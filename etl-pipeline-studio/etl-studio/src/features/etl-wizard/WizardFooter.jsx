import { useState } from 'react'
import { Btn, ModalDialog } from '../../shared/components/index.jsx'
import { STEPS } from '../../shared/types/index.js'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { useConfig } from '../../shared/store/configContext.jsx'
import { getFieldMappingValidation, isWizardStepValid } from '../../shared/services/wizardValidation.js'

export default function WizardFooter() {
  const { state, actions } = useWizard()
  const { transformers } = useConfig()
  const { currentStep, readOnly } = state
  const [mappingValidationModal, setMappingValidationModal] = useState(false)
  const isFirst = currentStep === 0
  const isLast = currentStep === STEPS.length - 1
  const canContinue = isWizardStepValid(currentStep, state, undefined, transformers)
  const fieldMappingValidation = getFieldMappingValidation(state, undefined, transformers)
  const missingTargetFieldsMessage = fieldMappingValidation.unmappedRequiredTargets.length > 0
    ? `Missing fields: ${fieldMappingValidation.unmappedRequiredTargets.map(field => field.name || field.id).join(', ')}`
    : ''
  const missingTransformerFieldsMessage = fieldMappingValidation.invalidTransformers.length > 0
    ? `Incomplete transformers: ${fieldMappingValidation.invalidTransformers.map(item => `${item.transformerName} (${item.missingRequiredProps.map(prop => prop.label || prop.key).join(', ')})`).join('; ')}`
    : ''
  const mappingValidationMessage = [
    !fieldMappingValidation.hasMappings
      ? 'At least one valid field mapping is required before you continue to the next step.'
      : 'Field mapping validation found incomplete configuration. Resolve the items below before you continue.',
    missingTargetFieldsMessage,
    missingTransformerFieldsMessage,
  ].filter(Boolean).join('\n\n')

  function handleContinue() {
    if (currentStep === 4 && !fieldMappingValidation.isValid) {
      setMappingValidationModal(true)
      return
    }
    if (canContinue) {
      actions.goNext(currentStep)
    }
  }

  // ── Read-only footer: simple Prev / Next navigation + close ─────────────
  if (readOnly) {
    return (
      <div style={{
        background: 'var(--surf)', borderTop: '1px solid var(--border)',
        padding: '14px 30px', display: 'flex', alignItems: 'center',
        gap: 12, flexShrink: 0,
      }}>
        <Btn v="secondary" onClick={() => actions.goBack(currentStep)} disabled={isFirst}>
          ← Previous
        </Btn>
        <div style={{ flex: 1 }} />
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          padding: '3px 10px',
          borderRadius: 99,
          background: 'rgba(245,158,11,0.15)',
          border: '1px solid rgba(245,158,11,0.4)',
          color: '#b45309',
          letterSpacing: '0.04em',
        }}>
          👁 VIEW ONLY
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          Step {currentStep + 1} of {STEPS.length} — {STEPS[currentStep].label}
        </span>
        {!isLast && (
          <Btn v="secondary" onClick={() => actions.setStep(currentStep + 1)}>
            Next →
          </Btn>
        )}
        {isLast && (
          <Btn v="secondary" onClick={() => window.close()}>
            Close
          </Btn>
        )}
      </div>
    )
  }

  // ── Normal footer ────────────────────────────────────────────────────────
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
        message={mappingValidationMessage}
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
