const express = require('express');

const User = require('../models/User');
const { getAuthTokenFromRequest, resolveAuthenticatedIdentity } = require('../auth');
const { normalizeNonEmptyString } = require('../utils/strings');
const { onlineUsers } = require('../state');

const router = express.Router();

// Get user profile by username
router.get('/users/:username', async (req, res) => {
    try {
        const token = getAuthTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ error: 'missing session token' });
        }

        const identity = await resolveAuthenticatedIdentity(token);
        if (!identity) {
            return res.status(401).json({ error: 'invalid or expired session' });
        }

        const username = normalizeNonEmptyString(req.params.username);
        if (!username) {
            return res.status(400).json({ error: 'username is required' });
        }

        const user = await User.findOne({ username }).lean();
        if (!user) {
            return res.status(404).json({ error: 'user not found' });
        }

        const isOnline = onlineUsers.has(user._id.toString());
        const isSelf = user._id.toString() === identity.userId.toString();
        const isFriend = user.friends?.some((f) => f.toString() === identity.userId.toString());

        return res.status(200).json({
            user: {
                id: user._id,
                username: user.username,
                usernameColor: user.usernameColor || '#dcddde',
                profilePicture: user.profilePicture || null,
                bio: user.bio || '',
                status: isOnline ? (user.status || 'online') : 'offline',
                customStatus: user.customStatus || '',
                createdAt: user.createdAt,
                isFriend,
                isSelf,
            },
        });
    } catch (error) {
        console.error('Get user profile error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

// Update own profile (bio, customStatus)
router.patch('/users/me/profile', async (req, res) => {
    try {
        const token = getAuthTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ error: 'missing session token' });
        }

        const identity = await resolveAuthenticatedIdentity(token);
        if (!identity) {
            return res.status(401).json({ error: 'invalid or expired session' });
        }

        const updates = {};

        if (req.body?.bio !== undefined) {
            const bio = typeof req.body.bio === 'string' ? req.body.bio.trim().slice(0, 200) : '';
            updates.bio = bio;
        }

        if (req.body?.customStatus !== undefined) {
            const customStatus = typeof req.body.customStatus === 'string' ? req.body.customStatus.trim().slice(0, 50) : '';
            updates.customStatus = customStatus;
        }

        if (req.body?.status !== undefined) {
            const validStatuses = ['online', 'away', 'dnd', 'offline'];
            if (validStatuses.includes(req.body.status)) {
                updates.status = req.body.status;
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'no valid fields to update' });
        }

        const user = await User.findByIdAndUpdate(
            identity.userId,
            { $set: updates },
            { new: true }
        ).lean();

        if (!user) {
            return res.status(404).json({ error: 'user not found' });
        }

        return res.status(200).json({
            user: {
                id: user._id,
                username: user.username,
                bio: user.bio || '',
                status: user.status || 'online',
                customStatus: user.customStatus || '',
            },
        });
    } catch (error) {
        console.error('Update profile error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

// Get friends list
router.get('/friends', async (req, res) => {
    try {
        const token = getAuthTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ error: 'missing session token' });
        }

        const identity = await resolveAuthenticatedIdentity(token);
        if (!identity) {
            return res.status(401).json({ error: 'invalid or expired session' });
        }

        const user = await User.findById(identity.userId)
            .populate('friends', 'username usernameColor profilePicture status customStatus')
            .populate('friendRequests.from', 'username usernameColor profilePicture')
            .lean();

        if (!user) {
            return res.status(404).json({ error: 'user not found' });
        }

        const friends = (user.friends || []).map((friend) => ({
            id: friend._id,
            username: friend.username,
            usernameColor: friend.usernameColor || '#dcddde',
            profilePicture: friend.profilePicture || null,
            status: onlineUsers.has(friend._id.toString()) ? (friend.status || 'online') : 'offline',
            customStatus: friend.customStatus || '',
        }));

        const friendRequests = (user.friendRequests || []).map((request) => ({
            id: request.from._id,
            username: request.from.username,
            usernameColor: request.from.usernameColor || '#dcddde',
            profilePicture: request.from.profilePicture || null,
            createdAt: request.createdAt,
        }));

        return res.status(200).json({ friends, friendRequests });
    } catch (error) {
        console.error('Get friends error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

// Send friend request
router.post('/friends/request', async (req, res) => {
    try {
        const token = getAuthTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ error: 'missing session token' });
        }

        const identity = await resolveAuthenticatedIdentity(token);
        if (!identity) {
            return res.status(401).json({ error: 'invalid or expired session' });
        }

        const targetUsername = normalizeNonEmptyString(req.body?.username);
        if (!targetUsername) {
            return res.status(400).json({ error: 'username is required' });
        }

        if (targetUsername.toLowerCase() === identity.username.toLowerCase()) {
            return res.status(400).json({ error: 'cannot send friend request to yourself' });
        }

        const targetUser = await User.findOne({ username: targetUsername });
        if (!targetUser) {
            return res.status(404).json({ error: 'user not found' });
        }

        // Check if already friends
        if (targetUser.friends?.some((f) => f.toString() === identity.userId.toString())) {
            return res.status(400).json({ error: 'already friends' });
        }

        // Check if request already exists
        if (targetUser.friendRequests?.some((r) => r.from.toString() === identity.userId.toString())) {
            return res.status(400).json({ error: 'friend request already sent' });
        }

        // Check if target has sent a request to us (auto-accept)
        const currentUser = await User.findById(identity.userId);
        const existingRequest = currentUser.friendRequests?.find(
            (r) => r.from.toString() === targetUser._id.toString()
        );

        if (existingRequest) {
            // Auto-accept: add each other as friends
            await User.updateOne(
                { _id: identity.userId },
                {
                    $push: { friends: targetUser._id },
                    $pull: { friendRequests: { from: targetUser._id } },
                }
            );
            await User.updateOne(
                { _id: targetUser._id },
                { $push: { friends: identity.userId } }
            );

            return res.status(200).json({ ok: true, status: 'accepted' });
        }

        // Add friend request to target user
        await User.updateOne(
            { _id: targetUser._id },
            { $push: { friendRequests: { from: identity.userId } } }
        );

        return res.status(200).json({ ok: true, status: 'pending' });
    } catch (error) {
        console.error('Send friend request error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

// Accept friend request
router.post('/friends/accept', async (req, res) => {
    try {
        const token = getAuthTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ error: 'missing session token' });
        }

        const identity = await resolveAuthenticatedIdentity(token);
        if (!identity) {
            return res.status(401).json({ error: 'invalid or expired session' });
        }

        const fromUsername = normalizeNonEmptyString(req.body?.username);
        if (!fromUsername) {
            return res.status(400).json({ error: 'username is required' });
        }

        const fromUser = await User.findOne({ username: fromUsername });
        if (!fromUser) {
            return res.status(404).json({ error: 'user not found' });
        }

        const currentUser = await User.findById(identity.userId);
        const request = currentUser.friendRequests?.find(
            (r) => r.from.toString() === fromUser._id.toString()
        );

        if (!request) {
            return res.status(404).json({ error: 'friend request not found' });
        }

        // Add each other as friends
        await User.updateOne(
            { _id: identity.userId },
            {
                $push: { friends: fromUser._id },
                $pull: { friendRequests: { from: fromUser._id } },
            }
        );
        await User.updateOne(
            { _id: fromUser._id },
            { $push: { friends: identity.userId } }
        );

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Accept friend request error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

// Reject friend request
router.post('/friends/reject', async (req, res) => {
    try {
        const token = getAuthTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ error: 'missing session token' });
        }

        const identity = await resolveAuthenticatedIdentity(token);
        if (!identity) {
            return res.status(401).json({ error: 'invalid or expired session' });
        }

        const fromUsername = normalizeNonEmptyString(req.body?.username);
        if (!fromUsername) {
            return res.status(400).json({ error: 'username is required' });
        }

        const fromUser = await User.findOne({ username: fromUsername });
        if (!fromUser) {
            return res.status(404).json({ error: 'user not found' });
        }

        await User.updateOne(
            { _id: identity.userId },
            { $pull: { friendRequests: { from: fromUser._id } } }
        );

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Reject friend request error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

// Remove friend
router.delete('/friends/:username', async (req, res) => {
    try {
        const token = getAuthTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ error: 'missing session token' });
        }

        const identity = await resolveAuthenticatedIdentity(token);
        if (!identity) {
            return res.status(401).json({ error: 'invalid or expired session' });
        }

        const friendUsername = normalizeNonEmptyString(req.params.username);
        if (!friendUsername) {
            return res.status(400).json({ error: 'username is required' });
        }

        const friendUser = await User.findOne({ username: friendUsername });
        if (!friendUser) {
            return res.status(404).json({ error: 'user not found' });
        }

        // Remove from both users' friend lists
        await User.updateOne(
            { _id: identity.userId },
            { $pull: { friends: friendUser._id } }
        );
        await User.updateOne(
            { _id: friendUser._id },
            { $pull: { friends: identity.userId } }
        );

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Remove friend error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

// Store user's public key for E2E encryption
router.post('/users/me/public-key', async (req, res) => {
    try {
        const token = getAuthTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ error: 'missing session token' });
        }

        const identity = await resolveAuthenticatedIdentity(token);
        if (!identity) {
            return res.status(401).json({ error: 'invalid or expired session' });
        }

        const publicKey = normalizeNonEmptyString(req.body?.publicKey);
        if (!publicKey) {
            return res.status(400).json({ error: 'publicKey is required' });
        }

        // Basic validation - should be base64 encoded
        if (publicKey.length < 100 || publicKey.length > 2000) {
            return res.status(400).json({ error: 'invalid publicKey format' });
        }

        await User.updateOne(
            { _id: identity.userId },
            { $set: { publicKey } }
        );

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Store public key error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

// Get user's public key for E2E encryption
router.get('/users/:username/public-key', async (req, res) => {
    try {
        const token = getAuthTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ error: 'missing session token' });
        }

        const identity = await resolveAuthenticatedIdentity(token);
        if (!identity) {
            return res.status(401).json({ error: 'invalid or expired session' });
        }

        const username = normalizeNonEmptyString(req.params.username);
        if (!username) {
            return res.status(400).json({ error: 'username is required' });
        }

        const user = await User.findOne({ username }).select('publicKey username').lean();
        if (!user) {
            return res.status(404).json({ error: 'user not found' });
        }

        if (!user.publicKey) {
            return res.status(404).json({ error: 'user has no public key' });
        }

        return res.status(200).json({
            username: user.username,
            publicKey: user.publicKey,
        });
    } catch (error) {
        console.error('Get public key error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

// Get public keys for multiple users (for room encryption)
router.post('/users/public-keys', async (req, res) => {
    try {
        const token = getAuthTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ error: 'missing session token' });
        }

        const identity = await resolveAuthenticatedIdentity(token);
        if (!identity) {
            return res.status(401).json({ error: 'invalid or expired session' });
        }

        const usernames = req.body?.usernames;
        if (!Array.isArray(usernames) || usernames.length === 0) {
            return res.status(400).json({ error: 'usernames array is required' });
        }

        // Limit to 50 users at a time
        const limitedUsernames = usernames.slice(0, 50);

        const users = await User.find({
            username: { $in: limitedUsernames },
            publicKey: { $ne: null },
        }).select('username publicKey').lean();

        const keys = {};
        for (const user of users) {
            keys[user.username] = user.publicKey;
        }

        return res.status(200).json({ keys });
    } catch (error) {
        console.error('Get public keys error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

module.exports = router;
