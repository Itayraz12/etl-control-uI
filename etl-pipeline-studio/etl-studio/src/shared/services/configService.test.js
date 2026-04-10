import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildConfigurationYamlUrl,
  buildSchemaByExampleUrl,
  fetchRecordsPerDay,
  fetchStreamingContinuities,
} from './configService.js'
import { writePersistedActiveUser } from '../store/userSessionPersistence.js'

describe('configService', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    localStorage.clear()
    writePersistedActiveUser({ userId: 'user-123', teamName: 'data-platform' })
  })

  it('appends the selected source format to the schema-by-example URL', () => {
    expect(buildSchemaByExampleUrl({ sourceFormat: 'JSON' })).toBe(
      'http://localhost:8080/api/backend/schemaByExample/JSON'
    )

    expect(buildSchemaByExampleUrl({ sourceFormat: 'CSV' })).toBe(
      'http://localhost:8080/api/backend/schemaByExample/CSV'
    )
  })

  it('omits the format query param when no source format is provided', () => {
    expect(buildSchemaByExampleUrl()).toBe(
      'http://localhost:8080/api/backend/schemaByExample'
    )
  })

  it('builds configuration YAML URLs correctly for absolute API bases', () => {
    expect(buildConfigurationYamlUrl('backend/configuration/yaml', {
      productType: 'Inventory',
      source: 'ERP',
      team: 'Team A',
      environment: 'production',
    })).toBe(
      'http://localhost:8080/api/backend/configuration/yaml?productType=Inventory&source=ERP&team=Team+A&environment=production'
    )
  })

  it('builds configuration YAML URLs correctly for relative /api bases used by the dev proxy', () => {
    expect(buildConfigurationYamlUrl('backend/configuration/yaml', {
      productType: 'Inventory',
      source: 'ERP',
      team: 'Team A',
      environment: 'production',
    }, {
      apiBase: '/api',
      origin: 'http://localhost:5173',
    })).toBe(
      'http://localhost:5173/api/backend/configuration/yaml?productType=Inventory&source=ERP&team=Team+A&environment=production'
    )
  })

  it('fetches streaming continuity options from /api/config/streaming-continuities', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([
      { value: 'continuous', label: 'Continuous' },
      { value: 'every-day', label: 'Once a Day' },
    ]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(fetchStreamingContinuities(false)).resolves.toEqual([
      { value: 'continuous', label: 'Continuous' },
      { value: 'every-day', label: 'Once a Day' },
    ])

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/config/streaming-continuities',
      { headers: { 'X-user-ID': 'user-123' } },
    )
  })

  it('fetches records-per-day options from /api/config/records-per-day and normalizes string responses', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(['thousands', 'millions']), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(fetchRecordsPerDay(false)).resolves.toEqual([
      { value: 'thousands', label: 'Thousands' },
      { value: 'millions', label: 'A Few Millions' },
    ])

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/config/records-per-day',
      { headers: { 'X-user-ID': 'user-123' } },
    )
  })
})


