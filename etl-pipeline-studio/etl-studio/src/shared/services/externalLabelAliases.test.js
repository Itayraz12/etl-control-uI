import { afterEach, describe, expect, it, vi } from 'vitest'

function buildState() {
  return {
    metadata: {
      productSource: 'ERP',
      productType: 'Catalog',
      productCode: 'P-42',
      location: 'OFFICE',
      team: 'data-platform',
      environment: 'production',
      entityName: 'Product',
    },
    source: {
      sourceType: 'kafka',
      format: 'JSON',
      kafkaTopic: 'catalog-source',
      kafkaOffset: 'earliest',
      kafkaKeys: '',
      streamingContinuity: 'continuous',
      recordsPerDay: 'millions',
    },
    upload: {
      schemaName: 'CatalogSchema',
      schema: [],
    },
    mappings: [
      {
        src: 'sku',
        tgt: 'sku',
        tgtMetadata: {
          sendToSaknay: true,
        },
      },
    ],
    filters: [],
    sink: {
      sinkType: 'kafka',
      sinkKafkaTopic: 'catalog-sink',
      sinkKafkaAdditionalPropertiesEnabled: false,
      sinkKafkaAdditionalProperties: [],
      shadow: true,
      shadowTopic: 'audit-shadow',
      saknay: true,
      saknayTopic: 'dog-topic',
      asg: true,
    },
  }
}

describe('external label YAML aliases', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('hydrates state from label-derived YAML keys', async () => {
    vi.stubEnv('VITE_PRODUCT_CODE_LABEL', 'Custom Param')
    vi.stubEnv('VITE_SHADOW_LABEL', 'Wolf')
    vi.stubEnv('VITE_ASG_LABEL', 'Bear')
    vi.stubEnv('VITE_SAKNAY_LABEL', 'Dog')
    vi.resetModules()

    const { hydrateWizardStateFromYaml } = await import('./configurationHydrator.js')

    const yaml = `metadata:
  genomeEntity: Product
  productSource: ERP
  productType: Catalog
  environment: production
  owner: data-platform
general:
  inputFormat: JSON
  outputFormat: JSON
  isWolfEnabled: true
  isDogEnabled: true
  isBearEnabled: false
source:
  kafka:
    topic: catalog-source
input:
  mapping:
    - name: sku
      type: string
output:
  mapping:
    - inName: sku
      outName: sku
      sendToDog: false
  kafka:
    topic: catalog-sink
    wolf_topic: audit-shadow
  saknay:
    customParam: "P-42"
    dog_topic: dog-topic
`

    const hydrated = hydrateWizardStateFromYaml(yaml, {
      productType: 'Catalog',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(hydrated.metadata.productCode).toBe('P-42')
    expect(hydrated.sink.shadow).toBe(true)
    expect(hydrated.sink.shadowTopic).toBe('audit-shadow')
    expect(hydrated.sink.saknay).toBe(true)
    expect(hydrated.sink.saknayTopic).toBe('dog-topic')
    expect(hydrated.sink.asg).toBe(false)
    expect(hydrated.mappings[0].tgtMetadata.sendToSaknay).toBe(false)
  })

  it('changes the pipeline signature when emitted YAML aliases change', async () => {
    vi.stubEnv('VITE_SAKNAY_LABEL', '')
    vi.resetModules()
    const { buildPipelineChangeSignature: buildDefaultSignature } = await import('./pipelineChangeDetection.js')
    const defaultSignature = buildDefaultSignature(buildState())

    vi.stubEnv('VITE_SAKNAY_LABEL', 'Dog')
    vi.resetModules()
    const { buildPipelineChangeSignature: buildDogSignature } = await import('./pipelineChangeDetection.js')
    const dogSignature = buildDogSignature(buildState())

    expect(dogSignature).not.toBe(defaultSignature)
  })
})



