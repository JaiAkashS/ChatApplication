const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    passwordHash: {
        type: String,
        required: true,
    },
    usernameColor: {
        type: String,
        default: '#dcddde',
        trim: true,
    },
    profilePicture: {
        type: String,
        default: null,
        trim: true,
    },
    bio: {
        type: String,
        default: '',
        trim: true,
        maxlength: 200,
    },
    status: {
        type: String,
        enum: ['online', 'away', 'dnd', 'offline'],
        default: 'offline',
    },
    customStatus: {
        type: String,
        default: '',
        trim: true,
        maxlength: 50,
    },
    friends: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    friendRequests: [{
        from: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    }],
    publicKey: {
        type: String,
        default: null,
        trim: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, {
    collection: 'users',
});

module.exports = mongoose.model('User', userSchema);
