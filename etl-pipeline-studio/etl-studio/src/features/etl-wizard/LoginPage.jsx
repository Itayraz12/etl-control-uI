import { useState } from 'react';
import { useUser } from '../../shared/store/userContext.jsx';
import { useMockMode } from '../../shared/store/mockModeContext.jsx';
import { useTeamNames } from '../../shared/store/teamNamesContext.jsx';

export default function LoginPage() {
  const { login } = useUser();
  const { useMock, setUseMock } = useMockMode();
  const { teamNames, loadingTeamNames, teamNamesError, refreshTeamNames } = useTeamNames();
  const appVersion = `v${__APP_VERSION__}`;
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [teamName, setTeamName] = useState('');

  const canSubmit = Boolean(userId.trim() && password && teamName) && !loadingTeamNames;

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    login({ userId, teamName });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div style={{ marginBottom: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
        <div style={{ fontSize: 36, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>ETL Studio</div>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>Enterprise Data Integration Platform</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{appVersion}</div>
      </div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 24, color: 'var(--text)' }}>Log In</div>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <select
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            required
            disabled={loadingTeamNames || teamNames.length === 0}
            aria-label="Team Name"
            style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border)', fontSize: 16, background: 'var(--surf)', color: 'var(--text)' }}
          >
            <option value="">{loadingTeamNames ? 'Loading team names...' : 'Select Team Name'}</option>
            {teamNames.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>

          {loadingTeamNames && (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading team names from the backend…</div>
          )}

          {!loadingTeamNames && teamNamesError && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--danger)' }}>{teamNamesError}</div>
              <button
                type="button"
                onClick={refreshTeamNames}
                style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surf)', color: 'var(--text)', fontSize: 14, cursor: 'pointer' }}
              >
                Retry loading teams
              </button>
            </div>
          )}

          {!loadingTeamNames && !teamNamesError && teamNames.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--warning)' }}>No team names are available.</div>
          )}
        </div>
        <label style={{ fontWeight: 500, fontSize: 15 }}>
          <input
            type="checkbox"
            checked={useMock}
            onChange={e => setUseMock(e.target.checked)}
            style={{ marginRight: 8 }}
          />
          Use Mock Data
        </label>
        <button type="submit" disabled={!canSubmit} style={{ padding: 10, borderRadius: 6, background: 'var(--accent)', color: 'white', fontWeight: 600, fontSize: 16, border: 'none', opacity: canSubmit ? 1 : 0.6, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>Login</button>
      </form>
    </div>
  );
}
