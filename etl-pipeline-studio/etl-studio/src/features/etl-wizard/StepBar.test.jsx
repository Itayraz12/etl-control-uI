import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StepBar from './StepBar.jsx'

const mockSetStep = vi.fn()
const mockGoNext = vi.fn()
const wizardState = {
  currentStep: 4,
  furthestStepVisited: 4,
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
      goNext: mockGoNext,
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
    wizardState.furthestStepVisited = 4
    wizardState.completedSteps = new Set([0, 1, 2])
    wizardState.mappings = []
    wizardState.filters = []
    wizardState.source = { sourceType: 'kafka', kafkaEnv: 'production', kafkaTopic: 'source_products_raw', kafkaOffset: 'earliest' }
    mockSetStep.mockClear()
    mockGoNext.mockClear()
  })

  it('marks the current step complete when the user clicks the next step header directly', () => {
    wizardState.currentStep = 0
    wizardState.completedSteps = new Set()
    wizardState.metadata = {
      productSource: 'ERP',
      productType: 'Inventory',
      environment: 'production',
      location: 'HOME',
      entityName: 'Product',
      team: 'data-platform',
    }
    wizardState.source = {
      sourceType: 'kafka',
      streamingContinuity: 'continuous',
      recordsPerDay: 'millions',
    }

    render(<StepBar />)

    fireEvent.click(screen.getByText('Source Config'))

    expect(mockGoNext).toHaveBeenCalledWith(0)
    expect(mockSetStep).not.toHaveBeenCalled()
  })

  it('shows Filter out as completed after the user advances past it even with no filters configured', () => {
    render(<StepBar />)

    const filtersLabel = screen.getByText('Filter out')
    const filtersCircle = filtersLabel.parentElement?.querySelector('div')

    expect(filtersLabel).toHaveStyle({ color: 'var(--success)' })
    expect(filtersCircle).toHaveTextContent('✓')
    expect(filtersCircle).toHaveStyle({ background: 'var(--success)' })
  })

  it('lets the user jump back to Source Upload directly after revisiting Metadata', () => {
    wizardState.currentStep = 0
    wizardState.furthestStepVisited = 2
    wizardState.completedSteps = new Set([0, 1])
    wizardState.metadata = {
      productSource: 'ERP',
      productType: 'Inventory',
      environment: 'production',
      location: 'OFFICE',
      entityName: 'Product',
      team: 'data-platform',
    }

    render(<StepBar />)

    fireEvent.click(screen.getByText('Source Upload'))

    expect(mockSetStep).toHaveBeenCalledWith(2)
  })

  it('lets the user jump back to Summary directly after revisiting Metadata', () => {
    wizardState.currentStep = 0
    wizardState.furthestStepVisited = 6
    wizardState.completedSteps = new Set([0, 1, 2, 3, 4, 5])
    wizardState.metadata = {
      productSource: 'ERP',
      productType: 'Inventory',
      environment: 'production',
      location: 'OFFICE',
      entityName: 'Product',
      team: 'data-platform',
    }
    wizardState.source = {
      sourceType: 'kafka',
      kafkaEnv: 'production',
      kafkaTopic: 'source_products_raw',
      kafkaOffset: 'earliest',
      format: 'JSON',
      streamingContinuity: 'continuous',
      recordsPerDay: 'millions',
    }
    wizardState.sink = { sinkType: 'kafka', sinkKafkaEnv: 'production' }
    wizardState.mappings = [{ src: 'sourceName', tgt: 'targetId' }]

    render(<StepBar />)

    fireEvent.click(screen.getByText('Summary'))

    expect(mockSetStep).toHaveBeenCalledWith(6)
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

    const filtersLabel = screen.getByText('Filter out')
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

    const filtersLabel = screen.getByText('Filter out')
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

    const filtersLabel = screen.getByText('Filter out')
    const filtersCircle = filtersLabel.parentElement?.querySelector('div')

    expect(filtersLabel).not.toHaveStyle({ color: '#ef6c4d' })
    expect(filtersCircle).not.toHaveStyle({ background: '#ef6c4d' })
  })
})