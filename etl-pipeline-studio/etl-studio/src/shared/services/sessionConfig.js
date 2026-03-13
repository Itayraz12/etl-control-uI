const DEFAULT_IDLE_LOGOUT_MINUTES = 15
const DEFAULT_SCOPE_RESET_GRACE_MINUTES = 10
const MINUTE_IN_MS = 60 * 1000

function readPositiveNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const SESSION_TIMEOUTS = {
  idleLogoutMinutes: readPositiveNumber(import.meta.env.VITE_IDLE_LOGOUT_MINUTES, DEFAULT_IDLE_LOGOUT_MINUTES),
  scopeResetGraceMinutes: readPositiveNumber(import.meta.env.VITE_SCOPE_RESET_GRACE_MINUTES, DEFAULT_SCOPE_RESET_GRACE_MINUTES),
}

export const SESSION_TIMEOUTS_MS = {
  idleLogout: SESSION_TIMEOUTS.idleLogoutMinutes * MINUTE_IN_MS,
  scopeResetGrace: SESSION_TIMEOUTS.scopeResetGraceMinutes * MINUTE_IN_MS,
}

