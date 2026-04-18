import { normalizeMetadataLocation } from '../types/index.js'
import {
  ASG_YAML_FLAG_KEY,
  PRODUCT_CODE_YAML_KEY,
  SAKNAY_TOPIC_YAML_KEY,
  SAKNAY_YAML_FLAG_KEY,
  SHADOW_TOPIC_YAML_KEY,
  SHADOW_YAML_FLAG_KEY,
  TARGET_SAKNAY_YAML_KEY,
} from './appConfig.js'

function sortDeep(value) {
  if (Array.isArray(value)) {
    return value.map(sortDeep)
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .reduce((accumulator, key) => {
        accumulator[key] = sortDeep(value[key])
        return accumulator
      }, {})
  }

  return value
}

function normalizeSchemaField(field = {}) {
  return {
    id: field.id || '',
    name: field.name || '',
    path: field.path || field.id || '',
    type: field.type || 'unknown',
    nullable: Boolean(field.nullable),
    required: Boolean(field.required),
  }
}

function normalizeMapping(mapping = {}) {
  return {
    src: mapping.src || '',
    tgt: mapping.tgt || '',
    srcExpression: mapping?.srcMetadata?.expression || '',
    tgtExpression: mapping?.tgtMetadata?.expression || '',
    sendToSaknay: mapping?.tgtMetadata?.sendToSaknay ?? true,
    transformer: mapping.transformer || 'none',
    transformerProps: sortDeep(mapping.transformerProps || {}),
    transformerChain: Array.isArray(mapping.transformerChain) ? mapping.transformerChain : [],
    transformerChainDetailed: Array.isArray(mapping.transformerChainDetailed)
      ? mapping.transformerChainDetailed.map(item => ({
          id: item?.id || item?.transformer || item?._id || '',
          props: sortDeep(item?.props || item?.transformerProps || {}),
        }))
      : [],
    extraInputs: Array.isArray(mapping.extraInputs)
      ? mapping.extraInputs.map(input => input?.field || '').filter(Boolean)
      : [],
  }
}

function normalizeFilterGroup(group = {}) {
  return {
    logic: group.logic || 'AND',
    mode: group.mode || 'include',
    rules: Array.isArray(group.rules)
      ? group.rules.map(rule => ({
          field: rule.field || '',
          op: rule.op || '',
          value: rule.value || '',
        }))
      : [],
    subgroups: Array.isArray(group.subgroups)
      ? group.subgroups.map(normalizeFilterGroup)
      : [],
  }
}

export function buildPipelineChangeSignature(state = {}) {
  const environment = state?.metadata?.environment || ''

  const signatureSource = {
    metadata: {
      productSource: state?.metadata?.productSource || '',
      productType: state?.metadata?.productType || '',
      productCode: state?.metadata?.productCode || '',
      location: normalizeMetadataLocation(state?.metadata?.location, environment),
      team: state?.metadata?.team || '',
      environment,
      entityName: state?.metadata?.entityName || '',
    },
    source: {
      sourceType: state?.source?.sourceType || '',
      format: state?.source?.format || '',
      kafkaTopic: state?.source?.kafkaTopic || '',
      kafkaOffset: state?.source?.kafkaOffset || '',
      kafkaKeys: state?.source?.kafkaKeys || '',
      rmqIp: state?.source?.rmqIp || '',
      rmqPort: state?.source?.rmqPort || '',
      rmqUsername: state?.source?.rmqUsername || '',
      rmqPassword: state?.source?.rmqPassword || '',
      rmqQueue: state?.source?.rmqQueue || '',
      rmqVhost: state?.source?.rmqVhost || '/',
      jsonSplit: state?.source?.jsonSplit || '',
      csvDelimiter: state?.source?.csvDelimiter ?? ',',
      rowDelimiter: state?.source?.rowDelimiter || '',
      streamingContinuity: state?.source?.streamingContinuity || 'continuous',
      recordsPerDay: state?.source?.recordsPerDay || 'millions',
    },
    upload: {
      schemaName: state?.upload?.schemaName || '',
      schema: Array.isArray(state?.upload?.schema)
        ? state.upload.schema.map(normalizeSchemaField)
        : [],
    },
    mappings: Array.isArray(state?.mappings)
      ? state.mappings.map(normalizeMapping)
      : [],
    filters: Array.isArray(state?.filters)
      ? state.filters.map(normalizeFilterGroup)
      : [],
    sink: {
      sinkType: state?.sink?.sinkType || '',
      sinkKafkaTopic: state?.sink?.sinkKafkaTopic || '',
      sinkKafkaAdditionalPropertiesEnabled: Boolean(state?.sink?.sinkKafkaAdditionalPropertiesEnabled),
      sinkKafkaAdditionalProperties: Array.isArray(state?.sink?.sinkKafkaAdditionalProperties)
        ? state.sink.sinkKafkaAdditionalProperties.map(entry => ({
            key: entry?.key || '',
            value: entry?.value || '',
          }))
        : [],
      shadow: Boolean(state?.sink?.shadow),
      shadowTopic: state?.sink?.shadowTopic || '',
      saknay: Boolean(state?.sink?.saknay),
      saknayTopic: state?.sink?.saknayTopic || '',
      asg: Boolean(state?.sink?.asg),
    },
    yamlAliases: {
      productCode: PRODUCT_CODE_YAML_KEY,
      shadowFlag: SHADOW_YAML_FLAG_KEY,
      shadowTopic: SHADOW_TOPIC_YAML_KEY,
      asgFlag: ASG_YAML_FLAG_KEY,
      saknayFlag: SAKNAY_YAML_FLAG_KEY,
      saknayTopic: SAKNAY_TOPIC_YAML_KEY,
      targetSaknayFlag: TARGET_SAKNAY_YAML_KEY,
    },
  }

  return JSON.stringify(sortDeep(signatureSource))
}