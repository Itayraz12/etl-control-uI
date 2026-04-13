import { API_BASE } from './appConfig.js'
import { fetchWithUserId } from './requestHeaders.js'

const ADMIN_TEAMS_PATH = `${API_BASE}/backend/admin/teams`
const ADMIN_USERS_PATH = `${API_BASE}/backend/admin/users`

const INITIAL_MOCK_TEAMS = [
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

const INITIAL_MOCK_USERS = [
  {
    id: 'alice',
    userId: 'alice',
    teamName: 'data-platform',
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-03-09T13:10:00.000Z',
  },
  {
    id: 'bob',
    userId: 'bob',
    teamName: 'analytics',
    createdAt: '2026-01-22T16:40:00.000Z',
    updatedAt: '2026-02-28T07:35:00.000Z',
  },
]

let mockTeamsStore = INITIAL_MOCK_TEAMS.map(team => ({ ...team }))
let mockUsersStore = INITIAL_MOCK_USERS.map(user => ({ ...user }))

function asTrimmedString(value, fallback = '') {
  if (value == null) return fallback
  const normalizedValue = String(value).trim()
  return normalizedValue || fallback
}

function normalizeDateValue(value) {
  const normalizedValue = asTrimmedString(value)
  if (!normalizedValue) return ''

  const date = new Date(normalizedValue)
  return Number.isNaN(date.getTime()) ? normalizedValue : date.toISOString()
}

function extractCollectionPayload(payload) {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []

  if (Array.isArray(payload.items)) return payload.items
  if (Array.isArray(payload.data)) return payload.data
  if (Array.isArray(payload.results)) return payload.results
  if (Array.isArray(payload.content)) return payload.content

  return []
}

async function parseResponsePayload(response) {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    return response.json()
  }

  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function ensureOkResponse(response, fallbackMessage) {
  const payload = await parseResponsePayload(response)

  if (!response.ok) {
    const message = typeof payload === 'string'
      ? payload
      : payload?.message || payload?.error || payload?.detail || `${fallbackMessage}: HTTP ${response.status}`

    throw new Error(message)
  }

  return payload
}

function buildTeamId(teamName = '') {
  return `team-${teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'entry'}`
}

export function normalizeAdminTeam(record, index = 0) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null

  const teamName = asTrimmedString(record.teamName ?? record.team ?? record.name)
  if (!teamName) return null

  const id = asTrimmedString(record.id ?? record.teamId ?? record.team_id, buildTeamId(teamName) || `team-${index + 1}`)

  return {
    id,
    teamName,
    devopsName: asTrimmedString(record.devopsName ?? record.devops ?? record.devopsOwner ?? record.devops_name),
    createdAt: normalizeDateValue(record.createdAt ?? record.dateOfCreate ?? record.createdDate ?? record.created_at),
    updatedAt: normalizeDateValue(record.updatedAt ?? record.modifiedAt ?? record.dateOfChange ?? record.updated_at),
  }
}

export function normalizeAdminUser(record, index = 0) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null

  const userId = asTrimmedString(record.userId ?? record.userID ?? record.username ?? record.id)
  if (!userId) return null

  return {
    id: asTrimmedString(record.id ?? record.userId ?? record.userID ?? record.username, `user-${index + 1}`),
    userId,
    teamName: asTrimmedString(record.teamName ?? record.team ?? record.team_name),
    createdAt: normalizeDateValue(record.createdAt ?? record.dateOfCreate ?? record.createdDate ?? record.created_at),
    updatedAt: normalizeDateValue(record.updatedAt ?? record.modifiedAt ?? record.dateOfChange ?? record.updated_at),
  }
}

function normalizeAdminTeams(payload) {
  return extractCollectionPayload(payload)
    .map(normalizeAdminTeam)
    .filter(Boolean)
}

function normalizeAdminUsers(payload) {
  return extractCollectionPayload(payload)
    .map(normalizeAdminUser)
    .filter(Boolean)
}

export function resetAdminServiceMockData() {
  mockTeamsStore = INITIAL_MOCK_TEAMS.map(team => ({ ...team }))
  mockUsersStore = INITIAL_MOCK_USERS.map(user => ({ ...user }))
}

export async function fetchAdminTeams(useMock = true) {
  if (useMock) {
    await new Promise(resolve => setTimeout(resolve, 80))
    return mockTeamsStore.map(team => ({ ...team }))
  }

  const response = await fetchWithUserId(ADMIN_TEAMS_PATH, {
    headers: {
      Accept: 'application/json, text/plain',
    },
  })
  const payload = await ensureOkResponse(response, 'Failed to fetch teams')
  return normalizeAdminTeams(payload)
}

export async function createAdminTeam(team, useMock = true) {
  const payload = {
    teamName: asTrimmedString(team?.teamName),
    devopsName: asTrimmedString(team?.devopsName),
  }

  if (useMock) {
    await new Promise(resolve => setTimeout(resolve, 80))
    const now = new Date().toISOString()
    const createdTeam = normalizeAdminTeam({
      id: buildTeamId(payload.teamName),
      ...payload,
      createdAt: now,
      updatedAt: now,
    })
    mockTeamsStore = [createdTeam, ...mockTeamsStore.filter(existingTeam => existingTeam.id !== createdTeam.id)]
    return createdTeam
  }

  const response = await fetchWithUserId(ADMIN_TEAMS_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain',
    },
    body: JSON.stringify(payload),
  })
  const createdPayload = await ensureOkResponse(response, 'Failed to create team')
  return normalizeAdminTeam(createdPayload) || normalizeAdminTeam(payload)
}

