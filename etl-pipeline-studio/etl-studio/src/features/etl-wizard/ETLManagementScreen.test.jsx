import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ETLManagementScreen, { compareDeploymentVersions, getManagementSearchTerms, matchesManagementSearch } from './ETLManagementScreen.jsx'

const mockFetchDraftConfiguration = vi.fn(() => Promise.resolve('pipeline: yaml'))
const mockFetchSavedDraftYaml = vi.fn(() => Promise.resolve('saved: yaml'))
const mockFetchDeployments = vi.fn(() => Promise.resolve([]))
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
const mockEnsureDefinitionsForWizardState = vi.fn(() => Promise.resolve())
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
    teamName: 'data-platform',
    productType: 'Inventory',
    productSource: 'ERP',
    environment: 'PROD',
    deploymentStatus: 'running',
    savedVersion: '1.2.0',
    deployedVersion: '1.2.0',
    lastStatusChange: '2026-03-15T10:00:00.000Z',
    createdAt: '2026-03-14T09:00:00.000Z',
  },
  {
    id: 'dep-2',
    teamName: 'data-platform',
    productType: 'Catalog',
    productSource: 'CRM',
    environment: 'CAP',
    deploymentStatus: 'draft',
    savedVersion: '2.0.0',
    deployedVersion: null,
    lastStatusChange: '2026-03-13T10:00:00.000Z',
    createdAt: '2026-03-12T09:00:00.000Z',
  },
  {
    id: 'dep-3',
    teamName: 'data-platform',
    productType: 'Pricing',
    productSource: 'PIM',
    environment: 'PROD',
    deploymentStatus: 'running',
    savedVersion: '3.1.0',
    deployedVersion: '3.0.0',
    lastStatusChange: '2026-03-16T10:00:00.000Z',
    createdAt: '2026-03-15T09:00:00.000Z',
  },
  {
    id: 'dep-4',
    teamName: 'data-platform',
    productType: 'Legacy',
    productSource: 'Archive',
    environment: 'PROD',
    deploymentStatus: 'deleted',
    previousDeploymentStatus: 'running',
    savedVersion: '0.9.0',
    deployedVersion: '0.9.0',
    lastStatusChange: '2026-03-10T10:00:00.000Z',
    createdAt: '2026-03-09T09:00:00.000Z',
  },
]

let mockDeployments = []
let mockUser = { teamName: 'data-platform', userId: 'user-1', role: 'regular' }
const mockCopyTextToClipboard = vi.fn(() => Promise.resolve(true))

vi.mock('../../shared/store/wizardStore.jsx', () => ({
  useWizard: () => ({
    state: { metadata: { environment: 'PROD' } },
    actions: mockActions,
  }),
}))

vi.mock('../../shared/store/mockModeContext.jsx', () => ({
  useMockMode: () => ({
    useMock: true,
    setUseMock: vi.fn(),
  }),
}))

vi.mock('../../shared/store/configContext.jsx', () => ({
  useConfig: () => ({
    ensureDefinitionsForWizardState: (...args) => mockEnsureDefinitionsForWizardState(...args),
  }),
}))

vi.mock('../../shared/store/userContext.jsx', () => ({
  useUser: () => ({
    user: mockUser,
  }),
}))

