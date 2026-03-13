import { useWizard } from '../../shared/store/wizardStore.jsx'
import { useUser } from '../../shared/store/userContext.jsx';

export default function MainMenu() {
  const { state, actions } = useWizard()
  const { user, logout } = useUser();

  const handleETLConfiguration = () => {
    actions.setNavigationMode('etl-config')
    actions.setStep(0)
  }

  const handleETLManagement = () => {
    actions.setNavigationMode('etl-management')
  }

  function handleLogout() {
    logout('manual');
  }

  return (
    <div style={{
      width: '190px',
      height: '100vh',
      background: 'var(--surf)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Logo / Branding */}
      <div style={{
        padding: '16px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <div style={{
          fontSize: '28px',
          fontWeight: 700,
          color: 'var(--accent)',
        }}>
          ⚡
        </div>
        <div>
          <div style={{
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--text)',
          }}>
            ETL Studio
          </div>
          <div style={{
            fontSize: '10px',
            color: 'var(--muted)',
          }}>
            Pipeline Builder
          </div>
          {user && user.userId && (
            <div style={{ fontSize: '11px', color: 'var(--accent)', marginTop: 4 }}>
              logged in:{user.userId}
            </div>
          )}
        </div>
      </div>

      {/* Menu Items */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '10px 6px',
        gap: '3px',
      }}>
        {/* ETL Configuration */}
        <button
          onClick={handleETLConfiguration}
          style={{
            padding: '10px 12px',
            background: state.navigationMode === 'etl-config' ? 'rgba(79, 110, 247, 0.15)' : 'transparent',
            border: state.navigationMode === 'etl-config' ? '1px solid var(--accent)' : '1px solid transparent',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            fontWeight: 600,
            color: state.navigationMode === 'etl-config' ? 'var(--accent)' : 'var(--text)',
            transition: 'all 0.2s',
            justifyContent: 'flex-start',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            if (state.navigationMode !== 'etl-config') {
              e.currentTarget.style.background = 'rgba(79, 110, 247, 0.08)'
              e.currentTarget.style.borderColor = 'var(--accent)'
            }
          }}
          onMouseLeave={(e) => {
            if (state.navigationMode !== 'etl-config') {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'transparent'
            }
          }}
        >
          <span style={{ fontSize: '16px' }}>⚙</span>
          <span>ETL Configuration</span>
        </button>

        {/* ETL Management */}
        <button
          onClick={handleETLManagement}
          style={{
            padding: '10px 12px',
            background: state.navigationMode === 'etl-management' ? 'rgba(79, 110, 247, 0.15)' : 'transparent',
            border: state.navigationMode === 'etl-management' ? '1px solid var(--accent)' : '1px solid transparent',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            fontWeight: 600,
            color: state.navigationMode === 'etl-management' ? 'var(--accent)' : 'var(--text)',
            transition: 'all 0.2s',
            justifyContent: 'flex-start',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            if (state.navigationMode !== 'etl-management') {
              e.currentTarget.style.background = 'rgba(79, 110, 247, 0.08)'
              e.currentTarget.style.borderColor = 'var(--accent)'
            }
          }}
          onMouseLeave={(e) => {
            if (state.navigationMode !== 'etl-management') {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'transparent'
            }
          }}
        >
          <span style={{ fontSize: '16px' }}>📊</span>
          <span>ETL Management</span>
        </button>
      </div>

      {/* Footer Info */}
      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid var(--border)',
        fontSize: '9px',
        color: 'var(--muted)',
        textAlign: 'center',
      }}>
        v1.0.0
      </div>
      <button
        onClick={handleLogout}
        style={{
          width: '100%',
          padding: '10px 0',
          background: 'var(--danger)',
          color: 'white',
          fontWeight: 600,
          fontSize: '13px',
          border: 'none',
          borderRadius: '0 0 8px 8px',
          cursor: 'pointer',
          marginTop: 4,
        }}
      >
        Logout
      </button>
    </div>
  )
}
