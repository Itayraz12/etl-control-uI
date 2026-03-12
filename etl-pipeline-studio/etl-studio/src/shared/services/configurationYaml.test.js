import { describe, expect, it } from 'vitest'
import { formatTransformationYamlItem, quoteYamlDoubleQuoted, formatInputFieldsYamlSection } from './configurationYaml.js'
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

  it('hydrates mappings from quoted transformation entries', () => {
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
mappings:
  - src: id
    tgt: name
    additional_inputs:
      - productName
      - price
transformations:
  - "ConvertMulti(logic: a:b:c?120|c:d:e?130, defaultValue: 0, case_sensitive: true)(string, id), (string, productName), (number, price) -> (string, name)"
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
      transformer: 'ConvertMulti',
      transformerProps: {
        logic: 'a:b:c?120|c:d:e?130',
        defaultValue: '0',
        case_sensitive: 'true',
      },
    })
    expect(state.mappings[0].extraInputs.map(input => input.field)).toEqual(['productName', 'price'])
  })

  it('serializes inputFields with source field names and types', () => {
    expect(formatInputFieldsYamlSection([
      { name: 'id', type: 'string' },
      { name: 'price', type: 'number' },
      { name: 'id', type: 'boolean' },
      { name: 'createdAt' },
      { name: '   ' },
    ])).toBe(`inputFields:
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
mappings:
  - src: id
    tgt: name
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

    expect(state.filters).toHaveLength(1)
    expect(state.filters[0]).toMatchObject({
      logic: 'AND',
      rules: [
        { field: 'id', op: 'f-2', value: '2' },
      ],
    })
  })
})
