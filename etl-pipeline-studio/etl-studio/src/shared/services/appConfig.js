const DEFAULT_API_BASE = 'http://localhost:8080/api'

function normalizeApiBase(value, fallback = DEFAULT_API_BASE) {
  const candidate = String(value ?? '').trim()
  const base = candidate || fallback
  return base.replace(/\/+$/, '')
}

function normalizeVersion(value, fallback = '') {
  const candidate = String(value ?? '').trim()
  return candidate || fallback
}

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE, DEFAULT_API_BASE)
export const APP_VERSION = normalizeVersion(import.meta.env.VITE_APP_VERSION, __APP_VERSION__)

export const APP_CONFIG = {
  apiBase: API_BASE,
  version: APP_VERSION,
}

export { DEFAULT_API_BASE, normalizeApiBase, normalizeVersion }

