import { WizardProvider, useWizard } from '../shared/store/wizardStore.jsx'
import { getWizardStorageKeyForUser } from '../shared/store/wizardPersistence.js'
import { useUser } from '../shared/store/userContext.jsx'
import { useEffect } from 'react'
import TopNav      from '../features/etl-wizard/TopNav.jsx'
import StepBar     from '../features/etl-wizard/StepBar.jsx'
import WizardShell from '../features/etl-wizard/WizardShell.jsx'
import WizardFooter from '../features/etl-wizard/WizardFooter.jsx'
import ETLManagementScreen from '../features/etl-wizard/ETLManagementScreen.jsx'
import LoginPage from '../features/etl-wizard/LoginPage.jsx';

function AppContent() {
  const { state, actions } = useWizard()
  const { user } = useUser();

  // Navigate to management page when user logs in
  useEffect(() => {
    if (user) {
      actions.setNavigationMode('etl-management')
    }
  }, [user, actions])

  // Show login page if user is not set
  if (!user) {
    return <LoginPage />;
  }

  // Show main menu if not in any mode
  if (state.navigationMode === 'menu') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}>
        <TopNav />
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          padding: '40px',
        }}>
          <div style={{ fontSize: '64px' }}>⚡</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text)' }}>
            ETL Studio
          </div>
          <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
            Select an option from the menu to get started
          </div>
        </div>
      </div>
    )
  }

  // Show ETL Configuration wizard
  if (state.navigationMode === 'etl-config') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}>
        <TopNav />
        <StepBar />
        <WizardShell />
        <WizardFooter />
      </div>
    )
  }

  // Show ETL Management
  if (state.navigationMode === 'etl-management') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}>
        <TopNav />
        <ETLManagementScreen />
      </div>
    )
  }
  
  return null
}

export default function App() {
  const { user } = useUser()

  return (
    <WizardProvider key={getWizardStorageKeyForUser(user?.userId)} user={user}>
      <AppContent />
    </WizardProvider>
  )
}
