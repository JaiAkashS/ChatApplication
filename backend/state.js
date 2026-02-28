const rooms = new Map();
const socketMeta = new Map();
const typingTimers = new Map();
const readReceipts = new Map();
// Track online users: userId -> Set of socket connections
const onlineUsers = new Map();

module.exports = {
    rooms,
    socketMeta,
    typingTimers,
    readReceipts,
    onlineUsers,
};
