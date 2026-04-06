import { describe, expect, it } from 'vitest'
import { buildSchemaByExampleUrl } from './configService.js'

describe('configService', () => {
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
})


