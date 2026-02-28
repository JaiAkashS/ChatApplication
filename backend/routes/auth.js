const express = require('express');
const bcrypt = require('bcrypt');

const User = require('../models/User');
const Session = require('../models/Session');
const { BCRYPT_ROUNDS, SESSION_TTL_MS } = require('../config');
const { normalizeNonEmptyString } = require('../utils/strings');
const { createSessionToken, getAuthTokenFromRequest } = require('../auth');
const { socketMeta } = require('../state');

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const username = normalizeNonEmptyString(req.body?.username);
        const password = normalizeNonEmptyString(req.body?.password);

        if (!username || !password) {
            return res.status(400).json({ error: 'username and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'password must be at least 6 characters' });
        }

        const existingUser = await User.findOne({ username }).lean();
        if (existingUser) {
            return res.status(409).json({ error: 'username already exists' });
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const user = await User.create({ username, passwordHash });

        return res.status(201).json({
            user: {
                id: user._id,
                username: user.username,
            },
        });
    } catch (error) {
        console.error('Register error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const username = normalizeNonEmptyString(req.body?.username);
        const password = normalizeNonEmptyString(req.body?.password);

        if (!username || !password) {
            return res.status(400).json({ error: 'username and password are required' });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ error: 'invalid credentials' });
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) {
            return res.status(401).json({ error: 'invalid credentials' });
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
        const token = createSessionToken();

        const session = await Session.create({
            token,
            userId: user._id,
            createdAt: now,
            expiresAt,
        });

        return res.status(200).json({
            token: session.token,
            expiresAt: session.expiresAt,
            user: {
                id: user._id,
                username: user.username,
                usernameColor: user.usernameColor || '#dcddde',
                profilePicture: user.profilePicture || null,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

router.post('/logout', async (req, res) => {
    try {
        const token = getAuthTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ error: 'missing session token' });
        }

        await Session.deleteOne({ token });

        for (const [socket, meta] of socketMeta.entries()) {
            if (meta?.token === token) {
                socket.close(1008, 'Session revoked');
            }
        }

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

router.post('/logout-everywhere', async (req, res) => {
    try {
        const token = getAuthTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ error: 'missing session token' });
        }

        // Get the current session to find userId
        const currentSession = await Session.findOne({ token, expiresAt: { $gt: new Date() } });
        if (!currentSession) {
            return res.status(401).json({ error: 'invalid or expired session' });
        }

        const userId = currentSession.userId;

        // Get all session tokens for this user before deleting
        const userSessions = await Session.find({ userId }).lean();
        const sessionTokens = new Set(userSessions.map((s) => s.token));

        // Delete all sessions for this user
        const deleteResult = await Session.deleteMany({ userId });

        // Disconnect all active sockets for this user's sessions
        let disconnectedCount = 0;
        for (const [socket, meta] of socketMeta.entries()) {
            if (meta?.token && sessionTokens.has(meta.token)) {
                socket.close(1008, 'All sessions revoked');
                disconnectedCount++;
            }
        }

        return res.status(200).json({
            ok: true,
            sessionsRevoked: deleteResult.deletedCount,
            socketsDisconnected: disconnectedCount,
        });
    } catch (error) {
        console.error('Logout everywhere error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

router.patch('/profile', async (req, res) => {
    try {
        const token = getAuthTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ error: 'missing session token' });
        }

        const session = await Session.findOne({ token, expiresAt: { $gt: new Date() } });
        if (!session) {
            return res.status(401).json({ error: 'invalid or expired session' });
        }

        const updates = {};

        if (req.body?.usernameColor !== undefined) {
            const color = normalizeNonEmptyString(req.body.usernameColor);
            if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
                updates.usernameColor = color;
            }
        }

        if (req.body?.profilePicture !== undefined) {
            const pfp = normalizeNonEmptyString(req.body.profilePicture);
            if (pfp === null || pfp === '') {
                updates.profilePicture = null;
            } else if (pfp && (pfp.startsWith('http://') || pfp.startsWith('https://') || pfp.startsWith('data:image/'))) {
                updates.profilePicture = pfp;
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'no valid fields to update' });
        }

        const user = await User.findByIdAndUpdate(
            session.userId,
            { $set: updates },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ error: 'user not found' });
        }

        return res.status(200).json({
            user: {
                id: user._id,
                username: user.username,
                usernameColor: user.usernameColor || '#dcddde',
                profilePicture: user.profilePicture || null,
            },
        });
    } catch (error) {
        console.error('Profile update error:', error);
        return res.status(500).json({ error: 'internal server error' });
    }
});

module.exports = router;
