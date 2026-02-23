import { useEffect, useRef, useState } from 'react'

export default function RoomList({
  conversations,
  activeRoom,
  onRoomSelect,
  unreadCounts,
  onKickMember,
  onBanMember,
}) {
  const [openModerationRoomId, setOpenModerationRoomId] = useState(null);
  const [moderationUsernames, setModerationUsernames] = useState({});
  const moderationMenuRef = useRef(null);

  useEffect(() => {
    if (!openModerationRoomId) return;

    const handleOutsideClick = (event) => {
      if (moderationMenuRef.current && !moderationMenuRef.current.contains(event.target)) {
        setOpenModerationRoomId(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [openModerationRoomId]);

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
            <div className="conversation-right">
              {unreadCounts?.[roomId] > 0 && (
                <span className="unread-badge">{unreadCounts[roomId]}</span>
              )}

              {info.type === 'private' && (
                <div className="room-menu-wrapper" ref={openModerationRoomId === roomId ? moderationMenuRef : null}>
                  <button
                    className="secondary room-menu-trigger"
                    type="button"
                    aria-label={`Open moderation menu for ${roomId}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenModerationRoomId((prev) => (prev === roomId ? null : roomId));
                    }}
                  >
                    ⋯
                  </button>

                  {openModerationRoomId === roomId && (
                    <div
                      className="room-menu-dropdown"
                      role="menu"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {info.inviteCode && (
                        <>
                          <div className="room-menu-title">Invite Code</div>
                          <div className="invite-code-section">
                            <code className="invite-code">{info.inviteCode}</code>
                            <button
                              className="secondary invite-copy-btn"
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(info.inviteCode);
                              }}
                            >
                              Copy
                            </button>
                          </div>
                        </>
                      )}
                      <div className="room-menu-title">Moderation</div>
                      <input
                        placeholder="username"
                        value={moderationUsernames[roomId] || ''}
                        onChange={(event) => {
                          const value = event.target.value;
                          setModerationUsernames((prev) => ({ ...prev, [roomId]: value }));
                        }}
                      />
                      <div className="room-moderation-actions">
                        <button
                          className="secondary"
                          type="button"
                          onClick={() => {
                            onKickMember?.(roomId, moderationUsernames[roomId] || '');
                            setOpenModerationRoomId(null);
                          }}
                        >
                          Kick
                        </button>
                        <button
                          className="secondary"
                          type="button"
                          onClick={() => {
                            onBanMember?.(roomId, moderationUsernames[roomId] || '');
                            setOpenModerationRoomId(null);
                          }}
                        >
                          Ban
                        </button>
                      </div>
                      <div className="panel-hint">Owner only. Private groups only.</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
