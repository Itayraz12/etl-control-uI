import { parse } from 'yaml'
import { FIELD_TYPES } from '../types/index.js'
import { MOCK_FILTER_OPERATORS } from './configService.js'

const VALID_ENVS = new Set(['dev', 'staging', 'production'])
const VALID_SOURCE_TYPES = new Set(['kafka', 'rabbitmq', 'file', 'db', 'http', 's3'])
const VALID_SINK_TYPES = new Set(['kafka', 'file', 'db', 'rabbitmq'])
const TUPLE_TYPES = new Set([...FIELD_TYPES, 'any', 'unknown'])
const NORMALIZED_OPERATOR_TO_ID = new Map(
  MOCK_FILTER_OPERATORS.map(op => [op.name.toLowerCase().replace(/\s+/g, '_'), op.id])
)

function asString(value, fallback = '') {
  if (value === undefined || value === null) return fallback
  return String(value)
}

function normalizeEnvironment(value, fallback = 'production') {
  const normalized = asString(value, fallback).toLowerCase()
  return VALID_ENVS.has(normalized) ? normalized : fallback
}

function normalizeSourceType(value, fallback = 'kafka') {
  const normalized = asString(value, fallback).toLowerCase()
  return VALID_SOURCE_TYPES.has(normalized) ? normalized : fallback
}

function normalizeSinkType(value, fallback = 'kafka') {
  const normalized = asString(value, fallback).toLowerCase()
  return VALID_SINK_TYPES.has(normalized) ? normalized : fallback
}

function extractParentheticalGroups(text = '') {
  const groups = []
  let depth = 0
  let start = -1

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '(') {
      if (depth === 0) start = i + 1
      depth += 1
    } else if (ch === ')') {
      depth -= 1
      if (depth === 0 && start >= 0) {
        groups.push(text.slice(start, i).trim())
        start = -1
      }
    }
  }

  return groups
}

function parseTypeFieldTuple(content = '') {
  const commaIndex = content.indexOf(',')
  if (commaIndex === -1) return null

  const type = content.slice(0, commaIndex).trim().toLowerCase()
  const field = content.slice(commaIndex + 1).trim()
  if (!TUPLE_TYPES.has(type) || !field) return null

  return { type, field }
}

function parseTransformerProps(content = '') {
  const props = {}

  content
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .forEach(entry => {
      const colonIndex = entry.indexOf(':')
      if (colonIndex === -1) return
      const key = entry.slice(0, colonIndex).trim()
      const value = entry.slice(colonIndex + 1).trim()
      if (key) props[key] = value
    })

  return props
}

function normalizeTransformationEntry(entry) {
  if (typeof entry === 'string') return entry
  if (entry && typeof entry === 'object') {
    return Object.entries(entry)
      .map(([key, value]) => `${key}: ${asString(value)}`)
      .join(', ')
  }
  return asString(entry)
}

function parseTransformationLine(line) {
  const raw = normalizeTransformationEntry(line).trim().replace(/^-\s*/, '')
  if (!raw) return null

  const arrowIndex = raw.indexOf('->')
  if (arrowIndex === -1) return null

  const left = raw.slice(0, arrowIndex).trim()
  const right = raw.slice(arrowIndex + 2).trim()
  const outputTuple = extractParentheticalGroups(right)[0]
  const output = parseTypeFieldTuple(outputTuple || '')
  if (!output) return null

  const firstParenIndex = left.indexOf('(')
  const transformer = firstParenIndex === -1 ? left : left.slice(0, firstParenIndex).trim()
  const groups = extractParentheticalGroups(firstParenIndex === -1 ? '' : left.slice(firstParenIndex))

  let transformerProps = {}
  const inputs = []

  groups.forEach((group, index) => {
    const tuple = parseTypeFieldTuple(group)
    if (tuple) {
      inputs.push(tuple)
      return
    }

    if (index === 0) {
      transformerProps = parseTransformerProps(group)
    }
  })

  return {
    transformer: transformer || 'none',
    transformerProps,
    inputs,
    outputType: output.type,
    targetField: output.field,
  }
}

