import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encryptLoginValue, extractTeamNameFromLoginPayload, loginUser, normalizeUserRole } from './authService.js'

function encodeBase64(bytes) {
  const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('')
  return typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(bytes).toString('base64')
}

describe('authService', () => {
  const fetchMock = vi.fn()
  const importKeyMock = vi.fn(async () => ({ type: 'secret' }))
  const encryptMock = vi.fn(async ({ iv }, key, plaintextBytes) => {
    const payload = new Uint8Array(iv.length + plaintextBytes.length)
    payload.set(iv, 0)
    payload.set(plaintextBytes, iv.length)
    return payload.buffer
  })

  const cryptoStub = {
    subtle: {
      importKey: (...args) => importKeyMock(...args),
      encrypt: (...args) => encryptMock(...args),
    },
    getRandomValues: vi.fn(target => {
      target.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
      return target
    }),
  }

  const authKeyBase64 = 'MDEyMzQ1Njc4OWFiY2RlZg=='
  const authKeyBytes = new TextEncoder().encode('0123456789abcdef')

  beforeEach(() => {
    fetchMock.mockReset()
    importKeyMock.mockClear()
    encryptMock.mockClear()
    cryptoStub.getRandomValues.mockClear()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('crypto', cryptoStub)
    vi.stubEnv('VITE_AUTH_AES_KEY', authKeyBase64)
  })

  it('normalizes missing roles to regular and preserves common admin header variants', () => {
    expect(normalizeUserRole()).toBe('regular')
    expect(normalizeUserRole('regular')).toBe('regular')
    expect(normalizeUserRole('ADMIN')).toBe('admin')
    expect(normalizeUserRole('ROLE_ADMIN')).toBe('admin')
    expect(normalizeUserRole('"admin"')).toBe('admin')
  })

  it('extracts the team name from text and JSON login payloads', () => {
    expect(extractTeamNameFromLoginPayload('Team A')).toBe('Team A')
    expect(extractTeamNameFromLoginPayload({ teamName: 'Team B' })).toBe('Team B')
    expect(extractTeamNameFromLoginPayload({ team: 'Team C' })).toBe('Team C')
  })

  it('encrypts login values as base64(iv):base64(ciphertext)', async () => {
    const encryptedValue = await encryptLoginValue('alice')

    expect(encryptedValue).toBe(`${encodeBase64(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))}:${encodeBase64(Uint8Array.from([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
      97, 108, 105, 99, 101,
    ]))}`)
    expect(importKeyMock).toHaveBeenCalledTimes(1)
    const [format, importedKeyBytes, algorithm, extractable, usages] = importKeyMock.mock.calls[0]
    expect(format).toBe('raw')
    expect(Array.from(importedKeyBytes)).toEqual(Array.from(authKeyBytes))
    expect(algorithm).toEqual({ name: 'AES-GCM' })
    expect(extractable).toBe(false)
    expect(usages).toEqual(['encrypt'])
    expect(encryptMock).toHaveBeenCalledWith(
      {
        name: 'AES-GCM',
        iv: Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
      },
      { type: 'secret' },
      new TextEncoder().encode('alice'),
    )
  })

  it('posts the encrypted username and password to /auth/login, then returns team, normalized role, and raw role header', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ teamName: 'Team B' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'user-role': 'admin',
      },
    }))

    await expect(loginUser({ username: 'alice', password: 'secret' })).resolves.toEqual({
      userId: 'alice',
      teamName: 'Team B',
      role: 'admin',
      userRoleHeader: 'admin',
    })

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain',
      },
      body: JSON.stringify({
        username: `${encodeBase64(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))}:${encodeBase64(Uint8Array.from([
          1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
          97, 108, 105, 99, 101,
        ]))}`,
        password: `${encodeBase64(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))}:${encodeBase64(Uint8Array.from([
          1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
          115, 101, 99, 114, 101, 116,
        ]))}`,
      }),
    })
  })

  it('defaults the role to regular when the login response header is missing', async () => {
    fetchMock.mockResolvedValue(new Response('Yarden', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    }))

    await expect(loginUser({ username: 'yarden', password: 'pw' })).resolves.toEqual({
      userId: 'yarden',
      teamName: 'Yarden',
      role: 'regular',
      userRoleHeader: '',
    })
  })

  it('fails with a clear error when secure login is missing the shared AES key', async () => {
    vi.stubEnv('VITE_AUTH_AES_KEY', '')

    await expect(loginUser({ username: 'alice', password: 'secret' })).rejects.toThrow(
      'Secure login is not configured. Set VITE_AUTH_AES_KEY to the shared AES key in base64 form.',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})





