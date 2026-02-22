# Features Explained (Beginner Friendly)

This file explains each feature in simple language.

---

## 1) Authentication (Register, Login, Logout)

- **What this feature does (plain English):**
  - Lets users create an account, sign in, and sign out.
- **Why this feature exists (problem it solves):**
  - Without login, anyone could pretend to be anyone.
  - It protects user identity and private rooms.
- **How it works conceptually:**
  - You register with username and password.
  - Password is stored as a hash (not plain text).
  - On login, server creates a session token.
  - On logout, server removes that session.
- **Technologies involved:**
  - React (login form)
  - Express (HTTP APIs)
  - MongoDB + Mongoose (users/sessions)
  - bcrypt (password hashing)
- **Where the logic lives:**
  - Client: login/register/logout UI and API calls
  - Server: validates credentials, creates/deletes sessions
  - Database: stores users and sessions
- **Short example scenario:**
  - Tharun logs in, gets a token, chats, then clicks logout. Token is revoked and access ends.
- **How to explain in an interview (2–3 lines):**
  - “I used server-side sessions, not JWT. Login creates an opaque token stored in MongoDB, and logout revokes it. Passwords are hashed with bcrypt, so plain passwords are never stored.”

---

## 2) Session Token in localStorage

- **What this feature does (plain English):**
  - Keeps you signed in after page refresh.
- **Why this feature exists (problem it solves):**
  - Without it, user must log in every time the page reloads.
- **How it works conceptually:**
  - After login, token is saved in localStorage.
  - On app start, frontend reads token and reconnects.
  - On logout or invalid session, token is removed.
- **Technologies involved:**
  - React
  - Browser localStorage API
- **Where the logic lives:**
  - Client only
- **Short example scenario:**
  - User refreshes the browser and is still logged in automatically.
- **How to explain in an interview (2–3 lines):**
  - “I persist the session token in localStorage for smooth user experience. On startup, the app restores the token and reconnects. On logout, I clear storage and close the socket.”

---

## 3) WebSocket Connection with Session Authentication

- **What this feature does (plain English):**
  - Opens a real-time connection so messages appear instantly.
- **Why this feature exists (problem it solves):**
  - HTTP polling is slower and more expensive for chat.
- **How it works conceptually:**
  - Client connects to `ws://...?...token=...`.
  - Server verifies token once at connection time.
  - If valid, server attaches user identity to socket.
  - If invalid/expired, server rejects the connection.
- **Technologies involved:**
  - WebSocket (`ws` library)
  - Express + Node HTTP server
  - MongoDB sessions
- **Where the logic lives:**
  - Client: creates socket
  - Server: validates token and manages socket metadata
  - Database: session lookup
- **Short example scenario:**
  - User’s token expires; next socket connect is rejected, forcing proper re-login.
- **How to explain in an interview (2–3 lines):**
  - “I authenticate WebSocket using the same server-side session token from HTTP login. The server resolves identity and stores it on socket metadata. Client cannot set username manually.”

---

## 4) Reconnection Technique

- **What this feature does (plain English):**
  - Automatically reconnects when network drops.
- **Why this feature exists (problem it solves):**
  - Temporary internet issues should not break chat permanently.
- **How it works conceptually:**
  - Uses exponential backoff delays: 1s, 2s, 4s... up to a max.
  - Keeps only one reconnect timer active.
  - Rejoins rooms after successful reconnect.
- **Technologies involved:**
  - React state/refs
  - Browser WebSocket
- **Where the logic lives:**
  - Client only
- **Short example scenario:**
  - Wi-Fi disconnects for 10 seconds, app reconnects and rejoins rooms automatically.
- **How to explain in an interview (2–3 lines):**
  - “I implemented reconnect with exponential backoff to avoid hammering the server. Once reconnected, the app rejoins prior rooms. I also prevent duplicate reconnect timers.”

---

## 5) Room Types and Visibility

- **What this feature does (plain English):**
  - Supports 3 room types:
    - Public: everyone can see
    - DM: only two participants
    - Private group: only members
