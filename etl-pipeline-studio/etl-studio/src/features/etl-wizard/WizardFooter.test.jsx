import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import WizardFooter from './WizardFooter.jsx'

vi.mock('../../shared/store/wizardStore.jsx', () => ({
  useWizard: () => ({
    state: {
      currentStep: 1,
      metadata: { productSource: 'ERP', productType: 'Inventory', environment: 'production', entityName: 'Product' },
      source: { sourceType: 'kafka' },
      upload: { done: false, schema: [], fileName: '', fileType: '', fileSize: 0 },
      mappings: [],
      targetSchema: [],
      sink: { sinkType: '' },
    },
    actions: {
      goBack: vi.fn(),
      goNext: vi.fn(),
    },
  }),
}))

describe('WizardFooter', () => {
  it('does not show the Draft badge next to the Back button', () => {
    render(<WizardFooter />)

    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
    expect(screen.queryByText(/draft/i)).not.toBeInTheDocument()
  })
})