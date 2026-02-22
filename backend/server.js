const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');

const { MONGO_URI, PORT } = require('./config');
const authRoutes = require('./routes/auth');
const roomsRoutes = require('./routes/rooms');
const searchRoutes = require('./routes/search');
const { setupWebSocket } = require('./ws');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
    res.send('OK');
});

app.get('/health', (_req, res) => {
    res.send('OK');
});

app.use(authRoutes);
app.use(roomsRoutes);
app.use(searchRoutes);

const httpServer = http.createServer(app);
setupWebSocket(httpServer);

const start = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        httpServer.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

start();
