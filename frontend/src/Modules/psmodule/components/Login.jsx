import { useState } from 'react';
import { login } from '../api';

export default function Login({ onLoggedIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      onLoggedIn?.();
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="loginFormView">
      <p className="loginFormHint">Use your Django username/password (JWT auth).</p>
      <form onSubmit={onSubmit} className="loginForm">
        <label className="loginField">
          <span className="loginFieldLabel">
            USERNAME <span className="loginRequired">*</span>
          </span>
          <input
            placeholder="Username / Roll No."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="loginField">
          <span className="loginFieldLabel">
            PASSWORD <span className="loginRequired">*</span>
          </span>
          <div className="inputWithIcon">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <span className="inputIcon">👁️</span>
          </div>
        </label>
        <div className="loginFormFooter">
          <div className="loginReset">Reset Password</div>
          {error ? <div className="error">{error}</div> : <div className="loginSpacer" />}
        </div>
        <button className="btn loginSubmit" disabled={loading}>
          {loading ? 'Signing in…' : 'Login'}
        </button>
      </form>
    </div>
  );
}
