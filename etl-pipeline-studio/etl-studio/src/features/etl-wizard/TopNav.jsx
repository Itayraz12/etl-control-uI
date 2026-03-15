import { Btn, Chip } from '../../shared/components/index.jsx'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { useUser } from '../../shared/store/userContext.jsx'

export default function TopNav() {
  const { state, actions } = useWizard()
  const { logout } = useUser()

  function handleBrandClick() {
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
          cursor: 'pointer',
        }}
        aria-label="Go to ETL management"
      >
        ETL<span style={{ color: 'var(--text)' }}>Management</span>
      </button>
      <Chip c="purple">ENTERPRISE</Chip>
      <div style={{ flex: 1 }} />
      <Btn
        v="ghost" sm
        onClick={() => actions.toggleTheme()}
      >
        {state.theme === 'dark' ? '🌞 Light' : '🌙 Dark'}
      </Btn>
      <Btn v="ghost" sm>?</Btn>
      <Btn v="danger" sm onClick={handleLogout}>Logout</Btn>
    </div>
  )
}
