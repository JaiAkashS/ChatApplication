const WebSocket = require('ws');

const Room = require('./models/Room');
const { MESSAGE_TYPES } = require('./constants');
const { parseTokenFromRequest, resolveAuthenticatedIdentity } = require('./auth');
const { sendEvent } = require('./wsUtils');
const { rooms, socketMeta } = require('./state');
const { isPlainObject, normalizeNonEmptyString } = require('./utils/strings');
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
        return {
            type: MESSAGE_TYPES.JOIN_ROOM,
            payload: { roomId },
        };
    }

    if (parsed.type === MESSAGE_TYPES.SEND_MESSAGE) {
        const roomId = normalizeNonEmptyString(parsed.payload.roomId);
        const text = normalizeNonEmptyString(parsed.payload.text);
        if (!roomId || !text) return null;
        return {
            type: MESSAGE_TYPES.SEND_MESSAGE,
            payload: { roomId, text },
        };
    }

    if (parsed.type === MESSAGE_TYPES.TYPING) {
        const roomId = normalizeNonEmptyString(parsed.payload.roomId);
        const isTyping = typeof parsed.payload.isTyping === 'boolean' ? parsed.payload.isTyping : null;
        if (!roomId || isTyping === null) return null;
        return {
            type: MESSAGE_TYPES.TYPING,
            payload: { roomId, isTyping },
        };
    }

    if (parsed.type === MESSAGE_TYPES.READ_RECEIPT) {
        const roomId = normalizeNonEmptyString(parsed.payload.roomId);
        if (!roomId) return null;
        return {
            type: MESSAGE_TYPES.READ_RECEIPT,
            payload: { roomId },
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

            socketMeta.set(ws, {
                userId: identity.userId,
                username: identity.username,
                token,
                rooms: new Set(),
            });

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

                    sendEvent(ws, MESSAGE_TYPES.ACK, { text: `Joined room ${roomId}` });

                    const room = rooms.get(roomId);
                    const text = `${meta.username} joined ${roomId}`;
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
                    const { roomId, text } = message.payload;

                    if (!meta.rooms.has(roomId)) {
                        return;
                    }

                    const room = rooms.get(roomId);
                    if (!room) return;

                    await Room.updateOne({ roomId }, { $set: { updatedAt: new Date() } });

                    await persistMessage({
                        roomId,
                        userId: meta.userId,
                        username: meta.username,
                        type: MESSAGE_TYPES.ROOM_MESSAGE,
                        text,
                    });

                    const createdAt = new Date().toISOString();
                    for (const client of room) {
                        sendEvent(client, MESSAGE_TYPES.ROOM_MESSAGE, {
                            roomId,
                            text,
                            username: meta.username,
                            createdAt,
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
