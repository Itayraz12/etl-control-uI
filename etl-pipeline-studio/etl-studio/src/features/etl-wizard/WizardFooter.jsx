import { Btn, DraftBadge } from '../../shared/components/index.jsx'
import { STEPS } from '../../shared/types/index.js'
import { useWizard } from '../../shared/store/wizardStore.jsx'

export default function WizardFooter() {
  const { state, actions } = useWizard()
  const { currentStep } = state
  const isLast = currentStep === STEPS.length - 1

  return (
    <div style={{
      background: 'var(--surf)', borderTop: '1px solid var(--border)',
      padding: '14px 30px', display: 'flex', alignItems: 'center',
      gap: 12, flexShrink: 0,
    }}>
      {currentStep > 0 && (
        <Btn v="secondary" onClick={() => actions.goBack(currentStep)}>
          ← Back
        </Btn>
      )}
      <DraftBadge />
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
        Step {currentStep + 1} of {STEPS.length} — {STEPS[currentStep].label}
      </span>
      {!isLast && (
        <Btn v="primary" onClick={() => actions.goNext(currentStep)}>Continue →</Btn>
      )}
    </div>
  )
}
