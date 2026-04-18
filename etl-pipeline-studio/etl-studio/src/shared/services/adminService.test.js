import { beforeEach, describe, expect, it } from 'vitest'
import {
  createAdminTeam,
  createAdminUser,
  deleteAdminUDF,
  deleteAdminTeam,
  deleteAdminUser,
  fetchAdminUDFs,
  fetchAdminTeams,
  fetchAdminUsers,
  normalizeAdminTeam,
  normalizeAdminUDF,
  normalizeAdminUser,
  resetAdminServiceMockData,
  updateAdminUDF,
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

  it('normalizes UDF payload aliases from backend responses', () => {
    expect(normalizeAdminUDF({
      udfId: 'udf-9',
      udfName: 'normalize_email',
      udfType: 'transformer',
      details: 'Normalizes email addresses',
      approved: 'true',
      active: 'true',
      file_path: '/udfs/normalize_email.py',
      team_name: 'data-platform',
      date_approved: '2026-04-10T12:30:00Z',
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-12T00:00:00Z',
    })).toMatchObject({
      id: 'udf-9',
      name: 'normalize_email',
      type: 'transformer',
      description: 'Normalizes email addresses',
      isApproved: true,
      isActive: true,
      filePath: '/udfs/normalize_email.py',
      team: 'data-platform',
      dateApproved: '2026-04-10T12:30:00.000Z',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-12T00:00:00.000Z',
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

  it('supports mock read, approval updates, and deletion for UDFs', async () => {
    const initialUdfs = await fetchAdminUDFs(true)
    expect(initialUdfs).toHaveLength(3)

    const targetUdf = initialUdfs.find(udf => udf.id === 'udf-1')
    expect(targetUdf).toMatchObject({
      name: 'data_cleaner',
      isApproved: true,
      dateApproved: '2026-04-10T10:30:00.000Z',
    })

    const unapproved = await updateAdminUDF('udf-1', { isApproved: false }, true)
    expect(unapproved).toMatchObject({
      id: 'udf-1',
      isApproved: false,
      dateApproved: null,
    })

    const reapproved = await updateAdminUDF('udf-1', { isApproved: true }, true)
    expect(reapproved.id).toBe('udf-1')
    expect(reapproved.isApproved).toBe(true)
    expect(reapproved.dateApproved).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    await expect(updateAdminUDF('udf-1', { isApproved: 'yes' }, true)).rejects.toThrow(/boolean/i)

    await deleteAdminUDF('udf-3', true)
    const remainingUdfs = await fetchAdminUDFs(true)
    expect(remainingUdfs.map(udf => udf.id)).not.toContain('udf-3')
  })
})

