# Features Explained (Beginner Friendly)

This file explains each feature in simple language.

---

## 1) Authentication (Register, Login, Logout)
- **What this feature does:** lets users create account, sign in, and sign out.
- **Why this exists:** prevents identity spoofing and protects private data.
- **How it works:** register stores hashed password; login creates session token; logout revokes token.
- **Technologies:** React, Express, MongoDB/Mongoose, bcrypt.
- **Where logic lives:** client (forms), server (validation/session), database (`users`, `sessions`).
- **Example:** user logs in, chats, logs out, session no longer works.
- **Interview (2–3 lines):** “I used server-side sessions, not JWT. Login creates an opaque token stored in MongoDB, and logout revokes it. Passwords are hashed with bcrypt.”
- **Minimal code syntax:**
```js
app.post('/login', async (req, res) => {
  const token = createSessionToken();
  await Session.create({ token, userId, expiresAt });
  res.json({ token });
});
```

## 2) Session Token in localStorage
- **What this feature does:** keeps user signed in after refresh.
- **Why this exists:** avoids repeated login on every page reload.
- **How it works:** save token after login; restore on app load; remove on logout.
- **Technologies:** React, browser localStorage.
- **Where logic lives:** client only.
- **Example:** refresh browser and stay logged in.
- **Interview:** “I persisted the session token in localStorage for better UX. App startup restores token and reconnects; logout clears token and socket.”
- **Minimal code syntax:**
```js
localStorage.setItem('chat.sessionToken', token);
const token = localStorage.getItem('chat.sessionToken');
localStorage.removeItem('chat.sessionToken');
```

## 3) WebSocket Connection with Session Authentication
- **What this feature does:** enables instant real-time messaging.
- **Why this exists:** real-time chat is faster than polling.
- **How it works:** client connects with token query; server validates once and attaches identity.
- **Technologies:** WebSocket (`ws`), Express/Node, MongoDB sessions.
- **Where logic lives:** client (open socket), server (auth/metadata), database (session lookup).
- **Example:** expired token causes socket rejection.
- **Interview:** “WS auth reuses HTTP session token. Server resolves user identity on connect and never trusts client identity fields.”
- **Minimal code syntax:**
```js
const ws = new WebSocket(`ws://localhost:6969?token=${token}`);
const identity = await resolveAuthenticatedIdentity(token);
if (!identity) ws.close(1008, 'Unauthorized');
```

## 4) Reconnection Technique
- **What this feature does:** auto-reconnects after connection drops.
- **Why this exists:** temporary network issues should not break chat.
- **How it works:** retry with exponential backoff and rejoin previous rooms.
- **Technologies:** React refs/state, browser WebSocket.
- **Where logic lives:** client.
- **Example:** Wi-Fi drops for 10 seconds, app reconnects automatically.
- **Interview:** “I used exponential backoff reconnect with one active timer. On reconnect, rooms are rejoined to restore live messaging quickly.”
- **Minimal code syntax:**
```js
const delay = Math.min(1000 * 2 ** attempts, 30000);
setTimeout(connectWebSocket, delay);
```

## 5) Room Types and Visibility
- **What this feature does:** supports `public`, `dm`, and `private` rooms.
- **Why this exists:** different conversations need different privacy.
- **How it works:** room metadata stores type/members; server checks membership before join.
- **Technologies:** React, Express, MongoDB/Mongoose.
- **Where logic lives:** client (create/select), server (rules), database (`rooms`).
- **Example:** private project room visible only to invited members.
- **Interview:** “Room privacy is modeled in DB and enforced server-side. Public is open, DM/private require membership checks.”
- **Minimal code syntax:**
```js
if (room.type === 'public') return true;
return room.members.some(id => id.toString() === userId.toString());
```

## 6) Real-Time Chat Messages
- **What this feature does:** sends and receives messages instantly in joined rooms.
- **Why this exists:** live conversation without refresh.
- **How it works:** client sends `SEND_MESSAGE`; server validates room membership and broadcasts.
- **Technologies:** WebSocket, Express/Node, MongoDB.
- **Where logic lives:** client (send/render), server (validate/broadcast), database (`messages`).
- **Example:** Alice sends “hello” in `general`, all members get it immediately.
- **Interview:** “Messages are event-driven via WebSocket and persisted in MongoDB. Server checks room membership before any broadcast.”
- **Minimal code syntax:**
```js
socket.send(JSON.stringify({
  type: 'SEND_MESSAGE',
  payload: { roomId, text }
}));
```

## 7) Message Timestamps
- **What this feature does:** shows when each message was sent.
- **Why this exists:** provides conversation time context.
- **How it works:** server includes `createdAt`; client formats and displays it.
- **Technologies:** MongoDB timestamps, WebSocket payload, React UI.
- **Where logic lives:** database + server (source time), client (display).
- **Example:** message shows `10:42 PM`.
- **Interview:** “I keep timestamps in DB and include them in real-time payloads so history and live messages stay consistent.”
- **Minimal code syntax:**
```js
sendEvent(client, 'ROOM_MESSAGE', {
  roomId, text, username, createdAt: new Date().toISOString()
});
```

## 8) Message History Pagination
- **What this feature does:** loads latest 50 first, then older messages.
- **Why this exists:** avoids heavy initial loads.
- **How it works:** endpoint supports `limit` and `before` cursor.
- **Technologies:** Express API, MongoDB sort/limit, React state.
- **Where logic lives:** server (query), client (load older button).
- **Example:** user clicks “Load older messages” to continue reading.
- **Interview:** “I implemented cursor-style pagination for chat history using `before` and `limit` for efficient scrolling.”
- **Minimal code syntax:**
```js
const messages = await Message.find({ roomId, createdAt: { $lt: before } })
  .sort({ createdAt: -1 })
  .limit(50);