vi.mock('../../shared/services/deploymentsService.js', () => ({
  fetchDeployments: (...args) => mockFetchDeployments(...args),
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

vi.mock('../../shared/services/clipboard.js', () => ({
  copyTextToClipboard: (...args) => mockCopyTextToClipboard(...args),
}))

vi.mock('../../shared/hooks/useDeploymentProgress.js', () => ({
  useDeploymentProgress: () => mockDeploymentProgress,
}))

describe('ETLManagementScreen table layout stability', () => {
  beforeEach(() => {
    vi.useRealTimers()
    mockDeployments = structuredClone(baseMockDeployments)
    mockUser = { teamName: 'data-platform', userId: 'user-1', role: 'regular' }
    mockFetchDeployments.mockReset()
    mockFetchDeployments.mockImplementation(() => Promise.resolve(mockDeployments))
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
    mockEnsureDefinitionsForWizardState.mockReset()
    mockEnsureDefinitionsForWizardState.mockResolvedValue(undefined)
    mockCopyTextToClipboard.mockReset()
    mockCopyTextToClipboard.mockResolvedValue(true)
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
    expect(screen.queryByText('Team Name')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Team filter' })).not.toBeInTheDocument()

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
      source: expect.objectContaining({
        streamingContinuity: '',
        recordsPerDay: '',
      }),
    }))
  }, 10000)

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
      expect(screen.getAllByText('PROD').length).toBeGreaterThan(0)
      expect(screen.getAllByText('CAP').length).toBeGreaterThan(0)
    })

    expect(screen.getByRole('button', { name: /All/i })).toHaveAttribute('aria-pressed', 'true')

    expect(screen.queryByRole('button', { name: /dev/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^CAP/i }))

    await waitFor(() => {
      expect(screen.getByText('Catalog')).toBeInTheDocument()
      expect(screen.queryByText('Inventory')).not.toBeInTheDocument()
      expect(screen.queryByText('Pricing')).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /^PROD/i }))

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
  }, 10000)

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

    await user.click(screen.getByRole('button', { name: /^CAP/i }))

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
    expect(matchesManagementSearch(baseMockDeployments[1], 'CRM cap')).toBe(true)
    expect(matchesManagementSearch(baseMockDeployments[1], '13 Mar 2026')).toBe(true)
    expect(matchesManagementSearch(baseMockDeployments[0], '13 Mar 2026')).toBe(false)
    expect(matchesManagementSearch(baseMockDeployments[1], '2026-03-13')).toBe(true)
  })

  it('compares dotted deployment versions numerically', () => {
    expect(compareDeploymentVersions('3.1.0', '3.0.9')).toBeGreaterThan(0)
    expect(compareDeploymentVersions('2.0.0', '2.0.0')).toBe(0)
    expect(compareDeploymentVersions('1.9.9', '2.0.0')).toBeLessThan(0)
  })

  it('matches separate filter words across different columns in the same row', async () => {
    const user = userEvent.setup()
    render(<ETLManagementScreen />)

    await waitFor(() => {
      expect(screen.getByText('Inventory')).toBeInTheDocument()
      expect(screen.getByText('Catalog')).toBeInTheDocument()
      expect(screen.getByText('Pricing')).toBeInTheDocument()
    })

    const filterInput = screen.getByPlaceholderText(' Filter deployments...')
    await user.type(filterInput, 'ERP running')

    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      expect(rows).toHaveLength(2)
      expect(within(rows[1]).getByText('Inventory')).toBeInTheDocument()
      expect(within(rows[1]).getByText('ERP')).toBeInTheDocument()
    })

    await user.clear(filterInput)
    await user.type(filterInput, 'CRM CAP')

    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      expect(rows).toHaveLength(2)
      expect(within(rows[1]).getByText('Catalog')).toBeInTheDocument()
      expect(within(rows[1]).getByText('CRM')).toBeInTheDocument()
    })
  })

  it('fetches deployments with teamName for regular users and without it for admin users', async () => {
    const { rerender } = render(<ETLManagementScreen />)

    await waitFor(() => {
      expect(mockFetchDeployments).toHaveBeenCalledWith('data-platform', true, { includeAllTeams: false, forceRefresh: true })
    })

    mockFetchDeployments.mockClear()
    mockUser = { teamName: 'data-platform', userId: 'admin-1', role: 'admin' }

    rerender(<ETLManagementScreen />)

    await waitFor(() => {
      expect(mockFetchDeployments).toHaveBeenCalledWith('data-platform', true, { includeAllTeams: true, forceRefresh: true })
    })
  })

  it('shows an admin-only team column and filters deployments by the selected team', async () => {
    const user = userEvent.setup()
    mockUser = { teamName: 'data-platform', userId: 'admin-1', role: 'admin' }
    mockDeployments = structuredClone(baseMockDeployments).map((deployment, index) => ({
      ...deployment,
      teamName: index % 2 === 0 ? 'Team A' : 'Team B',
    }))

    render(<ETLManagementScreen />)

    await waitFor(() => {
      expect(screen.getByText('Team Name')).toBeInTheDocument()
      const teamFilter = screen.getByRole('combobox', { name: 'Team filter' })
      expect(teamFilter).toBeInTheDocument()
      expect(within(teamFilter).getByRole('option', { name: 'Team A' })).toBeInTheDocument()
      expect(within(teamFilter).getByRole('option', { name: 'Team B' })).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Team filter' }), 'Team B')

    await waitFor(() => {
      expect(screen.getByText('Catalog')).toBeInTheDocument()
      expect(screen.getByText('Legacy')).toBeInTheDocument()
      expect(screen.queryByText('Inventory')).not.toBeInTheDocument()
      expect(screen.queryByText('Pricing')).not.toBeInTheDocument()
    })
  })

  it('keeps admin sorting and team filtering stable when multiple teams share backend ids', async () => {
    const user = userEvent.setup()
    mockUser = { teamName: 'data-platform', userId: 'admin-1', role: 'admin' }
    mockDeployments = [
      {
        id: 'shared-1',
        teamName: 'Team A',
        productType: 'Alpha',
        productSource: 'ERP',
        environment: 'PROD',
        deploymentStatus: 'running',
        savedVersion: '1.0.0',
        deployedVersion: '1.0.0',
        lastStatusChange: '2026-03-15T10:00:00.000Z',
        createdAt: '2026-03-14T09:00:00.000Z',
      },
      {
        id: 'shared-1',
        teamName: 'Team B',
        productType: 'Beta',
        productSource: 'ERP',
        environment: 'PROD',
        deploymentStatus: 'running',
        savedVersion: '1.0.0',
        deployedVersion: '1.0.0',
        lastStatusChange: '2026-03-15T10:05:00.000Z',
        createdAt: '2026-03-14T09:05:00.000Z',
      },
      {
        id: 'shared-2',
        teamName: 'Team A',
        productType: 'Gamma',
        productSource: 'CRM',
        environment: 'CAP',
        deploymentStatus: 'draft',
        savedVersion: '2.0.0',
        deployedVersion: null,
        lastStatusChange: '2026-03-13T10:00:00.000Z',
        createdAt: '2026-03-12T09:00:00.000Z',
      },
      {
        id: 'shared-2',
        teamName: 'Team B',
        productType: 'Delta',
        productSource: 'CRM',
        environment: 'CAP',
        deploymentStatus: 'draft',
        savedVersion: '2.0.0',
        deployedVersion: null,
        lastStatusChange: '2026-03-13T10:05:00.000Z',
        createdAt: '2026-03-12T09:05:00.000Z',
      },
    ]

    render(<ETLManagementScreen />)

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Team filter' })).toBeInTheDocument()
      expect(screen.getByText('Alpha')).toBeInTheDocument()
      expect(screen.getByText('Beta')).toBeInTheDocument()
      expect(screen.getByText('Gamma')).toBeInTheDocument()
      expect(screen.getByText('Delta')).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Team filter' }), 'Team B')

    await waitFor(() => {
      expect(screen.getByText('Beta')).toBeInTheDocument()
      expect(screen.getByText('Delta')).toBeInTheDocument()
      expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
      expect(screen.queryByText('Gamma')).not.toBeInTheDocument()
    })

    await user.click(screen.getByText('Product Type'))

    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      expect(rows).toHaveLength(3)
      expect(within(rows[1]).getByText('Delta')).toBeInTheDocument()
      expect(within(rows[2]).getByText('Beta')).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Team filter' }), 'Team A')

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument()
      expect(screen.getByText('Gamma')).toBeInTheDocument()
      expect(screen.queryByText('Beta')).not.toBeInTheDocument()
      expect(screen.queryByText('Delta')).not.toBeInTheDocument()
    })
  })

  it('requires every filter word to match somewhere in the same row', async () => {
    const user = userEvent.setup()
    render(<ETLManagementScreen />)

    await waitFor(() => {
      expect(screen.getByText('Inventory')).toBeInTheDocument()
    })

    const filterInput = screen.getByPlaceholderText(' Filter deployments...')
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

    const filterInput = screen.getByPlaceholderText(' Filter deployments...')
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
        environment: 'CAP',
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
        environment: 'PROD',
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
      expect(mockFetchDraftConfiguration).not.toHaveBeenCalled()
      expect(mockFetchSavedDraftYaml).not.toHaveBeenCalled()
      expect(mockDeployFromYaml).toHaveBeenCalledWith({
        productType: 'Pricing',
        source: 'PIM',
        team: 'data-platform',
        environment: 'PROD',
        isDeploy: false,
      })
      expect(mockSubscribeToDeploymentProgress).toHaveBeenCalledWith('dep-run-1', expect.any(Object))
    })
  })

  it('shows a deploy version choice modal when a newer saved version exists and deploys the chosen deployed version', async () => {
    const user = userEvent.setup()
    mockDeployments = structuredClone(baseMockDeployments).map((deployment) => (
      deployment.id === 'dep-3'
        ? { ...deployment, deploymentStatus: 'stopped' }
        : deployment
    ))

    render(<ETLManagementScreen />)

    const pricingCell = await screen.findByText('Pricing')
    const pricingRow = pricingCell.closest('tr')

    expect(pricingRow).toBeTruthy()

    await user.click(within(pricingRow).getByRole('button', { name: 'Deploy pipeline' }))

    await waitFor(() => {
      expect(screen.getByText('Choose version to deploy')).toBeInTheDocument()
      expect(screen.getByText('Saved version')).toBeInTheDocument()
      expect(screen.getByText('Deployed version')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Deploy deployed version' }))

    await waitFor(() => {
      expect(mockFetchDraftConfiguration).not.toHaveBeenCalled()
      expect(mockFetchSavedDraftYaml).not.toHaveBeenCalled()
      expect(mockDeployFromYaml).toHaveBeenCalledWith({
        productType: 'Pricing',
        source: 'PIM',
        team: 'data-platform',
        environment: 'PROD',
        isDeploy: true,
        isSavedVersion: false,
        isDeployVersion: true,
        configurationYaml: '',
      })
    })
  })

  it('can deploy the saved version from the version choice modal when a newer saved version exists', async () => {
    const user = userEvent.setup()
    mockDeployments = structuredClone(baseMockDeployments).map((deployment) => (
      deployment.id === 'dep-3'
        ? { ...deployment, deploymentStatus: 'stopped' }
        : deployment
    ))

    render(<ETLManagementScreen />)

    const pricingCell = await screen.findByText('Pricing')
    const pricingRow = pricingCell.closest('tr')

    expect(pricingRow).toBeTruthy()

    await user.click(within(pricingRow).getByRole('button', { name: 'Deploy pipeline' }))

    await waitFor(() => {
      expect(screen.getByText('Choose version to deploy')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Deploy saved version' }))

    await waitFor(() => {
      expect(mockFetchSavedDraftYaml).not.toHaveBeenCalled()
      expect(mockFetchDraftConfiguration).not.toHaveBeenCalled()
      expect(mockDeployFromYaml).toHaveBeenCalledWith({
        productType: 'Pricing',
        source: 'PIM',
        team: 'data-platform',
        environment: 'PROD',
        isDeploy: true,
        isSavedVersion: true,
        isDeployVersion: false,
        configurationYaml: '',
      })
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
        environment: 'PROD',
      }), true)
      expect(screen.queryByText('Legacy')).not.toBeInTheDocument()
      expect(screen.getByText('Pipeline permanently deleted.')).toBeInTheDocument()
    })
  }, 10000)

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

    await user.click(screen.getByRole('button', { name: /^PROD/i }))

    await waitFor(() => {
      expect(screen.getByText('Legacy')).toBeInTheDocument()
    })
  }, 10000)

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
      expect(mockFetchSavedDraftYaml).not.toHaveBeenCalled()
      expect(mockFetchDraftConfiguration).not.toHaveBeenCalled()
      expect(mockDeployFromYaml).toHaveBeenCalledWith({
        productType: 'Catalog',
        source: 'CRM',
        team: 'data-platform',
        environment: 'CAP',
        isDeploy: true,
        isSavedVersion: true,
        isDeployVersion: false,
        configurationYaml: '',
      })
      expect(screen.getByText('Kafka broker was unavailable')).toBeInTheDocument()
      expect(screen.getByText('1 failed')).toBeInTheDocument()
      expect(screen.queryByText('Failure Reason')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument()
    })
  }, 10000)

  it('copies the Grafana link from the deployed success overlay with the async clipboard API', async () => {
    const user = userEvent.setup()

    mockDeployments = structuredClone(baseMockDeployments).map((deployment) => (
      deployment.id === 'dep-2'
        ? { ...deployment, deploymentStatus: 'stopped' }
        : deployment
    ))

    render(<ETLManagementScreen />)

    const catalogCell = await screen.findByText('Catalog')
    const catalogRow = catalogCell.closest('tr')
    expect(catalogRow).toBeTruthy()

    await user.click(within(catalogRow).getByRole('button', { name: 'Deploy pipeline' }))

    await waitFor(() => {
      expect(mockSubscribeToDeploymentProgress).toHaveBeenCalledWith('dep-run-1', expect.any(Object))
    })

    const progressCallbacks = mockSubscribeToDeploymentProgress.mock.calls.at(-1)[1]

    await act(async () => {
      await progressCallbacks.onComplete()
    })

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 600))
    })

    const copyButton = await screen.findByRole('button', { name: /copy/i })
    await user.click(copyButton)

    expect(mockCopyTextToClipboard).toHaveBeenCalledWith(expect.stringContaining('https://grafana.etl-studio.io/d/pipeline-'))
    expect(await screen.findByRole('button', { name: /copied/i })).toBeInTheDocument()
  }, 10000)

  it('shows a copy failure dialog for the deployed success overlay when clipboard access is blocked in OCP', async () => {
    const user = userEvent.setup()
    mockCopyTextToClipboard.mockRejectedValueOnce(new Error('NotAllowedError'))

    mockDeployments = structuredClone(baseMockDeployments).map((deployment) => (
      deployment.id === 'dep-2'
        ? { ...deployment, deploymentStatus: 'stopped' }
        : deployment
    ))

    render(<ETLManagementScreen />)

    const catalogCell = await screen.findByText('Catalog')
    const catalogRow = catalogCell.closest('tr')
    expect(catalogRow).toBeTruthy()

    await user.click(within(catalogRow).getByRole('button', { name: 'Deploy pipeline' }))

    await waitFor(() => {
      expect(mockSubscribeToDeploymentProgress).toHaveBeenCalledWith('dep-run-1', expect.any(Object))
    })

    const progressCallbacks = mockSubscribeToDeploymentProgress.mock.calls.at(-1)[1]

    await act(async () => {
      await progressCallbacks.onComplete()
    })

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 600))
    })

    const copyButton = await screen.findByRole('button', { name: /copy/i })
    await user.click(copyButton)

    expect(mockCopyTextToClipboard).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Copy Failed')).toBeInTheDocument()
    expect(screen.getByText('Clipboard access is blocked in this environment. Please copy the Grafana dashboard link manually.')).toBeInTheDocument()
  }, 10000)


  it('renders saved and deployed version hints as floating tooltips above the last table row', async () => {
    const user = userEvent.setup()

    render(<ETLManagementScreen />)

    const legacyCell = await screen.findByText('Legacy')
    const legacyRow = legacyCell.closest('tr')

    expect(legacyRow).toBeTruthy()

    const [savedVersionButton, deployedVersionButton] = within(legacyRow).getAllByRole('button', { name: '0.9.0' })

    await user.hover(savedVersionButton)

    const savedTooltip = await screen.findByRole('tooltip')
    expect(savedTooltip).toHaveTextContent(' Open saved version preview')
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
    expect(deployedTooltip).toHaveTextContent(' Open deployed version preview')
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
  }, 10000)

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

  it('uses the source alias when editing and previewing deployments that do not expose productSource', async () => {
    const user = userEvent.setup()
    mockDeployments = [
      {
        id: 'dep-source-only',
        teamName: 'data-platform',
        productType: 'Inventory',
        source: 'ERP-Alias',
        environment: 'PROD',
        deploymentStatus: 'running',
        savedVersion: '1.0.0',
        deployedVersion: '1.0.0',
        lastStatusChange: '2026-03-15T10:00:00.000Z',
        createdAt: '2026-03-14T09:00:00.000Z',
      },
    ]

    render(<ETLManagementScreen />)

    await waitFor(() => {
      expect(screen.getByText('ERP-Alias')).toBeInTheDocument()
    })

    await user.click(screen.getAllByRole('button', { name: '1.0.0' })[0])

    await waitFor(() => {
      expect(mockFetchSavedDraftYaml).toHaveBeenCalledWith({
        productType: 'Inventory',
        source: 'ERP-Alias',
        team: 'data-platform',
        environment: 'PROD',
      }, true)
      expect(mockHydrateWizardStateFromYaml).toHaveBeenCalledWith('saved: yaml', {
        productType: 'Inventory',
        source: 'ERP-Alias',
        teamName: 'data-platform',
        environment: 'PROD',
      })
    })

    await user.click(screen.getByRole('button', { name: 'Edit configuration' }))

    await waitFor(() => {
      expect(screen.getByText('Open deployment for editing?')).toBeInTheDocument()
      expect(screen.getByText(/ERP-Alias \/ Inventory/)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(mockFetchDraftConfiguration).toHaveBeenCalledWith({
        productType: 'Inventory',
        source: 'ERP-Alias',
        team: 'data-platform',
        environment: 'PROD',
      }, true)
      expect(mockActions.loadState).toHaveBeenCalledWith(expect.objectContaining({
        navigationMode: 'etl-config',
        originalDraftYaml: 'pipeline: yaml',
      }))
    })
  })

  it('loads the original deployed YAML into wizard state when editing a running deployment', async () => {
    const user = userEvent.setup()
    const loadedState = {
      metadata: { productType: 'Inventory', environment: 'CAP' },
      filters: [
        {
          id: 'group-0',
          rules: [{ op: 'eq', isReverted: false, value: 'active' }],
          subgroups: [],
        },
      ],
      mappings: [
        { src: 'productName', tgt: 'name', transformer: 'Uppercase' },
      ],
    }
    mockHydrateWizardStateFromYaml.mockReturnValueOnce(loadedState)

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
       expect(mockEnsureDefinitionsForWizardState).toHaveBeenCalledWith(loadedState, true, {
         environment: 'CAP',
         forceReloadTransformers: true,
         includeMetadataOptions: true,
       })
       expect(mockActions.loadState).toHaveBeenCalledWith(expect.objectContaining({
         navigationMode: 'etl-config',
         currentStep: 0,
         originalDraftYaml: 'pipeline: yaml',
         completedSteps: [0, 1, 2, 3, 4, 5, 6],
       }))
     })
  })
})


