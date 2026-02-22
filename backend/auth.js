const crypto = require('crypto');

const Session = require('./models/Session');
const User = require('./models/User');
const { PORT } = require('./config');
const { normalizeNonEmptyString } = require('./utils/strings');

const createSessionToken = () => crypto.randomBytes(32).toString('hex');

const parseTokenFromRequest = (requestUrl) => {
    try {
        const parsed = new URL(requestUrl, `http://localhost:${PORT}`);
        const token = parsed.searchParams.get('token');
        return normalizeNonEmptyString(token);
    } catch {
        return null;
    }
};

const getAuthTokenFromRequest = (req) => {
    const authHeader = normalizeNonEmptyString(req.headers.authorization);
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        return normalizeNonEmptyString(authHeader.slice(7));
    }

    const legacyToken = normalizeNonEmptyString(req.headers['x-session-token']);
    if (legacyToken) return legacyToken;

    return normalizeNonEmptyString(req.query?.token);
};

const resolveAuthenticatedIdentity = async (token) => {
    const now = new Date();
    const session = await Session.findOne({ token }).lean();
    if (!session) return null;

    if (session.expiresAt <= now) {
        await Session.deleteOne({ _id: session._id });
        return null;
    }

    const user = await User.findById(session.userId).lean();
    if (!user) {
        await Session.deleteOne({ _id: session._id });
        return null;
    }

    return {
        userId: user._id,
        username: user.username,
    };
};

module.exports = {
    createSessionToken,
    parseTokenFromRequest,
    getAuthTokenFromRequest,
    resolveAuthenticatedIdentity,
};
