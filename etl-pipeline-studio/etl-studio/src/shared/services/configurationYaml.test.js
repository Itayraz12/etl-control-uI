import { describe, expect, it } from 'vitest'
import { formatTransformationYamlItem, quoteYamlDoubleQuoted, formatInputFieldsYamlSection, formatKeyValueYamlSection } from './configurationYaml.js'
import { formatFilterYamlItem } from './configurationYaml.js'
import { hydrateWizardStateFromYaml } from './configurationHydrator.js'

describe('configuration YAML helpers', () => {
  it('wraps transformation expressions in double quotes and escapes embedded quotes', () => {
    const expression = 'ConvertMulti(logic: a:b:c?120|c:d:e?130, defaultValue: "0", case_sensitive: true)(string, id), (string, productName), (number, price) -> (string, name)'

    expect(formatTransformationYamlItem(expression)).toBe(
      '  - "ConvertMulti(logic: a:b:c?120|c:d:e?130, defaultValue: \\\"0\\\", case_sensitive: true)(string, id), (string, productName), (number, price) -> (string, name)"'
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
  type: kafka
  format: CSV
  topic: source_products_raw
schema:
  inputSchema: CustomerSchema
general:
  inputFormat: delimited
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
      additional_inputs:
        - productName
        - price
  transformations:
    - "ConvertMulti(logic: a:b:c?120|c:d:e?130, defaultValue: 0, case_sensitive: true)(string, id), (string, productName), (number, price) -> (string, name)"
  filters:
    - "(id f-2 2)"
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

  it('serializes Kafka additional properties as a YAML subsection', () => {
    expect(formatKeyValueYamlSection('additional_properties', [
      { id: '1', key: 'acks', value: 'all' },
      { id: '2', key: 'compression.type', value: 'gzip' },
      { id: '3', key: '   ', value: 'ignored' },
    ])).toBe(`  additional_properties:
    "acks": "all"
    "compression.type": "gzip"`)
  })

  it('hydrates filters from quoted YAML filter entries', () => {
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
})
