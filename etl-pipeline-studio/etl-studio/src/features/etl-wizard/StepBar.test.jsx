import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StepBar from './StepBar.jsx'

const mockSetStep = vi.fn()

vi.mock('../../shared/store/wizardStore.jsx', () => ({
  useWizard: () => ({
    state: {
      currentStep: 4,
      completedSteps: new Set([0, 1, 2]),
      metadata: { productSource: 'ERP', productType: 'Inventory', environment: 'production', entityName: 'Product' },
      source: { sourceType: 'kafka' },
      upload: { done: true, schema: [{ id: 'id', required: true }] },
      targetSchema: [{ id: 'targetId', name: 'Target Id', required: true }],
      mappings: [],
      sink: { sinkType: 'kafka' },
    },
    actions: {
      setStep: mockSetStep,
    },
  }),
}))

describe('StepBar', () => {
  it('shows Filters as completed after the user advances past it even with no filters configured', () => {
    render(<StepBar />)

    const filtersLabel = screen.getByText('Filters')
    const filtersCircle = filtersLabel.parentElement?.querySelector('div')

    expect(filtersLabel).toHaveStyle({ color: 'var(--success)' })
    expect(filtersCircle).toHaveTextContent('✓')
    expect(filtersCircle).toHaveStyle({ background: 'var(--success)' })
  })
})