export async function updateAdminTeam(teamId, team, useMock = true) {
  const normalizedTeamId = asTrimmedString(teamId)
  const payload = {
    teamName: asTrimmedString(team?.teamName),
    devopsName: asTrimmedString(team?.devopsName),
  }

  if (useMock) {
    await new Promise(resolve => setTimeout(resolve, 80))
    const now = new Date().toISOString()
    let updatedTeam = null
    mockTeamsStore = mockTeamsStore.map(existingTeam => {
      if (existingTeam.id !== normalizedTeamId) return existingTeam
      updatedTeam = {
        ...existingTeam,
        ...payload,
        id: buildTeamId(payload.teamName || existingTeam.teamName),
        updatedAt: now,
      }
      return updatedTeam
    })
    return updatedTeam || null
  }

  const response = await fetchWithUserId(`${ADMIN_TEAMS_PATH}/${encodeURIComponent(normalizedTeamId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain',
    },
    body: JSON.stringify(payload),
  })
  const updatedPayload = await ensureOkResponse(response, 'Failed to update team')
  return normalizeAdminTeam(updatedPayload) || normalizeAdminTeam({ id: normalizedTeamId, ...payload })
}

export async function deleteAdminTeam(teamId, useMock = true) {
  const normalizedTeamId = asTrimmedString(teamId)

  if (useMock) {
    await new Promise(resolve => setTimeout(resolve, 80))
    mockTeamsStore = mockTeamsStore.filter(team => team.id !== normalizedTeamId)
    mockUsersStore = mockUsersStore.map(user => (
      user.teamName === normalizedTeamId || user.teamName === normalizedTeamId.replace(/^team-/, '')
        ? { ...user, teamName: '' }
        : user
    ))
    return { success: true }
  }

  const response = await fetchWithUserId(`${ADMIN_TEAMS_PATH}/${encodeURIComponent(normalizedTeamId)}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json, text/plain',
    },
  })
  await ensureOkResponse(response, 'Failed to delete team')
  return { success: true }
}

export async function fetchAdminUsers(useMock = true) {
  if (useMock) {
    await new Promise(resolve => setTimeout(resolve, 80))
    return mockUsersStore.map(user => ({ ...user }))
  }

  const response = await fetchWithUserId(ADMIN_USERS_PATH, {
    headers: {
      Accept: 'application/json, text/plain',
    },
  })
  const payload = await ensureOkResponse(response, 'Failed to fetch users')
  return normalizeAdminUsers(payload)
}

export async function createAdminUser(user, useMock = true) {
  const payload = {
    userId: asTrimmedString(user?.userId),
    teamName: asTrimmedString(user?.teamName),
  }

  if (useMock) {
    await new Promise(resolve => setTimeout(resolve, 80))
    const now = new Date().toISOString()
    const createdUser = normalizeAdminUser({
      id: payload.userId,
      ...payload,
      createdAt: now,
      updatedAt: now,
    })
    mockUsersStore = [createdUser, ...mockUsersStore.filter(existingUser => existingUser.id !== createdUser.id)]
    return createdUser
  }

  const response = await fetchWithUserId(ADMIN_USERS_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain',
    },
    body: JSON.stringify(payload),
  })
  const createdPayload = await ensureOkResponse(response, 'Failed to create user')
  return normalizeAdminUser(createdPayload) || normalizeAdminUser(payload)
}

export async function updateAdminUser(userId, user, useMock = true) {
  const normalizedUserId = asTrimmedString(userId)
  const payload = {
    userId: asTrimmedString(user?.userId),
    teamName: asTrimmedString(user?.teamName),
  }

  if (useMock) {
    await new Promise(resolve => setTimeout(resolve, 80))
    const now = new Date().toISOString()
    let updatedUser = null
    mockUsersStore = mockUsersStore.map(existingUser => {
      if (existingUser.id !== normalizedUserId) return existingUser
      updatedUser = {
        ...existingUser,
        ...payload,
        id: payload.userId || existingUser.userId,
        updatedAt: now,
      }
      return updatedUser
    })
    return updatedUser || null
  }

  const response = await fetchWithUserId(`${ADMIN_USERS_PATH}/${encodeURIComponent(normalizedUserId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain',
    },
    body: JSON.stringify(payload),
  })
  const updatedPayload = await ensureOkResponse(response, 'Failed to update user')
  return normalizeAdminUser(updatedPayload) || normalizeAdminUser({ id: normalizedUserId, ...payload })
}

export async function deleteAdminUser(userId, useMock = true) {
  const normalizedUserId = asTrimmedString(userId)

  if (useMock) {
    await new Promise(resolve => setTimeout(resolve, 80))
    mockUsersStore = mockUsersStore.filter(user => user.id !== normalizedUserId)
    return { success: true }
  }

  const response = await fetchWithUserId(`${ADMIN_USERS_PATH}/${encodeURIComponent(normalizedUserId)}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json, text/plain',
    },
  })
  await ensureOkResponse(response, 'Failed to delete user')
  return { success: true }
}

