import { STEPS } from '../../shared/types/index.js'
import { useWizard } from '../../shared/store/wizardStore.jsx'

export default function StepBar() {
  const { state, actions } = useWizard()
  const { currentStep, completedSteps } = state

  return (
    <div style={{
      background: 'var(--surf)', borderBottom: '1px solid var(--border)',
      padding: '16px 32px', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', gap: 0 }}>
        {STEPS.map((s, i) => {
          const isDone   = completedSteps.has(i)
          const isActive = i === currentStep
          const canClick = i <= currentStep || completedSteps.has(i)

          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div
                onClick={() => canClick && actions.goTo(i, state)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  cursor: canClick ? 'pointer' : 'default',
                  padding: '5px 10px', borderRadius: 8, transition: 'background .15s',
                  whiteSpace: 'nowrap',
                  background: isActive ? 'rgba(79,110,247,.13)' : 'transparent',
                }}
                onMouseEnter={e => { if (!isActive && canClick) e.currentTarget.style.background = 'var(--surf2)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                  background:   isDone ? 'var(--success)' : isActive ? 'var(--accent)' : 'var(--surf2)',
                  border: `2px solid ${isDone ? 'var(--success)' : isActive ? 'var(--accent)' : 'var(--border)'}`,
                  color: (isDone || isActive) ? '#fff' : 'var(--muted)',
                }}>
                  {isDone ? '✓' : i + 1}
                </div>
                <span style={{
                  fontSize: 12,
                  color:   isDone ? 'var(--success)' : isActive ? 'var(--text)' : 'var(--muted)',
                  fontWeight: isActive ? 600 : 400,
                }}>
                  {s.label}
                </span>
              </div>

              {i < STEPS.length - 1 && (
                <div style={{
                  width: 20, height: 2,
                  background: isDone ? 'var(--success)' : 'var(--border)',
                  flexShrink: 0,
                }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
