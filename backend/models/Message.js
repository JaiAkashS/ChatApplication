const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
        index: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    username: {
        type: String,
        required: true,
        trim: true,
    },
    type: {
        type: String,
        enum: ['SYSTEM', 'ROOM_MESSAGE'],
        required: true,
    },
    text: {
        type: String,
        required: true,
        trim: true,
    },
    isEncrypted: {
        type: Boolean,
        default: false,
    },
    iv: {
        type: String,
        default: null,
    },
    encryptedKeys: {
        // Maps username to their encrypted symmetric key
        type: Map,
        of: String,
        default: null,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
}, {
    collection: 'messages',
});

module.exports = mongoose.model('Message', messageSchema);
