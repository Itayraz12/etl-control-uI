import { describe, expect, it } from 'vitest'
import { canNavigateToWizardStep, getFieldMappingValidation, isWizardStepValid } from './wizardValidation.js'

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
  return {
    currentStep: 1,
    completedSteps: new Set(),
    metadata: {
      productSource: 'ERP',
      productType: 'Inventory',
      environment: 'production',
      entityName: 'Product',
    },
    source: {
      sourceType: 'kafka',
      kafkaEnv: 'production',
      kafkaTopic: 'source_products_raw',
      kafkaOffset: 'earliest',
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
    },
    ...overrides,
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

  it('allows completed future steps to remain clickable after loading an edited deployment', () => {
    const state = buildState({
      currentStep: 0,
      completedSteps: new Set([0, 1, 2, 3, 4, 5, 6]),
    })

    expect(canNavigateToWizardStep(1, state)).toBe(true)
    expect(canNavigateToWizardStep(4, state)).toBe(true)
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
})