import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ETLManagementScreen from './ETLManagementScreen.jsx'

const mockActions = {
  loadState: vi.fn(),
  setNavigationMode: vi.fn(),
  setStep: vi.fn(),
  updateMetadata: vi.fn(),
  updateSource: vi.fn(),
  setUploadDone: vi.fn(),
  setMappings: vi.fn(),
  setFilters: vi.fn(),
  updateSink: vi.fn(),
}

const mockDeployments = [
  {
    id: 'dep-1',
    productType: 'Inventory',
    productSource: 'ERP',
    environment: 'production',
    deploymentStatus: 'running',
    savedVersion: '1.2.0',
    deployedVersion: '1.2.0',
    lastStatusChange: '2026-03-15T10:00:00.000Z',
    createdAt: '2026-03-14T09:00:00.000Z',
  },
  {
    id: 'dep-2',
    productType: 'Catalog',
    productSource: 'CRM',
    environment: 'staging',
    deploymentStatus: 'draft',
    savedVersion: '2.0.0',
    deployedVersion: null,
    lastStatusChange: '2026-03-13T10:00:00.000Z',
    createdAt: '2026-03-12T09:00:00.000Z',
  },
]

vi.mock('../../shared/store/wizardStore.jsx', () => ({
  useWizard: () => ({
    state: { metadata: { environment: 'production' } },
    actions: mockActions,
  }),
}))

vi.mock('../../shared/store/mockModeContext.jsx', () => ({
  useMockMode: () => ({
    useMock: true,
    setUseMock: vi.fn(),
  }),
}))

vi.mock('../../shared/store/userContext.jsx', () => ({
  useUser: () => ({
    user: { teamName: 'data-platform', userId: 'user-1' },
  }),
}))

vi.mock('../../shared/services/deploymentsService.js', () => ({
  fetchDeployments: vi.fn(() => Promise.resolve(mockDeployments)),
  deployService: vi.fn(() => Promise.resolve()),
  stopDeployment: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../shared/services/configService.js', () => ({
  fetchDraftConfiguration: vi.fn(() => Promise.resolve('')),
}))

vi.mock('../../shared/services/configurationHydrator.js', () => ({
  hydrateWizardStateFromYaml: vi.fn(() => ({})),
}))

describe('ETLManagementScreen sort header stability', () => {
  beforeEach(() => {
    Object.values(mockActions).forEach(fn => fn.mockReset())
  })

  it('keeps a fixed-width sort indicator slot when sorting different columns', async () => {
    const user = userEvent.setup()
    render(<ETLManagementScreen />)

    await waitFor(() => {
      expect(screen.getByText('Inventory')).toBeInTheDocument()
      expect(screen.getByText('Catalog')).toBeInTheDocument()
    })

    const tableCard = screen.getByTestId('etl-management-table-card')
    expect(tableCard).toHaveStyle({ minHeight: '260px', flex: '1 1 auto' })
    expect(tableCard.style.height).toBe('')

    const productTypeIndicator = screen.getByTestId('sort-indicator-productType')
    const productSourceIndicator = screen.getByTestId('sort-indicator-productSource')

    expect(productTypeIndicator).toHaveStyle({ width: '12px', minWidth: '12px', visibility: 'visible' })
    expect(productSourceIndicator).toHaveStyle({ width: '12px', minWidth: '12px', visibility: 'hidden' })

    await user.click(screen.getByText('Product Source'))

    await waitFor(() => {
      expect(productTypeIndicator).toHaveStyle({ width: '12px', minWidth: '12px', visibility: 'hidden' })
      expect(productSourceIndicator).toHaveStyle({ width: '12px', minWidth: '12px', visibility: 'visible' })
    })
  })
})


