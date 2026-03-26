import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadFreshAppConfig() {
  vi.resetModules()
  return import('./appConfig.js')
}

describe('appConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('falls back to the default API base and package version when env overrides are absent', async () => {
    vi.stubEnv('VITE_API_BASE', '')
    vi.stubEnv('VITE_APP_VERSION', '')

    const { API_BASE, APP_VERSION } = await loadFreshAppConfig()

    expect(API_BASE).toBe('http://localhost:8080/api')
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('uses external env parameters for API base and version when provided', async () => {
    vi.stubEnv('VITE_API_BASE', 'https://example.internal/api/')
    vi.stubEnv('VITE_APP_VERSION', '9.9.9-rc.1')

    const { API_BASE, APP_VERSION, APP_CONFIG } = await loadFreshAppConfig()

    expect(API_BASE).toBe('https://example.internal/api')
    expect(APP_VERSION).toBe('9.9.9-rc.1')
    expect(APP_CONFIG).toEqual({
      apiBase: 'https://example.internal/api',
      version: '9.9.9-rc.1',
    })
  })
})

