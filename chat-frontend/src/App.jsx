import { useState, useRef, useEffect } from 'react'
import './App.css'
import ConnectionStatus from './components/ConnectionStatus'
import AuthPage from './components/AuthPage'
import UserSettings from './components/UserSettings'
import RoomSettings from './components/RoomSettings'
import Messages from './components/Messages'
import MessageInput from './components/MessageInput'
import RoomControls from './components/RoomControls'
import RoomList from './components/RoomList'
import UserProfile from './components/UserProfile'
import FriendList from './components/FriendList'
import MemberList from './components/MemberList'

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
    const usernameColor = normalizeNonEmptyString(parsed.payload.usernameColor) || '#dcddde';
    const profilePicture = normalizeNonEmptyString(parsed.payload.profilePicture) || null;
    if (!roomId || !text) return null;
    return {
      type: SERVER_EVENT_TYPES.ROOM_MESSAGE,
      payload: { roomId, text, username, createdAt, usernameColor, profilePicture }
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
  const [smartSearch, setSmartSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [typingByRoom, setTypingByRoom] = useState({});
  const [readReceiptsByRoom, setReadReceiptsByRoom] = useState({});
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [showRoomSettings, setShowRoomSettings] = useState(null);
  const [usernameColor, setUsernameColor] = useState('#dcddde');
  const [profilePicture, setProfilePicture] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);

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
            usernameColor: data.payload.usernameColor || '#dcddde',
            profilePicture: data.payload.profilePicture || null,
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

  const registerUser = async (usernameInput, passwordInput) => {
    const normalizedUsername = usernameInput.trim();
    if (!normalizedUsername || !passwordInput) {
      setAuthError('Username and password are required');
      return;
    }

    setAuthLoading(true);
    setAuthError('');
    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: normalizedUsername, password: passwordInput }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error || 'Registration failed');
      }
      
      // Auto-login after successful registration
      await loginUser(normalizedUsername, passwordInput);
    } catch (error) {
      setAuthError(error.message || 'Registration failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const loginUser = async (usernameInput, passwordInput) => {
    const normalizedUsername = usernameInput.trim();
    if (!normalizedUsername || !passwordInput) {
      setAuthError('Username and password are required');
      return;
    }

    setAuthLoading(true);
    setAuthError('');
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: normalizedUsername, password: passwordInput }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error || 'Login failed');
      }

      sessionTokenRef.current = body.token;
      setUserName(body.user.username);
      setUsernameColor(body.user.usernameColor || '#dcddde');
      setProfilePicture(body.user.profilePicture || null);
      storeSession(body.token, body.user.username);
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

  const logoutEverywhere = async () => {
    const token = sessionTokenRef.current;
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/logout-everywhere`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const body = await response.json();
      if (!response.ok) {
        setAuthError(body?.error || 'Logout everywhere failed');
        return;
      }

      // Clear local state after successful server-side logout
      sessionTokenRef.current = null;
      clearStoredSession();
      resetChatState();
      SetUserSet(false);
      setConnectionStatus('disconnected');

      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    } catch {
      setAuthError('Logout everywhere failed');
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
          nextConversations[room.roomId] = { 
            type: 'private', 
            inviteCode: room.inviteCode || null,
            isOwner: room.isOwner || false,
            logo: room.logo || null,
          };
        } else {
          nextConversations[room.roomId] = { 
            type: 'public',
            isOwner: room.isOwner || false,
            logo: room.logo || null,
          };
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
        usernameColor: message.usernameColor || '#dcddde',
        profilePicture: message.profilePicture || null,
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
            ? { type: 'private', inviteCode: body.room?.inviteCode }
            : { type: 'public' },
      }));
      joinRoom(roomId, { force: true });
    } catch {
      setAuthError('Failed to create room');
    }
  };

  const joinByInvite = async (inviteCode) => {
    if (!inviteCode || !sessionTokenRef.current) return;

    try {
      const response = await fetch(`${API_BASE_URL}/rooms/join-by-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionTokenRef.current}`,
        },
        body: JSON.stringify({ inviteCode }),
      });

      const body = await response.json();
      if (!response.ok) {
        setAuthError(body?.error || 'Failed to join room');
        return;
      }

      const joinedRoomId = body.room?.roomId;
      if (joinedRoomId) {
        setConversations((prev) => ({
          ...prev,
          [joinedRoomId]: { type: 'private' },
        }));
        joinRoom(joinedRoomId, { force: true });
        setActiveRoom(joinedRoomId);
      }
    } catch {
      setAuthError('Failed to join room');
    }
  };

  const parseSmartSearch = (query) => {
    let roomId = '';
    let username = '';
    let text = '';
    
    const tokens = query.match(/(@\S+|#\S+|[^@#]+)/g) || [];
    
    for (const token of tokens) {
      const trimmed = token.trim();
      if (trimmed.startsWith('@')) {
        username = trimmed.slice(1);
      } else if (trimmed.startsWith('#')) {
        roomId = trimmed.slice(1);
      } else if (trimmed) {
        text += (text ? ' ' : '') + trimmed;
      }
    }
    
    return { roomId, username, text: text.trim() };
  };

  const searchMessages = async (e) => {
    if (e) e.preventDefault();
    if (!sessionTokenRef.current || !smartSearch.trim()) return;

    const { roomId, username, text } = parseSmartSearch(smartSearch);
    const params = new URLSearchParams();
    if (roomId) params.set('roomId', roomId);
    if (username) params.set('username', username);
    if (text) params.set('q', text);

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

  const kickMember = async (roomId, targetUsername) => {
    if (!sessionTokenRef.current) return;
    const target = targetUsername.trim();
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

  const banMember = async (roomId, targetUsername) => {
    if (!sessionTokenRef.current) return;
    const target = targetUsername.trim();
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

  const updateProfile = async ({ usernameColor: newColor, profilePicture: newPfp }) => {
    if (!sessionTokenRef.current) return;

    setProfileLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionTokenRef.current}`,
        },
        body: JSON.stringify({
          usernameColor: newColor,
          profilePicture: newPfp,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        setAuthError(body?.error || 'Profile update failed');
        return;
      }

      setUsernameColor(body.user.usernameColor || '#dcddde');
      setProfilePicture(body.user.profilePicture || null);
      setShowUserSettings(false);
    } catch {
      setAuthError('Profile update failed');
    } finally {
      setProfileLoading(false);
    }
  };

  const updateRoomSettings = async (roomIdToUpdate, { logo, description }) => {
    if (!sessionTokenRef.current || !roomIdToUpdate) return;

    setProfileLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/rooms/${encodeURIComponent(roomIdToUpdate)}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionTokenRef.current}`,
        },
        body: JSON.stringify({ logo, description }),
      });

      const body = await response.json();
      if (!response.ok) {
        setAuthError(body?.error || 'Room settings update failed');
        return;
      }

      setConversations((prev) => ({
        ...prev,
        [roomIdToUpdate]: {
          ...prev[roomIdToUpdate],
          logo: body.room.logo || null,
          description: body.room.description || '',
        },
      }));
      setShowRoomSettings(null);
    } catch {
      setAuthError('Room settings update failed');
    } finally {
      setProfileLoading(false);
    }
  };

  const sendFriendRequest = async (targetUsername) => {
    if (!sessionTokenRef.current) return;
    const response = await fetch(`${API_BASE_URL}/friends/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionTokenRef.current}`,
      },
      body: JSON.stringify({ username: targetUsername }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to send friend request');
    }
    return data;
  };

  const removeFriend = async (targetUsername) => {
    if (!sessionTokenRef.current) return;
    const response = await fetch(`${API_BASE_URL}/friends/${encodeURIComponent(targetUsername)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${sessionTokenRef.current}`,
      },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to remove friend');
    }
    return data;
  };

  const startDMWithUser = (targetUsername) => {
    if (!username || !targetUsername) return;
    const dmRoom = `dm:${[username, targetUsername].sort().join(':')}`;
    setRoomId(dmRoom);
    createRoom({ roomId: dmRoom, type: 'dm', members: targetUsername });
  };

  // Show auth page when not logged in
  if (!userSet) {
    return (
      <AuthPage
        onLogin={loginUser}
        onRegister={registerUser}
        loading={authLoading}
        error={authError}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-surface-800 antialiased">
      <ConnectionStatus status={connectionStatus} />

      {/* ── Top header ───────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 h-12 bg-surface-600 border-b border-surface-300 shadow-sm flex-shrink-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-content-muted text-lg font-bold select-none">#</span>
          <h2 className="m-0 text-base font-semibold text-content-primary whitespace-nowrap overflow-hidden text-ellipsis">
            {activeRoom || 'Select a room'}
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            className="bg-transparent border-0 p-2 rounded text-content-muted cursor-pointer flex items-center justify-center transition-colors duration-100 hover:bg-surface-500 hover:text-content-normal"
            onClick={() => setShowSearchModal(true)}
            title="Search messages"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.71 20.29L18 16.61A9 9 0 1 0 16.61 18l3.68 3.68a1 1 0 0 0 1.42 0 1 1 0 0 0 0-1.39zM11 18a7 7 0 1 1 7-7 7 7 0 0 1-7 7z"/>
            </svg>
          </button>
          <button
            className="w-8 h-8 rounded-full border-0 cursor-pointer flex items-center justify-center font-semibold text-sm text-white overflow-hidden transition-all duration-150 hover:scale-105 hover:ring-2 hover:ring-blurple p-0"
            onClick={() => setShowUserSettings(true)}
            title="User Settings"
            style={{ backgroundColor: profilePicture ? 'transparent' : usernameColor }}
          >
            {profilePicture ? (
              <img src={profilePicture} alt={username} className="w-full h-full object-cover" />
            ) : (
              username.charAt(0).toUpperCase()
            )}
          </button>
          <span className="text-sm font-medium hidden sm:inline" style={{ color: usernameColor }}>{username}</span>
          <button
            className="px-3 py-1 bg-transparent border border-surface-300 text-content-normal text-xs rounded cursor-pointer transition-colors duration-100 hover:bg-status-red hover:border-status-red hover:text-white"
            onClick={logoutUser}
          >
            Logout
          </button>
        </div>
      </header>

      {/* ── Search modal ─────────────────────────────────────────── */}
      {showSearchModal && (
        <div
          className="fixed inset-0 bg-black/70 flex justify-center pt-24 z-[1000]"
          onClick={() => setShowSearchModal(false)}
        >
          <div
            className="bg-surface-700 rounded-xl w-full max-w-[600px] max-h-[500px] flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden h-fit"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={searchMessages} className="flex items-center gap-3 px-4 py-3 border-b border-surface-800">
              <svg className="text-content-muted flex-shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21.71 20.29L18 16.61A9 9 0 1 0 16.61 18l3.68 3.68a1 1 0 0 0 1.42 0 1 1 0 0 0 0-1.39zM11 18a7 7 0 1 1 7-7 7 7 0 0 1-7 7z"/>
              </svg>
              <input
                type="text"
                className="flex-1 bg-transparent border-0 text-lg text-content-normal outline-none placeholder:text-content-muted"
                placeholder="Search... @user #room or text"
                value={smartSearch}
                onChange={(e) => setSmartSearch(e.target.value)}
                autoFocus
              />
              {searchLoading && (
                <span className="w-4 h-4 border-2 border-surface-800 border-t-blurple rounded-full animate-spin flex-shrink-0" />
              )}
            </form>
            <div className="flex gap-4 px-4 py-2 text-xs text-content-muted bg-surface-800">
              <span><code className="bg-surface-700 px-1.5 py-0.5 rounded text-blurple font-mono">@username</code> user</span>
              <span><code className="bg-surface-700 px-1.5 py-0.5 rounded text-blurple font-mono">#room</code> room</span>
              <span><code className="bg-surface-700 px-1.5 py-0.5 rounded text-blurple font-mono">text</code> messages</span>
            </div>
            {searchError && <p className="px-4 py-3 text-status-red text-sm m-0">{searchError}</p>}
            {searchResults.length > 0 && (
              <ul className="list-none p-0 m-0 overflow-y-auto flex-1">
                {searchResults.map((result, index) => (
                  <li
                    key={`${result.roomId}-${index}`}
                    className="px-4 py-3 cursor-pointer border-b border-surface-800 transition-colors duration-100 hover:bg-surface-500"
                    onClick={() => {
                      setActiveRoom(result.roomId);
                      setRoomId(result.roomId);
                      joinRoom(result.roomId);
                      setShowSearchModal(false);
                    }}
                  >
                    <div className="flex gap-2 mb-1">
                      <span className="font-semibold text-content-secondary text-xs">#{result.roomId}</span>
                      <span className="text-content-muted text-xs">@{result.username}</span>
                    </div>
                    <div className="text-content-normal text-sm whitespace-nowrap overflow-hidden text-ellipsis">{result.text}</div>
                  </li>
                ))}
              </ul>
            )}
            {!searchLoading && searchResults.length === 0 && smartSearch.trim() && !searchError && (
              <p className="p-4 text-center text-content-muted text-sm m-0">Press Enter to search</p>
            )}
          </div>
        </div>
      )}

      {showUserSettings && (
        <UserSettings
          username={username}
          usernameColor={usernameColor}
          profilePicture={profilePicture}
          onUpdateProfile={updateProfile}
          onLogoutEverywhere={logoutEverywhere}
          onClose={() => setShowUserSettings(false)}
          loading={profileLoading}
        />
      )}

      {showRoomSettings && (
        <RoomSettings
          roomId={showRoomSettings.roomId}
          currentLogo={showRoomSettings.logo}
          currentDescription={showRoomSettings.description}
          onUpdateRoomSettings={updateRoomSettings}
          onClose={() => setShowRoomSettings(null)}
          loading={profileLoading}
        />
      )}

      {viewingProfile && (
        <UserProfile
          username={viewingProfile}
          sessionToken={sessionTokenRef.current}
          onSendFriendRequest={sendFriendRequest}
          onRemoveFriend={removeFriend}
          onClose={() => setViewingProfile(null)}
        />
      )}

      {/* ── Three-column layout ───────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Left sidebar */}
        <aside className="w-60 min-w-[240px] bg-surface-700 flex flex-col overflow-y-auto border-r border-surface-300 flex-shrink-0">
          <h3 className="px-4 m-0 text-xs font-semibold text-content-secondary uppercase tracking-wider h-12 flex items-center border-b border-surface-800 flex-shrink-0">
            Rooms
          </h3>

          <RoomControls
            roomId={roomId}
            onRoomIdChange={setRoomId}
            onJoinRoom={joinRoom}
            onCreateRoom={createRoom}
            onJoinByInvite={joinByInvite}
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
            onKickMember={kickMember}
            onBanMember={banMember}
            onOpenRoomSettings={(roomId, info) => {
              setShowRoomSettings({ roomId, logo: info.logo || null, description: info.description || '' });
            }}
            onRoomSelect={(id) => {
              setActiveRoom(id);
              setRoomId(id);
              joinRoom(id);
              setUnreadCounts(prev => ({ ...prev, [id]: 0 }));
            }}
          />

          <FriendList
            sessionToken={sessionTokenRef.current}
            onViewProfile={setViewingProfile}
            onStartDM={startDMWithUser}
            currentUsername={username}
          />
        </aside>

        {/* Main chat column */}
        <main className="flex-1 flex flex-col bg-surface-600 overflow-hidden min-w-0">
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
            activeRoom={activeRoom}
          />
        </main>

        {/* Right members sidebar */}
        <aside className="w-60 bg-surface-700 border-l border-surface-300 flex flex-col overflow-y-auto flex-shrink-0 hidden xl:flex">
          <MemberList
            roomId={activeRoom}
            sessionToken={sessionTokenRef.current}
            onViewProfile={setViewingProfile}
            currentUsername={username}
          />
        </aside>
      </div>
    </div>
  );
}

export default App
