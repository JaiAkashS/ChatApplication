import { useEffect, useRef, useState } from 'react'

export default function RoomList({
  conversations,
  activeRoom,
  onRoomSelect,
  unreadCounts,
  onKickMember,
  onBanMember,
  onOpenRoomSettings,
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

  const getInitials = (name) => {
    return name?.charAt(0).toUpperCase() || '#';
  };

  return (
    <div className="flex-1 overflow-y-auto py-2 px-2 min-h-0">
      <ul className="list-none p-0 m-0">
        {Object.entries(conversations).map(([roomId, info]) => (
          <li
            key={roomId}
            onClick={() => onRoomSelect(roomId)}
            className={`group flex items-center justify-between px-2 py-1.5 rounded-md mb-0.5 cursor-pointer text-sm font-medium transition-colors duration-100 ${
              activeRoom === roomId
                ? 'bg-surface-400 text-white'
                : 'text-content-muted hover:bg-surface-500 hover:text-content-normal'
            }`}
          >
            {/* Left: logo + label */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-7 h-7 rounded-lg bg-surface-400 flex items-center justify-center font-semibold text-xs text-content-normal overflow-hidden flex-shrink-0">
                {info.logo ? (
                  <img src={info.logo} alt={roomId} className="w-full h-full object-cover" />
                ) : (
                  <span>{info.type === 'dm' ? '@' : getInitials(roomId)}</span>
                )}
              </div>
              <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                {info.type === 'dm'
                  ? `@${info.with}`
                  : info.type === 'private'
                    ? `#${roomId}`
                    : `#${roomId}`}
              </span>
            </div>

            {/* Right: unread badge + context menu */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {unreadCounts?.[roomId] > 0 && (
                <span className="min-w-[16px] h-4 px-1 rounded-full bg-status-red text-white text-[11px] font-bold inline-flex items-center justify-center">
                  {unreadCounts[roomId]}
                </span>
              )}

              {info.type === 'private' && (
                <div
                  className="relative"
                  ref={openModerationRoomId === roomId ? moderationMenuRef : null}
                >
                  <button
                    className="w-6 h-6 p-0 rounded text-sm leading-none bg-transparent text-content-muted border-0 cursor-pointer
                               opacity-0 group-hover:opacity-100 transition-opacity duration-100 hover:bg-surface-500 hover:text-content-normal"
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
                      className="absolute top-[calc(100%+4px)] right-0 w-52 p-2 flex flex-col gap-2 bg-surface-900 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.4)] z-[100]"
                      role="menu"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {info.inviteCode && (
                        <>
                          <p className="m-0 text-[11px] font-semibold text-content-secondary uppercase tracking-wide px-2 pt-1">
                            Invite Code
                          </p>
                          <div className="flex items-center gap-2 px-2">
                            <code className="flex-1 px-2 py-1.5 bg-surface-800 rounded font-mono text-xs text-status-green-light tracking-wider truncate">
                              {info.inviteCode}
                            </code>
                            <button
                              className="secondary text-xs px-2 py-1"
                              type="button"
                              onClick={() => navigator.clipboard.writeText(info.inviteCode)}
                            >
                              Copy
                            </button>
                          </div>
                        </>
                      )}
                      {info.isOwner && (
                        <>
                          <p className="m-0 text-[11px] font-semibold text-content-secondary uppercase tracking-wide px-2 pt-1">
                            Room Settings
                          </p>
                          <button
                            className="secondary room-settings-btn"
                            type="button"
                            onClick={() => {
                              onOpenRoomSettings?.(roomId, info);
                              setOpenModerationRoomId(null);
                            }}
                          >
                            Edit Room Logo
                          </button>
                        </>
                      )}
                      <p className="m-0 text-[11px] font-semibold text-content-secondary uppercase tracking-wide px-2 pt-1">
                        Moderation
                      </p>
                      <input
                        placeholder="username"
                        value={moderationUsernames[roomId] || ''}
                        onChange={(event) => {
                          const value = event.target.value;
                          setModerationUsernames((prev) => ({ ...prev, [roomId]: value }));
                        }}
                      />
                      <div className="flex gap-2">
                        <button
                          className="secondary flex-1"
                          type="button"
                          onClick={() => {
                            onKickMember?.(roomId, moderationUsernames[roomId] || '');
                            setOpenModerationRoomId(null);
                          }}
                        >
                          Kick
                        </button>
                        <button
                          className="secondary flex-1"
                          type="button"
                          onClick={() => {
                            onBanMember?.(roomId, moderationUsernames[roomId] || '');
                            setOpenModerationRoomId(null);
                          }}
                        >
                          Ban
                        </button>
                      </div>
                      <p className="m-0 text-content-muted text-[11px] px-2 pb-1">Owner only. Private groups only.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Settings gear for public rooms (owner only) */}
              {info.type !== 'private' && info.type !== 'dm' && info.isOwner && (
                <button
                  className="w-6 h-6 p-0 rounded text-sm leading-none bg-transparent text-content-muted border-0 cursor-pointer
                             opacity-0 group-hover:opacity-100 transition-opacity duration-100 hover:bg-surface-500"
                  type="button"
                  title="Room Settings"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenRoomSettings?.(roomId, info);
                  }}
                >
                  ⚙
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
