import { useEffect } from 'react'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { useMockMode } from '../../shared/store/mockModeContext.jsx'
import { useConfig, STEP_METADATA, STEP_FILTERS, STEP_FIELD_MAPPING, STEP_SUMMARY } from '../../shared/store/configContext.jsx'
import MetadataStep    from '../file-upload/MetadataStep.jsx'
import SourceConfigStep from '../source-config/SourceConfigStep.jsx'
import SourceUploadStep from '../source-config/SourceUploadStep.jsx'
import FiltersStep      from '../filters/FiltersStep.jsx'
import FieldMappingStep from '../field-mapping/FieldMappingStep.jsx'
import SinkConfigStep   from '../sink-config/SinkConfigStep.jsx'
import SummaryStep      from '../summary/SummaryStep.jsx'

const STEP_COMPONENTS = [
  MetadataStep,
  SourceConfigStep,
  SourceUploadStep,
  FiltersStep,
  FieldMappingStep,
  SinkConfigStep,
  SummaryStep,
]

// Steps that require a pre-fetch and their corresponding loading flag key
const LOADING_FLAG = {
  [STEP_METADATA]:      'loadingEntities',
  [STEP_FILTERS]:       'loadingFilters',
  [STEP_FIELD_MAPPING]: 'loadingTransformers',
  [STEP_SUMMARY]:       'loadingTransformers',
}

// CSS injected when the wizard is in read-only (saved-version preview) mode.
// pointer-events: none on every interactive element lets mouse-wheel scroll
// still reach the scroll containers (wheel events are not pointer events).
const READ_ONLY_CSS = `
  [data-etl-ro] input,
  [data-etl-ro] select,
  [data-etl-ro] textarea,
  [data-etl-ro] button:not([data-etl-ro-allow]),
  [data-etl-ro] [role="button"]:not([data-etl-ro-allow]),
  [data-etl-ro] [draggable="true"],
  [data-etl-ro] label {
    pointer-events: none !important;
    cursor: default !important;
  }
`

export default function WizardShell() {
  const { state } = useWizard()
  const { useMock } = useMockMode()
  const config = useConfig()
  const { prefetchForStep } = config

  // Trigger pre-fetch whenever the active step changes
  useEffect(() => {
    prefetchForStep(state.currentStep, useMock)
  }, [state.currentStep, useMock, prefetchForStep])

  const Step = STEP_COMPONENTS[state.currentStep] || MetadataStep

  // Show a full-height spinner while the required data for this step is loading
  const loadingKey = LOADING_FLAG[state.currentStep]
  const isLoading  = loadingKey ? config[loadingKey] : false

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeIn .2s ease' }}>
      {state.readOnly && (
        <>
          <style>{READ_ONLY_CSS}</style>
          <div style={{
            background: 'rgba(245,158,11,0.12)',
            borderBottom: '1px solid rgba(245,158,11,0.4)',
            padding: '6px 24px',
            fontSize: 12,
            color: '#b45309',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 14 }}>👁</span>
            <strong>View Only</strong>
            <span style={{ color: 'var(--muted)' }}>— This is a read-only snapshot of the saved version. No changes can be made.</span>
          </div>
        </>
      )}
      {isLoading ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          color: 'var(--muted)',
          animation: 'fadeIn .2s ease',
        }}>
          <div style={{
            width: 36,
            height: 36,
            border: '3px solid var(--border)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }} />
          <span style={{ fontSize: 13 }}>Loading…</span>
        </div>
      ) : (
        <div
          data-etl-ro={state.readOnly ? 'true' : undefined}
          onFocusCapture={state.readOnly ? (e) => e.target.blur() : undefined}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          <Step />
        </div>
      )}
    </div>
  )
}


