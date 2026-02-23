export default function UserSetup({
  userSet,
  username,
  password,
  authLoading,
  authError,
  onUsernameChange,
  onPasswordChange,
  onRegister,
  onLogin,
}) {
  if (userSet) return null;

  return (
    <div className="user-input-section">
      <input
        placeholder='username'
        value={username}
        onChange={(e) => onUsernameChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onLogin();
          }
        }}
      />
      <input
        placeholder='password'
        type='password'
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onLogin();
          }
        }}
      />
      <div className="auth-actions">
        <button onClick={onRegister} disabled={authLoading}>Register</button>
        <button onClick={onLogin} disabled={authLoading}>Login</button>
      </div>
      {authError && <div className="auth-error">{authError}</div>}
    </div>
  );
}
