import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AdminWorkspace from './AdminWorkspace.jsx'

const mockSetNavigationMode = vi.fn()
let mockNavigationMode = 'etl-management'
let mockUser = { role: 'admin' }

vi.mock('../../shared/store/wizardStore.jsx', () => ({
  useWizard: () => ({
    state: { navigationMode: mockNavigationMode },
    actions: {
      setNavigationMode: mockSetNavigationMode,
    },
  }),
}))

vi.mock('../../shared/store/userContext.jsx', () => ({
  useUser: () => ({ user: mockUser }),
}))

vi.mock('../etl-wizard/ETLManagementScreen.jsx', () => ({
  default: () => <div data-testid="management-screen-stub">Management Screen</div>,
}))

vi.mock('./AdminScreen.jsx', () => ({
  default: () => <div data-testid="admin-screen-stub">Admin Screen</div>,
}))

vi.mock('./UDFScreen.jsx', () => ({
  default: () => <div data-testid="udf-screen-stub">UDF Screen</div>,
}))

vi.mock('./KafkaSimulatorScreen.jsx', () => ({
  default: function KafkaSimulatorScreenMock({ isActive = false }) {
    const [draftValue, setDraftValue] = useState('')

    return (
      <div
        data-testid="simulator-screen-stub"
        data-active={isActive ? 'true' : 'false'}
      >
        <input
          aria-label="Simulator Draft"
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
        />
      </div>
    )
  },
}))

describe('AdminWorkspace', () => {
  it('shows the admin side menu and navigates to the admin page for admin users', async () => {
    const user = userEvent.setup()
    mockNavigationMode = 'etl-management'
    mockUser = { role: 'admin' }
    mockSetNavigationMode.mockReset()

    render(<AdminWorkspace />)

    expect(screen.getByTestId('admin-side-menu')).toBeInTheDocument()
    expect(screen.getByTestId('management-screen-stub')).toBeInTheDocument()

    await user.click(screen.getByTestId('admin-side-menu-item-etl-admin'))

    expect(mockSetNavigationMode).toHaveBeenCalledWith('etl-admin')
  })

  it('shows the UDF management navigation item and routes to the UDF screen for admin users', async () => {
    const user = userEvent.setup()
    mockNavigationMode = 'etl-management'
    mockUser = { role: 'admin' }
    mockSetNavigationMode.mockReset()

    render(<AdminWorkspace />)

    await user.click(screen.getByTestId('admin-side-menu-item-udf-admin'))

    expect(mockSetNavigationMode).toHaveBeenCalledWith('udf-admin')
  })

  it('allows the admin side menu to be minimized and expanded', async () => {
    const user = userEvent.setup()
    mockNavigationMode = 'etl-management'
    mockUser = { role: 'admin' }
    mockSetNavigationMode.mockReset()

    render(<AdminWorkspace />)

    const sideMenu = screen.getByTestId('admin-side-menu')
    const toggle = screen.getByTestId('admin-side-menu-toggle')

    expect(sideMenu).toHaveAttribute('data-collapsed', 'false')
    expect(screen.getByText('Admin Navigation')).toBeInTheDocument()

    await user.click(toggle)

    expect(sideMenu).toHaveAttribute('data-collapsed', 'true')
    expect(screen.queryByText('Admin Navigation')).not.toBeInTheDocument()
    expect(screen.getByTestId('admin-side-menu-item-etl-admin')).toHaveAttribute('aria-label', 'Admin Page')

    await user.click(toggle)

    expect(sideMenu).toHaveAttribute('data-collapsed', 'false')
    expect(screen.getByText('Admin Navigation')).toBeInTheDocument()
  })

  it('renders the admin screen when the admin navigation mode is active', () => {
    mockNavigationMode = 'etl-admin'
    mockUser = { role: 'admin' }
    mockSetNavigationMode.mockReset()

    render(<AdminWorkspace />)

    expect(screen.getByTestId('admin-screen-stub')).toBeInTheDocument()
    expect(screen.queryByTestId('management-screen-stub')).not.toBeInTheDocument()
  })

  it('renders the UDF screen when the UDF navigation mode is active', () => {
    mockNavigationMode = 'udf-admin'
    mockUser = { role: 'admin' }
    mockSetNavigationMode.mockReset()

    render(<AdminWorkspace />)

    expect(screen.getByTestId('udf-screen-stub')).toBeInTheDocument()
    expect(screen.queryByTestId('management-screen-stub')).not.toBeInTheDocument()
  })

  it('preserves simulator state when switching away to another admin tab and back', async () => {
    const user = userEvent.setup()
    mockNavigationMode = 'simulator'
    mockUser = { role: 'admin' }
    mockSetNavigationMode.mockReset()

    const { rerender } = render(<AdminWorkspace />)

    const simulatorInput = screen.getByLabelText('Simulator Draft')
    await user.type(simulatorInput, 'task in progress')

    expect(screen.getByTestId('simulator-screen-stub')).toHaveAttribute('data-active', 'true')
    expect(simulatorInput).toHaveValue('task in progress')

    mockNavigationMode = 'etl-admin'
    rerender(<AdminWorkspace />)

    expect(screen.getByTestId('admin-screen-stub')).toBeInTheDocument()
    expect(screen.getByTestId('simulator-screen-stub')).toHaveAttribute('data-active', 'false')
    expect(screen.getByLabelText('Simulator Draft')).toHaveValue('task in progress')

    mockNavigationMode = 'simulator'
    rerender(<AdminWorkspace />)

    expect(screen.getByTestId('simulator-screen-stub')).toHaveAttribute('data-active', 'true')
    expect(screen.getByLabelText('Simulator Draft')).toHaveValue('task in progress')
  })

  it('does not show the side menu to regular users', () => {
    mockNavigationMode = 'etl-management'
    mockUser = { role: 'regular' }
    mockSetNavigationMode.mockReset()

    render(<AdminWorkspace />)

    expect(screen.queryByTestId('admin-side-menu')).not.toBeInTheDocument()
    expect(screen.getByTestId('management-screen-stub')).toBeInTheDocument()
  })
})

