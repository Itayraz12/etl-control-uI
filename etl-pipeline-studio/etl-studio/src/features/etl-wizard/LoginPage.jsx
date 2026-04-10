import { useState } from 'react';
import { useUser } from '../../shared/store/userContext.jsx';
import { useMockMode } from '../../shared/store/mockModeContext.jsx';
import { APP_VERSION } from '../../shared/services/appConfig.js';
import { loginUser, MOCK_TEAM_NAMES, USER_ROLES } from '../../shared/services/authService.js';

export default function LoginPage() {
  const { login } = useUser();
  const { useMock, setUseMock } = useMockMode();
  const appVersion = `v${APP_VERSION}`;
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [teamName, setTeamName] = useState('');
  const [loginError, setLoginError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMock
    ? Boolean(userId.trim() && password && teamName)
    : Boolean(userId.trim() && password);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    setLoginError('');
    setSubmitting(true);

    try {
      if (useMock) {
        login({ userId, teamName, role: USER_ROLES.REGULAR });
        return;
      }

      const authenticatedUser = await loginUser({ username: userId, password });
      login(authenticatedUser);
    } catch (error) {
      setLoginError(error?.message || 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleMockToggle(checked) {
    setUseMock(checked);
    setLoginError('');
    if (!checked) {
      setTeamName('');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div style={{ marginBottom: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
        <div style={{ fontSize: 36, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>ETL Studio</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{appVersion}</div>
      </div>
      <div style={{
        background: 'var(--surf)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        padding: '36px 40px 32px',
        minWidth: 360,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 24, color: 'var(--text)', textAlign: 'center' }}>Log In</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input
            type="text"
            placeholder="User ID"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            required
            style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border)', fontSize: 16, background: 'var(--bg)', color: 'var(--text)' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border)', fontSize: 16, background: 'var(--bg)', color: 'var(--text)' }}
          />
          <label style={{ fontWeight: 500, fontSize: 15, color: 'var(--text)' }}>
            <input
              type="checkbox"
              checked={useMock}
              onChange={e => handleMockToggle(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Use Mock Data
          </label>
          {useMock && (
            <select
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              required
              aria-label="Team Name"
              style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border)', fontSize: 16, background: 'var(--bg)', color: 'var(--text)' }}
            >
              <option value="">Select Team Name</option>
              {MOCK_TEAM_NAMES.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          )}
          {loginError && (
            <div style={{ fontSize: 12, color: 'var(--danger)' }}>{loginError}</div>
          )}
          <button type="submit" disabled={!canSubmit || submitting} style={{ padding: 10, borderRadius: 6, background: 'var(--accent)', color: 'white', fontWeight: 600, fontSize: 16, border: 'none', opacity: canSubmit && !submitting ? 1 : 0.6, cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed', marginTop: 8 }}>{submitting ? 'Logging in...' : 'Login'}</button>
        </form>
      </div>
    </div>
  );
}
