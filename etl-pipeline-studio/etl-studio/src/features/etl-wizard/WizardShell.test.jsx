import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WizardShell from './WizardShell.jsx'

const prefetchForStep = vi.fn()
const mockWizardState = {
  currentStep: 0,
  interactionMode: 'edit',
  metadata: {
    entityName: '',
  },
}

vi.mock('../../shared/store/wizardStore.jsx', () => ({
  useWizard: () => ({ state: mockWizardState }),
}))

vi.mock('../../shared/store/mockModeContext.jsx', () => ({
  useMockMode: () => ({ useMock: false }),
}))

vi.mock('../../shared/store/configContext.jsx', () => ({
  STEP_METADATA: 0,
  STEP_FILTERS: 3,
  STEP_FIELD_MAPPING: 4,
  STEP_SUMMARY: 6,
  useConfig: () => ({
    prefetchForStep,
    loadingMetadata: false,
    loadingEntities: false,
    loadingFilters: false,
    loadingTransformers: false,
  }),
}))

vi.mock('../file-upload/MetadataStep.jsx', () => ({
  default: () => <div data-testid="wizard-shell-step">Metadata step</div>,
}))

vi.mock('../source-config/SourceConfigStep.jsx', () => ({
  default: () => <div>Source Config step</div>,
}))

vi.mock('../source-config/SourceUploadStep.jsx', () => ({
  default: () => <div>Source Upload step</div>,
}))

vi.mock('../filters/FiltersStep.jsx', () => ({
  default: () => <div>Filters step</div>,
}))

vi.mock('../field-mapping/FieldMappingStep.jsx', () => ({
  default: () => <div>Field Mapping step</div>,
}))

vi.mock('../sink-config/SinkConfigStep.jsx', () => ({
  default: () => <div>Sink Config step</div>,
}))

vi.mock('../summary/SummaryStep.jsx', () => ({
  default: () => <div>Summary step</div>,
}))

describe('WizardShell', () => {
  beforeEach(() => {
    prefetchForStep.mockReset()
    mockWizardState.currentStep = 0
    mockWizardState.interactionMode = 'edit'
    mockWizardState.metadata = { entityName: '' }
  })

  it('prefetches config for the active step when the shell renders', () => {
    render(<WizardShell />)

    expect(prefetchForStep).toHaveBeenCalledWith(0, false, { entityName: '' })
  })

  it('renders the read-only banner without disabling the shell container', () => {
    mockWizardState.interactionMode = 'view'

    render(<WizardShell />)

    expect(screen.getByTestId('wizard-read-only-banner')).toHaveTextContent('View mode — configuration is read-only.')
    const shell = screen.getByTestId('wizard-step-shell')
    expect(shell.tagName).toBe('DIV')
    expect(shell).toHaveAttribute('aria-readonly', 'true')
    expect(shell).not.toHaveAttribute('disabled')
    expect(screen.getByTestId('wizard-shell-step')).toBeInTheDocument()
  })
})

