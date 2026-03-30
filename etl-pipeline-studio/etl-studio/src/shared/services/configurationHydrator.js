import { parse } from 'yaml'
import { FIELD_TYPES, normalizeMetadataLocation, normalizeSourceSchema } from '../types/index.js'
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

function normalizeKafkaKeys(value) {
  if (Array.isArray(value)) {
    return value.map(asString).map(item => item.trim()).filter(Boolean).join(', ')
  }

  return asString(value).trim()
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

function extractBracketGroups(text = '') {
  const groups = []
  let depth = 0
  let start = -1

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '[') {
      if (depth === 0) start = i + 1
      depth += 1
    } else if (ch === ']') {
      depth -= 1
      if (depth === 0 && start >= 0) {
        groups.push(text.slice(start, i).trim())
        start = -1
      }
    }
  }

  return groups
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

function parseTransformerHead(left = '') {
  const tupleStartIndex = left.indexOf('(')
  const head = tupleStartIndex === -1 ? left.trim() : left.slice(0, tupleStartIndex).trim()
  const lastChainHop = head.includes('-->')
    ? head.split('-->').map(part => part.trim()).filter(Boolean).at(-1) || ''
    : head

  const openBracket = lastChainHop.indexOf('[')
  const closeBracket = lastChainHop.lastIndexOf(']')

  if (openBracket !== -1 && closeBracket > openBracket) {
    return {
      transformer: lastChainHop.slice(0, openBracket).trim(),
      transformerProps: parseTransformerProps(lastChainHop.slice(openBracket + 1, closeBracket).trim()),
    }
  }

  return {
    transformer: lastChainHop.trim(),
    transformerProps: {},
  }
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

function buildKeyValueEntries(value, idPrefix = 'entry') {
  if (!value || typeof value !== 'object') return []

  if (Array.isArray(value)) {
    return value
      .map((entry, index) => {
        if (!entry || typeof entry !== 'object') return null
        const key = asString(entry.key).trim()
        if (!key) return null

        return {
          id: `${idPrefix}-${index}`,
          key,
          value: asString(entry.value),
        }
      })
      .filter(Boolean)
  }

  return Object.entries(value)
    .map(([key, entryValue], index) => {
      const normalizedKey = asString(key).trim()
      if (!normalizedKey) return null

      return {
        id: `${idPrefix}-${index}`,
        key: normalizedKey,
        value: asString(entryValue),
      }
    })
    .filter(Boolean)
}

/**
 * Tries to parse the new-format transformer expression from the left side of "->".
 * New format: TransformerName([field1,field2],[prop: val]) or chains with -->
 * Returns null if the text does not match the new format.
 */
function tryParseNewFormatTransformer(left = '') {
  // Get the last hop when a chain (-->) is present
  const lastHop = left.includes('-->')
    ? left.split('-->').map(s => s.trim()).filter(Boolean).at(-1) || ''
    : left.trim()

  const parenStart = lastHop.indexOf('(')
  if (parenStart === -1) return null

  const transformerName = lastHop.slice(0, parenStart).trim()
  if (!transformerName) return null

  // New format is identified by the argument list starting with '['
  if (lastHop[parenStart + 1] !== '[') return null

  // Extract the single parenthetical group: ([fields],[props])
  const innerGroups = extractParentheticalGroups(lastHop.slice(parenStart))
  if (innerGroups.length === 0) return null

  const innerContent = innerGroups[0]
  const bracketGroups = extractBracketGroups(innerContent)
  if (bracketGroups.length === 0) return null

  // First bracket group = comma-separated field names
  const fields = bracketGroups[0].split(',').map(s => s.trim()).filter(Boolean)

  // Second bracket group (optional) = transformer props
  const transformerProps = bracketGroups.length > 1
    ? parseTransformerProps(bracketGroups[1])
    : {}

  // Build inputs array; skip chained reference tokens (start with $)
  const inputs = fields
    .filter(f => !f.startsWith('$'))
    .map(field => ({ type: 'unknown', field }))

  return { transformer: transformerName, transformerProps, inputs }
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

  // ── New format: TransformerName([field1,field2],[prop: val]) -> (type, output) ──
  const newFormat = tryParseNewFormatTransformer(left)
  if (newFormat) {
    return {
      transformer: newFormat.transformer || 'none',
      transformerProps: newFormat.transformerProps,
      inputs: newFormat.inputs,
      outputType: output.type,
      targetField: output.field,
    }
  }

  // ── Legacy formats ──
  // e.g. TransformerName[props](type, field), ... or TransformerName(props)(type, field), ...
  const { transformer, transformerProps: headTransformerProps } = parseTransformerHead(left)
  const firstParenIndex = left.indexOf('(')
  const groups = extractParentheticalGroups(firstParenIndex === -1 ? '' : left.slice(firstParenIndex))

  let transformerProps = { ...headTransformerProps }
  const inputs = []

  groups.forEach((group, index) => {
    const tuple = parseTypeFieldTuple(group)
    if (tuple) {
      inputs.push(tuple)
      return
    }

    if (index === 0 && Object.keys(transformerProps).length === 0) {
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
      const targetField = asString(mapping?.outName || mapping?.tgt)
      const transformation = transformationByTarget.get(targetField)
      const inputFieldsFromTransformation = transformation?.inputs?.map(input => input.field).filter(Boolean) || []
      const mappedAdditionalInputs = Array.isArray(mapping?.additionalInputs)
        ? mapping.additionalInputs.map(asString).filter(Boolean)
        : (Array.isArray(mapping?.additional_inputs)
          ? mapping.additional_inputs.map(asString).filter(Boolean)
          : [])
      const primarySource = asString(mapping?.inName || mapping?.src || inputFieldsFromTransformation[0])
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
          expression: asString(mapping?.src_expression),
        },
        tgtMetadata: {
          sendToSaknay: mapping?.sendToSaknay ?? true,
          expression: asString(mapping?.expression ?? mapping?.tgt_expression),
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
  const dataStreamInfo = metadata.dataStreamInfo ?? metadata.data_stream_info ?? {}
  const source = parsed.source || {}
  const output = parsed.output || {}
  const general = parsed.general || {}
  const input = parsed.input || {}
  const inputFields = normalizeSourceSchema(input.mapping || input.mappings || parsed.inputFields)
  const schema = parsed.schema || {}
  const sink = parsed.sink || {}
  const environment = normalizeEnvironment(metadata.environment ?? fallback.environment)
  const sourceFormatRaw = asString(general.inputFormat ?? general.outputFormat ?? source.format, 'JSON').trim().toLowerCase()
  const sourceFormat = sourceFormatRaw === 'delimited' ? 'CSV' : sourceFormatRaw.toUpperCase()
  const csvDelimiter = asString(input.delimited?.columnDelimiter ?? source.csvDelimiter ?? ',', ',')
  const rowDelimiter = asString(general.split?.delimiter ?? source.rowDelimiter)
  const sourceType = normalizeSourceType(source.type)
  const sinkType = normalizeSinkType(sink.type)
  const sourceTopic = asString(source.topic)
  const sinkTopic = asString(sink.topic)
  const sinkKafkaAdditionalProperties = sinkType === 'kafka'
    ? buildKeyValueEntries(sink.additional_properties ?? sink.additionalProperties, 'sink-kafka-prop')
    : []

  return {
    metadata: {
      productSource: asString(metadata.productSource ?? metadata.product_source, fallback.source),
      productType: asString(metadata.productType ?? metadata.product_type, fallback.productType),
      productCode: asString(metadata.productCode ?? metadata.product_code),
      location: normalizeMetadataLocation(metadata.location, environment),
      team: asString(fallback.teamName || metadata.owner || metadata.team),
      environment,
      entityName: asString(metadata.genomeEntity ?? metadata.entity),
      tags: '',
      schemaVersion: '',
    },
    source: {
      sourceType,
      kafkaEnv: environment,
      kafkaTopic: sourceType === 'kafka' ? sourceTopic : '',
      kafkaOffset: sourceType === 'kafka' ? asString(source.offset) : '',
      kafkaKeys: sourceType === 'kafka'
        ? normalizeKafkaKeys(source.filter ?? source.keyFilter ?? source.kafkaKeys ?? source.keys)
        : '',
      rmqQueue: sourceType === 'rabbitmq' ? sourceTopic : '',
      format: sourceFormat,
      csvDelimiter,
      rowDelimiter,
      jsonSplit: asString(source.split_key),
      streamingContinuity: asString(dataStreamInfo.streamingContinuity ?? dataStreamInfo.streaming_continuity, 'continuous'),
      recordsPerDay: asString(dataStreamInfo.avgRecordsAmount ?? dataStreamInfo.avg_records_amount, 'millions'),
    },
    upload: {
      done: true,
      schema: inputFields,
      schemaName: asString(schema.inputSchema ?? fallback.upload?.schemaName),
    },
    mappings: buildMappings(output.mapping || output.mappings || parsed.mapping || parsed.mappings, output.transformations || parsed.transformations),
    filters: buildFilterGroups(output.filters || parsed.filters),
    sink: {
      sinkType,
      sinkKafkaTopic: sinkType === 'kafka' ? sinkTopic : '',
      sinkKafkaEnv: environment,
      sinkKafkaAdditionalPropertiesEnabled: sinkKafkaAdditionalProperties.length > 0,
      sinkKafkaAdditionalProperties,
      sinkRmqQueue: sinkType === 'rabbitmq' ? sinkTopic : '',
      shadow: sink.shadow === true,
      shadowTopic: asString(sink.shadow_topic) === 'auto' ? '' : asString(sink.shadow_topic),
      saknay: sink.saknay === true,
      saknayTopic: asString(sink.saknay_topic) === 'auto' ? '' : asString(sink.saknay_topic),
      asg: sink.asg === true,
    },
  }
}
