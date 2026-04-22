import { useMemo } from 'react'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { useUser } from '../../shared/store/userContext.jsx'
import ETLManagementScreen from '../etl-wizard/ETLManagementScreen.jsx'
import AdminScreen from './AdminScreen.jsx'
import AdminSideMenu from './AdminSideMenu.jsx'
import UDFScreen from './UDFScreen.jsx'
import KafkaSimulatorScreen from './KafkaSimulatorScreen.jsx'

const ADMIN_MODES = ['etl-admin', 'udf-admin', 'simulator']

export default function AdminWorkspace() {
  const { state, actions } = useWizard()
  const { user } = useUser()
  const isAdminUser = user?.role === 'admin'

  const activeMode = useMemo(() => (
    isAdminUser && ADMIN_MODES.includes(state.navigationMode)
      ? state.navigationMode
      : 'etl-management'
  ), [isAdminUser, state.navigationMode])

  function renderContent() {
    if (activeMode === 'etl-admin') return <AdminScreen />
    if (activeMode === 'udf-admin') return <UDFScreen />
    if (activeMode === 'simulator') return <KafkaSimulatorScreen />
    return <ETLManagementScreen />
  }

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
        {renderContent()}
      </div>
    </div>
  )
}

