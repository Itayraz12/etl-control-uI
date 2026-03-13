import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { SESSION_TIMEOUTS_MS } from '../services/sessionConfig.js'
import { clearPersistedWizardStateForUser, normalizeStorageUserId } from './wizardPersistence.js'
import {
  removePendingScopeReset,
  splitPendingScopeResetsByExpiry,
  upsertPendingScopeReset,
} from './userSessionPersistence.js'

const IDLE_LOGOUT_MS = SESSION_TIMEOUTS_MS.idleLogout
const RELOGIN_GRACE_MS = SESSION_TIMEOUTS_MS.scopeResetGrace
const MOUSEMOVE_THROTTLE_MS = 30 * 1000
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove']

const UserContext = createContext({
  user: null,
  setUser: () => {},
  login: () => {},
  logout: () => {},
});

function normalizeUser(user) {
  if (!user?.userId) return null

  return {
    ...user,
    userId: String(user.userId).trim(),
    teamName: String(user.teamName ?? '').trim(),
  }
}

export function UserProvider({ children }) {
  const [user, setUserState] = useState(null)
  const idleLogoutTimerRef = useRef(null)
  const pendingResetTimersRef = useRef(new Map())
  const lastMouseMoveAtRef = useRef(0)
  const userRef = useRef(null)

  useEffect(() => {
    userRef.current = user
  }, [user])

  const clearIdleLogoutTimer = useCallback(() => {
    if (idleLogoutTimerRef.current) {
      clearTimeout(idleLogoutTimerRef.current)
      idleLogoutTimerRef.current = null
    }
  }, [])

  const clearPendingResetTimer = useCallback((userId) => {
    const normalizedUserId = normalizeStorageUserId(userId)
    if (!normalizedUserId) return

    const existingTimer = pendingResetTimersRef.current.get(normalizedUserId)
    if (existingTimer) {
      clearTimeout(existingTimer)
      pendingResetTimersRef.current.delete(normalizedUserId)
    }
  }, [])

  const finalizeScopeReset = useCallback((userId) => {
    clearPendingResetTimer(userId)
    removePendingScopeReset(userId)
    clearPersistedWizardStateForUser(userId)
  }, [clearPendingResetTimer])

  const scheduleScopeReset = useCallback((userId, deadline = Date.now() + RELOGIN_GRACE_MS) => {
    const normalizedUserId = normalizeStorageUserId(userId)
    if (!normalizedUserId) return

    clearPendingResetTimer(normalizedUserId)
    upsertPendingScopeReset(normalizedUserId, deadline)

    const delay = Math.max(deadline - Date.now(), 0)
    const timerId = setTimeout(() => {
      finalizeScopeReset(normalizedUserId)
    }, delay)

    pendingResetTimersRef.current.set(normalizedUserId, timerId)
  }, [clearPendingResetTimer, finalizeScopeReset])

  const syncPendingScopeResets = useCallback(() => {
    const { expiredUserIds, activeResets } = splitPendingScopeResetsByExpiry(Date.now())

    expiredUserIds.forEach(userId => finalizeScopeReset(userId))

    const activeUserIds = new Set(Object.keys(activeResets))
    Array.from(pendingResetTimersRef.current.keys()).forEach(userId => {
      if (!activeUserIds.has(userId)) {
        clearPendingResetTimer(userId)
      }
    })

    Object.entries(activeResets).forEach(([userId, deadline]) => {
      scheduleScopeReset(userId, deadline)
    })
  }, [clearPendingResetTimer, finalizeScopeReset, scheduleScopeReset])

  const logout = useCallback((reason = 'manual') => {
    const activeUser = userRef.current
    clearIdleLogoutTimer()

    if (reason === 'idle' && activeUser?.userId) {
      scheduleScopeReset(activeUser.userId)
    }

    setUserState(null)
  }, [clearIdleLogoutTimer, scheduleScopeReset])

  const restartIdleLogoutTimer = useCallback(() => {
    clearIdleLogoutTimer()
    if (!userRef.current?.userId) return

    idleLogoutTimerRef.current = setTimeout(() => {
      logout('idle')
    }, IDLE_LOGOUT_MS)
  }, [clearIdleLogoutTimer, logout])

  const registerActivity = useCallback((event) => {
    if (!userRef.current?.userId) return

    if (event?.type === 'mousemove') {
      const now = Date.now()
      if (now - lastMouseMoveAtRef.current < MOUSEMOVE_THROTTLE_MS) return
      lastMouseMoveAtRef.current = now
    }

    restartIdleLogoutTimer()
  }, [restartIdleLogoutTimer])

  const login = useCallback((nextUser) => {
    const normalizedUser = normalizeUser(nextUser)
    syncPendingScopeResets()

    if (normalizedUser?.userId) {
      clearPendingResetTimer(normalizedUser.userId)
      removePendingScopeReset(normalizedUser.userId)
    }

    setUserState(normalizedUser)
  }, [clearPendingResetTimer, syncPendingScopeResets])

  const setUser = useCallback((nextUser) => {
    if (nextUser) {
      login(nextUser)
      return
    }

    logout('manual')
  }, [login, logout])

  useEffect(() => {
    syncPendingScopeResets()

    return () => {
      clearIdleLogoutTimer()
      Array.from(pendingResetTimersRef.current.values()).forEach(timerId => clearTimeout(timerId))
      pendingResetTimersRef.current.clear()
    }
  }, [clearIdleLogoutTimer, syncPendingScopeResets])

  useEffect(() => {
    if (!user?.userId) {
      clearIdleLogoutTimer()
      return undefined
    }

    lastMouseMoveAtRef.current = 0
    restartIdleLogoutTimer()

    ACTIVITY_EVENTS.forEach(eventName => window.addEventListener(eventName, registerActivity, true))
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') registerActivity({ type: 'visibilitychange' })
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      ACTIVITY_EVENTS.forEach(eventName => window.removeEventListener(eventName, registerActivity, true))
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearIdleLogoutTimer()
    }
  }, [clearIdleLogoutTimer, registerActivity, restartIdleLogoutTimer, user?.userId])

  const value = useMemo(() => ({ user, setUser, login, logout }), [login, logout, setUser, user])

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext);
}
