import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SummaryStep from './SummaryStep.jsx'

const mockActions = {
  setNavigationMode: vi.fn(),
  goTo: vi.fn(),
}

const mockSaveDraftConfiguration = vi.fn(() => Promise.resolve({ success: true }))

vi.mock('../../shared/store/wizardStore.jsx', () => ({
  useWizard: () => ({
    state: {
      metadata: {
        entityName: 'product',
        productSource: 'ERP',
        productType: 'Catalog',
        environment: 'production',
        team: 'data-platform',
      },
      source: {
        sourceType: 'kafka',
        kafkaTopic: 'catalog-topic',
        format: 'JSON',
        streamingContinuity: 'continuous',
        recordsPerDay: 'millions',
      },
      upload: {
        done: true,
        schema: [
          { id: 'sku', name: 'sku', path: 'sku', type: 'string', nullable: false },
        ],
      },
      targetSchema: [
        { id: 'sku', name: 'sku', path: 'sku', type: 'string', required: true },
      ],
      mappings: [
        { src: 'sku', tgt: 'sku', transformer: 'none' },
      ],
      filters: [],
      sink: {
        sinkType: 'kafka',
        sinkKafkaTopic: 'catalog-sink',
        sinkKafkaAdditionalProperties: [],
      },
    },
    actions: mockActions,
  }),
}))

vi.mock('../../shared/store/configContext.jsx', () => ({
  useConfig: () => ({
    transformers: [],
  }),
}))

vi.mock('../../shared/hooks/useDeploymentProgress.js', () => ({
  useDeploymentProgress: () => ({
    isOpen: false,
    steps: [],
    currentStepIndex: 0,
    isComplete: false,
    isError: false,
    errorMessage: '',
    startDeployment: vi.fn(),
    reset: vi.fn(),
  }),
}))

vi.mock('../../shared/services/configService.js', () => ({
  MOCK_FILTER_OPERATORS: [],
  saveDraftConfiguration: (...args) => mockSaveDraftConfiguration(...args),
}))

describe('SummaryStep save draft behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockActions.setNavigationMode.mockReset()
    mockActions.goTo.mockReset()
    mockSaveDraftConfiguration.mockClear()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('saves the draft and navigates to management after the success popup closes', async () => {
    render(<SummaryStep />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
      await Promise.resolve()
    })

    expect(mockSaveDraftConfiguration).toHaveBeenCalledTimes(1)

    expect(screen.getByText('Draft Saved')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(1800)
      await Promise.resolve()
    })

    expect(mockActions.setNavigationMode).toHaveBeenCalledWith('etl-management')
  })
})