const mongoose = require('mongoose');

const User = require('../models/User');
const Room = require('../models/Room');
const { rooms, socketMeta } = require('../state');
const { normalizeNonEmptyString } = require('../utils/strings');

const normalizeRoomType = (value) => {
    if (value === 'public' || value === 'dm' || value === 'private') {
        return value;
    }
    return null;
};

const resolveUserIdsByUsernames = async (usernames) => {
    const normalized = [...new Set(usernames.map(normalizeNonEmptyString).filter(Boolean))];
    if (normalized.length === 0) return [];

    const users = await User.find({ username: { $in: normalized } }).lean();
    const userIdMap = new Map(users.map((user) => [user.username, user._id]));
    return normalized.map((name) => userIdMap.get(name)).filter(Boolean);
};

const createRoomRecord = async ({ roomId, type, members, createdBy }) => {
    const now = new Date();
    const room = await Room.findOne({ roomId });
    if (room) {
        return room;
    }

    return Room.create({
        roomId,
        type,
        members,
        createdBy,
        createdAt: now,
        updatedAt: now,
    });
};

const canJoinRoom = (room, userId) => {
    if (!room) return false;
    if (room.type === 'public') return true;
    if (room.bannedMembers?.some((memberId) => memberId.toString() === userId.toString())) {
        return false;
    }
    return room.members?.some((memberId) => memberId.toString() === userId.toString());
};

const removeUserFromRoom = (roomId, userId) => {
    const room = rooms.get(roomId);
    if (!room) return;

    for (const client of room) {
        const meta = socketMeta.get(client);
        if (!meta) continue;
        if (meta.userId.toString() === userId.toString()) {
            meta.rooms.delete(roomId);
            room.delete(client);
        }
    }

    if (room.size === 0) {
        rooms.delete(roomId);
    }
};

const buildMemberObjectIds = (userIds) => userIds.map((id) => new mongoose.Types.ObjectId(id));

module.exports = {
    normalizeRoomType,
    resolveUserIdsByUsernames,
    createRoomRecord,
    canJoinRoom,
    removeUserFromRoom,
    buildMemberObjectIds,
};
