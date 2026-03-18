import { STEPS } from '../../shared/types/index.js'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { canNavigateToWizardStep, getFieldMappingValidation } from '../../shared/services/wizardValidation.js'

export default function StepBar() {
  const { state, actions } = useWizard()
  const { currentStep, completedSteps } = state
  const fieldMappingValidation = getFieldMappingValidation(state)

  return (
    <div style={{
      background: 'var(--surf)', borderBottom: '1px solid var(--border)',
      padding: '16px 32px', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', gap: 0 }}>
        {STEPS.map((s, i) => {
          const isDone   = completedSteps.has(i)
          const isActive = i === currentStep
          const canClick = canNavigateToWizardStep(i, state)
          const isIncompleteFieldMapping =
            i === 4 &&
            !fieldMappingValidation.isValid &&
            (fieldMappingValidation.hasMappings || completedSteps.has(4))

          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div
                onClick={() => canClick && actions.setStep(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  cursor: canClick ? 'pointer' : 'default',
                  padding: '8px 12px', borderRadius: 10, transition: 'all .15s',
                  whiteSpace: 'nowrap',
                  border: isActive
                    ? '1px solid rgba(255,255,255,0.9)'
                    : isIncompleteFieldMapping
                        ? '1px solid rgba(239,108,77,0.5)'
                      : isDone
                        ? '1px solid rgba(34,197,94,0.3)'
                        : canClick
                          ? '1px solid rgba(148,163,184,0.28)'
                          : '1px solid transparent',
                  background: isActive
                    ? 'rgba(255,255,255,0.96)'
                    : isIncompleteFieldMapping
                        ? 'rgba(239,108,77,.12)'
                      : isDone
                        ? 'rgba(34,197,94,.10)'
                        : canClick
                          ? 'rgba(148,163,184,.06)'
                          : 'transparent',
                  boxShadow: isActive ? '0 10px 24px rgba(15,23,42,0.16)' : 'none',
                }}
                onMouseEnter={e => {
                  if (!isActive && canClick) {
                    e.currentTarget.style.background = isIncompleteFieldMapping ? 'rgba(239,108,77,.18)' : isDone ? 'rgba(34,197,94,.14)' : 'rgba(255,255,255,.10)'
                    e.currentTarget.style.borderColor = isIncompleteFieldMapping ? 'rgba(239,108,77,.65)' : isDone ? 'rgba(34,197,94,0.42)' : 'rgba(255,255,255,0.35)'
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = isIncompleteFieldMapping ? 'rgba(239,108,77,.12)' : isDone ? 'rgba(34,197,94,.10)' : canClick ? 'rgba(148,163,184,.06)' : 'transparent'
                    e.currentTarget.style.borderColor = isIncompleteFieldMapping ? 'rgba(239,108,77,0.5)' : isDone ? 'rgba(34,197,94,0.3)' : canClick ? 'rgba(148,163,184,0.28)' : 'transparent'
                  }
                }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                  background: isIncompleteFieldMapping ? '#ef6c4d' : isDone ? 'var(--success)' : isActive ? 'var(--accent)' : 'var(--surf2)',
                  border: `2px solid ${isIncompleteFieldMapping ? '#ef6c4d' : isDone ? 'var(--success)' : isActive ? 'var(--accent)' : 'var(--border)'}`,
                  color: (isDone || isActive || isIncompleteFieldMapping) ? '#fff' : canClick ? 'var(--text)' : 'var(--muted)',
                }}>
                  {isDone && !isIncompleteFieldMapping ? '✓' : i + 1}
                </div>
                <span style={{
                  fontSize: 12,
                  color: isActive ? '#0f172a' : isIncompleteFieldMapping ? '#ef6c4d' : isDone ? 'var(--success)' : canClick ? 'var(--text)' : 'var(--muted)',
                  fontWeight: isActive ? 600 : isIncompleteFieldMapping ? 600 : 400,
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
                  color: isIncompleteFieldMapping ? '#ef6c4d' : isDone ? 'var(--success)' : 'var(--border)',
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
