const express = require('express');

const Message = require('../models/Message');
const Room = require('../models/Room');
const { getAuthTokenFromRequest, resolveAuthenticatedIdentity } = require('../auth');
const { escapeRegExp, normalizeNonEmptyString } = require('../utils/strings');
const { canJoinRoom } = require('../services/rooms');

const router = express.Router();

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

module.exports = router;
