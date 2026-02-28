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

---

## 14) User Customization (Color & Profile Picture)
- **What this feature does:** lets users set a custom username color and profile picture.
- **Why this exists:** personalization makes chat more engaging and helps identify users visually.
- **How it works:** user settings modal allows color picker and image URL/upload; stored in user document; sent with every message.
- **Technologies:** React (color picker, image upload), Express PATCH endpoint, MongoDB user schema.
- **Where logic lives:** client (settings UI), server (update endpoint), database (`users.usernameColor`, `users.profilePicture`).
- **Example:** user sets purple color and avatar; all their messages display with that style.
- **Interview:** "I added per-user customization stored in MongoDB. The color and avatar are fetched during message history and included in real-time payloads for consistent display."
- **Minimal code syntax:**
```js
// PATCH /profile
await User.findByIdAndUpdate(userId, {
  usernameColor: '#7c3aed',
  profilePicture: 'data:image/png;base64,...'
});
```

## 15) Room Customization (Logo & Description)
- **What this feature does:** room owners can set a logo and description for their room.
- **Why this exists:** branding and context help users understand room purpose.
- **How it works:** room settings modal for owners; `logo` and `description` fields in Room schema; displayed in room list and member sidebar.
- **Technologies:** React modal, Express PATCH endpoint, MongoDB room schema.
- **Where logic lives:** client (settings UI), server (owner-only update), database (`rooms.logo`, `rooms.description`).
- **Example:** "Project Alpha" room has company logo and "Sprint planning discussions" description.
- **Interview:** "Room customization is owner-restricted. I added logo and description fields, and the member list sidebar shows the description for context."
- **Minimal code syntax:**
```js
// PATCH /rooms/:roomId/settings
if (room.createdBy !== userId) return 403;
await Room.findOneAndUpdate({ roomId }, {
  logo: '...', description: 'Sprint planning discussions'
});
```

## 16) Friend System (Add, Accept, Reject, Remove)
- **What this feature does:** users can send/accept/reject friend requests and see friends with online status.
- **Why this exists:** social features help users connect and quickly DM friends.
- **How it works:** `friends` array and `friendRequests` array in User schema; API endpoints handle request flow; friend list shows online/offline grouping.
- **Technologies:** React FriendList component, Express REST endpoints, MongoDB user relations.
- **Where logic lives:** client (friend list UI), server (request logic), database (`users.friends`, `users.friendRequests`).
- **Example:** Alice sends request to Bob; Bob accepts; both see each other in friend list with online status.
- **Interview:** "I built a mutual friend system with request/accept flow. If Alice requests Bob while Bob already requested Alice, it auto-accepts. Online status is tracked via WebSocket connections."
- **Minimal code syntax:**
```js
// POST /friends/request - auto-accept if mutual
if (currentUser.friendRequests.includes(targetUser._id)) {
  // Add each other as friends
  await User.updateOne({ _id: userId }, { $push: { friends: targetId } });
}
```

## 17) Online Status Tracking
- **What this feature does:** tracks which users are online/offline in real-time.
- **Why this exists:** helps users know if friends/members are available.
- **How it works:** `onlineUsers` Map tracks userId -> Set of sockets; on connect, add to set and set status 'online'; on last disconnect, set 'offline'.
- **Technologies:** Node.js Map, WebSocket lifecycle, MongoDB user status field.
- **Where logic lives:** server (state.js + ws.js), database (`users.status`).
- **Example:** Bob connects from phone and laptop; both disconnect; status changes to offline.
- **Interview:** "I track online status per-socket, supporting multiple connections. Database status updates only when first/last socket connects/disconnects."
- **Minimal code syntax:**
```js
// ws.js on connect
if (!onlineUsers.has(userId)) {
  onlineUsers.set(userId, new Set());
  await User.updateOne({ _id: userId }, { status: 'online' });
}
onlineUsers.get(userId).add(ws);
```

## 18) User Profiles (Bio, Status, Join Date)
- **What this feature does:** viewable user profiles with bio, custom status, and join date.
- **Why this exists:** provides context about who you're chatting with.
- **How it works:** `GET /users/:username` returns profile data; UserProfile modal displays it; click username to view.
- **Technologies:** React UserProfile component, Express endpoint, MongoDB user fields.
- **Where logic lives:** client (profile modal), server (fetch endpoint), database (`users.bio`, `users.customStatus`, `users.createdAt`).
- **Example:** click a username to see "Full-stack developer | Member since January 2024".
- **Interview:** "User profiles include bio (200 chars), custom status (50 chars), and join date. The endpoint also indicates if you're friends for showing friend/unfriend actions."
- **Minimal code syntax:**
```js
// GET /users/:username
const user = await User.findOne({ username });
return { username, bio, status, customStatus, createdAt, isFriend };
```

