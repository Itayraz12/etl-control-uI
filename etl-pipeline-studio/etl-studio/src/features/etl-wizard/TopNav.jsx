import { Btn, Chip } from '../../shared/components/index.jsx'
import { useWizard } from '../../shared/store/wizardStore.jsx'

export default function TopNav() {
  const { state, actions } = useWizard()
  return (
    <div style={{
      background: 'var(--surf)', borderBottom: '1px solid var(--border)',
      padding: '0 32px', display: 'flex', alignItems: 'center',
      height: 56, gap: 16, flexShrink: 0,
    }}>
      <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent)', letterSpacing: 1 }}>
        ETL<span style={{ color: 'var(--text)' }}>Wizard</span>
      </div>
      <Chip c="purple">ENTERPRISE</Chip>
      <div style={{ flex: 1 }} />
      <Btn v="ghost" sm>⟳ Load Draft</Btn>
      <Btn v="ghost" sm>⚙ Settings</Btn>
      <Btn
        v="ghost" sm
        onClick={() => actions.toggleTheme()}
      >
        {state.theme === 'dark' ? '🌞 Light' : '🌙 Dark'}
      </Btn>
      <Btn v="ghost" sm>?</Btn>
    </div>
  )
}
