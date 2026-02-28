const WebSocket = require('ws');

const Room = require('./models/Room');
const User = require('./models/User');
const { MESSAGE_TYPES } = require('./constants');
const { parseTokenFromRequest, resolveAuthenticatedIdentity } = require('./auth');
const { sendEvent } = require('./wsUtils');
const { rooms, socketMeta, onlineUsers } = require('./state');
const { isPlainObject, normalizeNonEmptyString } = require('./utils/strings');
const { sanitizeMessage, sanitizeRoomId } = require('./utils/sanitize');
const { canJoinRoom } = require('./services/rooms');
const {
    persistMessage,
    scheduleTypingTimeout,
    stopTypingForUser,
    updateReadReceipt,
} = require('./services/messages');

const parseClientMessage = (raw) => {
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }

    if (!isPlainObject(parsed) || typeof parsed.type !== 'string' || !isPlainObject(parsed.payload)) {
        return null;
    }

    if (parsed.type === MESSAGE_TYPES.JOIN_ROOM) {
        const roomId = normalizeNonEmptyString(parsed.payload.roomId);
        if (!roomId) return null;
        const sanitizedRoomId = sanitizeRoomId(roomId);
        if (!sanitizedRoomId) return null;
        return {
            type: MESSAGE_TYPES.JOIN_ROOM,
            payload: { roomId: sanitizedRoomId },
        };
    }

    if (parsed.type === MESSAGE_TYPES.SEND_MESSAGE) {
        const roomId = normalizeNonEmptyString(parsed.payload.roomId);
        const text = normalizeNonEmptyString(parsed.payload.text);
        if (!roomId || !text) return null;
        const sanitizedRoomId = sanitizeRoomId(roomId);
        if (!sanitizedRoomId) return null;

        // E2E encryption fields (optional)
        const isEncrypted = parsed.payload.isEncrypted === true;
        const iv = isEncrypted ? normalizeNonEmptyString(parsed.payload.iv) : null;
        const encryptedKeys = isEncrypted && isPlainObject(parsed.payload.encryptedKeys)
            ? parsed.payload.encryptedKeys
            : null;

        return {
            type: MESSAGE_TYPES.SEND_MESSAGE,
            payload: {
                roomId: sanitizedRoomId,
                text,
                isEncrypted,
                iv,
                encryptedKeys,
            },
        };
    }

    if (parsed.type === MESSAGE_TYPES.TYPING) {
        const roomId = normalizeNonEmptyString(parsed.payload.roomId);
        const isTyping = typeof parsed.payload.isTyping === 'boolean' ? parsed.payload.isTyping : null;
        if (!roomId || isTyping === null) return null;
        const sanitizedRoomId = sanitizeRoomId(roomId);
        if (!sanitizedRoomId) return null;
        return {
            type: MESSAGE_TYPES.TYPING,
            payload: { roomId: sanitizedRoomId, isTyping },
        };
    }

    if (parsed.type === MESSAGE_TYPES.READ_RECEIPT) {
        const roomId = normalizeNonEmptyString(parsed.payload.roomId);
        if (!roomId) return null;
        const sanitizedRoomId = sanitizeRoomId(roomId);
        if (!sanitizedRoomId) return null;
        return {
            type: MESSAGE_TYPES.READ_RECEIPT,
            payload: { roomId: sanitizedRoomId },
        };
    }

    return null;
};