function buildTransformationMap(transformations) {
  const byTarget = new Map()

  if (!Array.isArray(transformations)) return byTarget

  transformations.forEach(line => {
    const parsed = parseTransformationLine(line)
    if (parsed?.targetField) {
      byTarget.set(parsed.targetField, parsed)
    }
  })

  return byTarget
}

function stripWrappingQuotes(value = '') {
  const text = asString(value).trim()
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1)
  }
  return text
}

function stripSingleOuterPair(text = '') {
  const trimmed = text.trim()
  if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) return trimmed

  let depth = 0
  for (let i = 0; i < trimmed.length; i += 1) {
    if (trimmed[i] === '(') depth += 1
    else if (trimmed[i] === ')') depth -= 1

    if (depth === 0 && i < trimmed.length - 1) {
      return trimmed
    }
  }

  return trimmed.slice(1, -1).trim()
}

function splitTopLevel(text, separator) {
  const parts = []
  let depth = 0
  let start = 0

  for (let i = 0; i <= text.length - separator.length; i += 1) {
    const ch = text[i]
    if (ch === '(') depth += 1
    else if (ch === ')') depth -= 1

    if (depth === 0 && text.slice(i, i + separator.length) === separator) {
      parts.push(text.slice(start, i).trim())
      start = i + separator.length
      i += separator.length - 1
    }
  }

  parts.push(text.slice(start).trim())
  return parts.filter(Boolean)
}

function parseFilterRule(text, ruleId) {
  const trimmed = stripSingleOuterPair(text)
  const match = trimmed.match(/^([^\s]+)\s+([a-z0-9_-]+)\s+(.+)$/i)
  if (!match) return null

  const [, field, operatorToken, rawValue] = match
  return {
    id: ruleId,
    field,
    op: NORMALIZED_OPERATOR_TO_ID.get(operatorToken.toLowerCase()) || operatorToken.toLowerCase(),
    value: rawValue.toLowerCase() === 'null' ? '' : stripWrappingQuotes(rawValue),
  }
}

function parseFilterGroup(expression, idPrefix = 'group') {
  const text = stripSingleOuterPair(stripWrappingQuotes(asString(expression).trim()))
  if (!text) {
    return { id: idPrefix, logic: 'AND', rules: [], subgroups: [] }
  }

  const logic = splitTopLevel(text, ' AND ').length > 1 ? 'AND' : (splitTopLevel(text, ' OR ').length > 1 ? 'OR' : 'AND')
  const segments = logic === 'AND' ? splitTopLevel(text, ' AND ') : splitTopLevel(text, ' OR ')
  const rules = []
  const subgroups = []

  segments.forEach((segment, index) => {
    const nested = stripSingleOuterPair(segment)
    const rule = parseFilterRule(nested, `${idPrefix}-rule-${index}`)
    if (rule) {
      rules.push(rule)
      return
    }

    const subgroup = parseFilterGroup(nested, `${idPrefix}-group-${index}`)
    if (subgroup.rules.length > 0 || subgroup.subgroups.length > 0) {
      subgroups.push(subgroup)
    }
  })

  return {
    id: idPrefix,
    logic,
    rules,
    subgroups,
  }
}

function buildFilterGroups(filters) {
  if (!Array.isArray(filters)) return []
  return filters
    .map((filter, index) => parseFilterGroup(filter, `group-${index}`))
    .filter(group => group.rules.length > 0 || group.subgroups.length > 0)
}

