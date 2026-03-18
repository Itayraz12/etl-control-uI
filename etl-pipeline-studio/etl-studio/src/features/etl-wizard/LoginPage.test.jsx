import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from './LoginPage.jsx'
import { TeamNamesProvider } from '../../shared/store/teamNamesContext.jsx'

const login = vi.fn()
const setUseMock = vi.fn()
const fetchTeamNames = vi.fn()

vi.mock('../../shared/store/userContext.jsx', () => ({
  useUser: () => ({ login }),
}))

vi.mock('../../shared/store/mockModeContext.jsx', () => ({
  useMockMode: () => ({ useMock: false, setUseMock }),
}))

vi.mock('../../shared/services/teamNamesService.js', () => ({
  fetchTeamNames: (...args) => fetchTeamNames(...args),
}))

function renderLogin() {
  return render(
    <TeamNamesProvider>
      <LoginPage />
    </TeamNamesProvider>
  )
}

describe('LoginPage team dropdown', () => {
  beforeEach(() => {
    login.mockReset()
    setUseMock.mockReset()
    fetchTeamNames.mockReset()
  })

  it('loads team names on startup and logs in with the selected team', async () => {
    const user = userEvent.setup()
    fetchTeamNames.mockResolvedValue(['data-platform', 'analytics'])

    renderLogin()

    await waitFor(() => {
      expect(fetchTeamNames).toHaveBeenCalledTimes(1)
    })

    await user.type(screen.getByPlaceholderText('User ID'), 'alice')
    await user.type(screen.getByPlaceholderText('Password'), 'secret')
    await user.selectOptions(screen.getByLabelText('Team Name'), 'analytics')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(login).toHaveBeenCalledWith({ userId: 'alice', teamName: 'analytics' })
  })

  it('shows a retry action when loading team names fails and recovers on retry', async () => {
    const user = userEvent.setup()
    fetchTeamNames
      .mockRejectedValueOnce(new Error('Failed to load teams'))
      .mockResolvedValueOnce(['platform'])

    renderLogin()

    await waitFor(() => {
      expect(screen.getByText('Failed to load teams')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Retry loading teams' }))

    await waitFor(() => {
      expect(fetchTeamNames).toHaveBeenCalledTimes(2)
      expect(screen.getByRole('option', { name: 'platform' })).toBeInTheDocument()
    })
  })
})

