# Chat Application

This project is a minimal real-time chat application with:
- A Node.js + Express + WebSocket backend (`../backend`)
- A React + Vite frontend (`chat-frontend`)
- MongoDB persistence via Mongoose

Authentication uses server-side sessions over HTTP (no JWT, no OAuth).

## Architecture Summary

- HTTP handles auth:
  - `POST /register`
  - `POST /login`
- `POST /login` returns an opaque `token` representing a persisted server-side session.
- WebSocket authenticates once at connection time using query token:
  - `ws://localhost:6969?token=SESSION_TOKEN`
- WebSocket message protocol remains unchanged:
  - `JOIN_ROOM`, `SEND_MESSAGE`
  - `ACK`, `ERR_ACK`, `SYSTEM`, `ROOM_MESSAGE`
- Server identity is authoritative:
  - usernames and user IDs come from session/user records, not client payloads.

Room types and visibility:
- Public: visible to everyone
- DM: visible to participants only
- Private group: visible to members only

## Backend Design (`../backend/server.js`)

### Database models

- `User` (`users` collection)
  - `_id`
  - `username` (unique)
  - `passwordHash`
  - `createdAt`

- `Session` (`sessions` collection)
  - `_id`
  - `token` (random opaque string)
  - `userId`
  - `createdAt`
  - `expiresAt`

- `Room` (`rooms` collection)
  - `_id`
  - `roomId` (unique)
  - `createdAt`
  - `updatedAt`

- `Message` (`messages` collection)
  - `_id`
  - `roomId`
  - `userId`
  - `username`
  - `type` (`SYSTEM` or `ROOM_MESSAGE`)
  - `text`
  - `createdAt`

### HTTP auth flow

1. Register (`POST /register`)
   - Validates `username` and `password`
   - Hashes password with `bcrypt`
   - Stores new user

2. Login (`POST /login`)
   - Validates credentials using `bcrypt.compare`
   - Creates session with random opaque token
   - Persists session with expiration
   - Returns `{ token, expiresAt, user }`

### WebSocket auth flow

1. Client connects with `?token=...`
2. Server validates token against `sessions`
3. Server rejects invalid/expired sessions
4. Server resolves user identity from `users`
5. Server sets socket metadata:
   - `{ userId, username, rooms: new Set() }`

### Room/message behavior

- `JOIN_ROOM`
  - Requires authenticated socket
  - Adds socket to in-memory room set
  - Upserts room in `rooms` collection
  - Broadcasts/persists `SYSTEM` join message

- `SEND_MESSAGE`
  - Requires socket already joined to room
  - Persists message in `messages`
  - Broadcasts `ROOM_MESSAGE` with server-authoritative username

- `close`
  - Broadcasts/persists `SYSTEM` leave messages
  - Removes socket from in-memory room state

## Frontend Design (`src/App.jsx`)

`App.jsx` coordinates authentication, WebSocket lifecycle, and chat state.

### Auth state

- `username`, `password` for auth form inputs
- `authLoading`, `authError` for request state
- `userSet` controls whether auth form or user display is shown
- `sessionTokenRef` stores session token in memory for WS usage

### Auth actions

- `registerUser()`
  - Calls `POST /register`
- `loginUser()`
  - Calls `POST /login`
  - Stores token in `sessionTokenRef`
  - Marks user authenticated
  - Preloads persisted rooms using `GET /rooms`
  - Opens WebSocket using tokenized URL

### Room creation

- Public room: create by name
- DM: create with a target username
- Private group: create with a name and member list

Room creation happens over HTTP (`POST /rooms`), and WebSocket only handles join/send.

### WebSocket lifecycle

- `connectWebSocket()`
  - Connects only when session token exists
  - Uses `ws://localhost:6969?token=...`
- `attemptReconnect()`
  - Exponential backoff reconnect
  - Reconnect only when token exists and component is mounted
- On reconnect success
  - Rejoins previously joined rooms

### Chat state

- `messages` stores incoming `SYSTEM` and `ROOM_MESSAGE` events
- `conversations` tracks room/dm list
- `activeRoom` and `unreadCounts` control display and badges
- `activeRoomRef` prevents stale closure issues in WS callbacks

## Component Responsibilities

- `ConnectionStatus.jsx`
  - Shows connection status (`connected`, `disconnected`, `reconnecting`, `connecting`, `error`)

- `UserSetup.jsx`
  - Auth form (username/password)
  - Register/Login actions
  - Auth error display

- `RoomControls.jsx`
  - Join room modal
  - Start DM modal

- `RoomList.jsx`
  - Conversation list
  - Active room selection
  - Unread badges

- `Messages.jsx`
  - Renders messages for current active room only

- `MessageInput.jsx`
  - Sends message on click or Enter

## WebSocket Protocol

### Client -> Server

- `JOIN_ROOM`
```json
{ "type": "JOIN_ROOM", "payload": { "roomId": "general" } }
```

- `SEND_MESSAGE`
```json
{ "type": "SEND_MESSAGE", "payload": { "roomId": "general", "text": "hello" } }
```

### Server -> Client

- `ACK`
```json
{ "type": "ACK", "payload": { "text": "Joined room general" } }
```

- `ERR_ACK`
```json
{ "type": "ERR_ACK", "payload": { "text": "Invalid message format" } }
```

- `SYSTEM`
```json
{ "type": "SYSTEM", "payload": { "roomId": "general", "text": "alice joined general" } }
```

- `ROOM_MESSAGE`
```json
{ "type": "ROOM_MESSAGE", "payload": { "roomId": "general", "text": "hello", "username": "alice" } }
```

## Running the App

### Prerequisites

- Node.js 18+
- MongoDB Atlas connection string set in `MONGO_URI`

### Backend

```bash
cd ../backend
npm install
npm run dev
```

Optional env vars:
- `MONGO_URI` (example: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/chat_app?retryWrites=true&w=majority`)
- `PORT` (default: `6969`)

### Frontend

```bash
npm install
npm run dev
```

Open Vite URL (usually `http://localhost:5173`).
