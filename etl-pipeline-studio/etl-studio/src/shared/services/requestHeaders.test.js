import { beforeEach, describe, expect, it } from 'vitest'
import { ACTIVE_USER_STORAGE_KEY } from '../store/userSessionPersistence.js'
import { buildHeadersWithUserId, withUserIdHeader } from './requestHeaders.js'

describe('requestHeaders', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('injects X-user-ID when an active user is persisted', () => {
    localStorage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify({ userId: 'alice', teamName: 'platform' }))

    expect(buildHeadersWithUserId({ Accept: 'application/json' })).toEqual({
      Accept: 'application/json',
      'X-user-ID': 'alice',
    })
  })

  it('preserves an existing X-user-ID header when already provided', () => {
    localStorage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify({ userId: 'alice', teamName: 'platform' }))

    expect(buildHeadersWithUserId({ 'x-user-id': 'override-user' })).toEqual({
      'x-user-id': 'override-user',
    })
  })

  it('returns unchanged headers when there is no active user', () => {
    expect(withUserIdHeader({ method: 'GET', headers: { Accept: 'application/json' } })).toEqual({
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
  })
})

