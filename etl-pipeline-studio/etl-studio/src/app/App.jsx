import { WizardProvider, useWizard } from '../shared/store/wizardStore.jsx'
import { useUser } from '../shared/store/userContext.jsx';
import TopNav      from '../features/etl-wizard/TopNav.jsx'
import StepBar     from '../features/etl-wizard/StepBar.jsx'
import MainMenu    from '../features/etl-wizard/MainMenu.jsx'
import WizardShell from '../features/etl-wizard/WizardShell.jsx'
import WizardFooter from '../features/etl-wizard/WizardFooter.jsx'
import ETLManagementScreen from '../features/etl-wizard/ETLManagementScreen.jsx'
import LoginPage from '../features/etl-wizard/LoginPage.jsx';

function AppContent() {
  const { state } = useWizard()
  const { user } = useUser();

  // Show login page if user is not set
  if (!user) {
    return <LoginPage />;
  }

  // Show main menu if not in any mode
  if (state.navigationMode === 'menu') {
    return (
      <div style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}>
        <MainMenu />
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
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}>
        <MainMenu />
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <TopNav />
          <StepBar />
          <WizardShell />
          <WizardFooter />
        </div>
      </div>
    )
  }

  // Show ETL Management
  if (state.navigationMode === 'etl-management') {
    return (
      <div style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}>
        <MainMenu />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TopNav />
          <ETLManagementScreen />
        </div>
      </div>
    )
  }
  
  return null
}

export default function App() {
  return (
    <WizardProvider>
      <AppContent />
    </WizardProvider>
  )
}
