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
    wizardState.filters = []
    wizardState.source = { sourceType: 'kafka', kafkaEnv: 'production', kafkaTopic: 'source_products_raw', kafkaOffset: 'earliest' }
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

  it('does not mark the Filters tab red on Summary when no filters are defined', () => {
    wizardState.currentStep = 6
    wizardState.completedSteps = new Set([0, 1, 2, 3, 4, 5])
    wizardState.filters = []

    render(<StepBar />)

    const filtersLabel = screen.getByText('Filters')
    const filtersCircle = filtersLabel.parentElement?.querySelector('div')

    expect(filtersLabel).not.toHaveStyle({ color: '#ef6c4d' })
    expect(filtersCircle).not.toHaveStyle({ background: '#ef6c4d' })
  })

  it('marks the Filters tab red on Summary when a filter is incomplete', () => {
    wizardState.currentStep = 6
    wizardState.completedSteps = new Set([0, 1, 2, 3, 4, 5])
    wizardState.filters = [
      {
        id: 'group-1',
        logic: 'AND',
        rules: [{ id: 'rule-1', field: 'sourceName', op: 'eq', value: '' }],
        subgroups: [],
      },
    ]

    render(<StepBar />)

    const filtersLabel = screen.getByText('Filters')
    const filtersCircle = filtersLabel.parentElement?.querySelector('div')

    expect(filtersLabel).toHaveStyle({ color: '#ef6c4d' })
    expect(filtersCircle).toHaveTextContent('4')
    expect(filtersCircle).toHaveStyle({ background: '#ef6c4d' })
  })

  it('clears the red tab state once the summary validation passes', () => {
    wizardState.currentStep = 6
    wizardState.completedSteps = new Set([0, 1, 2, 3, 4, 5])
    wizardState.filters = [
      {
        id: 'group-1',
        logic: 'AND',
        rules: [{ id: 'rule-1', field: 'sourceName', op: 'eq', value: 'ABC' }],
        subgroups: [],
      },
    ]

    render(<StepBar />)

    const filtersLabel = screen.getByText('Filters')
    const filtersCircle = filtersLabel.parentElement?.querySelector('div')

    expect(filtersLabel).not.toHaveStyle({ color: '#ef6c4d' })
    expect(filtersCircle).not.toHaveStyle({ background: '#ef6c4d' })
  })
})