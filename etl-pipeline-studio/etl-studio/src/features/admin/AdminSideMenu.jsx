import { useState } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

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
  {
    id: 'udf-admin',
    label: 'UDF Management',
    description: 'Review, approve, and delete UDFs',
    icon: '⚙️',
  },
]

export default function AdminSideMenu({ activeMode = 'etl-management', onSelect }) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <aside
      data-testid="admin-side-menu"
      data-collapsed={isCollapsed ? 'true' : 'false'}
      style={{
        width: isCollapsed ? 86 : 240,
        flexShrink: 0,
        borderRight: '1px solid var(--border)',
        background: 'var(--surf)',
        padding: isCollapsed ? '18px 10px' : '18px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'width .2s ease, padding .2s ease',
      }}
    >
      <div style={{ padding: isCollapsed ? '0 0 8px' : '6px 10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between', gap: 10 }}>
          {!isCollapsed && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Admin Navigation
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>
                Workspace
              </div>
            </div>
          )}

          <button
            type="button"
            data-testid="admin-side-menu-toggle"
            aria-label={isCollapsed ? 'Expand side menu' : 'Minimize side menu'}
            aria-pressed={isCollapsed}
            onClick={() => setIsCollapsed(current => !current)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              border: '1px solid var(--border)',
              borderRadius: 10,
              background: 'var(--bg)',
              color: 'var(--text)',
              cursor: 'pointer',
              transition: 'all .15s ease',
              flexShrink: 0,
            }}
          >
            {isCollapsed ? <PanelLeftOpen size={16} strokeWidth={2.1} /> : <PanelLeftClose size={16} strokeWidth={2.1} />}
          </button>
        </div>
      </div>

      {MENU_ITEMS.map(item => {
        const isActive = item.id === activeMode

        return (
          <button
            key={item.id}
            type="button"
            data-testid={`admin-side-menu-item-${item.id}`}
            aria-label={item.label}
            aria-pressed={isActive}
            onClick={() => onSelect?.(item.id)}
            title={isCollapsed ? item.label : undefined}
            style={{
              border: `1px solid ${isActive ? 'rgba(79,110,247,0.45)' : 'var(--border)'}`,
              background: isActive ? 'rgba(79,110,247,0.10)' : 'transparent',
              color: 'var(--text)',
              borderRadius: 10,
              padding: isCollapsed ? '12px 10px' : '12px 12px',
              textAlign: isCollapsed ? 'center' : 'left',
              cursor: 'pointer',
              transition: 'all .15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: isCollapsed ? 0 : 10, justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
              {!isCollapsed && (
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 600, color: isActive ? 'var(--accent)' : 'var(--text)' }}>
                    {item.label}
                  </div>
                  <div style={{ marginTop: 3, fontSize: 11, lineHeight: 1.45, color: 'var(--muted)' }}>
                    {item.description}
                  </div>
                </div>
              )}
            </div>
          </button>
        )
      })}
    </aside>
  )
}

