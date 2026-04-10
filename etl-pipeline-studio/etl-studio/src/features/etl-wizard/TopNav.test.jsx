import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TopNav from './TopNav.jsx'

const mockActions = {
  setNavigationMode: vi.fn(),
  toggleTheme: vi.fn(),
}

const logout = vi.fn()
let mockUser = { role: 'admin', userRoleHeader: 'admin' }

vi.mock('../../shared/store/wizardStore.jsx', () => ({
  useWizard: () => ({
    state: { theme: 'dark' },
    actions: mockActions,
  }),
}))

vi.mock('../../shared/store/userContext.jsx', () => ({
  useUser: () => ({ user: mockUser, logout }),
}))

describe('TopNav', () => {
  it('prints the raw user-role header value in the shared header for debug', () => {
    mockUser = { role: 'admin', userRoleHeader: 'admin' }

    render(<TopNav />)

    expect(screen.getByText('user-role header: admin')).toBeInTheDocument()
  })

  it('shows an explicit missing placeholder when the raw user-role header is unavailable', () => {
    mockUser = { role: 'regular', userRoleHeader: '' }

    render(<TopNav />)

    expect(screen.getByText('user-role header: (missing)')).toBeInTheDocument()
  })

  it('shows the UI version in the shared header', () => {
    mockUser = { role: 'admin', userRoleHeader: 'admin' }

    render(<TopNav />)

    expect(screen.getByText(/^v\d+\.\d+\.\d+$/)).toBeInTheDocument()
  })
})

