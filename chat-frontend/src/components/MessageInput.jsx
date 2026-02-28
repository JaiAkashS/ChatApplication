export default function MessageInput({ message, onMessageChange, onSendMessage, onStopTyping, activeRoom }) {
  return (
    <div className="px-4 pb-5 pt-2 bg-surface-600">
      <div className="bg-surface-700 rounded-xl flex items-center shadow-sm transition-shadow focus-within:ring-1 focus-within:ring-blurple/50">
        <input
          className="flex-1 bg-transparent border-0 py-3 px-4 text-base text-content-normal rounded-xl outline-none placeholder:text-content-muted"
          placeholder={activeRoom ? `Message #${activeRoom}` : 'Select a room to start chatting'}
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          onBlur={() => { if (onStopTyping) onStopTyping(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSendMessage();
            }
          }}
        />
      </div>
    </div>
  );
}
