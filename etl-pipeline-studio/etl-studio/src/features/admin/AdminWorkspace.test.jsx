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

  it('renders the admin screen when the admin navigation mode is active', () => {
    mockNavigationMode = 'etl-admin'
    mockUser = { role: 'admin' }
    mockSetNavigationMode.mockReset()

    render(<AdminWorkspace />)

    expect(screen.getByTestId('admin-screen-stub')).toBeInTheDocument()
    expect(screen.queryByTestId('management-screen-stub')).not.toBeInTheDocument()
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

