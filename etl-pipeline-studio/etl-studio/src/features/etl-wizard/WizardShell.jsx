import { useEffect } from 'react'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { useMockMode } from '../../shared/store/mockModeContext.jsx'
import { useConfig, STEP_METADATA, STEP_FILTERS, STEP_FIELD_MAPPING } from '../../shared/store/configContext.jsx'
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
}

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

  if (isLoading) {
    return (
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
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeIn .2s ease' }}>
      <Step />
    </div>
  )
}


