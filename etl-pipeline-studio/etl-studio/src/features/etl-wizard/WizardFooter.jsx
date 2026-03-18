import { useState } from 'react'
import { Btn, DraftBadge, ModalDialog } from '../../shared/components/index.jsx'
import { STEPS } from '../../shared/types/index.js'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { getFieldMappingValidation, isWizardStepValid } from '../../shared/services/wizardValidation.js'

export default function WizardFooter() {
  const { state, actions } = useWizard()
  const { currentStep } = state
  const [mappingValidationModal, setMappingValidationModal] = useState(false)
  const isLast = currentStep === STEPS.length - 1
  const canContinue = isWizardStepValid(currentStep, state)
  const fieldMappingValidation = getFieldMappingValidation(state)

  function handleContinue() {
    if (currentStep === 4 && !fieldMappingValidation.isValid) {
      setMappingValidationModal(true)
      return
    }

    if (canContinue) {
      actions.goNext(currentStep)
    }
  }

  return (
    <>
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
          <Btn v="primary" onClick={handleContinue} disabled={currentStep !== 4 && !canContinue}>
            Continue →
          </Btn>
        )}
      </div>
      <ModalDialog
        isOpen={mappingValidationModal}
        title="Field mapping is incomplete"
        icon="⚠️"
        tone="warning"
        message={fieldMappingValidation.hasMappings
          ? `Not all required target fields are mapped yet. Complete the missing mappings before you continue.${fieldMappingValidation.unmappedRequiredTargets.length > 0 ? `\n\nMissing fields: ${fieldMappingValidation.unmappedRequiredTargets.map(field => field.name || field.id).join(', ')}` : ''}`
          : 'At least one valid field mapping is required before you continue to the next step.'}
        footer={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Btn v="secondary" onClick={() => setMappingValidationModal(false)}>Back</Btn>
            <Btn v="primary" onClick={() => {
              setMappingValidationModal(false)
              actions.goNext(currentStep)
            }}>Continue anyway</Btn>
          </div>
        }
        onCancel={() => setMappingValidationModal(false)}
      />
    </>
  )
}
