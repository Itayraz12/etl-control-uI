import { normalizeStorageUserId } from './wizardPersistence.js'

export const PENDING_SCOPE_RESET_STORAGE_KEY = 'etl-studio-pending-scope-resets'

export function parsePendingScopeResets(raw) {
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

    return Object.entries(parsed).reduce((acc, [userId, deadline]) => {
      if (typeof deadline === 'number' && Number.isFinite(deadline)) {
        acc[userId] = deadline
      }
      return acc
    }, {})
  } catch {
    return {}
  }
}

export function readPendingScopeResets() {
  try {
    return parsePendingScopeResets(localStorage.getItem(PENDING_SCOPE_RESET_STORAGE_KEY))
  } catch {
    return {}
  }
}

export function writePendingScopeResets(resets = {}) {
  try {
    if (!resets || Object.keys(resets).length === 0) {
      localStorage.removeItem(PENDING_SCOPE_RESET_STORAGE_KEY)
      return
    }

    localStorage.setItem(PENDING_SCOPE_RESET_STORAGE_KEY, JSON.stringify(resets))
  } catch {}
}

export function upsertPendingScopeReset(userId, deadline) {
  const normalizedUserId = normalizeStorageUserId(userId)
  if (!normalizedUserId) return {}

  const resets = readPendingScopeResets()
  resets[normalizedUserId] = deadline
  writePendingScopeResets(resets)
  return resets
}

export function removePendingScopeReset(userId) {
  const normalizedUserId = normalizeStorageUserId(userId)
  if (!normalizedUserId) return {}

  const resets = readPendingScopeResets()
  delete resets[normalizedUserId]
  writePendingScopeResets(resets)
  return resets
}

export function splitPendingScopeResetsByExpiry(now = Date.now()) {
  const resets = readPendingScopeResets()
  const expiredUserIds = []
  const activeResets = {}

  Object.entries(resets).forEach(([userId, deadline]) => {
    if (deadline <= now) expiredUserIds.push(userId)
    else activeResets[userId] = deadline
  })

  return { expiredUserIds, activeResets }
}

