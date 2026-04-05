import { describe, expect, it } from 'vitest'
import { compactYamlDocument, formatTransformationYamlItem, quoteYamlDoubleQuoted, formatInputFieldsYamlSection, formatKeyValueYamlSection } from './configurationYaml.js'
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
    const expression = 'ConvertMulti([id,productName,price],[logic: a:b:c?120|c:d:e?130, defaultValue: "0", case_sensitive: true]) -> (string, name)'

    expect(formatTransformationYamlItem(expression)).toBe(
      '  - "ConvertMulti([id,productName,price],[logic: a:b:c?120|c:d:e?130, defaultValue: \\"0\\", case_sensitive: true]) -> (string, name)"'
    )
    expect(quoteYamlDoubleQuoted('A \\ B')).toBe('"A \\\\ B"')
  })

  it('hydrates mapping from quoted transformation entries', () => {
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
    - "ConvertMulti(logic: a:b:c?120|c:d:e?130, defaultValue: 0, case_sensitive: true)(string, id), (string, productName), (number, price) -> (string, name)"
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
    - "ConvertMulti([id,productName,price],[logic: a:b:c?120|c:d:e?130, defaultValue: 0, case_sensitive: true]) -> (string, name)"
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
      environment: 'production',
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
      environment: 'production',
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
      environment: 'staging',
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
      rules: [
        { field: 'id', op: 'f-2', value: '2' },
      ],
    })
    expect(state.sink.sinkKafkaAdditionalProperties).toEqual([
      { id: 'sink-kafka-prop-0', key: 'acks', value: 'all' },
      { id: 'sink-kafka-prop-1', key: 'compression.type', value: 'gzip' },
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
