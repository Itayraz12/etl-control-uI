import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ETLManagementScreen from './ETLManagementScreen.jsx'

const mockFetchDraftConfiguration = vi.fn(() => Promise.resolve('pipeline: yaml'))
const mockFetchSavedDraftYaml = vi.fn(() => Promise.resolve('saved: yaml'))
const mockFetchDeploymentSteps = vi.fn(() => Promise.resolve([
  { id: 'validate', label: 'Validate' },
  { id: 'deploy', label: 'Deploy' },
]))
const mockDeployFromYaml = vi.fn(() => Promise.resolve({ success: true, deploymentId: 'dep-run-1' }))
const mockSubscribeToDeploymentProgress = vi.fn(() => vi.fn())
const mockHydrateWizardStateFromYaml = vi.fn(() => ({ metadata: { productType: 'Inventory' } }))
const mockDeploymentProgress = {
  isOpen: false,
  steps: [],
  currentStepIndex: 0,
  isComplete: false,
  isError: false,
  errorMessage: '',
  startDeployment: vi.fn(),
  reset: vi.fn(),
  setCurrentStepIndex: vi.fn(),
  updateStep: vi.fn(),
  setIsComplete: vi.fn(),
}

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
  {
    id: 'dep-3',
    productType: 'Pricing',
    productSource: 'PIM',
    environment: 'production',
    deploymentStatus: 'running',
    savedVersion: '3.1.0',
    deployedVersion: '3.0.0',
    lastStatusChange: '2026-03-16T10:00:00.000Z',
    createdAt: '2026-03-15T09:00:00.000Z',
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
  deleteDeployment: vi.fn(() => Promise.resolve({ success: true })),
  fetchDeploymentSteps: (...args) => mockFetchDeploymentSteps(...args),
  subscribeToDeploymentProgress: (...args) => mockSubscribeToDeploymentProgress(...args),
  deployFromYaml: (...args) => mockDeployFromYaml(...args),
}))

vi.mock('../../shared/services/configService.js', () => ({
  fetchDraftConfiguration: (...args) => mockFetchDraftConfiguration(...args),
  fetchSavedDraftYaml: (...args) => mockFetchSavedDraftYaml(...args),
}))

vi.mock('../../shared/services/configurationHydrator.js', () => ({
  hydrateWizardStateFromYaml: (...args) => mockHydrateWizardStateFromYaml(...args),
}))

vi.mock('../../shared/hooks/useDeploymentProgress.js', () => ({
  useDeploymentProgress: () => mockDeploymentProgress,
}))

describe('ETLManagementScreen table layout stability', () => {
  beforeEach(() => {
    Object.values(mockActions).forEach(fn => fn.mockReset())
    mockFetchDraftConfiguration.mockClear()
    mockFetchSavedDraftYaml.mockClear()
    mockFetchDeploymentSteps.mockClear()
    mockDeployFromYaml.mockClear()
    mockSubscribeToDeploymentProgress.mockClear()
    mockHydrateWizardStateFromYaml.mockClear()
    localStorage.clear()
    window.open = vi.fn()
    Object.values(mockDeploymentProgress).forEach(value => {
      if (typeof value === 'function') value.mockClear()
    })
  })

  it('keeps stable sort indicator spacing and flexible table sizing', async () => {
    const user = userEvent.setup()
    render(<ETLManagementScreen />)

    await waitFor(() => {
      expect(screen.getByText('Inventory')).toBeInTheDocument()
      expect(screen.getByText('Catalog')).toBeInTheDocument()
      expect(screen.getByText('Pricing')).toBeInTheDocument()
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

  it('does not render a left warning border for version mismatch rows', async () => {
    render(<ETLManagementScreen />)

    const pricingCell = await screen.findByText('Pricing')
    const pricingRow = pricingCell.closest('tr')

    expect(pricingRow).toBeTruthy()
    expect(pricingRow.style.borderLeft).toBe('')
  })

  it('shows a deployment failure popup with a readable reason when deploy startup fails', async () => {
    const user = userEvent.setup()
    mockDeployFromYaml.mockResolvedValueOnce({ success: false, error: 'Kafka broker was unavailable' })

    render(<ETLManagementScreen />)

    await waitFor(() => {
      expect(screen.getByText('Catalog')).toBeInTheDocument()
    })

    await user.click(screen.getByTitle('Deploy pipeline'))

    await waitFor(() => {
      expect(screen.getByText('Deployment Failed')).toBeInTheDocument()
      expect(screen.getByText('Kafka broker was unavailable')).toBeInTheDocument()
      expect(screen.queryByText('Failure Reason')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument()
    })
  })

  it('opens saved versions in a read-only preview window that carries the deployment id in the URL', async () => {
    const user = userEvent.setup()

    render(<ETLManagementScreen />)

    await waitFor(() => {
      expect(screen.getByText('Catalog')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '2.0.0' }))

    await waitFor(() => {
      expect(mockFetchSavedDraftYaml).toHaveBeenCalledTimes(1)
      expect(mockHydrateWizardStateFromYaml).toHaveBeenCalledTimes(1)
      expect(window.open).toHaveBeenCalledWith(
        `${window.location.origin}/?preview=true&deploymentId=dep-2&previewSource=saved`,
        '_blank',
      )
    })

    const savedDraft = JSON.parse(localStorage.getItem('etl-deployment-preview:dep-2:saved'))

    expect(savedDraft.wizardState).toMatchObject({
      navigationMode: 'etl-config',
      readOnly: true,
      currentStep: 0,
      completedSteps: [0, 1, 2, 3, 4, 5, 6],
    })
  })

  it('opens deployed versions in a read-only preview window that carries the deployment id in the URL', async () => {
    const user = userEvent.setup()

    render(<ETLManagementScreen />)

    await waitFor(() => {
      expect(screen.getByText('Pricing')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '3.0.0' }))

    await waitFor(() => {
      expect(mockFetchDraftConfiguration).toHaveBeenCalledTimes(1)
      expect(mockHydrateWizardStateFromYaml).toHaveBeenCalledTimes(1)
      expect(window.open).toHaveBeenCalledWith(
        `${window.location.origin}/?preview=true&deploymentId=dep-3&previewSource=deployed`,
        '_blank',
      )
    })

    const deployedDraft = JSON.parse(localStorage.getItem('etl-deployment-preview:dep-3:deployed'))

    expect(deployedDraft.wizardState).toMatchObject({
      navigationMode: 'etl-config',
      readOnly: true,
      currentStep: 0,
      completedSteps: [0, 1, 2, 3, 4, 5, 6],
    })
  })
})


