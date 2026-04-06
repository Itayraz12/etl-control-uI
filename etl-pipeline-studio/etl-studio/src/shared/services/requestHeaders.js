import { readPersistedActiveUser } from '../store/userSessionPersistence.js'

function copyHeadersEntries(target, headers) {
  if (!headers) return target

  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    headers.forEach((value, key) => {
      target[key] = value
    })
    return target
  }

  if (Array.isArray(headers)) {
    headers.forEach(([key, value]) => {
      if (key != null) target[String(key)] = String(value)
    })
    return target
  }

  if (typeof headers === 'object') {
    Object.entries(headers).forEach(([key, value]) => {
      target[key] = value
    })
  }

  return target
}

function hasHeader(headers, headerName) {
  const normalizedHeaderName = String(headerName || '').toLowerCase()
  return Object.keys(headers).some(key => key.toLowerCase() === normalizedHeaderName)
}

export function buildHeadersWithUserId(headers = {}, user = readPersistedActiveUser()) {
  const mergedHeaders = copyHeadersEntries({}, headers)
  const userId = String(user?.userId || '').trim()

  if (userId && !hasHeader(mergedHeaders, 'X-user-ID')) {
    mergedHeaders['X-user-ID'] = userId
  }

  return mergedHeaders
}

export function withUserIdHeader(init = {}, user = readPersistedActiveUser()) {
  return {
    ...init,
    headers: buildHeadersWithUserId(init?.headers, user),
  }
}

export function fetchWithUserId(input, init = {}, user = readPersistedActiveUser()) {
  return fetch(input, withUserIdHeader(init, user))
}