- **Why this feature exists (problem it solves):**
  - Different conversations need different privacy levels.
- **How it works conceptually:**
  - Room type and member list are stored in DB.
  - Server checks access before allowing join.
  - Banned users are blocked from joining.
- **Technologies involved:**
  - React (room creation UI)
  - Express APIs
  - MongoDB `rooms` collection
- **Where the logic lives:**
  - Client: create/select rooms
  - Server: access checks
  - Database: room metadata
- **Short example scenario:**
  - A private project room is visible only to invited team members.
- **How to explain in an interview (2–3 lines):**
  - “I modeled room privacy in the `rooms` collection with type and members. Join checks run server-side so client cannot bypass access. This supports public rooms, DMs, and private groups cleanly.”

---

## 6) Real-Time Chat Messages

- **What this feature does (plain English):**
  - Sends and receives chat messages instantly in joined rooms.
- **Why this feature exists (problem it solves):**
  - Chat should feel live without manual refresh.
- **How it works conceptually:**
  - Client sends `SEND_MESSAGE` with room + text.
  - Server verifies user belongs to that room.
  - Server broadcasts to all sockets in that room.
  - Server saves message to DB.
- **Technologies involved:**
  - WebSocket
  - Express/Node
  - MongoDB `messages`
- **Where the logic lives:**
  - Client: send/display message
  - Server: validate + broadcast
  - Database: persistence
- **Short example scenario:**
  - Alice sends “hello” in `general`, all members in `general` see it immediately.
- **How to explain in an interview (2–3 lines):**
  - “Messages are real-time via WebSocket and persisted in MongoDB. The server is authoritative and checks room membership before broadcast. This keeps chat both fast and secure.”

---

## 7) Message Timestamps

- **What this feature does (plain English):**
  - Shows when each message was sent.
- **Why this feature exists (problem it solves):**
  - Users need time context to read conversations.
- **How it works conceptually:**
  - Message records contain `createdAt`.
  - Server includes timestamp in payload.
  - Client formats and displays time.
- **Technologies involved:**
  - MongoDB timestamps
  - WebSocket payloads
  - React UI formatting
- **Where the logic lives:**
  - Server + database for source timestamp
  - Client for display format
- **Short example scenario:**
  - User sees “10:42 PM” next to a message and knows it was sent earlier.
- **How to explain in an interview (2–3 lines):**
  - “I include `createdAt` in message payloads and keep it in MongoDB for consistency. The frontend formats it for readability. This helps users follow conversation order and timing.”

---

## 8) Message History Pagination

- **What this feature does (plain English):**
  - Loads recent messages first, then older messages when requested.
- **Why this feature exists (problem it solves):**
  - Loading all messages at once is slow and heavy.
- **How it works conceptually:**
  - Endpoint returns last 50 messages by default.
  - Client sends `before` cursor to fetch older messages.
  - UI shows “Load older messages.”
- **Technologies involved:**
  - Express API
  - MongoDB query with sort/limit
  - React pagination state
- **Where the logic lives:**
  - Server: paginated query
  - Client: cursor state + load button
- **Short example scenario:**
  - User opens room, sees latest 50 messages, clicks load older to continue reading.
- **How to explain in an interview (2–3 lines):**
  - “I implemented cursor-style pagination for chat history. The server returns a limited batch and the client requests older messages using a `before` value. This keeps performance stable.”

---

## 9) Typing Indicators

- **What this feature does (plain English):**
  - Shows when someone is typing in the current room.
- **Why this feature exists (problem it solves):**
  - Gives live conversation feedback, making chat feel natural.
- **How it works conceptually:**
  - Client sends typing on/off events.
  - Server broadcasts typing state to room members.
  - Timeout auto-clears typing if no update arrives.
- **Technologies involved:**
  - WebSocket events
  - React UI state
  - Node timers
- **Where the logic lives:**
  - Client: emits typing while user types
  - Server: timeout + broadcast
- **Short example scenario:**
  - “Bob is typing...” appears, then disappears after a few seconds of inactivity.
