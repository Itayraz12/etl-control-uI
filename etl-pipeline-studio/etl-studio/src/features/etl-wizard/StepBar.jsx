import { STEPS } from '../../shared/types/index.js'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { useConfig } from '../../shared/store/configContext.jsx'
import { canNavigateToWizardStep, getFieldMappingValidation, getSummaryFailingStepIndexes } from '../../shared/services/wizardValidation.js'

export default function StepBar() {
  const { state, actions } = useWizard()
  const { transformers } = useConfig()
  const { currentStep, completedSteps } = state
  const fieldMappingValidation = getFieldMappingValidation(state, undefined, transformers)
  const shouldShowSummaryFailures = currentStep === 6 || completedSteps.has(6)
  const summaryFailingStepIndexes = shouldShowSummaryFailures
    ? getSummaryFailingStepIndexes(state, undefined, transformers)
    : new Set()

  return (
    <div style={{
      background: 'var(--surf)', borderBottom: '1px solid var(--border)',
      padding: '16px 32px', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', gap: 0 }}>
        {STEPS.map((s, i) => {
          const isOptionalFiltersStep = i === 3
          const isDone = completedSteps.has(i) || (isOptionalFiltersStep && currentStep > i)
          const isActive = i === currentStep
          const canClick = canNavigateToWizardStep(i, state, undefined, transformers)
          const isIncompleteFieldMapping =
            i === 4 &&
            !fieldMappingValidation.isValid &&
            (fieldMappingValidation.hasMappings || completedSteps.has(4))
          const isSummaryFailingStep = summaryFailingStepIndexes.has(i)
          const isFailingStep = isIncompleteFieldMapping || isSummaryFailingStep

          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div
                onClick={() => canClick && actions.setStep(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  cursor: canClick ? 'pointer' : 'default',
                  padding: '8px 12px', transition: 'color .15s',
                  whiteSpace: 'nowrap',
                }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                  background: isFailingStep ? '#ef6c4d' : isDone ? 'var(--success)' : isActive ? 'var(--accent)' : 'var(--surf2)',
                  border: `2px solid ${isFailingStep ? '#ef6c4d' : isDone ? 'var(--success)' : isActive ? 'var(--accent)' : 'var(--border)'}`,
                  color: (isDone || isActive || isFailingStep) ? '#fff' : canClick ? 'var(--text)' : 'var(--muted)',
                }}>
                  {isDone && !isFailingStep ? '✓' : i + 1}
                </div>
                <span style={{
                  fontSize: 12,
                  color: isFailingStep ? '#ef6c4d' : isActive ? 'var(--accent)' : isDone ? 'var(--success)' : canClick ? 'var(--text)' : 'var(--muted)',
                  fontWeight: isActive || isFailingStep ? 700 : 400,
                }}>
                  {s.label}
                </span>
              </div>

              {i < STEPS.length - 1 && (
                <div style={{
                  width: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                   color: isFailingStep ? '#ef6c4d' : isDone ? 'var(--success)' : 'var(--border)',
                  fontSize: 14,
                  fontWeight: 700,
                  flexShrink: 0,
                  userSelect: 'none',
                }}>{'>'}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
