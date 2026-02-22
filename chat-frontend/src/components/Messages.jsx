export default function Messages({
  messages,
  activeRoom,
  typingUsers = [],
  readBy = [],
  onLoadOlder,
  hasMore = false,
  loadingHistory = false,
}) {
  const formatTimestamp = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="messages-container">
      {hasMore && (
        <button
          className="load-older"
          onClick={onLoadOlder}
          disabled={loadingHistory}
        >
          {loadingHistory ? 'Loading...' : 'Load older messages'}
        </button>
      )}
      <ul className="messages-list">
        {/* Filter messages to only show those from the active room */}
        {messages
          .filter(m => m.roomId === activeRoom)
          .map((m) => (
            <li
              key={m.id}
              className={`message-item ${m.type === "SYSTEM" ? "system" : "user-message"}${
                m.roomId && m.roomId.startsWith("dm:") ? " dm" : ""
              }`}
            >
              {m.type === "SYSTEM"
                ? `[SYSTEM] ${m.text}`
                : `[${m.roomId}] ${m.username || "Unknown"}: ${m.text}`}
              {m.createdAt && (
                <span className="message-time">{formatTimestamp(m.createdAt)}</span>
              )}
            </li>
          ))}
        {typingUsers.length > 0 && (
          <li className="message-item typing-indicator">
            {typingUsers.length === 1
              ? `${typingUsers[0]} is typing...`
              : `${typingUsers.join(', ')} are typing...`}
          </li>
        )}
      </ul>
      {readBy.length > 0 && (
        <div className="read-receipts">Seen by {readBy.join(', ')}</div>
      )}
    </div>
  );
}
