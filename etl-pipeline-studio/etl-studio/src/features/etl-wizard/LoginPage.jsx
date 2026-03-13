import { useState } from 'react';
import { useUser } from '../../shared/store/userContext.jsx';
import { useMockMode } from '../../shared/store/mockModeContext.jsx';

export default function LoginPage() {
  const { login } = useUser();
  const { useMock, setUseMock } = useMockMode();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [teamName, setTeamName] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    login({ userId, teamName });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div style={{ marginBottom: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
        <div style={{ fontSize: 36, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>ETL Studio</div>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>Enterprise Data Integration Platform</div>
      </div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 24, color: 'var(--text)' }}>Sign In</div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 320 }}>
        <input
          type="text"
          placeholder="User ID"
          value={userId}
          onChange={e => setUserId(e.target.value)}
          required
          style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border)', fontSize: 16 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border)', fontSize: 16 }}
        />
        <input
          type="text"
          placeholder="Team Name"
          value={teamName}
          onChange={e => setTeamName(e.target.value)}
          required
          style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border)', fontSize: 16 }}
        />
        <label style={{ fontWeight: 500, fontSize: 15 }}>
          <input
            type="checkbox"
            checked={useMock}
            onChange={e => setUseMock(e.target.checked)}
            style={{ marginRight: 8 }}
          />
          Use Mock Data
        </label>
        <button type="submit" style={{ padding: 10, borderRadius: 6, background: 'var(--accent)', color: 'white', fontWeight: 600, fontSize: 16, border: 'none' }}>Login</button>
      </form>
    </div>
  );
}
