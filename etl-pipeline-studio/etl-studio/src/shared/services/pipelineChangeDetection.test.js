import { describe, expect, it } from 'vitest'
import { buildPipelineChangeSignature } from './pipelineChangeDetection.js'

function buildState(overrides = {}) {
  return {
    metadata: {
      productSource: 'ERP',
      productType: 'Inventory',
      productCode: '',
      location: 'OFFICE',
      team: 'data-platform',
      environment: 'production',
      entityName: 'Product',
      ...(overrides.metadata || {}),
    },
    source: {
      sourceType: 'rabbitmq',
      format: 'JSON',
      rmqIp: '10.0.0.12',
      rmqPort: '5672',
      rmqUsername: 'guest',
      rmqPassword: 'secret',
      rmqQueue: 'products.ingest',
      rmqVhost: '/etl',
      streamingContinuity: 'continuous',
      recordsPerDay: 'millions',
      ...(overrides.source || {}),
    },
    upload: {
      schemaName: '',
      schema: [],
      ...(overrides.upload || {}),
    },
    mappings: overrides.mappings || [],
    filters: overrides.filters || [],
    targetSchema: overrides.targetSchema || [],
    sink: {
      sinkType: 'kafka',
      sinkKafkaTopic: 'etl_products_v3',
      sinkKafkaAdditionalPropertiesEnabled: false,
      sinkKafkaAdditionalProperties: [],
      shadow: false,
      shadowTopic: '',
      saknay: false,
      saknayTopic: '',
      asg: false,
      ...(overrides.sink || {}),
    },
  }
}

describe('buildPipelineChangeSignature', () => {
  it('changes when RabbitMQ source fields change', () => {
    const baseSignature = buildPipelineChangeSignature(buildState())
    const changedSignature = buildPipelineChangeSignature(buildState({
      source: {
        rmqQueue: 'products.retry',
      },
    }))

    expect(changedSignature).not.toBe(baseSignature)
  })

  it('changes when a filter is marked as not revertible', () => {
    const baseSignature = buildPipelineChangeSignature(buildState({
      filters: [
        {
          id: 'group-1',
          logic: 'AND',
          mode: 'include',
          rules: [{ id: 'rule-1', field: 'sku', op: 'eq', value: 'ABC' }],
          subgroups: [],
        },
      ],
    }))
    const changedSignature = buildPipelineChangeSignature(buildState({
      filters: [
        {
          id: 'group-1',
          logic: 'AND',
          mode: 'include',
          isRevertible: false,
          rules: [{ id: 'rule-1', field: 'sku', op: 'eq', value: 'ABC' }],
          subgroups: [],
        },
      ],
    }))

    expect(changedSignature).not.toBe(baseSignature)
  })

  it('changes when a filter rule switches between regular and reverted', () => {
    const baseSignature = buildPipelineChangeSignature(buildState({
      filters: [
        {
          id: 'group-1',
          logic: 'AND',
          mode: 'include',
          rules: [{ id: 'rule-1', field: 'sku', op: 'eq', isReverted: false, value: 'ABC' }],
          subgroups: [],
        },
      ],
    }))
    const changedSignature = buildPipelineChangeSignature(buildState({
      filters: [
        {
          id: 'group-1',
          logic: 'AND',
          mode: 'include',
          rules: [{ id: 'rule-1', field: 'sku', op: 'eq', isReverted: true, value: 'ABC' }],
          subgroups: [],
        },
      ],
    }))

    expect(changedSignature).not.toBe(baseSignature)
  })

  it('changes when the target schema title changes', () => {
    const baseSignature = buildPipelineChangeSignature(buildState({
      targetSchema: {
        title: 'Genome Product Title',
        schemaName: 'Genome Product Title',
        schema: [{ id: 'code', name: 'code', type: 'string', required: true }],
      },
    }))
    const changedSignature = buildPipelineChangeSignature(buildState({
      targetSchema: {
        title: 'Genome Product Title v2',
        schemaName: 'Genome Product Title v2',
        schema: [{ id: 'code', name: 'code', type: 'string', required: true }],
      },
    }))

    expect(changedSignature).not.toBe(baseSignature)
  })
})