```

## 9) Typing Indicators
- **What this feature does:** shows who is typing in current room.
- **Why this exists:** improves conversational feel.
- **How it works:** client emits typing on/off; server broadcasts and auto-clears stale typing.
- **Technologies:** WebSocket events, Node timers, React state.
- **Where logic lives:** client + server.
- **Example:** “Bob is typing...” appears and disappears after inactivity.
- **Interview:** “Typing is an ephemeral event, not persisted data. I broadcast per room and use timeout cleanup to prevent stale indicators.”
- **Minimal code syntax:**
```js
socket.send(JSON.stringify({
  type: 'TYPING',
  payload: { roomId, isTyping: true }
}));
```

## 10) Read Receipts (Per Room)
- **What this feature does:** shows who has seen messages in a room.
- **Why this exists:** helps teams confirm updates were read.
- **How it works:** client sends receipt when room is active; server broadcasts to room.
- **Technologies:** WebSocket events, React state.
- **Where logic lives:** client + server.
- **Example:** “Seen by Priya, Arun”.
- **Interview:** “I added room-level read receipts through lightweight WS events scoped to room members.”
- **Minimal code syntax:**
```js
socket.send(JSON.stringify({
  type: 'READ_RECEIPT',
  payload: { roomId }
}));
```

## 11) Search (Room, Username, Content)
- **What this feature does:** finds old messages by filters.
- **Why this exists:** quickly locate important past information.
- **How it works:** client sends filters; server checks access and returns matched messages.
- **Technologies:** Express endpoint, MongoDB query/regex, React UI.
- **Where logic lives:** client (form/results), server (filter/access), database (`messages`).
- **Example:** search `room=general, q=deadline`.
- **Interview:** “Search is server-side and access-controlled. I support room, username, and content filters while respecting room visibility.”
- **Minimal code syntax:**
```txt
GET /search?roomId=general&username=alice&q=deadline
```

## 12) Moderation (Kick / Ban for Private Groups)
- **What this feature does:** lets private-group owner kick/ban users.
- **Why this exists:** protects groups from abuse.
- **How it works:** server verifies owner and room type, then updates membership/ban list.
- **Technologies:** Express moderation APIs, MongoDB room membership, WebSocket system events.
- **Where logic lives:** server + database (core), client (controls).
- **Example:** owner bans spam user in private group.
- **Interview:** “Moderation is owner-only and private-group-only. Kick removes membership; ban also prevents future join.”
- **Minimal code syntax:**
```txt
POST /rooms/:roomId/kick
POST /rooms/:roomId/ban
Body: { "username": "targetUser" }
```

## 13) Connection Status / Presence Basics
- **What this feature does:** shows connected/reconnecting/disconnected/error status.
- **Why this exists:** users need feedback when sending may fail.
- **How it works:** client listens to socket lifecycle and updates status badge.
- **Technologies:** React state, WebSocket lifecycle.
- **Where logic lives:** client UI + socket handlers.
- **Example:** network drops → status changes to reconnecting.
- **Interview:** “I exposed connection state in UI to avoid silent failures and improve user trust during network interruptions.”
- **Minimal code syntax:**
```js
ws.onopen = () => setStatus('connected');
ws.onclose = () => setStatus('disconnected');
ws.onerror = () => setStatus('error');
```

---

## Quick Full-System Flow (Step by Step)
- User logs in over HTTP.
- Server creates session token.
- Client stores token and opens authenticated WebSocket.
- User joins room and sends messages.
- Server validates access, broadcasts events, and persists history.
- Client supports typing/read receipts/search/pagination/moderation.
