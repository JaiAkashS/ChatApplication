export default function ConnectionStatus({ status }) {
  return (
    <div className={`connection-status ${status}`}>
      {status === "connected" && "✓ Connected"}
      {status === "disconnected" && "✗ Disconnected"}
      {status === "reconnecting" && "⟳ Reconnecting..."}
      {status === "connecting" && "⟳ Connecting..."}
      {status === "error" && "⚠ Error"}
    </div>
  );
}
