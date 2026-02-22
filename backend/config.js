require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chat_app';
const PORT = Number(process.env.PORT || 6969);
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const BCRYPT_ROUNDS = 10;

module.exports = {
    MONGO_URI,
    PORT,
    SESSION_TTL_MS,
    BCRYPT_ROUNDS,
};
