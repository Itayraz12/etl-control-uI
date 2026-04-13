import { beforeEach, describe, expect, it } from 'vitest'
import {
  createAdminTeam,
  createAdminUser,
  deleteAdminTeam,
  deleteAdminUser,
  fetchAdminTeams,
  fetchAdminUsers,
  normalizeAdminTeam,
  normalizeAdminUser,
  resetAdminServiceMockData,
  updateAdminTeam,
  updateAdminUser,
} from './adminService.js'

describe('adminService', () => {
  beforeEach(() => {
    resetAdminServiceMockData()
  })

  it('normalizes team payload aliases from backend responses', () => {
    expect(normalizeAdminTeam({
      team: 'platform',
      devops: 'platform-devops',
      dateOfCreate: '2026-01-01T00:00:00Z',
      dateOfChange: '2026-01-02T00:00:00Z',
    })).toMatchObject({
      teamName: 'platform',
      devopsName: 'platform-devops',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
  })

  it('normalizes user payload aliases from backend responses', () => {
    expect(normalizeAdminUser({
      username: 'alice',
      team: 'platform',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    })).toMatchObject({
      userId: 'alice',
      teamName: 'platform',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
  })

  it('supports full mock CRUD for teams', async () => {
    const initialTeams = await fetchAdminTeams(true)
    expect(initialTeams).toHaveLength(2)

    await createAdminTeam({ teamName: 'ml-ops', devopsName: 'ml-devops' }, true)
    let teams = await fetchAdminTeams(true)
    expect(teams.map(team => team.teamName)).toContain('ml-ops')

    const createdTeam = teams.find(team => team.teamName === 'ml-ops')
    await updateAdminTeam(createdTeam.id, { teamName: 'ml-platform', devopsName: 'ml-sre' }, true)
    teams = await fetchAdminTeams(true)
    expect(teams.find(team => team.teamName === 'ml-platform')).toMatchObject({ devopsName: 'ml-sre' })

    const updatedTeam = teams.find(team => team.teamName === 'ml-platform')
    await deleteAdminTeam(updatedTeam.id, true)
    teams = await fetchAdminTeams(true)
    expect(teams.map(team => team.teamName)).not.toContain('ml-platform')
  })

  it('supports full mock CRUD for users', async () => {
    const initialUsers = await fetchAdminUsers(true)
    expect(initialUsers).toHaveLength(2)

    await createAdminUser({ userId: 'charlie', teamName: 'analytics' }, true)
    let users = await fetchAdminUsers(true)
    expect(users.map(user => user.userId)).toContain('charlie')

    await updateAdminUser('charlie', { userId: 'charlie', teamName: 'data-platform' }, true)
    users = await fetchAdminUsers(true)
    expect(users.find(user => user.userId === 'charlie')).toMatchObject({ teamName: 'data-platform' })

    await deleteAdminUser('charlie', true)
    users = await fetchAdminUsers(true)
    expect(users.map(user => user.userId)).not.toContain('charlie')
  })
})

