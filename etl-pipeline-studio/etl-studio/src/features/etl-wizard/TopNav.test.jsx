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
  it('does not render the raw user-role header in the shared header', () => {
    mockUser = { role: 'admin', userRoleHeader: 'admin' }

    render(<TopNav />)

    expect(screen.queryByText(/user-role header:/i)).not.toBeInTheDocument()
  })

  it('shows the UI version in the shared header', () => {
    mockUser = { role: 'admin', userRoleHeader: 'admin' }

    render(<TopNav />)

    expect(screen.getByText(/^v\d+\.\d+\.\d+$/)).toBeInTheDocument()
  })
})

