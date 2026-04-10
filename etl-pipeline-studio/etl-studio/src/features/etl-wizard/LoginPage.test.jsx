import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from './LoginPage.jsx'

const login = vi.fn()
const setUseMock = vi.fn()
const loginUser = vi.fn()
let mockUseMock = false

vi.mock('../../shared/store/userContext.jsx', () => ({
  useUser: () => ({ login }),
}))

vi.mock('../../shared/store/mockModeContext.jsx', () => ({
  useMockMode: () => ({ useMock: mockUseMock, setUseMock }),
}))

vi.mock('../../shared/services/authService.js', () => ({
  MOCK_TEAM_NAMES: ['Team A', 'Team B', 'Team C', 'Yarden'],
  USER_ROLES: { ADMIN: 'admin', REGULAR: 'regular' },
  loginUser: (...args) => loginUser(...args),
}))

function renderLogin() {
  return render(<LoginPage />)
}

describe('LoginPage authentication flow', () => {
  beforeEach(() => {
    login.mockReset()
    setUseMock.mockReset()
    loginUser.mockReset()
    mockUseMock = false
  })

  it('logs in through the backend in live mode and uses the team and role from the response', async () => {
    const user = userEvent.setup()
    loginUser.mockResolvedValue({ userId: 'alice', teamName: 'Team B', role: 'admin', userRoleHeader: 'admin' })

    renderLogin()

    expect(screen.queryByLabelText('Team Name')).not.toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('User ID'), 'alice')
    await user.type(screen.getByPlaceholderText('Password'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(loginUser).toHaveBeenCalledWith({ username: 'alice', password: 'secret' })
      expect(login).toHaveBeenCalledWith({ userId: 'alice', teamName: 'Team B', role: 'admin', userRoleHeader: 'admin' })
    })
  })

  it('shows the mock-only team dropdown and logs in locally with the selected team', async () => {
    const user = userEvent.setup()
    mockUseMock = true

    renderLogin()

    const teamSelect = screen.getByLabelText('Team Name')
    expect(screen.getByRole('option', { name: 'Team A' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Team B' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Team C' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Yarden' })).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('User ID'), 'mock-user')
    await user.type(screen.getByPlaceholderText('Password'), 'secret')
    await user.selectOptions(teamSelect, 'Yarden')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(loginUser).not.toHaveBeenCalled()
    expect(login).toHaveBeenCalledWith({ userId: 'mock-user', teamName: 'Yarden', role: 'regular' })
  })

  it('shows the backend error when live login fails', async () => {
    const user = userEvent.setup()
    loginUser.mockRejectedValue(new Error('Invalid credentials'))

    renderLogin()

    await user.type(screen.getByPlaceholderText('User ID'), 'alice')
    await user.type(screen.getByPlaceholderText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })
})

