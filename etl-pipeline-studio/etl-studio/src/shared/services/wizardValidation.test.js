import { describe, expect, it } from 'vitest'
import { canNavigateToWizardStep, canDeployFromSummaryChecklist, getFieldMappingValidation, getFilterValidation, getSummaryFailingStepIndexes, getSummaryValidations, isWizardStepValid } from './wizardValidation.js'

const transformers = [
  {
    _id: 'tf-required',
    name: 'RequiredTransformer',
    propsSchema: [
      { key: 'logic', label: 'Logic', required: true },
    ],
  },
  {
    _id: 'tf-none',
    name: 'Constant',
    inputType: 'NONE',
    propsSchema: [
      { key: 'value', label: 'Value', required: true },
    ],
  },
]

function buildState(overrides = {}) {
  const baseState = {
    currentStep: 1,
    completedSteps: new Set(),
    metadata: {
      productSource: 'ERP',
      productType: 'Inventory',
      location: 'OFFICE',
      environment: 'production',
      team: 'data-platform',
      entityName: 'Product',
    },
    source: {
      sourceType: 'kafka',
      kafkaEnv: 'production',
      kafkaTopic: 'source_products_raw',
      kafkaOffset: 'earliest',
      format: 'JSON',
      streamingContinuity: 'continuous',
      recordsPerDay: 'millions',
    },
    upload: {
      done: false,
      schema: [],
      fileName: '',
    },
    mappings: [],
    targetSchema: [],
    sink: {
      sinkType: '',
      sinkKafkaEnv: 'production',
    },
  }

  return {
    ...baseState,
    ...overrides,
    metadata: {
      ...baseState.metadata,
      ...(overrides.metadata || {}),
    },
    source: {
      ...baseState.source,
      ...(overrides.source || {}),
    },
    upload: {
      ...baseState.upload,
      ...(overrides.upload || {}),
    },
    sink: {
      ...baseState.sink,
      ...(overrides.sink || {}),
    },
  }
}

