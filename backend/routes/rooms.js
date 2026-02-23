const express = require('express');
const mongoose = require('mongoose');

const Room = require('../models/Room');
const User = require('../models/User');
const Message = require('../models/Message');
const { MESSAGE_TYPES } = require('../constants');
const { getAuthTokenFromRequest, resolveAuthenticatedIdentity } = require('../auth');
const { escapeRegExp, normalizeNonEmptyString } = require('../utils/strings');
const {
    normalizeRoomType,
    resolveUserIdsByUsernames,
    createRoomRecord,
    canJoinRoom,
    removeUserFromRoom,
    buildMemberObjectIds,
} = require('../services/rooms');
const { persistMessage } = require('../services/messages');
const { rooms } = require('../state');
const { sendEvent } = require('../wsUtils');

const router = express.Router();

router.get('/rooms', async (req, res) => {
    try {
        const token = getAuthTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ error: 'missing session token' });
        }

        const identity = await resolveAuthenticatedIdentity(token);
        if (!identity) {
            return res.status(401).json({ error: 'invalid or expired session' });
        }

        const roomsList = await Room.find({
            $or: [
                { type: 'public' },
                { members: identity.userId },
            ],
        })
            .sort({ updatedAt: -1 })
            .lean();

        const memberIds = new Set();
        roomsList.forEach((room) => {
            if (room.type === 'dm' || room.type === 'private') {
                (room.members || []).forEach((memberId) => memberIds.add(memberId.toString()));
            }
        });

        const memberUsers = await User.find({ _id: { $in: [...memberIds] } }).lean();
        const memberMap = new Map(memberUsers.map((user) => [user._id.toString(), user.username]));

        return res.status(200).json({
            rooms: roomsList.map((room) => {
                const memberNames = (room.members || [])
                    .map((memberId) => memberMap.get(memberId.toString()))
                    .filter(Boolean);
                const isOwner = room.createdBy?.toString() === identity.userId.toString();
                return {
                    roomId: room.roomId,
                    type: room.type,
                    members: memberNames,
                    updatedAt: room.updatedAt,
                    inviteCode: (room.type === 'private' && isOwner) ? room.inviteCode : undefined,
                    isOwner,
                };
            }),
        });
    } catch (error) {
        console.error('Rooms error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

router.post('/rooms', async (req, res) => {
    try {
        const token = getAuthTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ error: 'missing session token' });
        }

        const identity = await resolveAuthenticatedIdentity(token);
        if (!identity) {
            return res.status(401).json({ error: 'invalid or expired session' });
        }

        const roomId = normalizeNonEmptyString(req.body?.roomId);
        const type = normalizeRoomType(req.body?.type) || 'public';
        const memberUsernames = Array.isArray(req.body?.members) ? req.body.members : [];

        if (!roomId) {
            return res.status(400).json({ error: 'roomId is required' });
        }

        let members = [];
        if (type === 'dm' || type === 'private') {
            const resolvedMemberIds = await resolveUserIdsByUsernames(memberUsernames);
            const userIdSet = new Set(resolvedMemberIds.map((id) => id.toString()));
            userIdSet.add(identity.userId.toString());
            members = buildMemberObjectIds([...userIdSet]);

            if (type === 'dm' && members.length !== 2) {
                return res.status(400).json({ error: 'dm rooms require exactly two participants' });
            }
        }

        const existingRoom = await Room.findOne({ roomId }).lean();
        if (existingRoom) {
            if (existingRoom.type !== type) {
                return res.status(409).json({ error: 'room type mismatch' });
            }
            if (!canJoinRoom(existingRoom, identity.userId)) {
                return res.status(403).json({ error: 'access denied' });
            }

            return res.status(200).json({
                room: {
                    roomId: existingRoom.roomId,
                    type: existingRoom.type,
                    inviteCode: existingRoom.inviteCode || null,
                },
            });
        }

        const room = await createRoomRecord({
            roomId,
            type,
            members,
            createdBy: identity.userId,
        });

        return res.status(201).json({
            room: {
                roomId: room.roomId,
                type: room.type,
                inviteCode: room.inviteCode || null,
            },
        });
    } catch (error) {
        console.error('Create room error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

// Join a private room using invite code
router.post('/rooms/join-by-invite', async (req, res) => {
    try {
        const token = getAuthTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ error: 'missing session token' });
        }

        const identity = await resolveAuthenticatedIdentity(token);
        if (!identity) {
            return res.status(401).json({ error: 'invalid or expired session' });
        }

        const inviteCode = normalizeNonEmptyString(req.body?.inviteCode);
        if (!inviteCode) {
            return res.status(400).json({ error: 'inviteCode is required' });
        }

        const room = await Room.findOne({ inviteCode });
        if (!room) {
            return res.status(404).json({ error: 'invalid invite code' });
        }

        if (room.type !== 'private') {
            return res.status(400).json({ error: 'invite codes are only for private rooms' });
        }

        // Check if user is banned
        if (room.bannedMembers?.some((id) => id.toString() === identity.userId.toString())) {
            return res.status(403).json({ error: 'you are banned from this room' });
        }

        // Check if already a member
        const isMember = room.members?.some((id) => id.toString() === identity.userId.toString());
        if (!isMember) {
            room.members.push(identity.userId);
            room.updatedAt = new Date();
            await room.save();
        }

        return res.status(200).json({
            room: {
                roomId: room.roomId,
                type: room.type,
            },
        });
    } catch (error) {
        console.error('Join by invite error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

router.get('/rooms/:roomId/messages', async (req, res) => {
    try {
        const token = getAuthTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ error: 'missing session token' });
        }

        const identity = await resolveAuthenticatedIdentity(token);
        if (!identity) {
            return res.status(401).json({ error: 'invalid or expired session' });
        }

        const roomId = normalizeNonEmptyString(req.params.roomId);
        if (!roomId) {
            return res.status(400).json({ error: 'roomId is required' });
        }

        const roomRecord = await Room.findOne({ roomId }).lean();
        if (!roomRecord) {
            return res.status(404).json({ error: 'room not found' });
        }

        if (!canJoinRoom(roomRecord, identity.userId)) {
            return res.status(403).json({ error: 'access denied' });
        }

        const limitValue = Number(req.query?.limit || 50);
        const limit = Number.isFinite(limitValue) ? Math.min(Math.max(limitValue, 1), 100) : 50;

        const beforeParam = normalizeNonEmptyString(req.query?.before);
        const before = beforeParam && !Number.isNaN(Number(beforeParam))
            ? new Date(Number(beforeParam))
            : beforeParam
                ? new Date(beforeParam)
                : null;

        const filter = { roomId };
        if (before && !Number.isNaN(before.getTime())) {
            filter.createdAt = { $lt: before };
        }

        const messages = await Message.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        const ordered = messages.slice().reverse();
        const hasMore = messages.length === limit;

        return res.status(200).json({
            messages: ordered.map((message) => ({
                id: message._id,
                roomId: message.roomId,
                username: message.username,
                text: message.text,
                type: message.type,
                createdAt: message.createdAt,
            })),
            hasMore,
        });
    } catch (error) {
        console.error('Message history error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

router.get('/search', async (req, res) => {
    try {
        const token = getAuthTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ error: 'missing session token' });
        }

        const identity = await resolveAuthenticatedIdentity(token);
        if (!identity) {
            return res.status(401).json({ error: 'invalid or expired session' });
        }

        const roomId = normalizeNonEmptyString(req.query?.roomId);
        const username = normalizeNonEmptyString(req.query?.username);
        const query = normalizeNonEmptyString(req.query?.q);

        if (!roomId && !username && !query) {
            return res.status(400).json({ error: 'roomId, username, or q is required' });
        }

        let accessibleRoomIds = [];
        if (roomId) {
            const room = await Room.findOne({ roomId }).lean();
            if (!room) {
                return res.status(404).json({ error: 'room not found' });
            }
            if (!canJoinRoom(room, identity.userId)) {
                return res.status(403).json({ error: 'access denied' });
            }
            accessibleRoomIds = [roomId];
        } else {
            const roomsList = await Room.find({
                $or: [
                    { type: 'public' },
                    { members: identity.userId },
                ],
            }).lean();
            accessibleRoomIds = roomsList.map((room) => room.roomId);
        }

        if (accessibleRoomIds.length === 0) {
            return res.status(200).json({ results: [] });
        }

        const filter = {
            roomId: { $in: accessibleRoomIds },
        };

        if (username) {
            filter.username = new RegExp(`^${escapeRegExp(username)}$`, 'i');
        }

        if (query) {
            filter.text = new RegExp(escapeRegExp(query), 'i');
        }

        const results = await Message.find(filter)
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        return res.status(200).json({
            results: results.map((message) => ({
                roomId: message.roomId,
                username: message.username,
                text: message.text,
                createdAt: message.createdAt,
            })),
        });
    } catch (error) {
        console.error('Search error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

router.post('/rooms/:roomId/kick', async (req, res) => {
    try {
        const token = getAuthTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ error: 'missing session token' });
        }

        const identity = await resolveAuthenticatedIdentity(token);
        if (!identity) {
            return res.status(401).json({ error: 'invalid or expired session' });
        }

        const roomId = normalizeNonEmptyString(req.params.roomId);
        const targetUsername = normalizeNonEmptyString(req.body?.username);
        if (!roomId || !targetUsername) {
            return res.status(400).json({ error: 'roomId and username are required' });
        }

        const room = await Room.findOne({ roomId });
        if (!room) {
            return res.status(404).json({ error: 'room not found' });
        }

        if (room.type !== 'private') {
            return res.status(400).json({ error: 'kick is only available for private groups' });
        }

        if (!room.createdBy || room.createdBy.toString() !== identity.userId.toString()) {
            return res.status(403).json({ error: 'only the room owner can kick members' });
        }

        const targetUser = await User.findOne({ username: targetUsername });
        if (!targetUser) {
            return res.status(404).json({ error: 'user not found' });
        }

        if (targetUser._id.toString() === identity.userId.toString()) {
            return res.status(400).json({ error: 'cannot kick yourself' });
        }

        await Room.updateOne({ roomId }, { $pull: { members: targetUser._id } });
        removeUserFromRoom(roomId, targetUser._id);

        const text = `${targetUsername} was removed by ${identity.username}`;
        await persistMessage({
            roomId,
            userId: identity.userId,
            username: identity.username,
            type: MESSAGE_TYPES.SYSTEM,
            text,
        });

        const roomSockets = rooms.get(roomId);
        if (roomSockets) {
            for (const client of roomSockets) {
                sendEvent(client, MESSAGE_TYPES.SYSTEM, { roomId, text });
            }
        }

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Kick error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

router.post('/rooms/:roomId/ban', async (req, res) => {
    try {
        const token = getAuthTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ error: 'missing session token' });
        }

        const identity = await resolveAuthenticatedIdentity(token);
        if (!identity) {
            return res.status(401).json({ error: 'invalid or expired session' });
        }

        const roomId = normalizeNonEmptyString(req.params.roomId);
        const targetUsername = normalizeNonEmptyString(req.body?.username);
        if (!roomId || !targetUsername) {
            return res.status(400).json({ error: 'roomId and username are required' });
        }

        const room = await Room.findOne({ roomId });
        if (!room) {
            return res.status(404).json({ error: 'room not found' });
        }

        if (room.type !== 'private') {
            return res.status(400).json({ error: 'ban is only available for private groups' });
        }

        if (!room.createdBy || room.createdBy.toString() !== identity.userId.toString()) {
            return res.status(403).json({ error: 'only the room owner can ban members' });
        }

        const targetUser = await User.findOne({ username: targetUsername });
        if (!targetUser) {
            return res.status(404).json({ error: 'user not found' });
        }

        if (targetUser._id.toString() === identity.userId.toString()) {
            return res.status(400).json({ error: 'cannot ban yourself' });
        }

        await Room.updateOne(
            { roomId },
            {
                $addToSet: { bannedMembers: targetUser._id },
                $pull: { members: targetUser._id },
            }
        );
        removeUserFromRoom(roomId, targetUser._id);

        const text = `${targetUsername} was banned by ${identity.username}`;
        await persistMessage({
            roomId,
            userId: identity.userId,
            username: identity.username,
            type: MESSAGE_TYPES.SYSTEM,
            text,
        });

        const roomSockets = rooms.get(roomId);
        if (roomSockets) {
            for (const client of roomSockets) {
                sendEvent(client, MESSAGE_TYPES.SYSTEM, { roomId, text });
            }
        }

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Ban error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

module.exports = router;
