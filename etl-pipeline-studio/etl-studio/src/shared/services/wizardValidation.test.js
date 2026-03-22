import { describe, expect, it } from 'vitest'
import { canNavigateToWizardStep } from './wizardValidation.js'

function buildState(overrides = {}) {
  return {
    currentStep: 1,
    metadata: {
      productSource: 'ERP',
      productType: 'Inventory',
      environment: 'production',
      entityName: 'Product',
    },
    source: {
      sourceType: 'kafka',
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
      source: { sourceType: 'kafka' },
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
})