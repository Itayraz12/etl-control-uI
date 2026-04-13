import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminScreen from './AdminScreen.jsx'

let mockTeams = []
let mockUsers = []

const mockFetchAdminTeams = vi.fn()
const mockCreateAdminTeam = vi.fn()
const mockUpdateAdminTeam = vi.fn()
const mockDeleteAdminTeam = vi.fn()
const mockFetchAdminUsers = vi.fn()
const mockCreateAdminUser = vi.fn()
const mockUpdateAdminUser = vi.fn()
const mockDeleteAdminUser = vi.fn()

vi.mock('../../shared/store/mockModeContext.jsx', () => ({
  useMockMode: () => ({ useMock: true, setUseMock: vi.fn() }),
}))

vi.mock('../../shared/services/adminService.js', () => ({
  fetchAdminTeams: (...args) => mockFetchAdminTeams(...args),
  createAdminTeam: (...args) => mockCreateAdminTeam(...args),
  updateAdminTeam: (...args) => mockUpdateAdminTeam(...args),
  deleteAdminTeam: (...args) => mockDeleteAdminTeam(...args),
  fetchAdminUsers: (...args) => mockFetchAdminUsers(...args),
  createAdminUser: (...args) => mockCreateAdminUser(...args),
  updateAdminUser: (...args) => mockUpdateAdminUser(...args),
  deleteAdminUser: (...args) => mockDeleteAdminUser(...args),
}))

describe('AdminScreen', () => {
  beforeEach(() => {
    mockTeams = [
      {
        id: 'team-data-platform',
        teamName: 'data-platform',
        devopsName: 'platform-devops',
        createdAt: '2026-01-10T09:00:00.000Z',
        updatedAt: '2026-03-08T14:20:00.000Z',
      },
      {
        id: 'team-analytics',
        teamName: 'analytics',
        devopsName: 'analytics-devops',
        createdAt: '2026-01-12T11:30:00.000Z',
        updatedAt: '2026-03-02T08:45:00.000Z',
      },
    ]
    mockUsers = [
      {
        id: 'alice',
        userId: 'alice',
        teamName: 'data-platform',
        createdAt: '2026-01-15T10:00:00.000Z',
        updatedAt: '2026-03-09T13:10:00.000Z',
      },
    ]

    mockFetchAdminTeams.mockReset()
    mockFetchAdminTeams.mockImplementation(async () => structuredClone(mockTeams))
    mockCreateAdminTeam.mockReset()
    mockCreateAdminTeam.mockImplementation(async (_payload, _useMock) => {
      const createdTeam = {
        id: 'team-data-quality',
        teamName: 'data-quality',
        devopsName: 'quality-devops',
        createdAt: '2026-04-13T08:00:00.000Z',
        updatedAt: '2026-04-13T08:00:00.000Z',
      }
      mockTeams = [createdTeam, ...mockTeams]
      return createdTeam
    })
    mockUpdateAdminTeam.mockReset()
    mockUpdateAdminTeam.mockImplementation(async (teamId, payload) => {
      mockTeams = mockTeams.map(team => team.id === teamId ? { ...team, ...payload } : team)
      return mockTeams.find(team => team.id === teamId) || null
    })
    mockDeleteAdminTeam.mockReset()
    mockDeleteAdminTeam.mockImplementation(async (teamId) => {
      mockTeams = mockTeams.filter(team => team.id !== teamId)
      return { success: true }
    })

    mockFetchAdminUsers.mockReset()
    mockFetchAdminUsers.mockImplementation(async () => structuredClone(mockUsers))
    mockCreateAdminUser.mockReset()
    mockCreateAdminUser.mockImplementation(async (payload) => {
      const createdUser = {
        id: payload.userId,
        userId: payload.userId,
        teamName: payload.teamName,
        createdAt: '2026-04-13T08:00:00.000Z',
        updatedAt: '2026-04-13T08:00:00.000Z',
      }
      mockUsers = [createdUser, ...mockUsers]
      return createdUser
    })
    mockUpdateAdminUser.mockReset()
    mockUpdateAdminUser.mockImplementation(async (userId, payload) => {
      mockUsers = mockUsers.map(user => user.id === userId ? { ...user, ...payload, id: payload.userId } : user)
      return mockUsers.find(user => user.id === payload.userId || user.id === userId) || null
    })
    mockDeleteAdminUser.mockReset()
    mockDeleteAdminUser.mockImplementation(async (userId) => {
      mockUsers = mockUsers.filter(user => user.id !== userId)
      return { success: true }
    })
  })

  it('creates and deletes team entries from the admin page team management table', async () => {
    const user = userEvent.setup()
    render(<AdminScreen />)

    await user.click(screen.getByTestId('admin-tab-teams'))

    await waitFor(() => {
      expect(screen.getByText('data-platform')).toBeInTheDocument()
      expect(screen.getByText('analytics')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /add team/i }))
    await user.type(screen.getByTestId('team-management-team-name-input'), 'data-quality')
    await user.type(screen.getByTestId('team-management-devops-name-input'), 'quality-devops')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(mockCreateAdminTeam).toHaveBeenCalledWith({ teamName: 'data-quality', devopsName: 'quality-devops' }, true)
      expect(screen.getByText('data-quality')).toBeInTheDocument()
    })

    const createdRow = screen.getByText('data-quality').closest('tr')
    await user.click(within(createdRow).getByRole('button', { name: /delete/i }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(mockDeleteAdminTeam).toHaveBeenCalledWith('team-data-quality', true)
      expect(screen.queryByText('data-quality')).not.toBeInTheDocument()
    })
  }, 10000)

  it('updates user team assignments from the admin page user management table', async () => {
    const user = userEvent.setup()
    render(<AdminScreen />)

    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument()
    })

    const aliceRow = screen.getByText('alice').closest('tr')
    await user.click(within(aliceRow).getByRole('button', { name: /edit/i }))
    await user.selectOptions(screen.getByTestId('user-management-team-name-input'), 'analytics')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(mockUpdateAdminUser).toHaveBeenCalledWith('alice', { userId: 'alice', teamName: 'analytics' }, true)
      expect(screen.getByText('analytics')).toBeInTheDocument()
    })
  }, 10000)
})



