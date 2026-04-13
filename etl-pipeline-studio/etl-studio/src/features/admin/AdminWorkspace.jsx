import { useMemo } from 'react'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { useUser } from '../../shared/store/userContext.jsx'
import ETLManagementScreen from '../etl-wizard/ETLManagementScreen.jsx'
import AdminScreen from './AdminScreen.jsx'
import AdminSideMenu from './AdminSideMenu.jsx'

export default function AdminWorkspace() {
  const { state, actions } = useWizard()
  const { user } = useUser()
  const isAdminUser = user?.role === 'admin'

  const activeMode = useMemo(() => (
    isAdminUser && state.navigationMode === 'etl-admin'
      ? 'etl-admin'
      : 'etl-management'
  ), [isAdminUser, state.navigationMode])

  return (
    <div data-testid="admin-workspace" style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
      {isAdminUser && (
        <AdminSideMenu
          activeMode={activeMode}
          onSelect={(nextMode) => {
            if (nextMode !== activeMode) {
              actions.setNavigationMode(nextMode)
            }
          }}
        />
      )}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeMode === 'etl-admin' ? <AdminScreen /> : <ETLManagementScreen />}
      </div>
    </div>
  )
}

