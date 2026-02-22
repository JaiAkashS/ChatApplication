const WebSocket = require('ws');

const sendEvent = (ws, type, payload) => {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, payload }));
    }
};

module.exports = { sendEvent };
