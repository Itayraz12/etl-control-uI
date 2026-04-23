import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadFreshTypes() {
  vi.resetModules()
  return import('./index.js')
}

import { formatEnvironmentLabel, hasSourceSchemaFieldChanges, normalizeEnvironmentValue, normalizeSourceSchema } from './index.js'

describe('environment helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('normalizes only canonical environment values', () => {
    expect(normalizeEnvironmentValue('PROD')).toBe('PROD')
    expect(normalizeEnvironmentValue('cap')).toBe('CAP')
    expect(normalizeEnvironmentValue('production')).toBe('production')
    expect(normalizeEnvironmentValue('staging')).toBe('staging')
  })

  it('formats canonical labels without remapping legacy values', () => {
    expect(formatEnvironmentLabel('production')).toBe('production')
    expect(formatEnvironmentLabel('staging')).toBe('staging')
    expect(formatEnvironmentLabel('PROD')).toBe('PROD')
  })

  it('uses env-configured metadata locations and the first one for non-PROD normalization', async () => {
    vi.stubEnv('VITE_METADATA_LOCATIONS', 'remote, branch-office')

    const {
      METADATA_LOCATIONS,
      getAllowedMetadataLocations,
      normalizeMetadataLocation,
    } = await loadFreshTypes()

    expect(METADATA_LOCATIONS).toEqual(['REMOTE', 'BRANCH-OFFICE'])
    expect(getAllowedMetadataLocations('PROD')).toEqual(['REMOTE', 'BRANCH-OFFICE'])
    expect(getAllowedMetadataLocations('CAP')).toEqual(['REMOTE'])
    expect(normalizeMetadataLocation('branch-office', 'PROD')).toBe('BRANCH-OFFICE')
    expect(normalizeMetadataLocation('ignored', 'CAP')).toBe('REMOTE')
  })
})

describe('normalizeSourceSchema', () => {
  it('keeps the root array field when the uploaded JSON schema is a top-level array', () => {
    const normalized = normalizeSourceSchema({
      type: 'array',
      items: {
        type: 'object',
        required: ['firstName'],
        properties: {
          firstName: { type: 'string' },
          age: { type: 'number' },
        },
      },
    })

    expect(normalized).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'items',
          path: 'items',
          type: 'array',
          isArray: true,
          arrayItemType: 'object',
        }),
        expect.objectContaining({
          id: 'item.*.firstName',
          type: 'string',
          required: true,
        }),
        expect.objectContaining({
          id: 'item.*.age',
          type: 'number',
        }),
      ]),
    )
  })

  it('omits nested array container fields while preserving descendant item paths', () => {
    const normalized = normalizeSourceSchema({
      type: 'object',
      properties: {
        persons: {
          type: 'array',
          items: {
            type: 'object',
            required: ['firstName'],
            properties: {
              firstName: { type: 'string' },
              lastName: { type: 'string' },
            },
          },
        },
      },
    })

    expect(normalized).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'person.*.firstName', type: 'string', required: true }),
        expect.objectContaining({ id: 'person.*.lastName', type: 'string' }),
      ]),
    )
    expect(normalized).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'persons' }),
      ]),
    )
  })

  it('expands nested array item oneOf branches and referenced object fields', () => {
    const normalized = normalizeSourceSchema({
      type: 'object',
      properties: {
        persons: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              grades: {
                type: 'array',
                items: {
                  type: 'object',
                  oneOf: [
                    {
                      properties: {
                        school: {
                          $ref: '#/$defs/grades',
                        },
                      },
                      required: ['school'],
                    },
                    {
                      properties: {
                        highschool: {
                          $ref: '#/$defs/grades',
                        },
                      },
                      required: ['highschool'],
                    },
                    {
                      properties: {
                        mathGarde: { type: 'integer' },
                        historyGrade: { type: 'integer' },
                      },
                      required: ['mathGarde', 'historyGrade'],
                    },
                  ],
                },
              },
            },
          },
        },
      },
      $defs: {
        grades: {
          type: 'object',
          properties: {
            mathGarde: { type: 'integer' },
            historyGrade: { type: 'integer' },
          },
          required: ['mathGarde', 'historyGrade'],
        },
      },
    })

    expect(normalized).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'person.*.grade.*.school.mathGarde', type: 'number', required: true }),
        expect.objectContaining({ id: 'person.*.grade.*.school.historyGrade', type: 'number', required: true }),
        expect.objectContaining({ id: 'person.*.grade.*.highschool.mathGarde', type: 'number', required: true }),
        expect.objectContaining({ id: 'person.*.grade.*.highschool.historyGrade', type: 'number', required: true }),
        expect.objectContaining({ id: 'person.*.grade.*.mathGarde', type: 'number', required: true }),
        expect.objectContaining({ id: 'person.*.grade.*.historyGrade', type: 'number', required: true }),
      ]),
    )
    expect(normalized).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'persons' }),
        expect.objectContaining({ id: 'person.*.grades' }),
      ]),
    )
  })
})

describe('hasSourceSchemaFieldChanges', () => {
  it('returns false when the same normalized fields are re-uploaded in a different order', () => {
    expect(hasSourceSchemaFieldChanges(
      [
        { id: 'price', type: 'number', required: false },
        { id: 'sku', type: 'string', required: true },
      ],
      [
        { id: 'sku', path: 'sku', name: 'sku', type: 'string', required: true },
        { id: 'price', path: 'price', name: 'price', type: 'number', required: false },
      ],
    )).toBe(false)
  })

  it('returns true when at least one normalized field signature changes', () => {
    expect(hasSourceSchemaFieldChanges(
      [
        { id: 'price', type: 'number', required: false },
      ],
      [
        { id: 'price', type: 'string', required: false },
      ],
    )).toBe(true)
  })
})

