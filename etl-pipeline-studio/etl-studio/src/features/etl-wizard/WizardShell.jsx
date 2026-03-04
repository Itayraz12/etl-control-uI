import { useWizard } from '../../shared/store/wizardStore.jsx'
import MetadataStep    from '../file-upload/MetadataStep.jsx'
import SourceConfigStep from '../source-config/SourceConfigStep.jsx'
import SourceUploadStep from '../source-config/SourceUploadStep.jsx'
import FieldMappingStep from '../field-mapping/FieldMappingStep.jsx'
import FiltersStep      from '../filters/FiltersStep.jsx'
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

export default function WizardShell() {
  const { state } = useWizard()
  const Step = STEP_COMPONENTS[state.currentStep] || MetadataStep

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeIn .2s ease' }}>
      <Step />
    </div>
  )
}
