import { API_BASE } from './appConfig.js'
import { fetchWithUserId } from './requestHeaders.js'

const ADMIN_TEAMS_PATH = `${API_BASE}/backend/admin/teams`
const ADMIN_USERS_PATH = `${API_BASE}/backend/admin/users`
const ADMIN_UDFS_PATH  = `${API_BASE}/backend/admin/udfs`
const ADMIN_SYSTEM_ADMINS_PATH = `${API_BASE}/backend/admin/admin-users`

const VALID_UDF_TYPES = new Set(['transformer', 'filter'])
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/

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

const INITIAL_MOCK_UDFS = [
  {
    id: 'udf-1',
    name: 'data_cleaner',
    type: 'transformer',
    description: 'Cleans and normalizes data fields',
    isActive: true,
    isApproved: true,
    version: '1.2.0',
    filePath: '/path/to/udf/file',
    team: 'data_team',
    dateApproved: '2026-04-10T10:30:00.000Z',
    createdAt: '2026-03-18T10:30:00.000Z',
    updatedAt: '2026-04-12T10:30:00.000Z',
  },
  {
    id: 'udf-2',
    name: 'duplicate_filter',
    type: 'filter',
    description: 'Filters out duplicate records based on key fields',
    isActive: true,
    isApproved: true,
    version: '2.1.3',
    filePath: '/path/to/udf/file',
    team: 'data_team',
    dateApproved: '2026-04-09T08:15:00.000Z',
    createdAt: '2026-03-22T10:30:00.000Z',
    updatedAt: '2026-04-11T10:30:00.000Z',
  },
  {
    id: 'udf-3',
    name: 'email_normalizer',
    type: 'transformer',
    description: 'Normalizes email addresses to lowercase and validates format',
    isActive: true,
    isApproved: true,
    version: '1.0.5',
    filePath: '/path/to/udf/file',
    team: 'data_team',
    dateApproved: '2026-04-08T12:05:00.000Z',
    createdAt: '2026-03-20T10:30:00.000Z',
    updatedAt: '2026-04-10T10:30:00.000Z',
  },
]

let mockTeamsStore = INITIAL_MOCK_TEAMS.map(team => ({ ...team }))
let mockUsersStore = INITIAL_MOCK_USERS.map(user => ({ ...user }))
let mockUdfsStore  = INITIAL_MOCK_UDFS.map(udf => ({ ...udf }))

const INITIAL_MOCK_SYSTEM_ADMINS = [
  {
    id: 'admin-alice',
    userId: 'alice',
    createdAt: '2026-01-10T09:00:00.000Z',
    updatedAt: '2026-03-08T14:20:00.000Z',
  },
  {
    id: 'admin-dave',
    userId: 'dave',
    createdAt: '2026-02-14T11:00:00.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
  },
]

let mockSystemAdminsStore = INITIAL_MOCK_SYSTEM_ADMINS.map(a => ({ ...a }))

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

function normalizeNullableDateValue(value) {
  const normalizedValue = asTrimmedString(value)
  if (!normalizedValue) return null

  const date = new Date(normalizedValue)
  return Number.isNaN(date.getTime()) ? normalizedValue : date.toISOString()
}

