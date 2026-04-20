import { Btn, Chip } from '../../shared/components/index.jsx'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { useUser } from '../../shared/store/userContext.jsx'
import { APP_VERSION } from '../../shared/services/appConfig.js'

export default function TopNav() {
  const { state, actions } = useWizard()
  const { user, logout } = useUser()
  const { readOnly } = state
  const appVersion = `v${APP_VERSION}`

  function handleBrandClick() {
    if (readOnly) return
    actions.setNavigationMode('etl-management')
  }

  function handleLogout() {
    logout('manual')
  }

  return (
    <div style={{
      background: 'var(--surf)', borderBottom: '1px solid var(--border)',
      padding: '0 32px', display: 'flex', alignItems: 'center',
      height: 56, gap: 16, flexShrink: 0,
    }}>
      <button
        type="button"
        onClick={handleBrandClick}
        style={{
          fontWeight: 700,
          fontSize: 18,
          color: 'var(--accent)',
          letterSpacing: 1,
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          cursor: readOnly ? 'default' : 'pointer',
        }}
        aria-label={readOnly ? 'ETL Management (view only)' : 'Go to ETL management'}
      >
        ETL<span style={{ color: 'var(--text)' }}>Management</span>
      </button>
      <Chip c="purple">ENTERPRISE</Chip>
      <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
        {appVersion}
      </span>
      {readOnly && (
        <Chip c="amber" style={{ fontWeight: 700, letterSpacing: '0.04em' }}>
           VIEW ONLY
        </Chip>
      )}
      <div style={{ flex: 1 }} />
      <Btn
        v="ghost" sm
        onClick={() => actions.toggleTheme()}
      >
        {state.theme === 'dark' ? ' Light' : ' Dark'}
      </Btn>
      {!readOnly && (
        <Btn v="danger" sm onClick={handleLogout}>Logout</Btn>
      )}
    </div>
  )
}
