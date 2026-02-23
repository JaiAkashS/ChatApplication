export default function MessageInput({ message, onMessageChange, onSendMessage, onStopTyping, activeRoom }) {
  return (
    <div className="message-input-section">
      <div className="message-input-wrapper">
        <input
          placeholder={activeRoom ? `Message #${activeRoom}` : 'Select a channel to start chatting'}
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          onBlur={() => {
            if (onStopTyping) {
              onStopTyping();
            }
          }}
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
