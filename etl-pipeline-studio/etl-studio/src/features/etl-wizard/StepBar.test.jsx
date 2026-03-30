import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StepBar from './StepBar.jsx'

const mockSetStep = vi.fn()
const wizardState = {
  currentStep: 4,
  completedSteps: new Set([0, 1, 2]),
  metadata: { productSource: 'ERP', productType: 'Inventory', environment: 'production', entityName: 'Product' },
  source: { sourceType: 'kafka' },
  upload: { done: true, schema: [{ id: 'id', required: true }] },
  targetSchema: [{ id: 'targetId', name: 'Target Id', required: true }],
  mappings: [],
  sink: { sinkType: 'kafka' },
}

vi.mock('../../shared/store/wizardStore.jsx', () => ({
  useWizard: () => ({
    state: wizardState,
    actions: {
      setStep: mockSetStep,
    },
  }),
}))

vi.mock('../../shared/store/configContext.jsx', () => ({
  useConfig: () => ({
    transformers: [
      {
        _id: 'tf-required',
        name: 'RequiredTransformer',
        propsSchema: [{ key: 'logic', label: 'Logic', required: true }],
      },
    ],
  }),
}))

describe('StepBar', () => {
  beforeEach(() => {
    wizardState.currentStep = 4
    wizardState.completedSteps = new Set([0, 1, 2])
    wizardState.mappings = []
    mockSetStep.mockClear()
  })

  it('shows Filters as completed after the user advances past it even with no filters configured', () => {
    render(<StepBar />)

    const filtersLabel = screen.getByText('Filters')
    const filtersCircle = filtersLabel.parentElement?.querySelector('div')

    expect(filtersLabel).toHaveStyle({ color: 'var(--success)' })
    expect(filtersCircle).toHaveTextContent('✓')
    expect(filtersCircle).toHaveStyle({ background: 'var(--success)' })
  })

  it('marks Field Mapping as incomplete when a transformer is missing a required property', () => {
    wizardState.completedSteps = new Set([0, 1, 2, 3, 4])
    wizardState.mappings = [
      {
        src: 'sourceName',
        tgt: 'targetId',
        transformer: 'tf-required',
        transformerProps: { logic: '' },
        transformerChainDetailed: [{ id: 'tf-required', props: { logic: '' } }],
      },
    ]

    render(<StepBar />)

    const fieldMappingLabel = screen.getByText('Field Mapping')
    const fieldMappingCircle = fieldMappingLabel.parentElement?.querySelector('div')

    expect(fieldMappingCircle).toHaveTextContent('5')
    expect(fieldMappingCircle).toHaveStyle({ background: '#ef6c4d' })
  })
})