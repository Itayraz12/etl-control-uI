import { Btn, DraftBadge } from '../../shared/components/index.jsx'
import { STEPS } from '../../shared/types/index.js'
import { useWizard } from '../../shared/store/wizardStore.jsx'

function isStepValid(stepIndex, state) {
  const { metadata, source, upload, mappings, sink } = state
  
  // Step 0: Metadata - check required fields
  if (stepIndex === 0) {
    return metadata?.productSource && metadata?.productType && metadata?.environment && metadata?.entityName
  }
  
  // Step 1: Source Config - check that a source type is selected
  if (stepIndex === 1) {
    return source?.sourceType ? true : false
  }
  
  // Step 2: Source Upload - check that upload is marked as done
  if (stepIndex === 2) {
    return upload && Object.keys(upload).length > 0
  }
  
  // Step 3: Filters - always valid (filters are optional)
  if (stepIndex === 3) {
    return true
  }
  
  // Step 4: Field Mapping - check that at least one mapping exists
  if (stepIndex === 4) {
    return Array.isArray(mappings) && mappings.length > 0
  }
  
  // Step 5: Sink Config - check that a sink type is selected
  if (stepIndex === 5) {
    return sink?.sinkType ? true : false
  }
  
  // Step 6: Summary - always valid
  if (stepIndex === 6) {
    return true
  }
  
  return true
}

export default function WizardFooter() {
  const { state, actions } = useWizard()
  const { currentStep } = state
  const isLast = currentStep === STEPS.length - 1
  const canContinue = isStepValid(currentStep, state)

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
        <Btn v="primary" onClick={() => actions.goNext(currentStep)} disabled={!canContinue}>
          Continue →
        </Btn>
      )}
    </div>
  )
}