## 19) Member List Sidebar
- **What this feature does:** shows all members in the current room with online status.
- **Why this exists:** see who's in the room and who's available.
- **How it works:** `GET /rooms/:roomId/members` returns member list with status; MemberList component displays grouped by online/offline.
- **Technologies:** React MemberList component, Express endpoint, MongoDB room members.
- **Where logic lives:** client (sidebar), server (member lookup), database (`rooms.members`).
- **Example:** sidebar shows "Online — 3: Alice 👑, Bob, Charlie" and "Offline — 2: Dave, Eve".
- **Interview:** "The member sidebar fetches room members with their online status. Room owner gets a crown badge. Members are sorted: owner first, then online, then alphabetically."
- **Minimal code syntax:**
```js
// GET /rooms/:roomId/members
const members = await User.find({ _id: { $in: room.members } });
return members.map(m => ({
  username: m.username,
  status: onlineUsers.has(m._id) ? 'online' : 'offline',
  isOwner: m._id.equals(room.owner)
}));
```

## 20) Logout Everywhere (Session Invalidation)
- **What this feature does:** invalidates all active sessions for the user.
- **Why this exists:** security feature if account is compromised or logging out from shared devices.
- **How it works:** `POST /logout-everywhere` deletes all sessions for user except current (optional); client clears token.
- **Technologies:** Express endpoint, MongoDB session deletion.
- **Where logic lives:** server (session management), database (`sessions`).
- **Example:** user clicks "Logout Everywhere" → all other devices are signed out.
- **Interview:** "I added a bulk session invalidation endpoint. It deletes all session documents for the user from MongoDB, immediately revoking access on all devices."
- **Minimal code syntax:**
```js
// POST /logout-everywhere
await Session.deleteMany({ userId: identity.userId });
```

## 21) Input Sanitization (XSS Prevention)
- **What this feature does:** sanitizes all user input to prevent cross-site scripting attacks.
- **Why this exists:** security is critical; malicious scripts could hijack sessions or steal data.
- **How it works:** backend strips dangerous patterns (javascript:, event handlers, script tags); frontend escapes HTML for display.
- **Technologies:** Custom sanitize utilities (backend + frontend), regex patterns.
- **Where logic lives:** server (`utils/sanitize.js` - stripDangerousPatterns), client (`utils/sanitize.js` - escapeHtml, linkifyText).
- **Example:** user sends `<script>alert('xss')</script>` → stored and displayed as plain text.
- **Interview:** "I implemented defense-in-depth: backend strips dangerous patterns before storage, frontend escapes for display. URLs are safely converted to clickable links with proper escaping."
- **Minimal code syntax:**
```js
// Backend sanitization
const sanitizeMessage = (text) => {
  return text
    .replace(/<script\b[^<]*<\/script>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=/gi, '');
};

// Frontend display
const escapeHtml = (str) => str.replace(/[<>"'&]/g, char => htmlEntities[char]);
```

## 22) End-to-End Encryption (E2E)
- **What this feature does:** encrypts messages client-side so server cannot read content.
- **Why this exists:** privacy protection; even if server is compromised, messages stay private.
- **How it works:** users generate RSA key pair; public key stored on server; messages encrypted with AES-256-GCM; symmetric key encrypted per-recipient with their public key.
- **Technologies:** Web Crypto API (RSA-OAEP, AES-GCM, PBKDF2), React hooks, MongoDB fields.
- **Where logic lives:** client (encryption/decryption), server (stores encrypted data), database (`users.publicKey`, `messages.isEncrypted`, `messages.iv`, `messages.encryptedKeys`).
- **Example:** Alice sends encrypted message to Bob; only Bob's private key can decrypt it.
- **Interview:** "I implemented E2E encryption using Web Crypto API. Each message uses a random AES-256-GCM key, which is then RSA-encrypted for each recipient. Private keys are protected with password-derived keys using PBKDF2."
- **Minimal code syntax:**
```js
// Encrypt message
const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
const iv = crypto.getRandomValues(new Uint8Array(12));
const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext);

// Encrypt AES key for recipient
const encryptedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, recipientPublicKey, aesKey);
```

---

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│   React App     │────▶│  Express Server  │────▶│    MongoDB     │
│  (Vite + React) │◀────│  (Node.js + WS)  │◀────│   (Mongoose)   │
└─────────────────┘     └──────────────────┘     └────────────────┘
        │                       │
        │ WebSocket             │ REST API
        │ (real-time)           │ (auth, rooms, users)
        ▼                       ▼
   ┌─────────┐           ┌─────────────┐
   │ Messages│           │   Sessions  │
   │ Typing  │           │   Users     │
   │ Receipts│           │   Rooms     │
   └─────────┘           └─────────────┘
```

## Key Interview Talking Points

1. **Real-time Architecture**: "I used WebSocket for real-time features (messages, typing, receipts) and REST for CRUD operations. This separation keeps concerns clear."

2. **Security Layers**: "Multiple security layers: session-based auth, input sanitization, E2E encryption option, owner-only moderation."

3. **State Management**: "Server-side state uses Maps for WebSocket connections, room membership, and online tracking. React state handles UI with refs for values needed in callbacks."

4. **Database Design**: "MongoDB with Mongoose for flexible schemas. Users, Sessions, Rooms, and Messages collections with proper indexing on frequently queried fields."

5. **Scalability Considerations**: "For scaling, I'd add Redis for session storage and pub/sub for multi-server WebSocket broadcasting."