const setupWebSocket = (server) => {
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws, request) => {
        (async () => {
            const token = parseTokenFromRequest(request.url || '');
            if (!token) {
                ws.close(1008, 'Unauthorized');
                return;
            }

            const identity = await resolveAuthenticatedIdentity(token);
            if (!identity) {
                ws.close(1008, 'Unauthorized');
                return;
            }

            // Fetch user customization data
            const userData = await User.findById(identity.userId).lean();
            const usernameColor = userData?.usernameColor || '#dcddde';
            const profilePicture = userData?.profilePicture || null;

            socketMeta.set(ws, {
                userId: identity.userId,
                username: identity.username,
                usernameColor,
                profilePicture,
                token,
                rooms: new Set(),
            });

            // Track online status
            const userIdStr = identity.userId.toString();
            if (!onlineUsers.has(userIdStr)) {
                onlineUsers.set(userIdStr, new Set());
                // First connection - set user online
                await User.updateOne({ _id: identity.userId }, { $set: { status: 'online' } });
            }
            onlineUsers.get(userIdStr).add(ws);

            ws.on('message', async (data) => {
                const meta = socketMeta.get(ws);
                if (!meta) return;

                const message = parseClientMessage(data.toString());
                if (!message) {
                    sendEvent(ws, MESSAGE_TYPES.ERR_ACK, { text: 'Invalid message format' });
                    return;
                }

                if (message.type === MESSAGE_TYPES.JOIN_ROOM) {
                    const { roomId } = message.payload;

                    const roomRecord = await Room.findOne({ roomId }).lean();
                    if (!roomRecord) {
                        sendEvent(ws, MESSAGE_TYPES.ERR_ACK, { text: 'Room does not exist' });
                        return;
                    }

                    if (!canJoinRoom(roomRecord, meta.userId)) {
                        sendEvent(ws, MESSAGE_TYPES.ERR_ACK, { text: 'Access denied' });
                        return;
                    }

                    if (!rooms.has(roomId)) {
                        rooms.set(roomId, new Set());
                    }

                    rooms.get(roomId).add(ws);
                    meta.rooms.add(roomId);
                    await Room.updateOne({ roomId }, { $set: { updatedAt: new Date() } });

                    const isDM = roomId.startsWith('dm:');
                    const displayRoom = isDM ? 'dm' : roomId;
                    sendEvent(ws, MESSAGE_TYPES.ACK, { text: `Joined room ${displayRoom}` });

                    const room = rooms.get(roomId);
                    const text = `${meta.username} joined ${displayRoom}`;
                    const createdAt = new Date().toISOString();
                    await persistMessage({
                        roomId,
                        userId: meta.userId,
                        username: meta.username,
                        type: MESSAGE_TYPES.SYSTEM,
                        text,
                    });

                    for (const client of room) {
                        sendEvent(client, MESSAGE_TYPES.SYSTEM, { roomId, text, createdAt });
                    }
                    return;
                }

                if (message.type === MESSAGE_TYPES.SEND_MESSAGE) {
                    const { roomId, text: rawText, isEncrypted, iv, encryptedKeys } = message.payload;

                    if (!meta.rooms.has(roomId)) {
                        return;
                    }

                    const room = rooms.get(roomId);
                    if (!room) return;

                    // For encrypted messages, store as-is (already encrypted client-side)
                    // For plain messages, sanitize to prevent XSS
                    const text = isEncrypted ? rawText : sanitizeMessage(rawText);
                    if (!text) {
                        sendEvent(ws, MESSAGE_TYPES.ERR_ACK, { text: 'Invalid message content' });
                        return;
                    }

                    await Room.updateOne({ roomId }, { $set: { updatedAt: new Date() } });

                    await persistMessage({
                        roomId,
                        userId: meta.userId,
                        username: meta.username,
                        type: MESSAGE_TYPES.ROOM_MESSAGE,
                        text,
                        isEncrypted,
                        iv,
                        encryptedKeys,
                    });

                    const createdAt = new Date().toISOString();
                    for (const client of room) {
                        sendEvent(client, MESSAGE_TYPES.ROOM_MESSAGE, {
                            roomId,
                            text,
                            username: meta.username,
                            usernameColor: meta.usernameColor || '#dcddde',
                            profilePicture: meta.profilePicture || null,
                            createdAt,
                            isEncrypted,
                            iv,
                            encryptedKeys,
                        });
                    }
                }

                if (message.type === MESSAGE_TYPES.TYPING) {
                    const { roomId, isTyping } = message.payload;

                    if (!meta.rooms.has(roomId)) {
                        return;
                    }

                    const room = rooms.get(roomId);
                    if (!room) return;

                    if (isTyping) {
                        scheduleTypingTimeout(roomId, meta.userId, () => {
                            for (const client of room) {
                                sendEvent(client, MESSAGE_TYPES.TYPING, {
                                    roomId,
                                    username: meta.username,
                                    isTyping: false,
                                });
                            }
                        });
                    } else {
                        stopTypingForUser(roomId, meta.userId);
                    }

                    for (const client of room) {
                        sendEvent(client, MESSAGE_TYPES.TYPING, {
                            roomId,
                            username: meta.username,
                            isTyping,
                        });
                    }
                }

                if (message.type === MESSAGE_TYPES.READ_RECEIPT) {
                    const { roomId } = message.payload;

                    if (!meta.rooms.has(roomId)) {
                        return;
                    }

                    const room = rooms.get(roomId);
                    if (!room) return;

                    updateReadReceipt(roomId, meta.userId);
                    const timestamp = Date.now();

                    for (const client of room) {
                        sendEvent(client, MESSAGE_TYPES.READ_RECEIPT, {
                            roomId,
                            username: meta.username,
                            timestamp,
                        });
                    }
                }
            });

            ws.on('close', async () => {
                const meta = socketMeta.get(ws);
                if (!meta) return;

                // Track online status
                const userIdStr = meta.userId.toString();
                const userSockets = onlineUsers.get(userIdStr);
                if (userSockets) {
                    userSockets.delete(ws);
                    if (userSockets.size === 0) {
                        onlineUsers.delete(userIdStr);
                        // Last connection closed - set user offline
                        await User.updateOne({ _id: meta.userId }, { $set: { status: 'offline' } });
                    }
                }

                for (const roomId of meta.rooms) {
                    const room = rooms.get(roomId);
                    if (!room) continue;

                    stopTypingForUser(roomId, meta.userId);
                    for (const client of room) {
                        sendEvent(client, MESSAGE_TYPES.TYPING, {
                            roomId,
                            username: meta.username,
                            isTyping: false,
                        });
                    }

                    const text = `${meta.username} left ${roomId}`;
                    const createdAt = new Date().toISOString();
                    await persistMessage({
                        roomId,
                        userId: meta.userId,
                        username: meta.username,
                        type: MESSAGE_TYPES.SYSTEM,
                        text,
                    });

                    for (const client of room) {
                        sendEvent(client, MESSAGE_TYPES.SYSTEM, { roomId, text, createdAt });
                    }

                    room.delete(ws);
                    if (room.size === 0) {
                        rooms.delete(roomId);
                    }
                }

                socketMeta.delete(ws);
            });
        })().catch((error) => {
            console.error('WS connection error:', error);
            ws.close(1011, 'Server error');
        });
    });
};

module.exports = { setupWebSocket };
