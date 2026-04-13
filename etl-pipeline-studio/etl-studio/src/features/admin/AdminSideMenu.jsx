const MENU_ITEMS = [
  {
    id: 'etl-management',
    label: 'Management Page',
    description: 'Deployments, drafts, and runtime operations',
    icon: '🗂️',
  },
  {
    id: 'etl-admin',
    label: 'Admin Page',
    description: 'Users and teams administration',
    icon: '🛡️',
  },
]

export default function AdminSideMenu({ activeMode = 'etl-management', onSelect }) {
  return (
    <aside
      data-testid="admin-side-menu"
      style={{
        width: 240,
        flexShrink: 0,
        borderRight: '1px solid var(--border)',
        background: 'var(--surf)',
        padding: '18px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ padding: '6px 10px 14px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Admin Navigation
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>
          Workspace
        </div>
      </div>

      {MENU_ITEMS.map(item => {
        const isActive = item.id === activeMode

        return (
          <button
            key={item.id}
            type="button"
            data-testid={`admin-side-menu-item-${item.id}`}
            aria-pressed={isActive}
            onClick={() => onSelect?.(item.id)}
            style={{
              border: `1px solid ${isActive ? 'rgba(79,110,247,0.45)' : 'var(--border)'}`,
              background: isActive ? 'rgba(79,110,247,0.10)' : 'transparent',
              color: 'var(--text)',
              borderRadius: 10,
              padding: '12px 12px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all .15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 600, color: isActive ? 'var(--accent)' : 'var(--text)' }}>
                  {item.label}
                </div>
                <div style={{ marginTop: 3, fontSize: 11, lineHeight: 1.45, color: 'var(--muted)' }}>
                  {item.description}
                </div>
              </div>
            </div>
          </button>
        )
      })}
    </aside>
  )
}

