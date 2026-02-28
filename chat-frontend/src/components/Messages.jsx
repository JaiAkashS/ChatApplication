import { sanitizeForDisplay, linkifyText } from '../utils/sanitize';

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
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    if (isToday) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return (
      date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' ' +
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  };

  const getInitials = (name) => name?.charAt(0).toUpperCase() || '?';

  const renderMessageText = (text) => {
    const sanitized = sanitizeForDisplay(text || '');
    const withLinks = linkifyText(sanitized);
    if (withLinks === sanitized || !withLinks.includes('<a ')) return sanitized;
    return <span dangerouslySetInnerHTML={{ __html: withLinks }} />;
  };

  return (
    <div className="flex-1 overflow-y-auto bg-surface-600 scroll-smooth">
      {hasMore && (
        <div className="flex justify-center pt-3 pb-1">
          <button
            className="bg-transparent border-0 text-content-link text-xs px-3 py-1.5 cursor-pointer hover:underline transition-colors"
            onClick={onLoadOlder}
            disabled={loadingHistory}
          >
            {loadingHistory ? 'Loading...' : 'Load older messages'}
          </button>
        </div>
      )}

      <ul className="list-none p-0 m-0 flex flex-col pb-2">
        {messages
          .filter((m) => m.roomId === activeRoom)
          .map((m) => (
            <li
              key={m.id}
              className={
                m.type === 'SYSTEM'
                  ? /* centred divider style */
                    'flex items-center gap-3 px-4 py-1 my-1 text-xs text-content-muted ' +
                    'before:flex-1 before:h-px before:bg-surface-300 ' +
                    'after:flex-1 after:h-px after:bg-surface-300'
                  : /* normal chat message */
                    'relative pl-[72px] pr-4 pt-1 pb-1 mt-4 min-h-[2.75rem] ' +
                    'hover:bg-surface-500/50 transition-colors duration-75'
              }
            >
              {m.type === 'SYSTEM' ? (
                <span className="whitespace-nowrap px-2">{m.text}</span>
              ) : (
                <>
                  {/* Avatar */}
                  <div
                    className="absolute left-4 top-1 w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm text-white overflow-hidden flex-shrink-0"
                    style={{
                      backgroundColor: m.profilePicture
                        ? 'transparent'
                        : (m.usernameColor || '#5865f2'),
                    }}
                  >
                    {m.profilePicture ? (
                      <img src={m.profilePicture} alt={m.username} className="w-full h-full object-cover" />
                    ) : (
                      <span>{getInitials(m.username)}</span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="font-semibold text-sm cursor-pointer hover:underline leading-none"
                        style={{ color: m.usernameColor || '#dcddde' }}
                      >
                        {m.username || 'Unknown'}
                      </span>
                      {m.createdAt && (
                        <span className="text-[11px] text-content-muted font-normal">
                          {formatTimestamp(m.createdAt)}
                        </span>
                      )}
                    </div>
                    <span className="block text-content-normal text-sm leading-snug break-words">
                      {renderMessageText(m.text)}
                    </span>
                  </div>
                </>
              )}
            </li>
          ))}

        {typingUsers.length > 0 && (
          <li className="flex items-center gap-2 px-4 py-1.5 pl-[72px] text-xs text-content-muted">
            <span className="typing-dots" />
            {typingUsers.length === 1
              ? `${typingUsers[0]} is typing...`
              : `${typingUsers.join(', ')} are typing...`}
          </li>
        )}
      </ul>

      {readBy.length > 0 && (
        <div className="text-[11px] text-content-muted pl-[72px] pb-2 px-4">
          Seen by {readBy.join(', ')}
        </div>
      )}
    </div>
  );
}

