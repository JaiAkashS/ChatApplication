const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    type: {
        type: String,
        enum: ['public', 'dm', 'private'],
        required: true,
        default: 'public',
    },
    description: {
        type: String,
        default: '',
        trim: true,
        maxlength: 500,
    },
    logo: {
        type: String,
        default: null,
        trim: true,
    },
    inviteCode: {
        type: String,
        unique: true,
        sparse: true,
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    bannedMembers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
}, {
    collection: 'rooms',
});

module.exports = mongoose.model('Room', roomSchema);
