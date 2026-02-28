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
const { rooms, onlineUsers } = require('../state');
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
                    logo: room.logo || null,
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

        // Get unique user IDs and fetch their customization data
        const userIds = [...new Set(messages.map((m) => m.userId.toString()))];
        const users = await User.find({ _id: { $in: userIds } }).lean();
        const userMap = new Map(users.map((u) => [u._id.toString(), u]));

        const ordered = messages.slice().reverse();
        const hasMore = messages.length === limit;

        return res.status(200).json({
            messages: ordered.map((message) => {
                const user = userMap.get(message.userId.toString());
                const result = {
                    id: message._id,
                    roomId: message.roomId,
                    username: message.username,
                    text: message.text,
                    type: message.type,
                    createdAt: message.createdAt,
                    usernameColor: user?.usernameColor || '#dcddde',
                    profilePicture: user?.profilePicture || null,
                };

                // Include E2E encryption fields if present
                if (message.isEncrypted) {
                    result.isEncrypted = true;
                    result.iv = message.iv;
                    result.encryptedKeys = message.encryptedKeys instanceof Map
                        ? Object.fromEntries(message.encryptedKeys)
                        : message.encryptedKeys;
                }

                return result;
            }),
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

        // Get unique user IDs and fetch their customization data
        const userIds = [...new Set(results.map((m) => m.userId.toString()))];
        const users = await User.find({ _id: { $in: userIds } }).lean();
        const userMap = new Map(users.map((u) => [u._id.toString(), u]));

        return res.status(200).json({
            results: results.map((message) => {
                const user = userMap.get(message.userId.toString());
                return {
                    roomId: message.roomId,
                    username: message.username,
                    text: message.text,
                    createdAt: message.createdAt,
                    usernameColor: user?.usernameColor || '#dcddde',
                    profilePicture: user?.profilePicture || null,
                };
            }),
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

// Update room settings (logo)
router.patch('/rooms/:roomId/settings', async (req, res) => {
    try {
        const token = getAuthTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ error: 'missing session token' });
        }

        const identity = await resolveAuthenticatedIdentity(token);
        if (!identity) {
            return res.status(401).json({ error: 'invalid or expired session' });
        }

        const { roomId } = req.params;
        if (!roomId) {
            return res.status(400).json({ error: 'roomId is required' });
        }

        const room = await Room.findOne({ roomId });
        if (!room) {
            return res.status(404).json({ error: 'room not found' });
        }

        // Only room owner can update settings
        if (room.createdBy?.toString() !== identity.userId.toString()) {
            return res.status(403).json({ error: 'only room owner can update settings' });
        }

        const updates = {};

        if (req.body?.logo !== undefined) {
            const logo = normalizeNonEmptyString(req.body.logo);
            if (logo === null || logo === '') {
                updates.logo = null;
            } else if (logo && (logo.startsWith('http://') || logo.startsWith('https://') || logo.startsWith('data:image/'))) {
                updates.logo = logo;
            }
        }

        if (req.body?.description !== undefined) {
            const description = typeof req.body.description === 'string'
                ? req.body.description.trim().slice(0, 500)
                : '';
            updates.description = description;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'no valid fields to update' });
        }

        updates.updatedAt = new Date();

        const updatedRoom = await Room.findOneAndUpdate(
            { roomId },
            { $set: updates },
            { new: true }
        );

        return res.status(200).json({
            room: {
                roomId: updatedRoom.roomId,
                type: updatedRoom.type,
                logo: updatedRoom.logo || null,
                description: updatedRoom.description || '',
            },
        });
    } catch (error) {
        console.error('Room settings update error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

// Get room members with online status
router.get('/rooms/:roomId/members', async (req, res) => {
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

        const room = await Room.findOne({ roomId }).lean();
        if (!room) {
            return res.status(404).json({ error: 'room not found' });
        }

        // Check access
        const isMember = room.members?.some((m) => m.toString() === identity.userId.toString());
        if (room.type !== 'public' && !isMember) {
            return res.status(403).json({ error: 'access denied' });
        }

        // Get members info
        const memberIds = room.members || [];
        const members = await User.find({ _id: { $in: memberIds } })
            .select('username usernameColor profilePicture status customStatus')
            .lean();

        const memberList = members.map((member) => ({
            id: member._id,
            username: member.username,
            usernameColor: member.usernameColor || '#dcddde',
            profilePicture: member.profilePicture || null,
            status: onlineUsers.has(member._id.toString()) ? (member.status || 'online') : 'offline',
            customStatus: member.customStatus || '',
            isOwner: room.owner && member._id.toString() === room.owner.toString(),
        }));

        // Sort: owner first, then online users, then alphabetically
        memberList.sort((a, b) => {
            if (a.isOwner && !b.isOwner) return -1;
            if (!a.isOwner && b.isOwner) return 1;
            const aOnline = a.status !== 'offline';
            const bOnline = b.status !== 'offline';
            if (aOnline && !bOnline) return -1;
            if (!aOnline && bOnline) return 1;
            return a.username.localeCompare(b.username);
        });

        return res.status(200).json({
            roomId,
            roomType: room.type,
            description: room.description || '',
            members: memberList,
        });
    } catch (error) {
        console.error('Get room members error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

module.exports = router;
