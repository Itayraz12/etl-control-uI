import { useState } from 'react'
import { Card, CardTitle } from '../../shared/components/index.jsx'
import TeamManagementTable from './TeamManagementTable.jsx'
import UserManagementTable from './UserManagementTable.jsx'
import AdminUsersTable from './AdminUsersTable.jsx'

const ADMIN_TABS = [
  { id: 'users', label: 'User Management', description: 'Manage users and team assignments' },
  { id: 'teams', label: 'Team Management', description: 'Manage teams and DevOps ownership' },
  { id: 'admin-users', label: 'Admin Users', description: 'Grant or revoke admin privileges' },
]

export default function AdminScreen() {
  const [activeTab, setActiveTab] = useState('users')

  return (
    <div data-testid="admin-screen" style={{ flex: 1, overflowY: 'auto', padding: '24px 30px' }}>
      <Card>
        <CardTitle style={{ marginBottom: 10 }}>🛡️ Admin Page</CardTitle>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
          Admin users can manage teams and users from the backend-driven administration area.
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          {ADMIN_TABS.map(tab => {
            const isActive = tab.id === activeTab

            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`admin-tab-${tab.id}`}
                aria-pressed={isActive}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  border: `1px solid ${isActive ? 'rgba(79,110,247,0.45)' : 'var(--border)'}`,
                  background: isActive ? 'rgba(79,110,247,0.10)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  minWidth: 220,
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all .15s ease',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>{tab.label}</div>
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)', lineHeight: 1.45 }}>
                  {tab.description}
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      {activeTab === 'users' && <UserManagementTable />}
      {activeTab === 'teams' && <TeamManagementTable />}
      {activeTab === 'admin-users' && <AdminUsersTable />}
    </div>
  )
}