- **How to explain in an interview (2–3 lines):**
  - “Typing is an ephemeral WebSocket feature, not persisted. I broadcast typing status per room and use a timeout to auto-clear stale indicators. This keeps the UI responsive and clean.”

---

## 10) Read Receipts (Per Room)

- **What this feature does (plain English):**
  - Shows who has seen messages in a room.
- **Why this feature exists (problem it solves):**
  - Helps users know if teammates have read updates.
- **How it works conceptually:**
  - Client sends read event when room is active.
  - Server broadcasts read receipt to room members.
  - UI displays “Seen by ...”.
- **Technologies involved:**
  - WebSocket events
  - React state
- **Where the logic lives:**
  - Client + server (real-time), optional DB extension later
- **Short example scenario:**
  - Team lead posts update and sees “Seen by Priya, Arun”.
- **How to explain in an interview (2–3 lines):**
  - “I implemented room-level read receipts with WebSocket events. The active room triggers receipt updates, and the server broadcasts to members only. This keeps visibility scoped and private.”

---

## 11) Search (Room, Username, Content)

- **What this feature does (plain English):**
  - Finds messages by room, sender name, or text.
- **Why this feature exists (problem it solves):**
  - Users need to find old information quickly.
- **How it works conceptually:**
  - Client sends query filters.
  - Server checks accessible rooms first.
  - Server returns matching messages from DB.
- **Technologies involved:**
  - Express endpoint
  - MongoDB filters/regex
  - React search panel
- **Where the logic lives:**
  - Client: search inputs/results UI
  - Server: access check + query
  - Database: message search
- **Short example scenario:**
  - User searches `room=general, username=alice, q=deadline` to find a specific update.
- **How to explain in an interview (2–3 lines):**
  - “Search is server-side with access control, so users only see rooms they can access. I support filters for room, username, and content. Results are fast and scoped securely.”

---

## 12) Moderation (Kick / Ban for Private Groups)

- **What this feature does (plain English):**
  - Lets private group owner remove or ban members.
- **Why this feature exists (problem it solves):**
  - Groups need control over abuse or unwanted users.
- **How it works conceptually:**
  - Owner calls kick/ban endpoint.
  - Server verifies owner and room type.
  - Target user is removed from room membership.
  - Ban also blocks future joins.
- **Technologies involved:**
  - Express moderation endpoints
  - MongoDB room membership + banned list
  - WebSocket system event broadcast
- **Where the logic lives:**
  - Server + database mainly
  - Client provides moderation controls
- **Short example scenario:**
  - Owner bans a spam account from a private project room.
- **How to explain in an interview (2–3 lines):**
  - “Moderation is restricted to private-group owners. Kick removes membership, ban removes and blocks re-entry. I also broadcast a system message so members see the moderation action.”

---

## 13) Connection Status / Presence Basics

- **What this feature does (plain English):**
  - Shows whether your app is connected, reconnecting, or disconnected.
- **Why this feature exists (problem it solves):**
  - Users need clear feedback when messages may fail.
- **How it works conceptually:**
  - Client tracks WebSocket lifecycle events.
  - UI badge updates in real time.
  - Server sends system leave/join messages during connection changes.
- **Technologies involved:**
  - React state
  - WebSocket lifecycle events
- **Where the logic lives:**
  - Client: status badge
  - Server: room system messages
- **Short example scenario:**
  - Internet drops, badge changes to reconnecting, then back to connected.
- **How to explain in an interview (2–3 lines):**
  - “I surface WebSocket state directly in the UI so users understand connection health. Reconnect and disconnect states are explicit. This prevents silent failures and improves trust.”

---

## Quick Full-System Flow (Step by Step)

- User registers/logs in over HTTP.
- Server creates session token.
- Client stores token and opens authenticated WebSocket.
- User joins room (`JOIN_ROOM`) and sends messages (`SEND_MESSAGE`).
- Server validates access, broadcasts events, and persists messages.
- Client supports typing/read receipts/search/history/moderation through APIs and WebSocket events.
