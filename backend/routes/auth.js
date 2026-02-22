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

module.exports = router;
