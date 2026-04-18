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
    <div className="card">
      <h2>Sign in</h2>
      <p className="muted">Use your Django username/password (JWT auth).</p>
      <form onSubmit={onSubmit} className="form">
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error ? <div className="error">{error}</div> : null}
        <button className="btn" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
