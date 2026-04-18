import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UDFManagementTable from './UDFManagementTable.jsx'

let mockUdfs = []

const mockFetchAdminUDFs = vi.fn()
const mockUpdateAdminUDF = vi.fn()
const mockDeleteAdminUDF = vi.fn()

vi.mock('../../shared/store/mockModeContext.jsx', () => ({
  useMockMode: () => ({ useMock: true, setUseMock: vi.fn() }),
}))

vi.mock('../../shared/services/adminService.js', () => ({
  fetchAdminUDFs: (...args) => mockFetchAdminUDFs(...args),
  updateAdminUDF: (...args) => mockUpdateAdminUDF(...args),
  deleteAdminUDF: (...args) => mockDeleteAdminUDF(...args),
}))

describe('UDFManagementTable', () => {
  beforeEach(() => {
    mockUdfs = [
      {
        id: 'udf-1',
        name: 'data_cleaner',
        type: 'transformer',
        description: 'Cleans and normalizes data fields',
        isActive: true,
        isApproved: true,
        version: '1.2.0',
        filePath: '/path/to/udf/file',
        team: 'data_team',
        dateApproved: '2026-04-10T10:30:00.000Z',
        createdAt: '2026-03-18T10:30:00.000Z',
        updatedAt: '2026-04-12T10:30:00.000Z',
      },
      {
        id: 'udf-2',
        name: 'duplicate_filter',
        type: 'filter',
        description: 'Filters out duplicate records based on key fields',
        isActive: true,
        isApproved: false,
        version: '2.1.3',
        filePath: '/path/to/udf/filter',
        team: 'data_team',
        dateApproved: null,
        createdAt: '2026-03-22T10:30:00.000Z',
        updatedAt: '2026-04-11T10:30:00.000Z',
      },
      {
        id: 'udf-3',
        name: 'email_normalizer',
        type: 'transformer',
        description: 'Normalizes email addresses to lowercase',
        isActive: false,
        isApproved: true,
        version: '1.0.5',
        filePath: '/path/to/udf/email',
        team: 'growth_team',
        dateApproved: '2026-04-08T12:05:00.000Z',
        createdAt: '2026-03-20T10:30:00.000Z',
        updatedAt: '2026-04-10T10:30:00.000Z',
      },
    ]

    mockFetchAdminUDFs.mockReset()
    mockFetchAdminUDFs.mockImplementation(async () => structuredClone(mockUdfs))

    mockUpdateAdminUDF.mockReset()
    mockUpdateAdminUDF.mockImplementation(async (udfId, payload) => {
      mockUdfs = mockUdfs.map(udf => udf.id === udfId
        ? {
            ...udf,
            isApproved: payload.isApproved,
            dateApproved: payload.isApproved ? '2026-04-18T12:00:00.000Z' : null,
            updatedAt: '2026-04-18T12:00:00.000Z',
          }
        : udf)
      return mockUdfs.find(udf => udf.id === udfId)
    })

    mockDeleteAdminUDF.mockReset()
    mockDeleteAdminUDF.mockImplementation(async (udfId) => {
      mockUdfs = mockUdfs.filter(udf => udf.id !== udfId)
      return { success: true }
    })
  })

  it('renders UDF records and allows approval updates from the icon toggle', async () => {
    const user = userEvent.setup()
    render(<UDFManagementTable />)

    await waitFor(() => {
      expect(screen.getByText('data_cleaner')).toBeInTheDocument()
      expect(screen.getByText('duplicate_filter')).toBeInTheDocument()
      expect(screen.getByText('email_normalizer')).toBeInTheDocument()
      expect(screen.getByText('/path/to/udf/file')).toBeInTheDocument()
      expect(screen.getByTestId('udf-management-tabs')).toBeInTheDocument()
      expect(screen.getByTestId('udf-management-message-slot')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('udf-management-notice')).not.toBeInTheDocument()
    expect(screen.queryByTestId('udf-management-error')).not.toBeInTheDocument()

    await user.hover(screen.getByTestId('udf-description-udf-1'))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Cleans and normalizes data fields')
    await user.unhover(screen.getByTestId('udf-description-udf-1'))

    expect(mockFetchAdminUDFs).toHaveBeenCalledTimes(1)

    const duplicateRow = screen.getByText('duplicate_filter').closest('tr')
    await user.click(within(duplicateRow).getByRole('button', { name: /approve duplicate_filter/i }))

    expect(screen.getByRole('dialog')).toHaveTextContent('Are you sure you want to approve "duplicate_filter"?')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^approve$/i }))

    await waitFor(() => {
      expect(mockUpdateAdminUDF).toHaveBeenCalledWith('udf-2', { isApproved: true }, true)
      expect(mockFetchAdminUDFs).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('udf-management-notice')).toHaveTextContent('was approved')
      expect(within(screen.getByTestId('udf-management-message-slot')).getByTestId('udf-management-notice')).toHaveTextContent('was approved')
      const refreshedRow = screen.getByText('duplicate_filter').closest('tr')
      expect(within(refreshedRow).getByRole('button', { name: /unapprove duplicate_filter/i })).toBeInTheDocument()
    })
  })

  it('opens an informational modal when the active status icon is clicked', async () => {
    const user = userEvent.setup()
    render(<UDFManagementTable />)

    await waitFor(() => {
      expect(screen.getByText('data_cleaner')).toBeInTheDocument()
    })

    const activeButton = screen.getByTestId('udf-active-indicator-udf-1')
    await user.click(activeButton)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('UDF is active')
    expect(dialog).toHaveTextContent('Active status is managed outside this admin screen and cannot be changed here.')
    expect(within(dialog).queryByRole('button', { name: /^confirm$/i })).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /^close$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('filters UDF rows by tab and toolbar controls, and supports column resizing', async () => {
    const user = userEvent.setup()
    render(<UDFManagementTable />)

    await waitFor(() => {
      expect(screen.getByText('data_cleaner')).toBeInTheDocument()
      expect(screen.getByText('duplicate_filter')).toBeInTheDocument()
      expect(screen.getByText('email_normalizer')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /filter\s*1/i }))

    expect(screen.getByText('duplicate_filter')).toBeInTheDocument()
    expect(screen.queryByText('data_cleaner')).not.toBeInTheDocument()
    expect(screen.queryByText('email_normalizer')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /all\s*3/i }))
    await user.type(screen.getByTestId('udf-management-filter-input'), 'email')

    expect(screen.getByText('email_normalizer')).toBeInTheDocument()
    expect(screen.queryByText('data_cleaner')).not.toBeInTheDocument()

    await user.clear(screen.getByTestId('udf-management-filter-input'))
    await user.selectOptions(screen.getByTestId('udf-management-active-filter'), 'inactive')

    expect(screen.getByText('email_normalizer')).toBeInTheDocument()
    expect(screen.queryByText('data_cleaner')).not.toBeInTheDocument()
    expect(screen.queryByText('duplicate_filter')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /clear filters/i }))

    await waitFor(() => {
      expect(screen.getByText('data_cleaner')).toBeInTheDocument()
      expect(screen.getByText('duplicate_filter')).toBeInTheDocument()
      expect(screen.getByText('email_normalizer')).toBeInTheDocument()
    })

    const nameColumn = screen.getByTestId('udf-column-name-col')
    expect(nameColumn).toHaveStyle({ width: '200px' })

    fireEvent.mouseDown(screen.getByTestId('udf-column-resizer-name'), { clientX: 200 })
    fireEvent.mouseMove(document, { clientX: 260 })
    fireEvent.mouseUp(document)

    await waitFor(() => {
      expect(screen.getByTestId('udf-column-name-col')).toHaveStyle({ width: '260px' })
    })

    expect(screen.getByTestId('udf-description-udf-1')).toHaveStyle({ maxWidth: '236px' })

    fireEvent.mouseDown(screen.getByTestId('udf-column-resizer-description'), { clientX: 260 })
    fireEvent.mouseMove(document, { clientX: 340 })
    fireEvent.mouseUp(document)

    await waitFor(() => {
      expect(screen.getByTestId('udf-column-description-col')).toHaveStyle({ width: '340px' })
      expect(screen.getByTestId('udf-description-udf-1')).toHaveStyle({ maxWidth: '316px' })
    })
  })

  it('auto-fits a column to the widest visible content when the header is double-clicked', async () => {
    render(<UDFManagementTable />)

    await waitFor(() => {
      expect(screen.getByText('data_cleaner')).toBeInTheDocument()
    })

    const headerContent = document.querySelector('[data-udf-column-header-content="description"]')
    const descriptionContentNodes = Array.from(document.querySelectorAll('[data-udf-column-content="description"]'))

    expect(headerContent).not.toBeNull()
    expect(descriptionContentNodes.length).toBeGreaterThan(0)

    Object.defineProperty(headerContent, 'scrollWidth', {
      configurable: true,
      get: () => 90,
    })

    descriptionContentNodes.forEach((node, index) => {
      Object.defineProperty(node, 'scrollWidth', {
        configurable: true,
        get: () => (index === 1 ? 420 : 240),
      })
    })

    fireEvent.doubleClick(screen.getByText('Description'))

    await waitFor(() => {
      expect(screen.getByTestId('udf-column-description-col')).toHaveStyle({ width: '444px' })
      expect(screen.getByTestId('udf-description-udf-2')).toHaveStyle({ maxWidth: '420px' })
    })
  })

  it('deletes a UDF after confirmation', async () => {
    const user = userEvent.setup()
    render(<UDFManagementTable />)

    await waitFor(() => {
      expect(screen.getByText('data_cleaner')).toBeInTheDocument()
    })

    const targetRow = screen.getByText('data_cleaner').closest('tr')
    await user.click(within(targetRow).getByRole('button', { name: /delete data_cleaner/i }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(mockDeleteAdminUDF).toHaveBeenCalledWith('udf-1', true)
      expect(screen.queryByText('data_cleaner')).not.toBeInTheDocument()
      expect(screen.getByTestId('udf-management-notice')).toHaveTextContent('was deleted')
      expect(within(screen.getByTestId('udf-management-message-slot')).getByTestId('udf-management-notice')).toHaveTextContent('was deleted')
    })
  })
})


