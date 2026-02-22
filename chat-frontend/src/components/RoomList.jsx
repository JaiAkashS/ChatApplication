export default function RoomList({ conversations, activeRoom, onRoomSelect, unreadCounts }) {
  return (
    <div className="conversations-container">
      <ul className="conversations-list">
        {/* Display all conversations, highlight the active room */}
        {Object.entries(conversations).map(([roomId, info]) => (
          <li
            key={roomId}
            onClick={() => onRoomSelect(roomId)}
            className={`conversation-item ${activeRoom === roomId ? "active" : ""}`}
          >
            <span className="conversation-label">
              {info.type === "dm"
                ? `@${info.with}`
                : info.type === "private"
                  ? `#${roomId} (private)`
                  : `#${roomId}`}
            </span>
            {unreadCounts?.[roomId] > 0 && (
              <span className="unread-badge">{unreadCounts[roomId]}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
