import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ETLManagementScreen, { getManagementSearchTerms, matchesManagementSearch } from './ETLManagementScreen.jsx'

const mockFetchDraftConfiguration = vi.fn(() => Promise.resolve('pipeline: yaml'))
const mockFetchSavedDraftYaml = vi.fn(() => Promise.resolve('saved: yaml'))
const mockFetchDeploymentSteps = vi.fn(() => Promise.resolve([
  { id: 'validate', label: 'Validate' },
  { id: 'deploy', label: 'Deploy' },
]))
const mockDeployFromYaml = vi.fn(() => Promise.resolve({ success: true, deploymentId: 'dep-run-1' }))
const mockSubscribeToDeploymentProgress = vi.fn(() => vi.fn())
const mockSetDeploymentStatus = vi.fn()
const mockDeleteDeployment = vi.fn()
const mockPermanentlyDeleteDeployment = vi.fn()
const mockRestoreDeployment = vi.fn()
const mockStopDeployment = vi.fn()
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

const baseMockDeployments = [
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
  {
    id: 'dep-4',
    productType: 'Legacy',
    productSource: 'Archive',
    environment: 'production',
    deploymentStatus: 'deleted',
    previousDeploymentStatus: 'running',
    savedVersion: '0.9.0',
    deployedVersion: '0.9.0',
    lastStatusChange: '2026-03-10T10:00:00.000Z',
    createdAt: '2026-03-09T09:00:00.000Z',
  },
]

