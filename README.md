# Chat Application

Real-time chat app with:
- HTTP authentication using server-side sessions (no JWT)
- WebSocket chat authenticated by session token at connection time
- MongoDB persistence

- Backend: `backend/`
- Frontend: `chat-frontend/`
- Detailed internals: `chat-frontend/README.md`

## Quick Start

### 0) Configure MongoDB Atlas
- Create a MongoDB Atlas cluster.
- Add your IP to the Atlas IP access list.
- Set `MONGO_URI` to your Atlas connection string.
  - Example: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/chat_app?retryWrites=true&w=majority`
- Create a backend `.env` file (see `backend/.env.example`).

### 1) Run backend
```bash
cd backend
npm install
npm run dev
```

### 2) Run frontend
```bash
cd chat-frontend
npm install
npm run dev
```

Open the Vite URL shown in terminal (usually `http://localhost:5173`).

## What each part does

- `backend/server.js`
  - Exposes HTTP auth endpoints: `POST /register`, `POST /login`.
  - Exposes `GET /rooms` to load persisted rooms after login.
  - Creates and validates server-side sessions in MongoDB.
  - Authenticates WebSocket using `?token=SESSION_TOKEN`.
  - Enforces server-authoritative identity for room/message events.
  - Enforces room visibility by type:
    - Public: everyone
    - DM: only participants
    - Private group: only members

- `chat-frontend/src/App.jsx`
  - Handles register/login over HTTP.
  - Uses returned session token for WebSocket URL.
  - Owns websocket lifecycle and reconnect behavior.
  - Manages active room, conversations, unread counts, and message list.
  - Parses incoming server events and builds outgoing client messages.

- `chat-frontend/src/components/*`
  - UI components for auth form, status, room controls/list, message list, and input.

## Protocol summary

Client sends:
- `JOIN_ROOM`
- `SEND_MESSAGE`

Server sends:
- `ACK`
- `ERR_ACK`
- `SYSTEM`
- `ROOM_MESSAGE`

## MongoDB Collections

The backend uses these collections:
- `users`
- `sessions`
- `rooms`
- `messages`

For payload shapes and complete flow details, see `chat-frontend/README.md`.
