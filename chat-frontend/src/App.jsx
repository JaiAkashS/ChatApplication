import { useState, useRef, useEffect } from 'react'
import './App.css'
import ConnectionStatus from './components/ConnectionStatus'
import UserSetup from './components/UserSetup'
import Messages from './components/Messages'
import MessageInput from './components/MessageInput'
import RoomControls from './components/RoomControls'
import RoomList from './components/RoomList'

const API_BASE_URL = 'http://localhost:6969'
const SESSION_TOKEN_KEY = 'chat.sessionToken'
const SESSION_USERNAME_KEY = 'chat.username'
const HISTORY_PAGE_SIZE = 50

const CLIENT_EVENT_TYPES = Object.freeze({
  JOIN_ROOM: 'JOIN_ROOM',
  SEND_MESSAGE: 'SEND_MESSAGE',
  TYPING: 'TYPING',
  READ_RECEIPT: 'READ_RECEIPT',
});

const SERVER_EVENT_TYPES = Object.freeze({
  ACK: 'ACK',
  ERR_ACK: 'ERR_ACK',
  SYSTEM: 'SYSTEM',
  ROOM_MESSAGE: 'ROOM_MESSAGE',
  TYPING: 'TYPING',
  READ_RECEIPT: 'READ_RECEIPT',
});

const isPlainObject = (value) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const normalizeNonEmptyString = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const parseServerMessage = (rawData) => {
  let parsed;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    return null;
  }

  if (!isPlainObject(parsed) || typeof parsed.type !== 'string' || !isPlainObject(parsed.payload)) {
    return null;
  }

  if (parsed.type === SERVER_EVENT_TYPES.ACK || parsed.type === SERVER_EVENT_TYPES.ERR_ACK) {
    const text = normalizeNonEmptyString(parsed.payload.text);
    if (!text) return null;
    return {
      type: parsed.type,
      payload: { text }
    };
  }

  if (parsed.type === SERVER_EVENT_TYPES.SYSTEM) {
    const roomId = normalizeNonEmptyString(parsed.payload.roomId);
    const text = normalizeNonEmptyString(parsed.payload.text);
    const createdAt = parsed.payload.createdAt || null;
    if (!roomId || !text) return null;
    return {
      type: SERVER_EVENT_TYPES.SYSTEM,
      payload: { roomId, text, createdAt }
    };
  }

  if (parsed.type === SERVER_EVENT_TYPES.ROOM_MESSAGE) {
    const roomId = normalizeNonEmptyString(parsed.payload.roomId);
    const text = normalizeNonEmptyString(parsed.payload.text);
    const username = normalizeNonEmptyString(parsed.payload.username) || 'anon';
    const createdAt = parsed.payload.createdAt || null;
    if (!roomId || !text) return null;
    return {
      type: SERVER_EVENT_TYPES.ROOM_MESSAGE,
      payload: { roomId, text, username, createdAt }
    };
  }

  if (parsed.type === SERVER_EVENT_TYPES.TYPING) {
    const roomId = normalizeNonEmptyString(parsed.payload.roomId);
    const username = normalizeNonEmptyString(parsed.payload.username);
    const isTyping = typeof parsed.payload.isTyping === 'boolean' ? parsed.payload.isTyping : null;
    if (!roomId || !username || isTyping === null) return null;
    return {
      type: SERVER_EVENT_TYPES.TYPING,
      payload: { roomId, username, isTyping }
    };
  }

  if (parsed.type === SERVER_EVENT_TYPES.READ_RECEIPT) {
    const roomId = normalizeNonEmptyString(parsed.payload.roomId);
    const username = normalizeNonEmptyString(parsed.payload.username);
    const timestamp = typeof parsed.payload.timestamp === 'number' ? parsed.payload.timestamp : null;
    if (!roomId || !username || timestamp === null) return null;
    return {
      type: SERVER_EVENT_TYPES.READ_RECEIPT,
      payload: { roomId, username, timestamp }
    };
  }

  return null;
};

