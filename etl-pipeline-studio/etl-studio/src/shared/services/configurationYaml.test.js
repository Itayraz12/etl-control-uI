import { describe, expect, it, vi } from 'vitest'
import { compactYamlDocument, formatTransformationYamlItem, quoteYamlDoubleQuoted, formatInputFieldsYamlSection, formatKeyValueYamlSection, formatFiltersYamlSection } from './configurationYaml.js'
import { formatFilterYamlItem } from './configurationYaml.js'
import { hydrateWizardStateFromYaml } from './configurationHydrator.js'

describe('configuration YAML helpers', () => {
  it('removes blank lines and trailing whitespace from YAML documents', () => {
    const yaml = `metadata:  

  productType: Catalog
    
source:
  kafka:
    topic: catalog-topic

`

    expect(compactYamlDocument(yaml)).toBe(`metadata:
  productType: Catalog
source:
  kafka:
    topic: catalog-topic`)
  })

  it('wraps transformation expressions in double quotes and escapes embedded quotes', () => {
    // New format: TransformerName([fields],[props]) -> (type, output)
    const expression = 'ConvertMulti([id,productName,price],[logic= a:b:c?120|c:d:e?130, defaultValue= "0", case_sensitive= true]) -> (string, name)'

    expect(formatTransformationYamlItem(expression)).toBe(
      '  - "ConvertMulti([id,productName,price],[logic= a:b:c?120|c:d:e?130, defaultValue= \\"0\\", case_sensitive= true]) -> (string, name)"'
    )
    expect(quoteYamlDoubleQuoted('A \\ B')).toBe('"A \\\\ B"')
  })

  it('hydrates mapping from quoted transformation entries that use = separators', () => {
    const yaml = `metadata:
  entity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
source:
  kafka:
    topic: source_products_raw
schema:
  inputSchema: CustomerSchema
general:
  format: CSV
input:
  delimited:
    columnDelimiter: ";"
    mapping:
      - name: id
        type: string
      - name: productName
        type: string
      - name: price
        type: number
output:
  mapping:
    - inName: id
      outName: name
      sendToGP: true
      sendToSaknay: false
      expression: trim(name)
      additionalInputs:
        - productName
        - price
  transformations:
    - "ConvertMulti(logic= a:b:c?120|c:d:e?130, defaultValue= 0, case_sensitive= true)(string, id), (string, productName), (number, price) -> (string, name)"
  filters:
    - "(id f-2 2)"
  kafka:
    topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.mappings).toHaveLength(1)
    expect(state.mappings[0]).toMatchObject({
      src: 'id',
      tgt: 'name',
      tgtMetadata: {
        sendToSaknay: false,
        expression: 'trim(name)',
      },
      transformer: 'ConvertMulti',
      transformerProps: {
        logic: 'a:b:c?120|c:d:e?130',
        defaultValue: '0',
        case_sensitive: 'true',
      },
    })
    expect(state.source).toMatchObject({
      format: 'CSV',
      csvDelimiter: ';',
    })
    expect(state.upload).toMatchObject({
      schemaName: 'CustomerSchema',
    })
    expect(state.upload.schema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'id', type: 'string' }),
        expect.objectContaining({ id: 'productName', type: 'string' }),
        expect.objectContaining({ id: 'price', type: 'number' }),
      ])
    )
    expect(state.filters).toHaveLength(1)
    expect(state.mappings[0].extraInputs.map(input => input.field)).toEqual(['productName', 'price'])
  })

  it('hydrates mapping from new-format transformation entries', () => {
    const yaml = `metadata:
  entity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
source:
  kafka:
    topic: source_products_raw
schema:
  inputSchema: CustomerSchema
general:
  format: CSV
input:
  delimited:
    columnDelimiter: ";"
    mapping:
      - name: id
        type: string
      - name: productName
        type: string
      - name: price
        type: number
output:
  mapping:
    - inName: id
      outName: name
      sendToGP: true
      sendToSaknay: false
      expression: trim(name)
  transformations:
    - "ConvertMulti([id,productName,price],[logic= a:b:c?120|c:d:e?130, defaultValue= 0, case_sensitive= true]) -> (string, name)"
  filters:
    - "(id f-2 2)"
  kafka:
    topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.mappings).toHaveLength(1)
    expect(state.mappings[0]).toMatchObject({
      src: 'id',
      tgt: 'name',
      tgtMetadata: {
        sendToSaknay: false,
        expression: 'trim(name)',
      },
      transformer: 'ConvertMulti',
      transformerProps: {
        logic: 'a:b:c?120|c:d:e?130',
        defaultValue: '0',
        case_sensitive: 'true',
      },
    })
    expect(state.mappings[0].extraInputs.map(input => input.field)).toEqual(['productName', 'price'])
    expect(state.filters).toHaveLength(1)
  })

  it('does not parse colon-separated transformer props in the new format', () => {
    const yaml = `metadata:
  entity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
source:
  kafka:
    topic: source_products_raw
schema:
  inputSchema: CustomerSchema
general:
  format: CSV
input:
  delimited:
    columnDelimiter: ";"
    mapping:
      - name: id
        type: string
      - name: productName
        type: string
      - name: price
        type: number
output:
  mapping:
    - inName: id
      outName: name
      sendToGP: true
      sendToSaknay: false
  transformations:
    - "ConvertMulti([id,productName,price],[logic: a:b:c?120|c:d:e?130, defaultValue: 0, case_sensitive: true]) -> (string, name)"
  kafka:
    topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.mappings[0]).toMatchObject({
      transformer: 'ConvertMulti',
      transformerProps: {},
    })
  })


  it('hydrates source format from general.outputFormat when inputFormat is absent', () => {
    const yaml = `metadata:
  entity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
source:
  type: kafka
  format: JSON
  topic: source_products_raw
general:
  outputFormat: delimited
input:
  delimited:
    columnDelimiter: ";"
  mapping:
    - name: id
      type: string
output:
  mapping:
    - inName: id
      outName: name
  kafka:
    topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.source).toMatchObject({
      format: 'CSV',
      csvDelimiter: ';',
    })
  })

  it('hydrates source format from general.inputFormat and outputFormat', () => {
    const yaml = `metadata:
  entity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
source:
  kafka:
    topic: source_products_raw
general:
  inputFormat: JSON
  outputFormat: JSON
input:
  convert:
    mapping:
      - name: id
        type: string
output:
  mapping:
    - inName: id
      outName: name
  kafka:
    topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.source).toMatchObject({
      format: 'JSON',
    })
  })

  it('hydrates source format from canonical delimited input/output format values', () => {
    const yaml = `metadata:
  entity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
source:
  kafka:
    topic: source_products_raw
general:
  inputFormat: delimited
  outputFormat: delimited
input:
  delimited:
    columnDelimiter: ";"
    mapping:
      - name: id
        type: string
output:
  mapping:
    - inName: id
      outName: name
  kafka:
    topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.source).toMatchObject({
      format: 'CSV',
      csvDelimiter: ';',
    })
  })

  it('hydrates nested kafka source settings and general format', () => {
    const yaml = `metadata:
  entity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
source:
  kafka:
    topic: source_products_raw
    offset: latest
    filter: "user-001, order-456"
general:
  format: JSON
input:
  convert:
    splitByPath: "$.items"
    mapping:
      - name: id
        type: string
output:
  mapping:
    - inName: id
      outName: name
sink:
  type: kafka
  topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.source).toMatchObject({
      sourceType: 'kafka',
      format: 'JSON',
      kafkaTopic: 'source_products_raw',
      kafkaOffset: 'latest',
      kafkaKeys: 'user-001, order-456',
      jsonSplit: '$.items',
    })
  })

  it('hydrates nested RabbitMQ source settings and general format', () => {
    const yaml = `metadata:
  entity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
source:
  rabbitmq:
    ip: 10.0.0.12
    port: 5672
    username: guest
    password: secret
    queue: products.ingest
    vhost: /etl
general:
  inputFormat: JSON
  outputFormat: JSON
input:
  convert:
    mapping:
      - name: id
        type: string
output:
  mapping:
    - inName: id
      outName: name
sink:
  type: kafka
  topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.source).toMatchObject({
      sourceType: 'rabbitmq',
      rmqIp: '10.0.0.12',
      rmqPort: '5672',
      rmqUsername: 'guest',
      rmqPassword: 'secret',
      rmqQueue: 'products.ingest',
      rmqVhost: '/etl',
      format: 'JSON',
    })
  })

  it('hydrates sink enablement flags from general is*Enabled keys', () => {
    const yaml = `metadata:
  entity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
source:
  kafka:
    topic: source_products_raw
general:
  format: JSON
  isShadowEnabled: true
  isSaknayEnabled: true
  isAsgEnabled: true
input:
  convert:
    mapping:
      - name: id
        type: string
output:
  mapping:
    - inName: id
      outName: name
  kafka:
    topic: etl_products_v3
    shadow_topic: auto
    saknay_topic: auto
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.sink).toMatchObject({
      shadow: true,
      saknay: true,
      asg: true,
      shadowTopic: '',
      saknayTopic: '',
    })
  })

  it('prefers explicit false general is*Enabled keys over legacy sink flags', () => {
    const yaml = `metadata:
  entity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
source:
  kafka:
    topic: source_products_raw
general:
  format: JSON
  isShadowEnabled: false
  isSaknayEnabled: false
  isAsgEnabled: false
input:
  convert:
    mapping:
      - name: id
        type: string
output:
  mapping:
    - inName: id
      outName: name
sink:
  type: kafka
  topic: etl_products_v3
  shadow: true
  saknay: true
  asg: true
  shadow_topic: auto
  saknay_topic: auto
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.sink).toMatchObject({
      shadow: false,
      saknay: false,
      asg: false,
      shadowTopic: '',
      saknayTopic: '',
    })
  })

  it('hydrates productCode and saknayTopic from the new output.saknay section', () => {
    const yaml = `metadata:
  genomeEntity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
general:
  inputFormat: JSON
  outputFormat: JSON
  isSaknayEnabled: true
source:
  kafka:
    topic: source_products_raw
input:
  convert:
    mapping:
      - name: id
        type: string
output:
  mapping:
    - inName: id
      outName: name
      sendToSaknay: true
  kafka:
    topic: etl_products_v3
  saknay:
    productCode: "PC-42"
    saknay_topic: dog-topic
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.metadata.productCode).toBe('PC-42')
    expect(state.sink.saknay).toBe(true)
    expect(state.sink.saknayTopic).toBe('dog-topic')
  })

  it('hydrates productCode and saknayTopic from an env-driven Saknay output section', async () => {
    vi.stubEnv('VITE_SAKNAY_LABEL', 'Dog')
    vi.resetModules()

    const { hydrateWizardStateFromYaml: hydrateWithDogLabel } = await import('./configurationHydrator.js')

    const yaml = `metadata:
  genomeEntity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
general:
  inputFormat: JSON
  outputFormat: JSON
  isDogEnabled: true
source:
  kafka:
    topic: source_products_raw
input:
  convert:
    mapping:
      - name: id
        type: string
output:
  mapping:
    - inName: id
      outName: name
      sendToDog: true
  kafka:
    topic: etl_products_v3
  dog:
    productCode: "PC-99"
    dog_topic: wolf-topic
`

    const state = hydrateWithDogLabel(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.metadata.productCode).toBe('PC-99')
    expect(state.sink.saknay).toBe(true)
    expect(state.sink.saknayTopic).toBe('wolf-topic')
  })

  it('hydrates canonical genomeEntity metadata key', () => {
    const yaml = `metadata:
  genomeEntity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
source:
  type: kafka
  format: JSON
  topic: source_products_raw
input:
  mapping:
    - name: id
      type: string
output:
  mapping:
    - inName: id
      outName: name
sink:
  type: kafka
  topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.metadata).toMatchObject({
      entityName: 'Product',
    })
  })

  it('hydrates CSV row delimiter from general.split.delimiter', () => {
    const yaml = `metadata:
  entity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
source:
  kafka:
    topic: source_products_raw
general:
  format: CSV
  split:
    delimiter: "\\r\\n"
input:
  delimited:
    columnDelimiter: ";"
    mapping:
      - name: id
        type: string
output:
  mapping:
    - inName: id
      outName: name
sink:
  type: kafka
  topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.source).toMatchObject({
      format: 'CSV',
      csvDelimiter: ';',
      rowDelimiter: '\r\n',
    })
  })

  it('hydrates kafka source offset from YAML', () => {
    const yaml = `metadata:
  entity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
source:
  type: kafka
  format: JSON
  topic: source_products_raw
  offset: latest
input:
  mapping:
    - name: id
      type: string
output:
  mapping:
    - inName: id
      outName: name
sink:
  type: kafka
  topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.source).toMatchObject({
      kafkaOffset: 'latest',
      kafkaTopic: 'source_products_raw',
    })
  })

  it('hydrates kafka key filter from canonical filter YAML key', () => {
    const yaml = `metadata:
  entity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
source:
  type: kafka
  format: JSON
  topic: source_products_raw
  offset: earliest
  filter: "user-001, order-456"
input:
  mapping:
    - name: id
      type: string
output:
  mapping:
    - inName: id
      outName: name
sink:
  type: kafka
  topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.source).toMatchObject({
      kafkaKeys: 'user-001, order-456',
      kafkaOffset: 'earliest',
    })
  })

  it('hydrates kafka key filter from legacy keyFilter YAML key', () => {
    const yaml = `metadata:
  entity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
source:
  type: kafka
  format: JSON
  topic: source_products_raw
  offset: earliest
  keyFilter: "user-001, order-456"
input:
  mapping:
    - name: id
      type: string
output:
  mapping:
    - inName: id
      outName: name
sink:
  type: kafka
  topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.source).toMatchObject({
      kafkaKeys: 'user-001, order-456',
      kafkaOffset: 'earliest',
    })
  })

  it('hydrates kafka key filter from array alias YAML keys', () => {
    const yaml = `metadata:
  entity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
source:
  type: kafka
  format: JSON
  topic: source_products_raw
  offset: earliest
  keys:
    - user-001
    - order-456
input:
  mapping:
    - name: id
      type: string
output:
  mapping:
    - inName: id
      outName: name
sink:
  type: kafka
  topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.source).toMatchObject({
      kafkaKeys: 'user-001, order-456',
    })
  })

  it('hydrates legacy snake_case metadata keys', () => {
    const yaml = `metadata:
  entity: Product
  product_source: ERP
  product_type: Inventory
  environment: production
  team: data-platform
source:
  type: kafka
  format: JSON
  topic: source_products_raw
input:
  mapping:
    - name: id
      type: string
output:
  mapping:
    - inName: id
      outName: name
      tgt_expression: trim(name)
sink:
  type: kafka
  topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.mappings[0]).toMatchObject({
      src: 'id',
      tgt: 'name',
      tgtMetadata: {
        expression: 'trim(name)',
      },
    })
    expect(state.metadata).toMatchObject({
      productSource: 'ERP',
      productType: 'Inventory',
    })
  })

  it('hydrates camelCase dataStreamInfo metadata keys', () => {
    const yaml = `metadata:
  entity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
  dataStreamInfo:
    streamingContinuity: batch
    avgRecordsAmount: thousands
source:
  type: kafka
  format: JSON
  topic: source_products_raw
input:
  mapping:
    - name: id
      type: string
output:
  mapping:
    - inName: id
      outName: name
sink:
  type: kafka
  topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.source).toMatchObject({
      streamingContinuity: 'batch',
      recordsPerDay: 'thousands',
    })
  })

  it('keeps production location empty when YAML does not specify it', () => {
    const yaml = `metadata:
  entity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
source:
  type: kafka
  format: JSON
  topic: source_products_raw
input:
  mapping:
    - name: id
      type: string
output:
  mapping:
    - inName: id
      outName: name
sink:
  type: kafka
  topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.metadata).toMatchObject({
      environment: 'PROD',
      location: '',
    })
  })

  it('preserves explicit OFFICE location for production YAML', () => {
    const yaml = `metadata:
  entity: Product
  productSource: ERP
  productType: Inventory
  location: OFFICE
  environment: production
  owner: data-platform
source:
  type: kafka
  format: JSON
  topic: source_products_raw
input:
  mapping:
    - name: id
      type: string
output:
  mapping:
    - inName: id
      outName: name
sink:
  type: kafka
  topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.metadata).toMatchObject({
      environment: 'PROD',
      location: 'OFFICE',
    })
  })

  it('forces non-production YAML location to HOME', () => {
    const yaml = `metadata:
  entity: Product
  productSource: ERP
  productType: Inventory
  location: OFFICE
  environment: staging
  owner: data-platform
source:
  type: kafka
  format: JSON
  topic: source_products_raw
input:
  mapping:
    - name: id
      type: string
output:
  mapping:
    - inName: id
      outName: name
sink:
  type: kafka
  topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'staging',
    })

    expect(state.metadata).toMatchObject({
      environment: 'CAP',
      location: 'HOME',
    })
  })

  it('hydrates legacy snake_case additional_inputs mapping keys', () => {
    const yaml = `metadata:
  entity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
source:
  type: kafka
  format: JSON
  topic: source_products_raw
input:
  mapping:
    - name: id
      type: string
    - name: price
      type: number
    - name: quantity
      type: number
output:
  mapping:
    - inName: id
      outName: name
      additional_inputs:
        - price
        - quantity
sink:
  type: kafka
  topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.mappings[0].extraInputs.map(input => input.field)).toEqual(['price', 'quantity'])
  })

  it('hydrates legacy snake_case stream info keys', () => {
    const yaml = `metadata:
  entity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
  dataStreamInfo:
    streaming_continuity: batch
    avg_records_amount: thousands
source:
  type: kafka
  format: JSON
  topic: source_products_raw
input:
  mapping:
    - name: id
      type: string
output:
  mapping:
    - inName: id
      outName: name
sink:
  type: kafka
  topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.source).toMatchObject({
      streamingContinuity: 'batch',
      recordsPerDay: 'thousands',
    })
  })

  it('serializes inputFields with source field names and types', () => {
    expect(formatInputFieldsYamlSection([
      { name: 'id', type: 'string' },
      { name: 'price', type: 'number' },
      { name: 'id', type: 'boolean' },
      { name: 'createdAt' },
      { name: '   ' },
    ])).toBe(`  mapping:
    - name: id
      type: string
    - name: price
      type: number
    - name: createdAt
      type: unknown`)
  })

  it('serializes filter expressions as double-quoted YAML items', () => {
    expect(formatFilterYamlItem('(id f-2 2)')).toBe('  - "(id f-2 2)"')
  })

  it('serializes filters into dependencies and config sections', () => {
    expect(formatFiltersYamlSection([
      {
        id: 'group-1',
        logic: 'AND',
        mode: 'exclude',
        rules: [
          { id: 'rule-1', field: 'productName', op: 'eq', value: 'john, unknown' },
        ],
        subgroups: [],
      },
      {
        id: 'group-2',
        logic: 'AND',
        mode: 'include',
        rules: [
          { id: 'rule-2', field: 'price', op: 'eq', value: '100' },
          { id: 'rule-3', field: 'price', op: 'eq', value: '200' },
        ],
        subgroups: [],
      },
    ])).toBe(`filters:
  dependencies:
    - type: EQ
  config:
    - rule:
        and:
          - field: productName
            isReverted: false
            mode: exclude
            type: EQ
            values:
              - john
              - unknown
    - rule:
        and:
          - field: price
            isReverted: false
            type: EQ
            values:
              - "100"
              - "200"`)
  })

  it('serializes filters with multiple operators using explicit per-rule type fields', () => {
    expect(formatFiltersYamlSection([
      {
        id: 'group-1',
        logic: 'AND',
        mode: 'include',
        rules: [
          { id: 'rule-1', field: 'productName', op: 'eq', value: 'john, unknown' },
          { id: 'rule-2', field: 'price', op: 'gt', value: '100, 200' },
        ],
        subgroups: [],
      },
    ])).toBe(`filters:
  dependencies:
    - type: EQ
    - type: GT
  config:
    - rule:
        and:
          - field: productName
            isReverted: false
            type: EQ
            values:
              - john
              - unknown
          - field: price
            isReverted: false
            type: GT
            values:
              - "100"
              - "200"`)
  })

  it('does not serialize group-level isRevertible in the structured filters YAML', () => {
    expect(formatFiltersYamlSection([
      {
        id: 'group-1',
        logic: 'AND',
        mode: 'include',
        isRevertible: false,
        rules: [
          { id: 'rule-1', field: 'productName', op: 'eq', value: 'john' },
        ],
        subgroups: [],
      },
    ])).toBe(`filters:
  dependencies:
    - type: EQ
  config:
    - rule:
        and:
          - field: productName
            isReverted: false
            type: EQ
            values:
              - john`)
  })

  it('does not serialize condition isRevertible even when operator metadata provides it', () => {
    expect(formatFiltersYamlSection([
      {
        id: 'group-1',
        logic: 'AND',
        mode: 'include',
        rules: [
          { id: 'rule-1', field: 'price', op: 'smaller', value: '10' },
        ],
        subgroups: [],
      },
    ], [
      { id: 'smaller', name: 'Smaller', isRevertible: false },
    ])).toBe(`filters:
  dependencies:
    - type: SMALLER
  config:
    - rule:
        and:
          - field: price
            isReverted: false
            type: SMALLER
            values:
              - "10"`)
  })

  it('serializes reverted filters with isReverted=true and keeps the base type', () => {
    expect(formatFiltersYamlSection([
      {
        id: 'group-1',
        logic: 'AND',
        mode: 'include',
        rules: [
          { id: 'rule-1', field: 'sku', op: 'eq', isReverted: true, value: 'ABC-123' },
        ],
        subgroups: [],
      },
    ])).toBe(`filters:
  dependencies:
    - type: EQ
  config:
    - rule:
        and:
          - field: sku
            isReverted: true
            type: EQ
            values:
              - ABC-123`)
  })

  it('serializes Kafka additional properties as root additionalConfig', () => {
    expect(formatKeyValueYamlSection('additionalConfig', [
      { id: '1', key: 'acks', value: 'all' },
      { id: '2', key: 'compression.type', value: 'gzip' },
      { id: '3', key: '   ', value: 'ignored' },
    ], '')).toBe(`additionalConfig:
  "acks": "all"
  "compression.type": "gzip"`)
  })

  it('hydrates filters and root additionalConfig from YAML', () => {
    const yaml = `metadata:
  entity: Product
  product_source: ERP
  product_type: Inventory
  environment: production
  team: data-platform
source:
  type: kafka
  format: JSON
  topic: source_products_raw
mapping:
  - inName: id
    outName: name
filters:
  - "(id f-2 2)"
additionalConfig:
  "acks": "all"
  "compression.type": "gzip"
output:
  kafka:
    topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.filters).toHaveLength(1)
    expect(state.filters[0]).toMatchObject({
      logic: 'AND',
      mode: 'include',
      isRevertible: true,
      rules: [
        { field: 'id', op: 'f-2', isReverted: false, value: '2' },
      ],
    })
    expect(state.sink.sinkKafkaAdditionalProperties).toEqual([
      { id: 'sink-kafka-prop-0', key: 'acks', value: 'all' },
      { id: 'sink-kafka-prop-1', key: 'compression.type', value: 'gzip' },
    ])
  })

  it('hydrates structured filters dependencies/config YAML', () => {
    const yaml = `metadata:
  entity: Product
  product_source: ERP
  product_type: Inventory
  environment: production
  team: data-platform
source:
  type: kafka
  format: JSON
  topic: source_products_raw
mapping:
  - inName: id
    outName: name
filters:
  dependencies:
    - type: EQ
  config:
    - rule:
        and:
          - field: productName
            mode: exclude
            type: EQ
            values:
              - john
              - unknown
    - rule:
        and:
          - field: price
            type: EQ
            values:
              - "100"
              - "200"
additionalConfig:
  "acks": "all"
output:
  kafka:
    topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.filters).toEqual([
      {
        id: 'group-0',
        logic: 'AND',
        mode: 'exclude',
        isRevertible: true,
        rules: [
          { id: 'group-0-rule-0-0', field: 'productName', op: 'eq', isReverted: false, value: 'john' },
          { id: 'group-0-rule-0-1', field: 'productName', op: 'eq', isReverted: false, value: 'unknown' },
        ],
        subgroups: [],
      },
      {
        id: 'group-1',
        logic: 'AND',
        mode: 'include',
        isRevertible: true,
        rules: [
          { id: 'group-1-rule-0-0', field: 'price', op: 'eq', isReverted: false, value: '100' },
          { id: 'group-1-rule-0-1', field: 'price', op: 'eq', isReverted: false, value: '200' },
        ],
        subgroups: [],
      },
    ])
  })

  it('hydrates structured filters that use explicit type fields', () => {
    const yaml = `metadata:
  entity: Product
  product_source: ERP
  product_type: Inventory
  environment: production
  team: data-platform
source:
  type: kafka
  format: JSON
  topic: source_products_raw
mapping:
  - inName: id
    outName: name
filters:
  dependencies:
    - type: EQ
    - type: GT
  config:
    - rule:
        and:
          - field: productName
            type: EQ
            values:
              - john
              - unknown
          - field: price
            type: GT
            values:
              - "100"
              - "200"
output:
  kafka:
    topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.filters).toEqual([
      {
        id: 'group-0',
        logic: 'AND',
        mode: 'include',
        isRevertible: true,
        rules: [
          { id: 'group-0-rule-0-0', field: 'productName', op: 'eq', isReverted: false, value: 'john' },
          { id: 'group-0-rule-0-1', field: 'productName', op: 'eq', isReverted: false, value: 'unknown' },
          { id: 'group-0-rule-1-0', field: 'price', op: 'gt', isReverted: false, value: '100' },
          { id: 'group-0-rule-1-1', field: 'price', op: 'gt', isReverted: false, value: '200' },
        ],
        subgroups: [],
      },
    ])
  })

  it('hydrates structured filters with isRevertible=false', () => {
    const yaml = `metadata:
  entity: Product
  product_source: ERP
  product_type: Inventory
  environment: production
  team: data-platform
source:
  type: kafka
  format: JSON
  topic: source_products_raw
mapping:
  - inName: id
    outName: name
filters:
  dependencies:
    - type: EQ
  config:
    - rule:
        and:
          - field: productName
            isRevertible: false
            type: EQ
            values:
              - john
output:
  kafka:
    topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.filters).toEqual([
      {
        id: 'group-0',
        logic: 'AND',
        mode: 'include',
        isRevertible: false,
        rules: [
          { id: 'group-0-rule-0-0', field: 'productName', op: 'eq', isReverted: false, value: 'john' },
        ],
        subgroups: [],
      },
    ])
  })

  it('keeps supporting legacy rule-level isRevertible in structured filters YAML', () => {
    const yaml = `metadata:
  entity: Product
  product_source: ERP
  product_type: Inventory
  environment: production
  team: data-platform
source:
  type: kafka
  format: JSON
  topic: source_products_raw
mapping:
  - inName: id
    outName: name
filters:
  dependencies:
    - type: EQ
  config:
    - rule:
        isRevertible: false
        and:
          - field: productName
            op: EQ
            values:
              - john
output:
  kafka:
    topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.filters).toEqual([
      {
        id: 'group-0',
        logic: 'AND',
        mode: 'include',
        isRevertible: false,
        rules: [
          { id: 'group-0-rule-0-0', field: 'productName', op: 'eq', isReverted: false, value: 'john' },
        ],
        subgroups: [],
      },
    ])
  })

  it('keeps hydrating legacy condition-level isRevertible=false from older YAML', () => {
    const state = hydrateWizardStateFromYaml(`metadata:
  entity: Product
  product_source: ERP
  product_type: Inventory
  environment: production
  team: data-platform
source:
  type: kafka
  format: JSON
  topic: source_products_raw
mapping:
  - inName: id
    outName: name
filters:
  dependencies:
    - type: EQ
  config:
    - rule:
        and:
          - field: productName
            isRevertible: false
            isReverted: false
            type: EQ
            values:
              - john
output:
  kafka:
    topic: etl_products_v3
`, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.filters).toEqual([
      {
        id: 'group-0',
        logic: 'AND',
        mode: 'include',
        isRevertible: false,
        rules: [
          { id: 'group-0-rule-0-0', field: 'productName', op: 'eq', isReverted: false, value: 'john' },
        ],
        subgroups: [],
      },
    ])
  })

  it('hydrates structured filters with condition-level isReverted=true', () => {
    const yaml = `metadata:
  entity: Product
  product_source: ERP
  product_type: Inventory
  environment: production
  team: data-platform
source:
  type: kafka
  format: JSON
  topic: source_products_raw
mapping:
  - inName: id
    outName: name
filters:
  dependencies:
    - type: EQ
  config:
    - rule:
        and:
          - field: sku
            isRevertible: true
            isReverted: true
            type: EQ
            values:
              - ABC-123
output:
  kafka:
    topic: etl_products_v3
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.filters).toEqual([
      {
        id: 'group-0',
        logic: 'AND',
        mode: 'include',
        isRevertible: true,
        rules: [
          { id: 'group-0-rule-0-0', field: 'sku', op: 'eq', isReverted: true, value: 'ABC-123' },
        ],
        subgroups: [],
      },
    ])
  })

  it('hydrates legacy sink additional_properties when root additionalConfig is absent', () => {
    const yaml = `metadata:
  entity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
source:
  type: kafka
  format: JSON
  topic: source_products_raw
input:
  mapping:
    - name: id
      type: string
output:
  mapping:
    - inName: id
      outName: name
sink:
  type: kafka
  topic: etl_products_v3
  additional_properties:
    "acks": "all"
    "compression.type": "gzip"
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.sink.sinkKafkaAdditionalProperties).toEqual([
      { id: 'sink-kafka-prop-0', key: 'acks', value: 'all' },
      { id: 'sink-kafka-prop-1', key: 'compression.type', value: 'gzip' },
    ])
  })

  it('hydrates legacy sink shadow, saknay, and asg flags when general flags are absent', () => {
    const yaml = `metadata:
  entity: Product
  productSource: ERP
  productType: Inventory
  environment: production
  owner: data-platform
source:
  type: kafka
  format: JSON
  topic: source_products_raw
input:
  mapping:
    - name: id
      type: string
output:
  mapping:
    - inName: id
      outName: name
sink:
  type: kafka
  topic: etl_products_v3
  shadow: true
  shadow_topic: auto
  saknay: true
  saknay_topic: auto
  asg: true
`

    const state = hydrateWizardStateFromYaml(yaml, {
      productType: 'Inventory',
      source: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    })

    expect(state.sink).toMatchObject({
      shadow: true,
      saknay: true,
      asg: true,
      shadowTopic: '',
      saknayTopic: '',
    })
  })
})
