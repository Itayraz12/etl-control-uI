import { describe, expect, it } from 'vitest'
import { buildConfigurationYamlUrl, buildSchemaByExampleUrl } from './configService.js'

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
})


