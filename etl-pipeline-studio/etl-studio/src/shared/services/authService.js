import { API_BASE } from './appConfig.js'

export const USER_ROLES = {
  ADMIN: 'admin',
  REGULAR: 'regular',
}

export const MOCK_TEAM_NAMES = ['Team A', 'Team B', 'Team C', 'Yarden']

const AUTH_AES_GCM_IV_LENGTH = 12

function getAuthEncryptionKeyBase64() {
  return String(import.meta.env.VITE_AUTH_AES_KEY ?? '').trim()
}

function getCryptoImplementation(cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl?.subtle || typeof cryptoImpl.getRandomValues !== 'function') {
    throw new Error('Secure login is unavailable because Web Crypto is not supported in this environment.')
  }

  return cryptoImpl
}

function encodeBase64(bytes) {
  const normalizedBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const binary = Array.from(normalizedBytes, byte => String.fromCharCode(byte)).join('')

  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(binary)
  }

  return Buffer.from(normalizedBytes).toString('base64')
}

function decodeBase64(value) {
  const normalizedValue = String(value ?? '').trim()
  if (!normalizedValue) return new Uint8Array()

  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(normalizedValue)
    return Uint8Array.from(binary, char => char.charCodeAt(0))
  }

  return Uint8Array.from(Buffer.from(normalizedValue, 'base64'))
}

async function importAuthEncryptionKey({ cryptoImpl = globalThis.crypto, keyBase64 = getAuthEncryptionKeyBase64() } = {}) {
  const normalizedKey = String(keyBase64 ?? '').trim()
  if (!normalizedKey) {
    throw new Error('Secure login is not configured. Set VITE_AUTH_AES_KEY to the shared AES key in base64 form.')
  }

  const keyBytes = decodeBase64(normalizedKey)
  if (![16, 24, 32].includes(keyBytes.byteLength)) {
    throw new Error('VITE_AUTH_AES_KEY must decode to a valid AES key length of 16, 24, or 32 bytes.')
  }

  return getCryptoImplementation(cryptoImpl).subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  )
}

export function normalizeUserRole(role) {
  const normalizedRole = String(role ?? '')
    .trim()
    .toLowerCase()
    .replace(/^['"]+|['"]+$/g, '')

  if (!normalizedRole) return USER_ROLES.REGULAR

  const roleTokens = normalizedRole.split(/[\s,:;|_-]+/).filter(Boolean)

  return roleTokens.includes(USER_ROLES.ADMIN) || roleTokens.includes('administrator')
    ? USER_ROLES.ADMIN
    : USER_ROLES.REGULAR
}

export async function encryptLoginValue(value = '', options = {}) {
  const cryptoImpl = getCryptoImplementation(options.cryptoImpl)
  const iv = options.iv instanceof Uint8Array
    ? options.iv
    : cryptoImpl.getRandomValues(new Uint8Array(AUTH_AES_GCM_IV_LENGTH))
  const encryptionKey = await importAuthEncryptionKey({
    cryptoImpl,
    keyBase64: options.keyBase64,
  })
  const plaintextBytes = new TextEncoder().encode(String(value ?? ''))
  const ciphertext = await cryptoImpl.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    encryptionKey,
    plaintextBytes,
  )

  return `${encodeBase64(iv)}:${encodeBase64(new Uint8Array(ciphertext))}`
}

export function extractTeamNameFromLoginPayload(payload) {
  if (payload == null) return ''
  if (typeof payload === 'string') return payload.trim()
  if (typeof payload !== 'object' || Array.isArray(payload)) return ''

  return String(
    payload.teamName
    ?? payload.team
    ?? payload.team_name
    ?? payload.name
    ?? ''
  ).trim()
}

export async function loginUser({ userName = '', username = '', password = '' }) {
  const normalizedUserName = String(username || userName || '').trim()
  const [encryptedUserName, encryptedPassword] = await Promise.all([
    encryptLoginValue(normalizedUserName),
    encryptLoginValue(password),
  ])

  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain',
    },
    body: JSON.stringify({
      username: encryptedUserName,
      password: encryptedPassword,
    }),
  })

  if (!response.ok) {
    let message = `Login failed with status: ${response.status}`

    try {
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const payload = await response.json()
        message = payload?.message || payload?.error || payload?.detail || message
      } else {
        const text = await response.text()
        if (text) message = text
      }
    } catch {}

    throw new Error(message)
  }

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  const teamName = extractTeamNameFromLoginPayload(payload)
  if (!teamName) {
    throw new Error('Login response did not include a team name.')
  }

  const userRoleHeader = String(response.headers.get('user-role') ?? '').trim()

  return {
    userId: normalizedUserName,
    teamName,
    role: normalizeUserRole(userRoleHeader),
    userRoleHeader,
  }
}



