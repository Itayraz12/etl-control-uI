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
    vi.stubEnv('VITE_PRODUCT_CODE_LABEL', '')
    vi.stubEnv('VITE_METADATA_LOCATIONS', '')
    vi.stubEnv('VITE_SHADOW_LABEL', '')
    vi.stubEnv('VITE_ASG_LABEL', '')
    vi.stubEnv('VITE_SAKNAY_LABEL', '')

    const {
      API_BASE,
      APP_VERSION,
      PRODUCT_CODE_LABEL,
      METADATA_LOCATIONS,
      DEFAULT_METADATA_LOCATION,
      SHADOW_LABEL,
      ASG_LABEL,
      SAKNAY_LABEL,
      PRODUCT_CODE_YAML_KEY,
      SHADOW_YAML_FLAG_KEY,
      SHADOW_TOPIC_YAML_KEY,
      ASG_YAML_FLAG_KEY,
      SAKNAY_YAML_FLAG_KEY,
      SAKNAY_TOPIC_YAML_KEY,
      TARGET_SAKNAY_YAML_KEY,
    } = await loadFreshAppConfig()

    expect(API_BASE).toBe('http://localhost:8080/api')
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/)
    expect(PRODUCT_CODE_LABEL).toBe('Product Code')
    expect(METADATA_LOCATIONS).toEqual(['HOME', 'OFFICE'])
    expect(DEFAULT_METADATA_LOCATION).toBe('HOME')
    expect(SHADOW_LABEL).toBe('SHADOW')
    expect(ASG_LABEL).toBe('ASG')
    expect(SAKNAY_LABEL).toBe('Saknay')
    expect(PRODUCT_CODE_YAML_KEY).toBe('productCode')
    expect(SHADOW_YAML_FLAG_KEY).toBe('isShadowEnabled')
    expect(SHADOW_TOPIC_YAML_KEY).toBe('shadow_topic')
    expect(ASG_YAML_FLAG_KEY).toBe('isAsgEnabled')
    expect(SAKNAY_YAML_FLAG_KEY).toBe('isSaknayEnabled')
    expect(SAKNAY_TOPIC_YAML_KEY).toBe('saknay_topic')
    expect(TARGET_SAKNAY_YAML_KEY).toBe('sendToSaknay')
  })

  it('uses external env parameters for API base and version when provided', async () => {
    vi.stubEnv('VITE_API_BASE', 'https://example.internal/api/')
    vi.stubEnv('VITE_APP_VERSION', '9.9.9-rc.1')
    vi.stubEnv('VITE_PRODUCT_CODE_LABEL', 'External Param')
    vi.stubEnv('VITE_METADATA_LOCATIONS', 'remote, branch-office, remote')
    vi.stubEnv('VITE_SHADOW_LABEL', 'Shaldag')
    vi.stubEnv('VITE_ASG_LABEL', 'Asgard')
    vi.stubEnv('VITE_SAKNAY_LABEL', 'Golden Path')

    const {
      API_BASE,
      APP_VERSION,
      PRODUCT_CODE_LABEL,
      METADATA_LOCATIONS,
      DEFAULT_METADATA_LOCATION,
      SHADOW_LABEL,
      ASG_LABEL,
      SAKNAY_LABEL,
      PRODUCT_CODE_YAML_KEY,
      SHADOW_YAML_FLAG_KEY,
      SHADOW_TOPIC_YAML_KEY,
      ASG_YAML_FLAG_KEY,
      SAKNAY_YAML_FLAG_KEY,
      SAKNAY_TOPIC_YAML_KEY,
      TARGET_SAKNAY_YAML_KEY,
      APP_CONFIG,
    } = await loadFreshAppConfig()

    expect(API_BASE).toBe('https://example.internal/api')
    expect(APP_VERSION).toBe('9.9.9-rc.1')
    expect(PRODUCT_CODE_LABEL).toBe('External Param')
    expect(METADATA_LOCATIONS).toEqual(['REMOTE', 'BRANCH-OFFICE'])
    expect(DEFAULT_METADATA_LOCATION).toBe('REMOTE')
    expect(SHADOW_LABEL).toBe('Shaldag')
    expect(ASG_LABEL).toBe('Asgard')
    expect(SAKNAY_LABEL).toBe('Golden Path')
    expect(PRODUCT_CODE_YAML_KEY).toBe('externalParam')
    expect(SHADOW_YAML_FLAG_KEY).toBe('isShaldagEnabled')
    expect(SHADOW_TOPIC_YAML_KEY).toBe('shaldag_topic')
    expect(ASG_YAML_FLAG_KEY).toBe('isAsgardEnabled')
    expect(SAKNAY_YAML_FLAG_KEY).toBe('isGoldenPathEnabled')
    expect(SAKNAY_TOPIC_YAML_KEY).toBe('golden_path_topic')
    expect(TARGET_SAKNAY_YAML_KEY).toBe('sendToGoldenPath')
    expect(APP_CONFIG).toEqual({
      apiBase: 'https://example.internal/api',
      version: '9.9.9-rc.1',
      productCodeLabel: 'External Param',
      metadataLocations: ['REMOTE', 'BRANCH-OFFICE'],
      shadowLabel: 'Shaldag',
      asgLabel: 'Asgard',
      saknayLabel: 'Golden Path',
      saknaySectionKey: 'golden_path',
      yamlAliases: {
        productCode: 'externalParam',
        shadowFlag: 'isShaldagEnabled',
        shadowTopic: 'shaldag_topic',
        asgFlag: 'isAsgardEnabled',
        saknayFlag: 'isGoldenPathEnabled',
        saknayTopic: 'golden_path_topic',
        targetSaknayFlag: 'sendToGoldenPath',
      },
    })
  })
})

