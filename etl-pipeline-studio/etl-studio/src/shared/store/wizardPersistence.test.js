import { describe, expect, it } from 'vitest'
import { buildStateFromPersisted, parsePersistedWizardState, serializeWizardState } from './wizardPersistence.js'

describe('wizardPersistence', () => {
  it('does not persist transient readOnly mode', () => {
    const serialized = serializeWizardState({
      navigationMode: 'etl-config',
      currentStep: 3,
      furthestStepVisited: 6,
      completedSteps: new Set([0, 1, 2]),
      readOnly: true,
      metadata: { productType: 'Catalog' },
    })

    expect(JSON.parse(serialized)).toEqual({
      navigationMode: 'etl-config',
      currentStep: 3,
      furthestStepVisited: 6,
      completedSteps: [0, 1, 2],
      filters: [],
      metadata: { productType: 'Catalog' },
    })
  })

  it('sanitizes stale persisted readOnly state back to editable mode', () => {
    const persisted = parsePersistedWizardState(JSON.stringify({
      navigationMode: 'etl-config',
      currentStep: 2,
      furthestStepVisited: 6,
      completedSteps: [0, 1],
      readOnly: true,
      metadata: { productSource: 'ERP' },
    }))

    expect(persisted).toMatchObject({
      navigationMode: 'etl-config',
      currentStep: 2,
      furthestStepVisited: 6,
      readOnly: false,
      metadata: { productSource: 'ERP' },
    })
    expect(persisted.completedSteps).toEqual(new Set([0, 1]))
  })

  it('preserves the admin navigation mode for persisted admin sessions', () => {
    const persisted = parsePersistedWizardState(JSON.stringify({
      navigationMode: 'etl-admin',
      currentStep: 0,
      completedSteps: [],
    }))

    expect(persisted).toMatchObject({
      navigationMode: 'etl-admin',
      readOnly: false,
    })
  })

  it('preserves canonical persisted PROD/CAP values when rebuilding state', () => {
    const rebuilt = buildStateFromPersisted({
      metadata: { environment: '', location: '', productType: '', team: '' },
      source: { kafkaEnv: '' },
      sink: { sinkKafkaEnv: '' },
      upload: {},
      targetSchema: [],
      filters: [],
    }, {
      metadata: { environment: 'PROD', location: 'HOME' },
      source: { kafkaEnv: 'CAP' },
      sink: { sinkKafkaEnv: 'PROD' },
      filters: [],
    })

    expect(rebuilt.metadata.environment).toBe('PROD')
    expect(rebuilt.source.kafkaEnv).toBe('CAP')
    expect(rebuilt.sink.sinkKafkaEnv).toBe('PROD')
  })
})

