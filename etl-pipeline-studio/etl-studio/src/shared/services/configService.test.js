import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildFiltersUrl,
  buildTransformersUrl,
  buildConfigurationYamlUrl,
  buildSchemaByExampleUrl,
  fetchEntitySchema,
  fetchFilters,
  fetchTransformers,
  fetchRecordsPerDay,
  fetchStreamingContinuities,
  resetConfigServiceRequestCache,
} from './configService.js'
import { writePersistedActiveUser } from '../store/userSessionPersistence.js'

describe('configService', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    localStorage.clear()
    resetConfigServiceRequestCache()
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
      environment: 'PROD',
    })).toBe(
      'http://localhost:8080/api/backend/configuration/yaml?productType=Inventory&source=ERP&team=Team+A&environment=PROD'
    )
  })

  it('builds configuration YAML URLs correctly for relative /api bases used by the dev proxy', () => {
    expect(buildConfigurationYamlUrl('backend/configuration/yaml', {
      productType: 'Inventory',
      source: 'ERP',
      team: 'Team A',
      environment: 'cap',
    }, {
      apiBase: '/api',
      origin: 'http://localhost:5173',
    })).toBe(
      'http://localhost:5173/api/backend/configuration/yaml?productType=Inventory&source=ERP&team=Team+A&environment=CAP'
    )
  })

  it('builds filter URLs with a normalized environment query parameter when provided', () => {
    expect(buildFiltersUrl({ environment: 'cap' })).toBe(
      'http://localhost:8080/api/config/filters?environment=CAP'
    )

    expect(buildFiltersUrl({ environment: '' })).toBe(
      'http://localhost:8080/api/config/filters'
    )
  })

  it('builds transformer URLs with a normalized environment query parameter when provided', () => {
    expect(buildTransformersUrl({ environment: 'prod' })).toBe(
      'http://localhost:8080/api/config/transformers?environment=PROD'
    )

    expect(buildTransformersUrl({ environment: '' })).toBe(
      'http://localhost:8080/api/config/transformers'
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

  it('deduplicates concurrent streaming continuity fetches but refetches on a later revisit', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify([
      { value: 'continuous', label: 'Continuous' },
      { value: 'every-day', label: 'Once a Day' },
    ]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))

    const [first, second, third] = await Promise.all([
      fetchStreamingContinuities(false),
      fetchStreamingContinuities(false),
      fetchStreamingContinuities(false),
    ])

    expect(first).toEqual(second)
    expect(second).toEqual(third)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await expect(fetchStreamingContinuities(false)).resolves.toEqual(first)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('deduplicates concurrent records-per-day fetches but refetches on a later revisit', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(['thousands', 'millions']), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))

    const [first, second] = await Promise.all([
      fetchRecordsPerDay(false),
      fetchRecordsPerDay(false),
    ])

    expect(first).toEqual(second)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await expect(fetchRecordsPerDay(false)).resolves.toEqual(first)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('normalizes the new filter API response shape from /api/config/filters', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([
      {
        _id: 'filter-001',
        name: 'equals',
        createDate: '2026-04-10T09:30:00',
        description: 'Matches records where severity is warning or higher.',
        owner: 'team-a',
        s3Path: 's3://etl-control/filters/equals/v1/filter.py',
        approved: true,
        isActive: true,
        isRevertible: true,
        version: '1.0.0',
        additionalParams: [
          {
            name: 'severity',
            displayName: 'Severity threshold',
            description: 'Minimum severity threshold to include.',
            type: 'string',
            isArray: false,
          },
        ],
      },
    ]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(fetchFilters(false, { environment: 'cap' })).resolves.toEqual([
      {
        _id: 'filter-001',
        id: 'eq',
        name: 'equals',
        createDate: '2026-04-10T09:30:00',
        description: 'Matches records where severity is warning or higher.',
        owner: 'team-a',
        s3Path: 's3://etl-control/filters/equals/v1/filter.py',
        approved: true,
        isActive: true,
        isRevertible: true,
        isReverted: false,
        version: '1.0.0',
        additionalParams: [
          {
            name: 'severity',
            displayName: 'Severity threshold',
            description: 'Minimum severity threshold to include.',
            type: 'string',
            isArray: false,
          },
        ],
        additionalProperties: {
          properties: [
            {
              key: 'severity',
              label: 'Severity threshold',
              type: 'text',
              default: '',
              description: 'Minimum severity threshold to include.',
              isArray: false,
            },
          ],
        },
        symbol: 'equals',
      },
      {
        _id: 'filter-001',
        id: 'eq',
        name: 'not equals',
        createDate: '2026-04-10T09:30:00',
        description: 'Matches records where severity is warning or higher.',
        owner: 'team-a',
        s3Path: 's3://etl-control/filters/equals/v1/filter.py',
        approved: true,
        isActive: true,
        isRevertible: true,
        isReverted: true,
        version: '1.0.0',
        additionalParams: [
          {
            name: 'severity',
            displayName: 'Severity threshold',
            description: 'Minimum severity threshold to include.',
            type: 'string',
            isArray: false,
          },
        ],
        additionalProperties: {
          properties: [
            {
              key: 'severity',
              label: 'Severity threshold',
              type: 'text',
              default: '',
              description: 'Minimum severity threshold to include.',
              isArray: false,
            },
          ],
        },
        symbol: 'equals',
      },
    ])

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/config/filters?environment=CAP',
      { headers: { 'X-user-ID': 'user-123' } },
    )
  })

  it('keeps supporting the previous filter payload shape and synthetic revertible options', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([
      {
        id: 'startswith',
        name: 'Starts With',
        rule: '^=',
        isInclude: true,
        isRevertible: true,
        additionalProperties: { options: ['sku', 'catalog'] },
      },
    ]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(fetchFilters(false)).resolves.toEqual([
      expect.objectContaining({
        _id: 'startswith',
        id: 'startswith',
        name: 'Starts With',
        rule: '^=',
        symbol: '^=',
        isInclude: true,
        isRevertible: true,
        isReverted: false,
        additionalParams: [],
        additionalProperties: { options: ['sku', 'catalog'] },
      }),
      expect.objectContaining({
        _id: 'startswith',
        id: 'startswith',
        name: 'not Starts With',
        rule: '^=',
        symbol: '^=',
        isInclude: true,
        isRevertible: true,
        isReverted: true,
        additionalParams: [],
        additionalProperties: { options: ['sku', 'catalog'] },
      }),
    ])
  })

  it('fetches transformers from the environment-aware transformers endpoint', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([
      {
        _id: 'tf-001',
        name: 'Uppercase',
        description: 'Upper cases the input value.',
        inputType: 'SINGLE',
        additionalProperties: {
          _required: ['locale'],
          locale: 'en-US',
        },
      },
    ]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(fetchTransformers(false, { environment: 'cap' })).resolves.toEqual([
      expect.objectContaining({
        _id: 'tf-001',
        name: 'Uppercase',
        propsSchema: [
          {
            key: 'locale',
            label: 'Locale',
            type: 'text',
            default: '',
            required: true,
            description: 'en-US',
          },
        ],
      }),
    ])

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/config/transformers?environment=CAP',
      { headers: { 'X-user-ID': 'user-123' } },
    )
  })

  it('deduplicates concurrent entity schema fetches for the same entity but refetches on a later revisit', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      type: 'object',
      required: ['code'],
      properties: {
        code: { type: 'string' },
        price: { type: 'number' },
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))

    const [first, second, third] = await Promise.all([
      fetchEntitySchema('Product', false),
      fetchEntitySchema('Product', false),
      fetchEntitySchema(' Product ', false),
    ])

    expect(first).toEqual(second)
    expect(second).toEqual(third)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:8080/api/backend/schema/entity/Product',
      {
        headers: {
          Accept: 'application/json, text/plain',
          'X-user-ID': 'user-123',
        },
      },
    )

    await expect(fetchEntitySchema('product', false)).resolves.toEqual(first)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:8080/api/backend/schema/entity/product',
      {
        headers: {
          Accept: 'application/json, text/plain',
          'X-user-ID': 'user-123',
        },
      },
    )
  })
})