function normalizeBooleanValue(value, fallback = false) {
  if (typeof value === 'boolean') return value
  if (value == null || value === '') return fallback
  if (typeof value === 'number') return value !== 0

  const normalizedValue = String(value).trim().toLowerCase()
  if (['true', '1', 'yes', 'y'].includes(normalizedValue)) return true
  if (['false', '0', 'no', 'n'].includes(normalizedValue)) return false

  return fallback
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

export function normalizeAdminUDF(record, index = 0) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null

  const name = asTrimmedString(record.name ?? record.udfName ?? record.udf_name)
  const normalizedType = asTrimmedString(record.type ?? record.udfType ?? record.udf_type).toLowerCase()
  if (!name || !VALID_UDF_TYPES.has(normalizedType)) return null

  return {
    id: asTrimmedString(record.id ?? record.udfId ?? record.udf_id, `udf-${index + 1}`),
    name,
    type: normalizedType,
    description: asTrimmedString(record.description ?? record.details ?? record.summary),
    isActive: normalizeBooleanValue(record.isActive ?? record.active ?? record.is_active, true),
    isApproved: normalizeBooleanValue(record.isApproved ?? record.approved ?? record.is_approved, false),
    version: asTrimmedString(record.version ?? record.udfVersion ?? record.udf_version),
    filePath: asTrimmedString(record.filePath ?? record.path ?? record.file_path),
    team: asTrimmedString(record.team ?? record.teamName ?? record.team_name),
    dateApproved: normalizeNullableDateValue(record.dateApproved ?? record.approvedAt ?? record.date_approved),
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

function normalizeAdminUDFs(payload) {
  return extractCollectionPayload(payload)
    .map(normalizeAdminUDF)
    .filter(Boolean)
}

function validateMockUdfUpdatePayload(udf) {
  if (!udf || typeof udf !== 'object' || Array.isArray(udf)) {
    throw new Error('Invalid UDF update payload.')
  }

  if (typeof udf.isApproved !== 'boolean') {
    throw new Error('UDF approval status must be provided as a boolean.')
  }
}

function validateNormalizedUdfRecord(udf, existingUdfs = [], previousId = '') {
  if (!udf?.name) throw new Error('UDF name is required.')
  if (!VALID_UDF_TYPES.has(udf.type)) throw new Error('UDF type must be either "transformer" or "filter".')
  if (typeof udf.isApproved !== 'boolean') throw new Error('UDF approval status is required.')
  if (typeof udf.isActive !== 'boolean') throw new Error('UDF active status must be a boolean value.')
  if (udf.version && !SEMVER_PATTERN.test(udf.version)) {
    throw new Error('UDF version must follow semantic versioning, for example "1.2.0".')
  }

  const duplicateName = existingUdfs.find(existingUdf => (
    existingUdf.id !== previousId && existingUdf.name.toLowerCase() === udf.name.toLowerCase()
  ))

  if (duplicateName) {
    throw new Error(`A UDF named "${udf.name}" already exists.`)
  }
}

export function resetAdminServiceMockData() {
  mockTeamsStore = INITIAL_MOCK_TEAMS.map(team => ({ ...team }))
  mockUsersStore = INITIAL_MOCK_USERS.map(user => ({ ...user }))
  mockUdfsStore  = INITIAL_MOCK_UDFS.map(udf => ({ ...udf }))
  mockSystemAdminsStore = INITIAL_MOCK_SYSTEM_ADMINS.map(a => ({ ...a }))
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

export async function fetchAdminUDFs(useMock = true) {
  if (useMock) {
    await new Promise(resolve => setTimeout(resolve, 80))
    return mockUdfsStore.map(udf => ({ ...udf }))
  }

  const response = await fetchWithUserId(ADMIN_UDFS_PATH, {
    headers: {
      Accept: 'application/json, text/plain',
    },
  })
  const payload = await ensureOkResponse(response, 'Failed to fetch UDFs')
  return normalizeAdminUDFs(payload)
}

export async function updateAdminUDF(udfId, udf, useMock = true) {
  const normalizedUdfId = asTrimmedString(udfId)
  const payload = {
    isApproved: udf?.isApproved,
  }

  if (useMock) {
    validateMockUdfUpdatePayload(payload)
    await new Promise(resolve => setTimeout(resolve, 80))

    const existingUdf = mockUdfsStore.find(candidate => candidate.id === normalizedUdfId)
    if (!existingUdf) {
      throw new Error(`UDF "${normalizedUdfId}" was not found.`)
    }

    const now = new Date().toISOString()
    const nextIsApproved = payload.isApproved
    const updatedUdf = normalizeAdminUDF({
      ...existingUdf,
      isApproved: nextIsApproved,
      dateApproved: nextIsApproved
        ? (existingUdf.dateApproved || now)
        : null,
      updatedAt: now,
    })

    validateNormalizedUdfRecord(updatedUdf, mockUdfsStore, normalizedUdfId)
    mockUdfsStore = mockUdfsStore.map(candidate => candidate.id === normalizedUdfId ? updatedUdf : candidate)
    return updatedUdf
  }

  const response = await fetchWithUserId(`${ADMIN_UDFS_PATH}/${encodeURIComponent(normalizedUdfId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain',
    },
    body: JSON.stringify(payload),
  })
  const updatedPayload = await ensureOkResponse(response, 'Failed to update UDF approval status')
  return normalizeAdminUDF(updatedPayload)
}

export async function deleteAdminUDF(udfId, useMock = true) {
  const normalizedUdfId = asTrimmedString(udfId)

  if (useMock) {
    await new Promise(resolve => setTimeout(resolve, 80))
    const existingCount = mockUdfsStore.length
    mockUdfsStore = mockUdfsStore.filter(udf => udf.id !== normalizedUdfId)

    if (mockUdfsStore.length === existingCount) {
      throw new Error(`UDF "${normalizedUdfId}" was not found.`)
    }

    return { success: true }
  }

  const response = await fetchWithUserId(`${ADMIN_UDFS_PATH}/${encodeURIComponent(normalizedUdfId)}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json, text/plain',
    },
  })
  await ensureOkResponse(response, 'Failed to delete UDF')
  return { success: true }
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

// ── System / privileged admin users ──────────────────────────────────────
// These are the users that hold the "admin" role (distinct from the generic
// user-to-team assignments managed by the User Management table).

function normalizeSystemAdmin(record, index = 0) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null
  const userId = asTrimmedString(record.userId ?? record.userID ?? record.username ?? record.id)
  if (!userId) return null
  return {
    id:        asTrimmedString(record.id ?? record.userId, `admin-${index + 1}`),
    userId,
    createdAt: normalizeDateValue(record.createdAt ?? record.dateOfCreate ?? record.created_at),
    updatedAt: normalizeDateValue(record.updatedAt ?? record.modifiedAt ?? record.dateOfChange ?? record.updated_at),
  }
}

function normalizeSystemAdmins(payload) {
  return extractCollectionPayload(payload)
    .map((record, index) => normalizeSystemAdmin(record, index))
    .filter(Boolean)
}

/**
 * GET /backend/admin/admin-users
 * Returns the list of privileged admin users.
 */
export async function fetchAdminSystemAdmins(useMock = true) {
  if (useMock) {
    await new Promise(resolve => setTimeout(resolve, 80))
    return mockSystemAdminsStore.map(a => ({ ...a }))
  }

  const response = await fetchWithUserId(ADMIN_SYSTEM_ADMINS_PATH, {
    headers: { Accept: 'application/json, text/plain' },
  })
  const payload = await ensureOkResponse(response, 'Failed to fetch admin users')
  return normalizeSystemAdmins(payload)
}

/**
 * POST /backend/admin/admin-users
 * Grants admin privileges to a user.
 */
export async function addAdminSystemAdmin({ userId }, useMock = true) {
  const normalizedUserId = asTrimmedString(userId)
  if (!normalizedUserId) throw new Error('User ID is required.')

  if (useMock) {
    await new Promise(resolve => setTimeout(resolve, 80))
    const existing = mockSystemAdminsStore.find(a => a.userId === normalizedUserId)
    if (existing) throw new Error(`User "${normalizedUserId}" is already an admin.`)
    const now = new Date().toISOString()
    const record = normalizeSystemAdmin({ id: `admin-${normalizedUserId}`, userId: normalizedUserId, createdAt: now, updatedAt: now })
    mockSystemAdminsStore = [record, ...mockSystemAdminsStore]
    return record
  }

  const response = await fetchWithUserId(ADMIN_SYSTEM_ADMINS_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/plain' },
    body: JSON.stringify({ userId: normalizedUserId }),
  })
  const createdPayload = await ensureOkResponse(response, 'Failed to add admin user')
  return normalizeSystemAdmin(createdPayload) ?? normalizeSystemAdmin({ userId: normalizedUserId })
}

/**
 * DELETE /backend/admin/admin-users/{id}
 * Revokes admin privileges from a user.
 */
export async function removeAdminSystemAdmin(id, useMock = true) {
  const normalizedId = asTrimmedString(id)

  if (useMock) {
    await new Promise(resolve => setTimeout(resolve, 80))
    mockSystemAdminsStore = mockSystemAdminsStore.filter(a => a.id !== normalizedId)
    return { success: true }
  }

  const response = await fetchWithUserId(`${ADMIN_SYSTEM_ADMINS_PATH}/${encodeURIComponent(normalizedId)}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json, text/plain' },
  })
  await ensureOkResponse(response, 'Failed to remove admin user')
  return { success: true }
}