let mockDeployments = []

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
  deleteDeployment: (...args) => mockDeleteDeployment(...args),
  permanentlyDeleteDeployment: (...args) => mockPermanentlyDeleteDeployment(...args),
  restoreDeployment: (...args) => mockRestoreDeployment(...args),
  stopDeployment: (...args) => mockStopDeployment(...args),
  fetchDeploymentSteps: (...args) => mockFetchDeploymentSteps(...args),
  subscribeToDeploymentProgress: (...args) => mockSubscribeToDeploymentProgress(...args),
  deployFromYaml: (...args) => mockDeployFromYaml(...args),
  setDeploymentStatus: (...args) => mockSetDeploymentStatus(...args),
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
    mockDeployments = structuredClone(baseMockDeployments)
    Object.values(mockActions).forEach(fn => fn.mockReset())
    mockFetchDraftConfiguration.mockClear()
    mockFetchSavedDraftYaml.mockClear()
    mockFetchDeploymentSteps.mockClear()
    mockDeployFromYaml.mockClear()
    mockSubscribeToDeploymentProgress.mockClear()
    mockSetDeploymentStatus.mockClear()
    mockDeleteDeployment.mockReset()
    mockDeleteDeployment.mockImplementation(async (dep) => {
      mockDeployments = mockDeployments.map(deployment => (
        deployment.id === dep.id
          ? { ...deployment, previousDeploymentStatus: deployment.deploymentStatus, deploymentStatus: 'deleted' }
          : deployment
      ))
      return { success: true }
    })
    mockPermanentlyDeleteDeployment.mockReset()
    mockPermanentlyDeleteDeployment.mockImplementation(async (dep) => {
      mockDeployments = mockDeployments.filter(deployment => deployment.id !== dep.id)
      return { success: true }
    })
    mockRestoreDeployment.mockReset()
    mockRestoreDeployment.mockImplementation(async (id) => {
      mockDeployments = mockDeployments.map(deployment => (
        deployment.id === id
          ? {
              ...deployment,
              deploymentStatus: deployment.previousDeploymentStatus || 'draft',
              previousDeploymentStatus: deployment.previousDeploymentStatus || 'draft',
            }
          : deployment
      ))
      return { success: true }
    })
    mockStopDeployment.mockReset()
    mockStopDeployment.mockImplementation(async (dep) => {
      mockDeployments = mockDeployments.map(deployment => (
        deployment.id === dep.id
          ? {
              ...deployment,
              deploymentStatus: 'stopped',
            }
          : deployment
      ))
      return { success: true }
    })
    mockHydrateWizardStateFromYaml.mockClear()
    localStorage.clear()
    window.open = vi.fn()
    mockDeploymentProgress.isOpen = false
    mockDeploymentProgress.steps = []
    mockDeploymentProgress.currentStepIndex = 0
    mockDeploymentProgress.isComplete = false
    mockDeploymentProgress.isError = false
    mockDeploymentProgress.errorMessage = ''
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
    const tableStack = screen.getByTestId('etl-management-table-stack')
    const tabsFrame = screen.getByTestId('etl-management-tabs-frame')
    const toolbar = screen.getByTestId('etl-management-toolbar')
    const notificationsRow = screen.getByTestId('etl-management-notifications-row')
    const tabsWrapper = screen.getByTestId('etl-management-tabs')
    const allTabButton = screen.getByRole('button', { name: /All/i })
    const deletedTabButton = screen.getByRole('button', { name: /Deleted/i })
    const tabRow = allTabButton.parentElement

    expect(tableCard).toHaveStyle({ minHeight: '260px', flex: '1 1 auto' })
    expect(tableCard.style.height).toBe('')
    expect(tabsWrapper).toHaveStyle({ width: '100%' })
    expect(tableStack).toContainElement(tabsFrame)
    expect(tableStack).toContainElement(tableCard)
    expect(tabsFrame).toContainElement(tabsWrapper)
    expect(tabsFrame.nextElementSibling).toBe(tableCard)
    expect(allTabButton.style.flex).toBe('')
    expect(notificationsRow).toHaveStyle({ minHeight: '52px' })
    expect(toolbar.nextElementSibling).toBe(notificationsRow)
    expect(notificationsRow.nextElementSibling).toBe(tableStack)
    expect(tabsFrame.style.border).toBe('')
    expect(tabsFrame).toHaveStyle({ alignSelf: 'flex-start', marginBottom: '-1px' })
    expect(tableCard).toHaveStyle({ borderTopLeftRadius: '10px', borderTopRightRadius: '10px' })
    expect(tabRow).toHaveStyle({
      boxShadow: 'inset 0 0 0 1px var(--border)',
      borderTopLeftRadius: '10px',
      borderTopRightRadius: '10px',
    })
    expect(deletedTabButton).toBeInTheDocument()

    const productTypeIndicator = screen.getByTestId('sort-indicator-productType')
    const productSourceIndicator = screen.getByTestId('sort-indicator-productSource')

    expect(productTypeIndicator).toHaveStyle({ width: '12px', minWidth: '12px', visibility: 'visible' })
    expect(productSourceIndicator).toHaveStyle({ width: '12px', minWidth: '12px', visibility: 'hidden' })

    await user.click(screen.getByText('Product Source'))

    await waitFor(() => {
      expect(productTypeIndicator).toHaveStyle({ width: '12px', minWidth: '12px', visibility: 'hidden' })
      expect(productSourceIndicator).toHaveStyle({ width: '12px', minWidth: '12px', visibility: 'visible' })
    })
  }, 10000)

  it('starts a new configuration with an empty location selection', async () => {
    const user = userEvent.setup()

    render(<ETLManagementScreen />)

    await waitFor(() => {
      expect(screen.getByText('Inventory')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /new configuration/i }))

    expect(mockActions.loadState).toHaveBeenCalledWith(expect.objectContaining({
      navigationMode: 'etl-config',
      currentStep: 0,
      metadata: expect.objectContaining({
        location: '',
        environment: '',
      }),
    }))
  })

  it('does not render a left warning border for version mismatch rows', async () => {
    render(<ETLManagementScreen />)

    const pricingCell = await screen.findByText('Pricing')
    const pricingRow = pricingCell.closest('tr')

    expect(pricingRow).toBeTruthy()
    expect(pricingRow.style.borderLeft).toBe('')
  })

  it('defaults to the All tab and filters rows by environment and deleted status tabs', async () => {
    const user = userEvent.setup()
    render(<ETLManagementScreen />)

    await waitFor(() => {
      expect(screen.getByText('Inventory')).toBeInTheDocument()
      expect(screen.getByText('Catalog')).toBeInTheDocument()
      expect(screen.getByText('Pricing')).toBeInTheDocument()
      expect(screen.getByText('Legacy')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /All/i })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: /Stage/i }))

    await waitFor(() => {
      expect(screen.getByText('Catalog')).toBeInTheDocument()
      expect(screen.queryByText('Inventory')).not.toBeInTheDocument()
      expect(screen.queryByText('Pricing')).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Prod/i }))

    await waitFor(() => {
      expect(screen.getByText('Inventory')).toBeInTheDocument()
      expect(screen.getByText('Pricing')).toBeInTheDocument()
      expect(screen.queryByText('Catalog')).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Deleted/i }))

    await waitFor(() => {
      expect(screen.getByText('Legacy')).toBeInTheDocument()
      expect(screen.queryByText('Inventory')).not.toBeInTheDocument()
      expect(screen.queryByText('Catalog')).not.toBeInTheDocument()
    })
  })

  it('updates the summary line to reflect only the active tab', async () => {
    const user = userEvent.setup()
    render(<ETLManagementScreen />)

    await waitFor(() => {
      expect(screen.getByText('4 pipelines')).toBeInTheDocument()
      expect(screen.getByText('2 running')).toBeInTheDocument()
      expect(screen.getByText('0 stopped')).toBeInTheDocument()
      expect(screen.getByText('1 draft')).toBeInTheDocument()
      expect(screen.getByText('0 failed')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Stage/i }))

    await waitFor(() => {
      expect(screen.getByText('1 pipeline')).toBeInTheDocument()
      expect(screen.getByText('0 running')).toBeInTheDocument()
      expect(screen.getByText('0 stopped')).toBeInTheDocument()
      expect(screen.getByText('1 draft')).toBeInTheDocument()
      expect(screen.getByText('0 failed')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Deleted/i }))

    await waitFor(() => {
      expect(screen.getByText('1 pipeline')).toBeInTheDocument()
      expect(screen.getByText('0 running')).toBeInTheDocument()
      expect(screen.getByText('0 stopped')).toBeInTheDocument()
      expect(screen.getByText('0 draft')).toBeInTheDocument()
      expect(screen.getByText('0 failed')).toBeInTheDocument()
    })
  })

  it('normalizes multi-word filter text and matches terms across different columns', () => {
    expect(getManagementSearchTerms('  ERP   running  ')).toEqual(['erp', 'running'])

    expect(matchesManagementSearch(baseMockDeployments[0], 'ERP running')).toBe(true)
    expect(matchesManagementSearch(baseMockDeployments[1], 'ERP running')).toBe(false)
    expect(matchesManagementSearch(baseMockDeployments[1], 'CRM staging')).toBe(true)
    expect(matchesManagementSearch(baseMockDeployments[1], '13 Mar 2026')).toBe(true)
    expect(matchesManagementSearch(baseMockDeployments[0], '13 Mar 2026')).toBe(false)
    expect(matchesManagementSearch(baseMockDeployments[1], '2026-03-13')).toBe(true)
  })

  it('matches separate filter words across different columns in the same row', async () => {
    const user = userEvent.setup()
    render(<ETLManagementScreen />)

    await waitFor(() => {
      expect(screen.getByText('Inventory')).toBeInTheDocument()
      expect(screen.getByText('Catalog')).toBeInTheDocument()
      expect(screen.getByText('Pricing')).toBeInTheDocument()
    })

    const filterInput = screen.getByPlaceholderText('🔍 Filter deployments...')
    await user.type(filterInput, 'ERP running')

    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      expect(rows).toHaveLength(2)
      expect(within(rows[1]).getByText('Inventory')).toBeInTheDocument()
      expect(within(rows[1]).getByText('ERP')).toBeInTheDocument()
    })

    await user.clear(filterInput)
    await user.type(filterInput, 'CRM staging')

    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      expect(rows).toHaveLength(2)
      expect(within(rows[1]).getByText('Catalog')).toBeInTheDocument()
      expect(within(rows[1]).getByText('CRM')).toBeInTheDocument()
    })
  })

  it('requires every filter word to match somewhere in the same row', async () => {
    const user = userEvent.setup()
    render(<ETLManagementScreen />)

    await waitFor(() => {
      expect(screen.getByText('Inventory')).toBeInTheDocument()
    })

    const filterInput = screen.getByPlaceholderText('🔍 Filter deployments...')
    await user.type(filterInput, 'ERP deleted')

    await waitFor(() => {
      expect(screen.getByText('No deployments match "ERP deleted"')).toBeInTheDocument()
      expect(screen.queryByText('Inventory')).not.toBeInTheDocument()
      expect(screen.queryByText('Legacy')).not.toBeInTheDocument()
    })
  })

  it('filters rows by last status change text', async () => {
    const user = userEvent.setup()
    render(<ETLManagementScreen />)

    await waitFor(() => {
      expect(screen.getByText('Inventory')).toBeInTheDocument()
      expect(screen.getByText('Catalog')).toBeInTheDocument()
      expect(screen.getByText('Pricing')).toBeInTheDocument()
    })

    const filterInput = screen.getByPlaceholderText('🔍 Filter deployments...')
    await user.type(filterInput, '13 mar 2026')

    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      expect(rows).toHaveLength(2)
      expect(within(rows[1]).getByText('Catalog')).toBeInTheDocument()
      expect(within(rows[1]).getByText('CRM')).toBeInTheDocument()
      expect(screen.queryByText('Inventory')).not.toBeInTheDocument()
      expect(screen.queryByText('Pricing')).not.toBeInTheDocument()
    })
  })

  it('reloads the management table after delete and moves the pipeline into the Deleted tab', async () => {
    const user = userEvent.setup()
    render(<ETLManagementScreen />)

    await waitFor(() => {
      expect(screen.getByText('Catalog')).toBeInTheDocument()
    })

    await user.click(screen.getAllByRole('button', { name: 'Delete pipeline' })[0])

    await waitFor(() => {
      expect(screen.getByText('Delete deployment?')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(mockDeleteDeployment).toHaveBeenCalledWith(expect.objectContaining({
        id: 'dep-2',
        productType: 'Catalog',
        productSource: 'CRM',
        teamName: 'data-platform',
        environment: 'staging',
      }), true)
      expect(screen.getByText('Pipeline deleted. You can find it under the Deleted tab.')).toBeInTheDocument()
    })

    const notificationsRow = screen.getByTestId('etl-management-notifications-row')

    expect(within(notificationsRow).getByText('Pipeline deleted. You can find it under the Deleted tab.')).toBeInTheDocument()
    expect(notificationsRow.nextElementSibling).toBe(screen.getByTestId('etl-management-table-stack'))

    await user.click(screen.getByRole('button', { name: /Deleted/i }))

    await waitFor(() => {
      expect(screen.getByText('Catalog')).toBeInTheDocument()
    })
  }, 10000)

  it('stops a running pipeline from the management table', async () => {
    const user = userEvent.setup()
    render(<ETLManagementScreen />)

    await waitFor(() => {
      expect(screen.getByText('Inventory')).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: 'Stop pipeline' }).length).toBeGreaterThan(0)
    })

    const enabledStopButton = screen.getAllByRole('button', { name: 'Stop pipeline' }).find(button => !button.disabled)

    expect(enabledStopButton).toBeTruthy()

    await user.click(enabledStopButton)

    await waitFor(() => {
      expect(mockStopDeployment).toHaveBeenCalledWith(expect.objectContaining({
        id: 'dep-1',
        productType: 'Inventory',
        productSource: 'ERP',
        teamName: 'data-platform',
        environment: 'production',
      }), true)
      expect(screen.getByText('Pipeline stopped successfully.')).toBeInTheDocument()
      expect(screen.getByText('1 stopped')).toBeInTheDocument()
    })
  })

  it('uses the shared deploy modal and SSE flow when upgrading a running deployment', async () => {
    const user = userEvent.setup()
    mockDeploymentProgress.isOpen = true
    render(<ETLManagementScreen />)

    await waitFor(() => {
      expect(screen.getByText('Pricing')).toBeInTheDocument()
    })

    const upgradeButton = screen.getAllByRole('button', { name: 'Upgrade deployment' }).find(button => !button.disabled)

    expect(upgradeButton).toBeTruthy()

    await user.click(upgradeButton)

    await waitFor(() => {
      expect(screen.getByText('Upgrading pipeline from management...')).toBeInTheDocument()
      expect(mockFetchDeploymentSteps).toHaveBeenCalledWith(false)
      expect(mockDeploymentProgress.startDeployment).toHaveBeenCalledWith([
        { id: 'validate', label: 'Validate' },
        { id: 'deploy', label: 'Deploy' },
      ])
      expect(mockFetchDraftConfiguration).toHaveBeenCalledWith({
        productType: 'Pricing',
        source: 'PIM',
        team: 'data-platform',
        environment: 'production',
      }, false)
      expect(mockDeployFromYaml).toHaveBeenCalledWith({
        productType: 'Pricing',
        source: 'PIM',
        team: 'data-platform',
        environment: 'production',
        isDeploy: false,
        configurationYaml: 'pipeline: yaml',
      })
      expect(mockSubscribeToDeploymentProgress).toHaveBeenCalledWith('dep-run-1', expect.any(Object))
    })
  })

  it('permanently deletes rows from the Deleted tab using mocked data', async () => {
    const user = userEvent.setup()
    render(<ETLManagementScreen />)

    await waitFor(() => {
      expect(screen.getByText('Legacy')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Deleted/i }))

    await waitFor(() => {
      expect(screen.getByText('Legacy')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Delete permanently' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Restore pipeline' })).toBeInTheDocument()
      expect(screen.queryByText('Delete permanently')).not.toBeInTheDocument()
      expect(screen.queryByText('Restore')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Deploy pipeline' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Upgrade deployment' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Edit configuration' })).not.toBeInTheDocument()
    })

    await user.click(screen.getAllByRole('button', { name: 'Delete permanently' })[0])

    await waitFor(() => {
      expect(screen.getByText('Delete permanently?')).toBeInTheDocument()
      expect(screen.getByText('This will delete this pipeline permantly , are you sure you want to continue?')).toBeInTheDocument()
    })

    await user.click(screen.getAllByRole('button', { name: 'Delete permanently' })[1])

    await waitFor(() => {
      expect(mockPermanentlyDeleteDeployment).toHaveBeenCalledWith(expect.objectContaining({
        id: 'dep-4',
        productType: 'Legacy',
        productSource: 'Archive',
        teamName: 'data-platform',
        environment: 'production',
      }), true)
      expect(screen.queryByText('Legacy')).not.toBeInTheDocument()
      expect(screen.getByText('Pipeline permanently deleted.')).toBeInTheDocument()
    })
  })

  it('restores deleted rows back to their original environment tab', async () => {
    const user = userEvent.setup()
    render(<ETLManagementScreen />)

    await user.click(screen.getByRole('button', { name: /Deleted/i }))

    await waitFor(() => {
      expect(screen.getByText('Legacy')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Restore pipeline' })).toBeInTheDocument()
      expect(screen.queryByText('Restore')).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Restore pipeline' }))

    await waitFor(() => {
      expect(screen.getByText('Restore pipeline?')).toBeInTheDocument()
      expect(screen.getByText('Are you sure you want to restore this pipline ?')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Yes' }))

    await waitFor(() => {
      expect(mockRestoreDeployment).toHaveBeenCalledWith('dep-4', true)
      expect(screen.queryByText('Legacy')).not.toBeInTheDocument()
      expect(screen.getByText('Pipeline restored successfully.')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Prod/i }))

    await waitFor(() => {
      expect(screen.getByText('Legacy')).toBeInTheDocument()
    })
  })

  it('shows a deployment failure popup with a readable reason when deploy startup fails', async () => {
    const user = userEvent.setup()
    mockDeployFromYaml.mockResolvedValueOnce({ success: false, error: 'Kafka broker was unavailable' })

    render(<ETLManagementScreen />)

    await waitFor(() => {
      expect(screen.getByText('Catalog')).toBeInTheDocument()
    })

    const deployButton = screen.getAllByRole('button', { name: 'Deploy pipeline' }).find(button => !button.disabled)

    expect(deployButton).toBeTruthy()

    await user.click(deployButton)

    await waitFor(() => {
      expect(mockDeployFromYaml).toHaveBeenCalledWith({
        productType: 'Catalog',
        source: 'CRM',
        team: 'data-platform',
        environment: 'staging',
        isDeploy: true,
        configurationYaml: 'pipeline: yaml',
      })
      expect(screen.getByText('Kafka broker was unavailable')).toBeInTheDocument()
      expect(screen.getByText('1 failed')).toBeInTheDocument()
      expect(screen.queryByText('Failure Reason')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument()
    })
  })

  it('renders saved and deployed version hints as floating tooltips above the last table row', async () => {
    const user = userEvent.setup()

    render(<ETLManagementScreen />)

    const legacyCell = await screen.findByText('Legacy')
    const legacyRow = legacyCell.closest('tr')

    expect(legacyRow).toBeTruthy()

    const [savedVersionButton, deployedVersionButton] = within(legacyRow).getAllByRole('button', { name: '0.9.0' })

    await user.hover(savedVersionButton)

    const savedTooltip = await screen.findByRole('tooltip')
    expect(savedTooltip).toHaveTextContent('👁 Open saved version preview')
    expect(savedTooltip).toHaveStyle({
      bottom: 'calc(100% + 8px)',
      left: '50%',
    })
    expect(savedTooltip.style.top).toBe('')

    await user.unhover(savedVersionButton)

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    await user.hover(deployedVersionButton)

    const deployedTooltip = await screen.findByRole('tooltip')
    expect(deployedTooltip).toHaveTextContent('👁 Open deployed version preview')
    expect(deployedTooltip).toHaveStyle({
      bottom: 'calc(100% + 8px)',
      left: '50%',
    })
    expect(deployedTooltip.style.top).toBe('')
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

  it('loads the original deployed YAML into wizard state when editing a running deployment', async () => {
    const user = userEvent.setup()

    render(<ETLManagementScreen />)

    await waitFor(() => {
      expect(screen.getByText('Inventory')).toBeInTheDocument()
    })

    await user.click(screen.getAllByRole('button', { name: 'Edit configuration' })[0])

    await waitFor(() => {
      expect(screen.getByText('Open deployment for editing?')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(mockFetchDraftConfiguration).toHaveBeenCalledTimes(1)
      expect(mockActions.loadState).toHaveBeenCalledWith(expect.objectContaining({
        navigationMode: 'etl-config',
        currentStep: 0,
        originalDraftYaml: 'pipeline: yaml',
        completedSteps: [0, 1, 2, 3, 4, 5, 6],
      }))
    })
  })
})


