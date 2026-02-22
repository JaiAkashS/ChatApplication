const Message = require('../models/Message');
const { typingTimers, readReceipts } = require('../state');

const persistMessage = async ({ roomId, userId, username, type, text }) => {
    await Message.create({ roomId, userId, username, type, text });
};

const getRoomTypingMap = (roomId) => {
    if (!typingTimers.has(roomId)) {
        typingTimers.set(roomId, new Map());
    }
    return typingTimers.get(roomId);
};

const stopTypingForUser = (roomId, userId) => {
    const roomTyping = typingTimers.get(roomId);
    if (!roomTyping) return;
    const timer = roomTyping.get(userId.toString());
    if (timer) {
        clearTimeout(timer);
        roomTyping.delete(userId.toString());
    }
    if (roomTyping.size === 0) {
        typingTimers.delete(roomId);
    }
};

const scheduleTypingTimeout = (roomId, userId, onTimeout) => {
    const roomTyping = getRoomTypingMap(roomId);
    const key = userId.toString();
    if (roomTyping.has(key)) {
        clearTimeout(roomTyping.get(key));
    }
    const timeoutId = setTimeout(() => {
        roomTyping.delete(key);
        if (roomTyping.size === 0) {
            typingTimers.delete(roomId);
        }
        onTimeout();
    }, 4000);

    roomTyping.set(key, timeoutId);
};

const updateReadReceipt = (roomId, userId) => {
    if (!readReceipts.has(roomId)) {
        readReceipts.set(roomId, new Map());
    }
    readReceipts.get(roomId).set(userId.toString(), Date.now());
};

module.exports = {
    persistMessage,
    getRoomTypingMap,
    stopTypingForUser,
    scheduleTypingTimeout,
    updateReadReceipt,
};