const buildClientMessage = (type, payload) => {
  if (type === CLIENT_EVENT_TYPES.JOIN_ROOM) {
    const roomId = normalizeNonEmptyString(payload?.roomId);
    if (!roomId) return null;
    return JSON.stringify({ type, payload: { roomId } });
  }

  if (type === CLIENT_EVENT_TYPES.SEND_MESSAGE) {
    const roomId = normalizeNonEmptyString(payload?.roomId);
    const text = normalizeNonEmptyString(payload?.text);
    if (!roomId || !text) return null;
    return JSON.stringify({ type, payload: { roomId, text } });
  }

  if (type === CLIENT_EVENT_TYPES.TYPING) {
    const roomId = normalizeNonEmptyString(payload?.roomId);
    const isTyping = typeof payload?.isTyping === 'boolean' ? payload.isTyping : null;
    if (!roomId || isTyping === null) return null;
    return JSON.stringify({ type, payload: { roomId, isTyping } });
  }

  if (type === CLIENT_EVENT_TYPES.READ_RECEIPT) {
    const roomId = normalizeNonEmptyString(payload?.roomId);
    if (!roomId) return null;
    return JSON.stringify({ type, payload: { roomId } });
  }

  return null;
};

function App() {
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const joinedRoomsRef = useRef(new Set());
  const hasConnectedRef = useRef(false);
  const sessionTokenRef = useRef(null);
  const shouldReconnectRef = useRef(true);
  const activeRoomRef = useRef(null);
  const historyMetaRef = useRef(new Map());
  const typingTimeoutRef = useRef(new Map());
  const typingStateRef = useRef(new Map());
  const lastReadSentRef = useRef(new Map());

  const [userSet, SetUserSet] = useState(false)
  const [targetUser, setTargetUser] = useState("")
  const [username, setUserName] = useState("")
  const [password, setPassword] = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState("")
  const [roomId, setRoomId] = useState("")
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState([])
  const [activeRoom, setActiveRoom] = useState(null);
  const [conversations, setConversations] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [historyLoadingByRoom, setHistoryLoadingByRoom] = useState({});
  const [hasMoreByRoom, setHasMoreByRoom] = useState({});
  const [searchRoomId, setSearchRoomId] = useState("");
  const [searchUsername, setSearchUsername] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [moderationRoomId, setModerationRoomId] = useState("");
  const [moderationUsername, setModerationUsername] = useState("");
  const [typingByRoom, setTypingByRoom] = useState({});
  const [readReceiptsByRoom, setReadReceiptsByRoom] = useState({});

  const clearStoredSession = () => {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_USERNAME_KEY);
  };

  const storeSession = (token, name) => {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
    localStorage.setItem(SESSION_USERNAME_KEY, name);
  };

  const resetChatState = () => {
    setTargetUser('');
    setRoomId('');
    setMessage('');
    setMessages([]);
    setActiveRoom(null);
    setConversations({});
    setUnreadCounts({});
    joinedRoomsRef.current = new Set();
    activeRoomRef.current = null;
    historyMetaRef.current = new Map();
    setHistoryLoadingByRoom({});
    setHasMoreByRoom({});
  };

  const connectWebSocket = () => {
    try {
      if (!sessionTokenRef.current) {
        setConnectionStatus('disconnected');
        return;
      }

      if (
        socketRef.current &&
        (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      const wsUrl = `ws://localhost:6969?token=${encodeURIComponent(sessionTokenRef.current)}`;
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;
      setConnectionStatus('connecting');

      ws.onopen = () => {
        const wasReconnect = hasConnectedRef.current;
        setConnectionStatus("connected");
        reconnectAttemptsRef.current = 0;

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        if (wasReconnect) {
          rejoinAllRooms();
          pushReconnectedMessage();
        }

        hasConnectedRef.current = true;
      };

      ws.onmessage = (event) => {
        const data = parseServerMessage(event.data);
        if (!data) return;

        if (data.type === SERVER_EVENT_TYPES.ACK || data.type === SERVER_EVENT_TYPES.ERR_ACK) {
          console.log(data.payload.text)
        }

        setConversations(prev => {
          const next = { ...prev };
          const incomingRoomId = data.payload.roomId;

          if (incomingRoomId && !next[incomingRoomId]) {
            if (incomingRoomId.startsWith("dm:")) {
              const other = incomingRoomId
                .replace("dm:", "")
                .split(":")
                .find(u => u !== username);

              next[incomingRoomId] = { type: "dm", with: other };
            } else {
              next[incomingRoomId] = { type: "room" };
            }

            if (!activeRoomRef.current) {
              setActiveRoom(incomingRoomId);
            }
          }

          return next;
        });

        if (data.type === SERVER_EVENT_TYPES.SYSTEM) {
          setMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            type: SERVER_EVENT_TYPES.SYSTEM,
            roomId: data.payload.roomId,
            text: data.payload.text,
            createdAt: data.payload.createdAt || new Date().toISOString(),
          }]);
        }

        if (data.type === SERVER_EVENT_TYPES.ROOM_MESSAGE) {
          setMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            type: SERVER_EVENT_TYPES.ROOM_MESSAGE,
            roomId: data.payload.roomId,
            username: data.payload.username,
            text: data.payload.text,
            createdAt: data.payload.createdAt || new Date().toISOString(),
          }]);

          if (data.payload.roomId && data.payload.roomId !== activeRoomRef.current) {
            incrementUnread(data.payload.roomId);
          }
        }

        if (data.type === SERVER_EVENT_TYPES.TYPING) {
          setTypingByRoom((prev) => {
            const next = { ...prev };
            const users = new Set(next[data.payload.roomId] || []);
            if (data.payload.isTyping) {
              users.add(data.payload.username);
            } else {
              users.delete(data.payload.username);
            }
            next[data.payload.roomId] = [...users];
            return next;
          });
        }

        if (data.type === SERVER_EVENT_TYPES.READ_RECEIPT) {
          setReadReceiptsByRoom((prev) => {
            const next = { ...prev };
            const roomReceipts = { ...(next[data.payload.roomId] || {}) };
            roomReceipts[data.payload.username] = data.payload.timestamp;
            next[data.payload.roomId] = roomReceipts;
            return next;
          });
        }
      };

      ws.onerror = () => {
        setConnectionStatus("error");
      };

      ws.onclose = () => {
        setConnectionStatus("disconnected");
        socketRef.current = null;

        if (!shouldReconnectRef.current || !sessionTokenRef.current) {
          return;
        }

        attemptReconnect();
      };
    } catch {
      setConnectionStatus("error");
      attemptReconnect();
    }
  };

  const attemptReconnect = () => {
    if (!shouldReconnectRef.current || !sessionTokenRef.current) return;
    if (reconnectTimeoutRef.current) return;

    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
    reconnectAttemptsRef.current += 1;

    setConnectionStatus("reconnecting");

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      connectWebSocket();
    }, delay);
  };

  useEffect(() => {
    shouldReconnectRef.current = true;

    const storedToken = localStorage.getItem(SESSION_TOKEN_KEY);
    const storedUsername = localStorage.getItem(SESSION_USERNAME_KEY);
    if (storedToken) {
      sessionTokenRef.current = storedToken;
      if (storedUsername) {
        setUserName(storedUsername);
      }
      SetUserSet(true);
      fetchRooms(storedToken).then(() => {
        connectWebSocket();
      });
    }

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    if (activeRoom) {
      sendReadReceipt(activeRoom);
    }
  }, [activeRoom, messages.length, connectionStatus]);

  useEffect(() => {
    if (!activeRoom || !sessionTokenRef.current) return;
    const meta = historyMetaRef.current.get(activeRoom);
    if (!meta?.loaded) {
      loadRoomHistory(activeRoom, { replace: true });
    }
  }, [activeRoom]);

  const incrementUnread = (roomId) => {
    if (!roomId) return;
    setUnreadCounts(prev => ({
      ...prev,
      [roomId]: (prev[roomId] || 0) + 1
    }));
  };

  const pushSystemMessage = (roomId, text) => {
    if (!roomId) return;
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      type: "SYSTEM",
      roomId,
      text
    }]);
  };

  const pushReconnectedMessage = () => {
    const fallbackRoomId = activeRoomRef.current || joinedRoomsRef.current.values().next().value;
    if (!fallbackRoomId) return;
    pushSystemMessage(fallbackRoomId, "Reconnected");
  };

  const sendTyping = (roomId, isTyping) => {
    if (!roomId || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    const message = buildClientMessage(CLIENT_EVENT_TYPES.TYPING, { roomId, isTyping });
    if (!message) return;
    socketRef.current.send(message);
  };

  const stopTyping = (roomId) => {
    if (!roomId) return;
    typingStateRef.current.set(roomId, false);
    sendTyping(roomId, false);
    const existingTimeout = typingTimeoutRef.current.get(roomId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      typingTimeoutRef.current.delete(roomId);
    }
  };

  const handleMessageChange = (value) => {
    setMessage(value);
    if (!roomId) return;

    const isTyping = value.trim().length > 0;
    const wasTyping = typingStateRef.current.get(roomId) || false;

    if (isTyping && !wasTyping) {
      typingStateRef.current.set(roomId, true);
      sendTyping(roomId, true);
    }

    if (!isTyping && wasTyping) {
      stopTyping(roomId);
      return;
    }

    if (isTyping) {
      const existingTimeout = typingTimeoutRef.current.get(roomId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      const timeoutId = setTimeout(() => {
        stopTyping(roomId);
      }, 2000);
      typingTimeoutRef.current.set(roomId, timeoutId);
    }
  };

  const joinRoom = (id, options = {}) => {
    const { force = false } = options;
    if (!id || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    if (!force && joinedRoomsRef.current.has(id)) return;

    const joinMessage = buildClientMessage(CLIENT_EVENT_TYPES.JOIN_ROOM, { roomId: id });
    if (!joinMessage) return;

    socketRef.current.send(joinMessage);
    joinedRoomsRef.current.add(id);
  };

  const rejoinAllRooms = () => {
    for (const id of joinedRoomsRef.current) {
      joinRoom(id, { force: true });
    }
  };

  const sendMessage = () => {
    if (!message || !roomId || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    const outboundMessage = buildClientMessage(CLIENT_EVENT_TYPES.SEND_MESSAGE, {
      roomId,
      text: message,
    });
    if (!outboundMessage) return;

    socketRef.current.send(outboundMessage);
    setMessage("");
    stopTyping(roomId);
  };

  const registerUser = async () => {
    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) {
      setAuthError('Username and password are required');
      return;
    }

    setAuthLoading(true);
    setAuthError('');
    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: normalizedUsername, password }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error || 'Registration failed');
      }
    } catch (error) {
      setAuthError(error.message || 'Registration failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const loginUser = async () => {
    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) {
      setAuthError('Username and password are required');
      return;
    }

    setAuthLoading(true);
    setAuthError('');
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: normalizedUsername, password }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error || 'Login failed');
      }

      sessionTokenRef.current = body.token;
      setUserName(body.user.username);
      storeSession(body.token, body.user.username);
      setPassword('');
      SetUserSet(true);
      resetChatState();
      await fetchRooms(body.token);
      connectWebSocket();
    } catch (error) {
      setAuthError(error.message || 'Login failed');
      sessionTokenRef.current = null;
      clearStoredSession();
      SetUserSet(false);
      setConnectionStatus('disconnected');
    } finally {
      setAuthLoading(false);
    }
  };

  const logoutUser = async () => {
    const token = sessionTokenRef.current;
    sessionTokenRef.current = null;
    clearStoredSession();
    resetChatState();
    SetUserSet(false);
    setConnectionStatus('disconnected');

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    if (!token) return;

    try {
      await fetch(`${API_BASE_URL}/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Ignore logout errors to ensure client state is cleared.
    }
  };

  const fetchRooms = async (token) => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/rooms`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const body = await response.json();
      if (!response.ok) {
        return;
      }

      const nextConversations = {};
      for (const room of body.rooms || []) {
        if (!room?.roomId) continue;
        if (room.type === 'dm') {
          const other = (room.members || []).find((name) => name !== username) || 'unknown';
          nextConversations[room.roomId] = { type: 'dm', with: other };
        } else if (room.type === 'private') {
          nextConversations[room.roomId] = { type: 'private' };
        } else {
          nextConversations[room.roomId] = { type: 'public' };
        }
      }

      setConversations(nextConversations);
    } catch {
      // Ignore room preload errors.
    }
  };

  const loadRoomHistory = async (roomIdToLoad, options = {}) => {
    if (!roomIdToLoad || !sessionTokenRef.current) return;
    const { before, replace = false } = options;

    setHistoryLoadingByRoom((prev) => ({
      ...prev,
      [roomIdToLoad]: true,
    }));

    try {
      const params = new URLSearchParams();
      params.set('limit', String(HISTORY_PAGE_SIZE));
      if (before) {
        params.set('before', String(before));
      }

      const response = await fetch(`${API_BASE_URL}/rooms/${encodeURIComponent(roomIdToLoad)}/messages?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${sessionTokenRef.current}`,
        },
      });

      const body = await response.json();
      if (!response.ok) {
        return;
      }

      const loadedMessages = (body.messages || []).map((message) => ({
        id: String(message.id),
        type: message.type,
        roomId: message.roomId,
        username: message.username,
        text: message.text,
        createdAt: message.createdAt,
      }));

      const oldest = loadedMessages.length > 0
        ? new Date(loadedMessages[0].createdAt).getTime()
        : null;

      historyMetaRef.current.set(roomIdToLoad, {
        loaded: true,
        oldest,
      });

      setHasMoreByRoom((prev) => ({
        ...prev,
        [roomIdToLoad]: Boolean(body.hasMore),
      }));

      setMessages((prev) => {
        const withoutRoom = prev.filter((msg) => msg.roomId !== roomIdToLoad);
        if (replace) {
          return [...loadedMessages, ...withoutRoom];
        }
        return [...loadedMessages, ...prev];
      });
    } finally {
      setHistoryLoadingByRoom((prev) => ({
        ...prev,
        [roomIdToLoad]: false,
      }));
    }
  };

  const sendReadReceipt = (roomIdToRead) => {
    if (!roomIdToRead || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    const now = Date.now();
    const lastSent = lastReadSentRef.current.get(roomIdToRead) || 0;
    if (now - lastSent < 2000) return;

    const message = buildClientMessage(CLIENT_EVENT_TYPES.READ_RECEIPT, { roomId: roomIdToRead });
    if (!message) return;

    socketRef.current.send(message);
    lastReadSentRef.current.set(roomIdToRead, now);
  };

  const createRoom = async ({ roomId, type, members }) => {
    if (!roomId || !sessionTokenRef.current) return;

    const memberList = typeof members === 'string'
      ? members.split(',').map((name) => name.trim()).filter(Boolean)
      : [];

    try {
      const response = await fetch(`${API_BASE_URL}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionTokenRef.current}`,
        },
        body: JSON.stringify({
          roomId,
          type,
          members: memberList,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        setAuthError(body?.error || 'Failed to create room');
        return;
      }

      setConversations((prev) => ({
        ...prev,
        [roomId]: type === 'dm'
          ? { type: 'dm', with: memberList[0] || 'unknown' }
          : type === 'private'
            ? { type: 'private' }
            : { type: 'public' },
      }));
      joinRoom(roomId, { force: true });
    } catch {
      setAuthError('Failed to create room');
    }
  };

  const searchMessages = async () => {
    if (!sessionTokenRef.current) return;

    const params = new URLSearchParams();
    if (searchRoomId.trim()) params.set('roomId', searchRoomId.trim());
    if (searchUsername.trim()) params.set('username', searchUsername.trim());
    if (searchQuery.trim()) params.set('q', searchQuery.trim());

    setSearchLoading(true);
    setSearchError("");
    try {
      const response = await fetch(`${API_BASE_URL}/search?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${sessionTokenRef.current}`,
        },
      });
      const body = await response.json();
      if (!response.ok) {
        setSearchError(body?.error || 'Search failed');
        setSearchResults([]);
        return;
      }
      setSearchResults(body.results || []);
    } catch {
      setSearchError('Search failed');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const kickMember = async () => {
    if (!sessionTokenRef.current) return;
    const roomId = moderationRoomId.trim() || activeRoom || '';
    const target = moderationUsername.trim();
    if (!roomId || !target) return;

    try {
      const response = await fetch(`${API_BASE_URL}/rooms/${encodeURIComponent(roomId)}/kick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionTokenRef.current}`,
        },
        body: JSON.stringify({ username: target }),
      });
      const body = await response.json();
      if (!response.ok) {
        setAuthError(body?.error || 'Kick failed');
      }
    } catch {
      setAuthError('Kick failed');
    }
  };

  const banMember = async () => {
    if (!sessionTokenRef.current) return;
    const roomId = moderationRoomId.trim() || activeRoom || '';
    const target = moderationUsername.trim();
    if (!roomId || !target) return;

    try {
      const response = await fetch(`${API_BASE_URL}/rooms/${encodeURIComponent(roomId)}/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionTokenRef.current}`,
        },
        body: JSON.stringify({ username: target }),
      });
      const body = await response.json();
      if (!response.ok) {
        setAuthError(body?.error || 'Ban failed');
      }
    } catch {
      setAuthError('Ban failed');
    }
  };

  return (
    <div className="app-container">
      <ConnectionStatus status={connectionStatus} />

      <div className="chat-area">
        <div className="left-column">
          <h2>Minimal Chat</h2>

          <UserSetup
            userSet={userSet}
            username={username}
            password={password}
            authLoading={authLoading}
            authError={authError}
            onUsernameChange={setUserName}
            onPasswordChange={setPassword}
            onRegister={registerUser}
            onLogin={loginUser}
            onLogout={logoutUser}
          />

          <Messages
            messages={messages}
            activeRoom={activeRoom}
            typingUsers={(typingByRoom[activeRoom] || []).filter((name) => name !== username)}
            readBy={Object.entries(readReceiptsByRoom[activeRoom] || {})
              .filter(([name]) => name !== username)
              .sort((a, b) => b[1] - a[1])
              .map(([name]) => name)}
            onLoadOlder={() => {
              const meta = historyMetaRef.current.get(activeRoom);
              if (!meta?.oldest) return;
              loadRoomHistory(activeRoom, { before: meta.oldest });
            }}
            hasMore={Boolean(hasMoreByRoom[activeRoom])}
            loadingHistory={Boolean(historyLoadingByRoom[activeRoom])}
          />

          <MessageInput
            message={message}
            onMessageChange={handleMessageChange}
            onSendMessage={sendMessage}
            onStopTyping={() => stopTyping(roomId)}
          />
        </div>

        <div className="right-sidebar">
          <h3>Rooms</h3>

          <RoomControls
            roomId={roomId}
            onRoomIdChange={setRoomId}
            onJoinRoom={joinRoom}
            onCreateRoom={createRoom}
            targetUser={targetUser}
            onTargetUserChange={setTargetUser}
            username={username}
            onStartDM={() => {
              if (!username || !targetUser) return;
              const dmRoom = `dm:${[username, targetUser].sort().join(":")}`;
              setRoomId(dmRoom);
              createRoom({ roomId: dmRoom, type: 'dm', members: targetUser });
            }}
          />

          <RoomList
            conversations={conversations}
            activeRoom={activeRoom}
            unreadCounts={unreadCounts}
            onRoomSelect={(id) => {
              setActiveRoom(id);
              setRoomId(id);
              joinRoom(id);
              setUnreadCounts(prev => ({
                ...prev,
                [id]: 0
              }));
            }}
          />

          <div className="panel">
            <h4>Search</h4>
            <input
              placeholder="room id (optional)"
              value={searchRoomId}
              onChange={(e) => setSearchRoomId(e.target.value)}
            />
            <input
              placeholder="username (optional)"
              value={searchUsername}
              onChange={(e) => setSearchUsername(e.target.value)}
            />
            <input
              placeholder="search text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button onClick={searchMessages} disabled={searchLoading}>Search</button>
            {searchError && <div className="panel-error">{searchError}</div>}
            {searchResults.length > 0 && (
              <ul className="search-results">
                {searchResults.map((result, index) => (
                  <li key={`${result.roomId}-${index}`}>
                    <span className="search-room">#{result.roomId}</span>
                    <span className="search-user">{result.username}</span>
                    <span className="search-text">{result.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel">
            <h4>Moderation</h4>
            <input
              placeholder="room id (private)"
              value={moderationRoomId}
              onChange={(e) => setModerationRoomId(e.target.value)}
            />
            <input
              placeholder="username"
              value={moderationUsername}
              onChange={(e) => setModerationUsername(e.target.value)}
            />
            <div className="panel-actions">
              <button className="secondary" onClick={kickMember}>Kick</button>
              <button className="secondary" onClick={banMember}>Ban</button>
            </div>
            <div className="panel-hint">Owner only. Private groups only.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App
