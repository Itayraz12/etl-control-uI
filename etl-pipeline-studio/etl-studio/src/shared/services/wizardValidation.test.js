import { describe, expect, it } from 'vitest'
import { canNavigateToWizardStep, isWizardStepValid } from './wizardValidation.js'

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
})