function buildMappings(mappings, transformations) {
  const transformationByTarget = buildTransformationMap(transformations)

  if (!Array.isArray(mappings)) return []

  return mappings
    .map((mapping, index) => {
      const targetField = asString(mapping?.tgt)
      const transformation = transformationByTarget.get(targetField)
      const inputFieldsFromTransformation = transformation?.inputs?.map(input => input.field).filter(Boolean) || []
      const mappedAdditionalInputs = Array.isArray(mapping?.additional_inputs)
        ? mapping.additional_inputs.map(asString).filter(Boolean)
        : []
      const primarySource = asString(mapping?.src || inputFieldsFromTransformation[0])
      const extraInputFields = mappedAdditionalInputs.length > 0
        ? mappedAdditionalInputs
        : inputFieldsFromTransformation.slice(primarySource ? 1 : 0)

      if (!primarySource || !targetField) return null

      return {
        src: primarySource,
        tgt: targetField,
        srcNodeId: `loaded-src-${index}-${primarySource}`,
        tgtNodeId: `loaded-tgt-${index}-${targetField}`,
        srcPos: { x: 40, y: 30 + index * 70 },
        tgtPos: { x: 650, y: 30 + index * 70 },
        srcMetadata: {
          sendToSaknay: true,
          sendToGP: true,
          expression: asString(mapping?.src_expression),
        },
        tgtMetadata: {
          sendToSaknay: true,
          sendToGP: true,
          expression: asString(mapping?.tgt_expression),
        },
        transformer: transformation?.transformer || 'none',
        transformerInputType: transformation?.inputs?.[0]?.type === 'unknown' ? 'any' : (transformation?.inputs?.[0]?.type || 'any'),
        transformerOutputType: transformation?.outputType === 'unknown' ? 'any' : (transformation?.outputType || 'any'),
        transformerProps: transformation?.transformerProps || {},
        extraInputs: extraInputFields.map((field, extraIndex) => ({
          nodeId: `loaded-extra-${index}-${extraIndex}-${field}`,
          field,
          pos: { x: 40, y: 90 + (index + extraIndex) * 70 },
        })),
      }
    })
    .filter(Boolean)
}

export function hydrateWizardStateFromYaml(yamlText, fallback = {}) {
  const parsed = parse(asString(yamlText, '')) || {}
  const metadata = parsed.metadata || {}
  const source = parsed.source || {}
  const sink = parsed.sink || {}
  const environment = normalizeEnvironment(metadata.environment ?? fallback.environment)
  const sourceType = normalizeSourceType(source.type)
  const sinkType = normalizeSinkType(sink.type)
  const sourceTopic = asString(source.topic)
  const sinkTopic = asString(sink.topic)

  return {
    metadata: {
      productSource: asString(metadata.product_source, fallback.source),
      productType: asString(metadata.product_type, fallback.productType),
      team: asString(fallback.teamName || metadata.team),
      environment,
      entityName: asString(metadata.entity),
      tags: '',
      schemaVersion: '',
    },
    source: {
      sourceType,
      kafkaEnv: environment,
      kafkaTopic: sourceType === 'kafka' ? sourceTopic : '',
      rmqQueue: sourceType === 'rabbitmq' ? sourceTopic : '',
      format: asString(source.format, 'JSON').toUpperCase(),
      jsonSplit: asString(source.split_key),
      streamingContinuity: asString(metadata.data_stream_info?.streaming_continuity, 'continuous'),
      recordsPerDay: asString(metadata.data_stream_info?.avg_records_amount, 'millions'),
    },
    upload: {
      done: true,
    },
    mappings: buildMappings(parsed.mappings, parsed.transformations),
    filters: buildFilterGroups(parsed.filters),
    sink: {
      sinkType,
      sinkKafkaTopic: sinkType === 'kafka' ? sinkTopic : '',
      sinkKafkaEnv: environment,
      sinkRmqQueue: sinkType === 'rabbitmq' ? sinkTopic : '',
      shadow: sink.shadow === true,
      shadowTopic: asString(sink.shadow_topic) === 'auto' ? '' : asString(sink.shadow_topic),
      saknay: sink.saknay === true,
      saknayTopic: asString(sink.saknay_topic) === 'auto' ? '' : asString(sink.saknay_topic),
      asg: sink.asg === true,
    },
  }
}
