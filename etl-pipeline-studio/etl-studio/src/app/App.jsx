import { WizardProvider } from '../shared/store/wizardStore.jsx'
import TopNav      from '../features/etl-wizard/TopNav.jsx'
import StepBar     from '../features/etl-wizard/StepBar.jsx'
import WizardShell from '../features/etl-wizard/WizardShell.jsx'
import WizardFooter from '../features/etl-wizard/WizardFooter.jsx'

export default function App() {
  return (
    <WizardProvider>
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: '100vh', overflow: 'hidden',
        background: 'var(--bg)',
      }}>
        <TopNav />
        <StepBar />
        <WizardShell />
        <WizardFooter />
      </div>
    </WizardProvider>
  )
}
