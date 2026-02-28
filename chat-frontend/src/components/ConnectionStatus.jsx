export default function ConnectionStatus({ status }) {
  const base = 'fixed top-0 left-0 right-0 px-4 py-1.5 text-xs font-medium flex items-center justify-center gap-2 z-[100] transition-transform duration-150';
  const variant =
    status === 'connected'
      ? '-translate-y-full bg-status-green text-white'
      : status === 'disconnected'
        ? 'translate-y-0 bg-status-red text-white'
        : status === 'reconnecting' || status === 'connecting'
          ? 'translate-y-0 bg-status-yellow text-black'
          : 'translate-y-0 bg-zinc-600 text-white';

  return (
    <div className={`${base} ${variant}`}>
      <span className="w-2 h-2 rounded-full bg-current flex-shrink-0" />
      {status === 'connected' && 'Connected'}
      {status === 'disconnected' && 'Disconnected'}
      {status === 'reconnecting' && 'Reconnecting...'}
      {status === 'connecting' && 'Connecting...'}
      {status === 'error' && 'Error'}
    </div>
  );
}
