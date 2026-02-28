import { useState } from 'react';

export default function AuthPage({ onLogin, onRegister, loading = false, error = '' }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setLocalError('');
    if (!username.trim() || !password.trim()) {
      setLocalError('Username and password are required');
      return;
    }
    if (isRegisterMode) {
      if (password !== confirmPassword) { setLocalError('Passwords do not match'); return; }
      if (password.length < 6) { setLocalError('Password must be at least 6 characters'); return; }
      onRegister(username.trim(), password);
    } else {
      onLogin(username.trim(), password);
    }
  };

  const displayError = localError || error;
  const inputCls =
    'w-full px-3 py-3 bg-surface-800 rounded-lg text-content-normal text-sm outline-none ' +
    'focus:ring-2 focus:ring-blurple placeholder:text-content-muted transition-all duration-150';

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-800 p-4">
      <div className="w-full max-w-[400px] bg-surface-600 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-8">

        {/* Logo + heading */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blurple rounded-2xl mb-4 text-white shadow-lg">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
              <path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-content-primary m-0 mb-1">
            {isRegisterMode ? 'Create account' : 'Welcome back!'}
          </h1>
          <p className="text-sm text-content-muted m-0">
            {isRegisterMode ? 'Join Relayr and start chatting' : 'Sign in to continue to Relayr'}
          </p>
        </div>

        {/* Form */}
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-xs font-bold uppercase text-content-secondary tracking-wider">
              Username
            </label>
            <input id="username" type="text" className={inputCls} value={username}
              onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username"
              autoComplete="username" autoFocus />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-bold uppercase text-content-secondary tracking-wider">
              Password
            </label>
            <input id="password" type="password" className={inputCls} value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password"
              autoComplete={isRegisterMode ? 'new-password' : 'current-password'} />
          </div>

          {isRegisterMode && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmPassword" className="text-xs font-bold uppercase text-content-secondary tracking-wider">
                Confirm Password
              </label>
              <input id="confirmPassword" type="password" className={inputCls} value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm your password"
                autoComplete="new-password" />
            </div>
          )}

          {displayError && (
            <div className="bg-status-red/10 border border-status-red rounded-lg px-3 py-3 text-status-red-light text-sm text-center">
              {displayError}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-blurple text-white border-0 rounded-lg text-sm font-semibold cursor-pointer
                       transition-colors duration-150 hover:bg-blurple-hover disabled:opacity-60 disabled:cursor-not-allowed mt-1">
            {loading ? 'Please wait...' : (isRegisterMode ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        {/* Switch mode */}
        <div className="mt-5 text-center text-content-muted text-sm">
          {isRegisterMode ? (
            <p className="m-0">
              Already have an account?{' '}
              <button type="button" className="bg-transparent border-0 text-content-link text-sm cursor-pointer p-0 hover:underline"
                onClick={() => { setIsRegisterMode(false); setLocalError(''); setConfirmPassword(''); }}>
                Sign In
              </button>
            </p>
          ) : (
            <p className="m-0">
              Need an account?{' '}
              <button type="button" className="bg-transparent border-0 text-content-link text-sm cursor-pointer p-0 hover:underline"
                onClick={() => { setIsRegisterMode(true); setLocalError(''); }}>
                Register
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
