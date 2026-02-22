export default function MessageInput({ message, onMessageChange, onSendMessage, onStopTyping }) {
  return (
    <div className="message-input-section">
      <input
        placeholder="message"
        value={message}
        onChange={(e) => onMessageChange(e.target.value)}
        onBlur={() => {
          if (onStopTyping) {
            onStopTyping();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onSendMessage();
          }
        }}
      />
      <button onClick={onSendMessage}>Send</button>
    </div>
  );
}