describe('canNavigateToWizardStep', () => {
  it('allows already visited or current steps', () => {
    const state = buildState({ currentStep: 3 })

    expect(canNavigateToWizardStep(0, state)).toBe(true)
    expect(canNavigateToWizardStep(3, state)).toBe(true)
  })

  it('allows only the immediate next step when the current step is valid', () => {
    const state = buildState({
      currentStep: 1,
      source: {
        sourceType: 'kafka',
        kafkaEnv: 'production',
        kafkaTopic: 'source_products_raw',
        kafkaOffset: 'latest',
      },
    })

    expect(canNavigateToWizardStep(2, state)).toBe(true)
    expect(canNavigateToWizardStep(3, state)).toBe(false)
  })

  it('blocks the immediate next step when the current step is invalid', () => {
    const state = buildState({
      currentStep: 1,
      source: { sourceType: '' },
    })

    expect(canNavigateToWizardStep(2, state)).toBe(false)
  })

  it('treats kafka source config as invalid when offset is missing', () => {
    const state = buildState({
      currentStep: 1,
      source: {
        sourceType: 'kafka',
        kafkaEnv: 'production',
        kafkaTopic: 'source_products_raw',
        kafkaOffset: '',
      },
    })

    expect(isWizardStepValid(1, state)).toBe(false)
    expect(canNavigateToWizardStep(2, state)).toBe(false)
  })

  it('treats metadata as invalid when required metadata properties are missing', () => {
    const state = buildState({
      metadata: {
        productSource: 'ERP',
        productType: '',
        environment: 'production',
        entityName: '',
        team: '',
        location: '',
      },
    })

    expect(isWizardStepValid(0, state)).toBe(false)

    const metadataValidation = getSummaryValidations(state, undefined, transformers).find(item => item.key === 'metadataConfigured')

    expect(metadataValidation.type).toBe('err')
    expect(metadataValidation.text).toContain('product type')
    expect(metadataValidation.text).toContain('team')
    expect(metadataValidation.text).toContain('location')
    expect(metadataValidation.text).toContain('entity name')
  })

  it('treats source config as invalid when required source properties are missing', () => {
    const state = buildState({
      source: {
        sourceType: 'kafka',
        kafkaEnv: 'production',
        kafkaTopic: '',
        kafkaOffset: '',
        format: '',
        streamingContinuity: 'continuous',
        recordsPerDay: 'millions',
      },
    })

    expect(isWizardStepValid(1, state)).toBe(false)

    const sourceValidation = getSummaryValidations(state, undefined, transformers).find(item => item.key === 'sourceConfigured')

    expect(sourceValidation.type).toBe('err')
    expect(sourceValidation.text).toContain('message / file format')
    expect(sourceValidation.text).toContain('topic')
    expect(sourceValidation.text).toContain('offset')
  })

  it('treats CSV source config as invalid when the column delimiter is missing', () => {
    const state = buildState({
      source: {
        sourceType: 'kafka',
        kafkaEnv: 'production',
        kafkaTopic: 'source_products_raw',
        kafkaOffset: 'earliest',
        format: 'CSV',
        csvDelimiter: '',
      },
    })

    expect(isWizardStepValid(1, state)).toBe(false)

    const sourceValidation = getSummaryValidations(state, undefined, transformers).find(item => item.key === 'sourceConfigured')

    expect(sourceValidation.type).toBe('err')
    expect(sourceValidation.text).toContain('column delimiter')
    expect(canDeployFromSummaryChecklist(state, undefined, transformers)).toBe(false)
  })

  it('treats sink config as invalid when required sink properties are missing', () => {
    const state = buildState({
      metadata: {
        productSource: 'ERP',
        productType: 'Inventory',
        environment: '',
        entityName: 'Product',
        team: 'data-platform',
        location: '',
      },
      sink: {
        sinkType: 'kafka',
        sinkKafkaEnv: '',
      },
    })

    expect(isWizardStepValid(5, state)).toBe(false)

    const sinkValidation = getSummaryValidations(state, undefined, transformers).find(item => item.key === 'sinkConfigured')

    expect(sinkValidation.type).toBe('err')
    expect(sinkValidation.text).toContain('bootstrap environment')
  })

  it('allows completed future steps to remain clickable after loading an edited deployment', () => {
    const state = buildState({
      currentStep: 0,
      completedSteps: new Set([0, 1, 2, 3, 4, 5, 6]),
    })

    expect(canNavigateToWizardStep(1, state)).toBe(true)
    expect(canNavigateToWizardStep(4, state)).toBe(true)
    expect(canNavigateToWizardStep(6, state)).toBe(true)
  })

  it('keeps previously visited tabs navigable after returning to metadata', () => {
    const state = buildState({
      currentStep: 0,
      furthestStepVisited: 2,
      completedSteps: new Set([0, 1]),
    })

    expect(canNavigateToWizardStep(2, state)).toBe(true)
  })

  it('keeps summary navigable after the user revisits an earlier step', () => {
    const state = buildState({
      currentStep: 0,
      furthestStepVisited: 6,
      completedSteps: new Set([0, 1, 2, 3, 4, 5]),
    })

    expect(canNavigateToWizardStep(6, state)).toBe(true)
  })

  it('treats field mapping as invalid when a transformer is missing a required property', () => {
    const state = buildState({
      currentStep: 4,
      mappings: [
        {
          src: 'sourceName',
          tgt: 'targetName',
          transformer: 'tf-required',
          transformerProps: { logic: '   ' },
          transformerChainDetailed: [{ id: 'tf-required', props: { logic: '   ' } }],
        },
      ],
      targetSchema: [{ id: 'targetName', name: 'Target Name', required: true }],
    })

    const validation = getFieldMappingValidation(state, undefined, transformers)

    expect(validation.isValid).toBe(false)
    expect(validation.invalidTransformers).toHaveLength(1)
    expect(validation.invalidTransformers[0].transformerName).toBe('RequiredTransformer')
    expect(validation.invalidTransformers[0].missingRequiredProps.map(prop => prop.key)).toEqual(['logic'])
    expect(isWizardStepValid(4, state, undefined, transformers)).toBe(false)
    expect(canNavigateToWizardStep(5, state, undefined, transformers)).toBe(false)
  })

  it('accepts falsy-but-valid required transformer property values including NONE-input transformers', () => {
    const state = buildState({
      currentStep: 4,
      mappings: [
        {
          src: '',
          tgt: 'targetName',
          fromType: 'none',
          transformer: 'tf-none',
          transformerProps: { value: 0 },
          transformerChainDetailed: [{ id: 'tf-none', props: { value: 0 } }],
        },
      ],
      targetSchema: [{ id: 'targetName', name: 'Target Name', required: true }],
    })

    const validation = getFieldMappingValidation(state, undefined, transformers)

    expect(validation.invalidTransformers).toEqual([])
    expect(validation.isValid).toBe(true)
    expect(isWizardStepValid(4, state, undefined, transformers)).toBe(true)
    expect(canNavigateToWizardStep(5, state, undefined, transformers)).toBe(true)
  })

  it('validates required properties for later transformers in a chain', () => {
    const state = buildState({
      currentStep: 4,
      mappings: [
        {
          src: 'sourceName',
          tgt: 'targetName',
          transformer: 'tf-required',
          transformerProps: { logic: 'ready' },
          transformerChainDetailed: [
            { id: 'tf-required', props: { logic: 'ready' } },
            { id: 'tf-none', props: { value: '' } },
          ],
        },
      ],
      targetSchema: [{ id: 'targetName', name: 'Target Name', required: true }],
    })

    const validation = getFieldMappingValidation(state, undefined, transformers)

    expect(validation.isValid).toBe(false)
    expect(validation.invalidTransformers).toHaveLength(1)
    expect(validation.invalidTransformers[0].chainIndex).toBe(1)
    expect(validation.invalidTransformers[0].transformerName).toBe('Constant')
    expect(validation.invalidTransformers[0].missingRequiredProps.map(prop => prop.key)).toEqual(['value'])
  })

  it('maps failing summary validations to their owning step indexes', () => {
    const state = buildState({
      currentStep: 6,
      source: {
        sourceType: 'kafka',
        kafkaEnv: 'production',
        kafkaTopic: 'source_products_raw',
        kafkaOffset: '',
      },
      filters: [],
      sink: { sinkType: '' },
      mappings: [],
    })

    expect(Array.from(getSummaryFailingStepIndexes(state, undefined, transformers)).sort((a, b) => a - b)).toEqual([1, 4, 5])
    expect(canDeployFromSummaryChecklist(state, undefined, transformers)).toBe(false)
  })

  it('treats an empty filter list as valid for the summary checklist', () => {
    const state = buildState({
      currentStep: 6,
      metadata: {
        productSource: 'ERP',
        productType: 'Inventory',
        environment: 'production',
        entityName: 'Product',
        team: 'data-platform',
        location: 'OFFICE',
      },
      filters: [],
      sink: { sinkType: 'kafka', sinkKafkaEnv: 'production' },
      targetSchema: [{ id: 'targetName', name: 'Target Name', required: true }],
      mappings: [{ src: 'id', tgt: 'targetName' }],
    })

    const filterValidation = getFilterValidation(state.filters)
    const summaryFilterValidation = getSummaryValidations(state, undefined, transformers).find(item => item.key === 'filtersConfigured')

    expect(filterValidation.isValid).toBe(true)
    expect(filterValidation.hasFilters).toBe(false)
    expect(summaryFilterValidation.type).toBe('ok')
    expect(summaryFilterValidation.text).toContain('all records will pass')
    expect(Array.from(getSummaryFailingStepIndexes(state, undefined, transformers))).not.toContain(3)
    expect(canDeployFromSummaryChecklist(state, undefined, transformers)).toBe(true)
  })

  it('fails the summary checklist when a filter rule is incomplete', () => {
    const state = buildState({
      currentStep: 6,
      metadata: {
        productSource: 'ERP',
        productType: 'Inventory',
        environment: 'production',
        entityName: 'Product',
        team: 'data-platform',
        location: 'OFFICE',
      },
      filters: [
        {
          id: 'group-1',
          logic: 'AND',
          rules: [{ id: 'rule-1', field: 'id', op: 'eq', value: '' }],
          subgroups: [],
        },
      ],
      sink: { sinkType: 'kafka', sinkKafkaEnv: 'production' },
      targetSchema: [{ id: 'targetName', name: 'Target Name', required: true }],
      mappings: [{ src: 'id', tgt: 'targetName' }],
    })

    const filterValidation = getFilterValidation(state.filters)
    const summaryFilterValidation = getSummaryValidations(state, undefined, transformers).find(item => item.key === 'filtersConfigured')

    expect(filterValidation.isValid).toBe(false)
    expect(summaryFilterValidation.type).toBe('err')
    expect(summaryFilterValidation.text).toContain('Filters incomplete')
    expect(summaryFilterValidation.text).toContain('value')
    expect(Array.from(getSummaryFailingStepIndexes(state, undefined, transformers))).toContain(3)
    expect(canDeployFromSummaryChecklist(state, undefined, transformers)).toBe(false)
  })

  it('fails the summary checklist when a complex filter operator properties are not fully configured', () => {
    const state = buildState({
      currentStep: 6,
      metadata: {
        productSource: 'ERP',
        productType: 'Inventory',
        environment: 'production',
        entityName: 'Product',
        team: 'data-platform',
        location: 'OFFICE',
      },
      filters: [
        {
          id: 'group-1',
          logic: 'AND',
          rules: [{ id: 'rule-1', field: 'id', op: 'between', value: '1' }],
          subgroups: [],
        },
      ],
      sink: { sinkType: 'kafka', sinkKafkaEnv: 'production' },
      targetSchema: [{ id: 'targetName', name: 'Target Name', required: true }],
      mappings: [{ src: 'id', tgt: 'targetName' }],
    })

    const summaryFilterValidation = getSummaryValidations(state, undefined, transformers).find(item => item.key === 'filtersConfigured')

    expect(summaryFilterValidation.type).toBe('err')
    expect(summaryFilterValidation.text).toContain('properties')
    expect(canDeployFromSummaryChecklist(state, undefined, transformers)).toBe(false)
  })

  it('includes missing required transformer properties in the summary checklist', () => {
    const state = buildState({
      currentStep: 6,
      metadata: {
        productSource: 'ERP',
        productType: 'Inventory',
        environment: 'production',
        entityName: 'Product',
        team: 'data-platform',
        location: 'OFFICE',
      },
      filters: [
        {
          id: 'group-1',
          logic: 'AND',
          rules: [{ id: 'rule-1', field: 'id', op: 'eq', value: '42' }],
          subgroups: [],
        },
      ],
      sink: { sinkType: 'kafka', sinkKafkaEnv: 'production' },
      targetSchema: [{ id: 'targetName', name: 'Target Name', required: true }],
      mappings: [
        {
          src: 'id',
          tgt: 'targetName',
          transformer: 'tf-required',
          transformerProps: { logic: ' ' },
          transformerChainDetailed: [{ id: 'tf-required', props: { logic: ' ' } }],
        },
      ],
    })

    const transformerValidation = getSummaryValidations(state, undefined, transformers).find(item => item.key === 'transformersConfigured')

    expect(transformerValidation.type).toBe('err')
    expect(transformerValidation.text).toContain('RequiredTransformer')
    expect(transformerValidation.text).toContain('Logic')
    expect(Array.from(getSummaryFailingStepIndexes(state, undefined, transformers))).toContain(4)
    expect(canDeployFromSummaryChecklist(state, undefined, transformers)).toBe(false)
  })

  it('returns only ok summary validations once each owning step is valid', () => {
    const state = buildState({
      currentStep: 6,
      filters: [
        {
          id: 'group-1',
          logic: 'AND',
          rules: [{ id: 'rule-1', field: 'id', op: 'eq', value: '42' }],
          subgroups: [],
        },
      ],
      sink: { sinkType: 'kafka' },
      metadata: {
        productSource: 'ERP',
        productType: 'Inventory',
        environment: 'production',
        entityName: 'Product',
        team: 'data-platform',
        location: 'OFFICE',
      },
      targetSchema: [{ id: 'targetName', name: 'Target Name', required: true }],
      mappings: [{ src: 'id', tgt: 'targetName' }],
    })

    expect(getSummaryValidations(state, undefined, transformers).every(item => item.type === 'ok')).toBe(true)
    expect(Array.from(getSummaryFailingStepIndexes(state, undefined, transformers))).toEqual([])
    expect(canDeployFromSummaryChecklist(state, undefined, transformers)).toBe(true)
  })
})