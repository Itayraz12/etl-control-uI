import { SOURCE_TYPES, normalizeMetadataLocation, resolveTargetSchema } from '../types/index.js'
import { MOCK_FILTER_OPERATORS } from './configService.js'
import { findTransformer, getMissingRequiredTransformerProps } from './transformerValidation.js'

export const SUMMARY_VALIDATION_STEP_INDEXES = {
  requiredFieldsMapped: 4,
  hasMappings: 4,
  transformersConfigured: 4,
  sourceConfigured: 1,
  metadataConfigured: 0,
  filtersConfigured: 3,
  sinkConfigured: 5,
}

function hasRequiredValue(value) {
  if (value === 0 || value === false) return true
  if (typeof value === 'string') return value.trim() !== ''
  return value != null && Boolean(value)
}

function formatMissingRequiredFieldsText(missingFields = []) {
  return missingFields.length > 0
    ? `Missing required fields: ${missingFields.join(', ')}`
    : ''
}

export function getMissingMetadataRequiredFields(metadata = {}, source = {}) {
  const missingFields = []
  const normalizedLocation = normalizeMetadataLocation(metadata.location, metadata.environment)

  if (!hasRequiredValue(metadata.productSource)) missingFields.push('product source')
  if (!hasRequiredValue(metadata.productType)) missingFields.push('product type')
  if (!hasRequiredValue(metadata.team)) missingFields.push('team')
  if (!hasRequiredValue(metadata.environment)) missingFields.push('environment')
  if (hasRequiredValue(metadata.environment) && !hasRequiredValue(normalizedLocation)) missingFields.push('location')
  if (!hasRequiredValue(metadata.entityName)) missingFields.push('entity name')
  if (!hasRequiredValue(source.streamingContinuity)) missingFields.push('streaming continuity')
  if (!hasRequiredValue(source.recordsPerDay)) missingFields.push('avg records per day')

  return missingFields
}

export function getMissingSourceRequiredFields(source = {}) {
  const missingFields = []
  const sourceType = String(source.sourceType || '').trim().toLowerCase()

  if (!hasRequiredValue(source.sourceType)) {
    missingFields.push('source type')
    return missingFields
  }

  if (!hasRequiredValue(source.format)) missingFields.push('message / file format')
  if (String(source.format || '').trim().toUpperCase() === 'CSV' && !hasRequiredValue(source.csvDelimiter)) {
    missingFields.push('column delimiter')
  }

  if (sourceType === 'kafka') {
    if (!hasRequiredValue(source.kafkaEnv)) missingFields.push('environment')
    if (!hasRequiredValue(source.kafkaTopic)) missingFields.push('topic')
    if (!hasRequiredValue(source.kafkaOffset)) missingFields.push('offset')
  }

  if (sourceType === 'rabbitmq') {
    if (!hasRequiredValue(source.rmqIp)) missingFields.push('ip')
    if (!hasRequiredValue(source.rmqPort)) missingFields.push('port')
    if (!hasRequiredValue(source.rmqUsername)) missingFields.push('username')
    if (!hasRequiredValue(source.rmqPassword)) missingFields.push('password')
    if (!hasRequiredValue(source.rmqQueue)) missingFields.push('queue')
  }

  return missingFields
}

export function getMissingSinkRequiredFields(sink = {}) {
  const missingFields = []
  const sinkType = String(sink.sinkType || '').trim().toLowerCase()

  if (!hasRequiredValue(sink.sinkType)) {
    missingFields.push('sink type')
    return missingFields
  }

  if (sinkType === 'kafka') {
    if (!hasRequiredValue(sink.sinkKafkaEnv)) missingFields.push('bootstrap environment')
  }

  if (sinkType === 'rabbitmq') {
    if (!hasRequiredValue(sink.sinkRmqVhost)) missingFields.push('vhost')
    if (!hasRequiredValue(sink.sinkRmqPort)) missingFields.push('port')
    if (!hasRequiredValue(sink.sinkRmqQueue)) missingFields.push('queue name')
  }

  return missingFields
}

function getFilterOperatorDefinition(filterOperators = MOCK_FILTER_OPERATORS, operatorId) {
  if (!operatorId) return null
  return filterOperators.find(operator => operator?.id === operatorId || operator?.name === operatorId) || null
}

function parseFilterRuleValue(value) {
  if (!value || typeof value !== 'string') return null

  try {
    const parsedValue = JSON.parse(value)
    return parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue)
      ? parsedValue
      : null
  } catch {
    return null
  }
}

function getFilterOperatorComplexProperties(operatorDefinition = {}) {
  const complexProperties = Array.isArray(operatorDefinition?.additionalProperties?.properties)
    ? operatorDefinition.additionalProperties.properties
    : []
  const declaredAdditionalParams = Array.isArray(operatorDefinition?.additionalParams)
    ? operatorDefinition.additionalParams
    : Array.isArray(operatorDefinition?.additional_params)
      ? operatorDefinition.additional_params
      : null

  if (declaredAdditionalParams) {
    return declaredAdditionalParams.length > 0 ? complexProperties : []
  }

  return complexProperties
}

function hasFilterOperatorExplicitNoAdditionalParams(operatorDefinition = {}) {
  const declaredAdditionalParams = Array.isArray(operatorDefinition?.additionalParams)
    ? operatorDefinition.additionalParams
    : Array.isArray(operatorDefinition?.additional_params)
      ? operatorDefinition.additional_params
      : null

  return Array.isArray(declaredAdditionalParams) && declaredAdditionalParams.length === 0
}

function getMissingFilterRuleFields(rule = {}, filterOperators = MOCK_FILTER_OPERATORS) {
  const missingFields = []
  const operatorId = String(rule?.op || '').trim()

  if (!hasRequiredValue(rule?.field)) missingFields.push('field')
  if (!hasRequiredValue(operatorId)) missingFields.push('operator')
  if (missingFields.length > 0) return missingFields

  if (operatorId.includes('null')) return missingFields

  const operatorDefinition = getFilterOperatorDefinition(filterOperators, operatorId)
  if (hasFilterOperatorExplicitNoAdditionalParams(operatorDefinition)) {
    return missingFields
  }
  const complexProperties = getFilterOperatorComplexProperties(operatorDefinition)

  if (complexProperties.length > 0) {
    const parsedValue = parseFilterRuleValue(rule?.value)

    if (!parsedValue) {
      return ['properties']
    }

    complexProperties.forEach(property => {
      const propertyValue = parsedValue[property.key] ?? property.default
      if (!hasRequiredValue(propertyValue)) {
        missingFields.push(property.label || property.key)
      }
    })

    return missingFields
  }

  if (!hasRequiredValue(rule?.value)) missingFields.push('value')
  return missingFields
}

function countFilterRules(groups = []) {
  return groups.reduce((count, group) => (
    count
    + (Array.isArray(group?.rules) ? group.rules.length : 0)
    + countFilterRules(Array.isArray(group?.subgroups) ? group.subgroups : [])
  ), 0)
}

function validateFilterGroup(group = {}, filterOperators = MOCK_FILTER_OPERATORS, path = 'group 1') {
  const rules = Array.isArray(group?.rules) ? group.rules : []
  const subgroups = Array.isArray(group?.subgroups) ? group.subgroups : []
  const missingFields = []
  const invalidRules = []
  const invalidSubgroups = []

  if (!['AND', 'OR'].includes(String(group?.logic || '').toUpperCase())) {
    missingFields.push('logic')
  }

  if ((rules.length + subgroups.length) === 0) {
    missingFields.push('condition')
  }

  rules.forEach((rule, index) => {
    const missingRuleFields = getMissingFilterRuleFields(rule, filterOperators)
    if (missingRuleFields.length > 0) {
      invalidRules.push({
        path: `${path} rule ${index + 1}`,
        missingFields: missingRuleFields,
      })
    }
  })

  subgroups.forEach((subgroup, index) => {
    const subgroupValidation = validateFilterGroup(subgroup, filterOperators, `${path}.${index + 1}`)
    if (!subgroupValidation.isValid) {
      invalidSubgroups.push(subgroupValidation)
    }
  })

  return {
    path,
    missingFields,
    invalidRules,
    invalidSubgroups,
    isValid: missingFields.length === 0 && invalidRules.length === 0 && invalidSubgroups.length === 0,
  }
}

export function getFilterValidation(filters = [], filterOperators = MOCK_FILTER_OPERATORS) {
  const normalizedFilters = Array.isArray(filters) ? filters : []
  const groupValidations = normalizedFilters.map((group, index) => validateFilterGroup(group, filterOperators, `group ${index + 1}`))
  const invalidGroups = groupValidations.filter(groupValidation => !groupValidation.isValid)

  return {
    hasFilters: normalizedFilters.length > 0,
    ruleCount: countFilterRules(normalizedFilters),
    invalidGroups,
    isValid: invalidGroups.length === 0,
  }
}

export function getResolvedTargetSchema(state) {
  return resolveTargetSchema(state?.targetSchema)
}

export function getRequiredTargetFields(targetSchema = []) {
  return targetSchema.filter(field => field?.required)
}

export function getUnmappedRequiredTargets(mappings = [], targetSchema = []) {
  const requiredFields = getRequiredTargetFields(targetSchema)
  return requiredFields.filter(field => !mappings.some(mapping => mapping?.tgt === field.id))
}

function parseTransformerChainEntry(entry) {
  if (!entry) return null
  if (typeof entry === 'string') return { ref: entry, props: {} }
  if (typeof entry !== 'object') return null

  const ref = entry.id || entry._id || entry.transformerId || entry.transformer || entry.name
  const props = (entry.props && typeof entry.props === 'object')
    ? entry.props
    : (entry.transformerProps && typeof entry.transformerProps === 'object')
      ? entry.transformerProps
      : {}

  if (!ref) return null
  return { ref, props }
}

export function getMappingTransformerChain(mapping = {}) {
  const rawChain = Array.isArray(mapping?.transformerChainDetailed) && mapping.transformerChainDetailed.length > 0
    ? mapping.transformerChainDetailed
    : Array.isArray(mapping?.transformerChain) && mapping.transformerChain.length > 0
      ? mapping.transformerChain
      : []

  const parsedChain = rawChain
    .map(parseTransformerChainEntry)
    .filter(Boolean)

  if (parsedChain.length > 0) return parsedChain

  if (mapping?.transformer && mapping.transformer !== 'none') {
    return [{ ref: mapping.transformer, props: mapping.transformerProps || {} }]
  }

  return []
}

export function getInvalidTransformerMappings(mappings = [], transformers = []) {
  if (!Array.isArray(transformers) || transformers.length === 0) return []

  return mappings.flatMap((mapping, mappingIndex) => (
    getMappingTransformerChain(mapping).flatMap((chainItem, chainIndex) => {
      const transformer = findTransformer(transformers, chainItem.ref)
      if (!transformer) return []

      const missingRequiredProps = getMissingRequiredTransformerProps(transformers, chainItem.ref, chainItem.props || {})
      if (missingRequiredProps.length === 0) return []

      return [{
        mappingIndex,
        chainIndex,
        mapping,
        transformerRef: chainItem.ref,
        transformerName: transformer.name || String(chainItem.ref),
        missingRequiredProps,
      }]
    })
  ))
}

export function getFieldMappingValidation(state, targetSchema = getResolvedTargetSchema(state), transformers = []) {
  const mappings = Array.isArray(state?.mappings) ? state.mappings : []
  const unmappedRequiredTargets = getUnmappedRequiredTargets(mappings, targetSchema)
  const invalidTransformers = getInvalidTransformerMappings(mappings, transformers)
  const hasMappings = mappings.length > 0

  return {
    hasMappings,
    unmappedRequiredTargets,
    invalidTransformers,
    isValid: hasMappings && unmappedRequiredTargets.length === 0 && invalidTransformers.length === 0,
  }
}

export function getSummaryValidations(state, targetSchema = getResolvedTargetSchema(state), transformers = [], filterOperators = MOCK_FILTER_OPERATORS) {
  const source = state?.source || {}
  const metadata = state?.metadata || {}
  const filters = Array.isArray(state?.filters) ? state.filters : []
  const sink = state?.sink || {}
  const fieldMappingValidation = getFieldMappingValidation(state, targetSchema, transformers)
  const filterValidation = getFilterValidation(filters, filterOperators)
  const srcMeta = SOURCE_TYPES.find(t => t.id === source.sourceType)
  const missingMetadataFields = getMissingMetadataRequiredFields(metadata, source)
  const missingSourceFields = getMissingSourceRequiredFields(source, metadata)
  const missingSinkFields = getMissingSinkRequiredFields(sink, metadata)
  const invalidTransformerSummary = fieldMappingValidation.invalidTransformers
    .map(item => `${item.transformerName} (${item.missingRequiredProps.map(prop => prop.label || prop.key).join(', ')})`)
    .join('; ')
  const requiredTargetFieldIds = targetSchema.filter(field => field?.required).map(field => field.id)
  const reqMapped = Array.isArray(state?.mappings)
    ? state.mappings.filter(mapping => requiredTargetFieldIds.includes(mapping?.tgt)).length
    : 0

  return [
    {
      key: 'requiredFieldsMapped',
      stepIndex: SUMMARY_VALIDATION_STEP_INDEXES.requiredFieldsMapped,
      type: fieldMappingValidation.unmappedRequiredTargets.length === 0 ? 'ok' : 'err',
      text: `Required fields mapped (${reqMapped}/${requiredTargetFieldIds.length || 0})`,
    },
    {
      key: 'hasMappings',
      stepIndex: SUMMARY_VALIDATION_STEP_INDEXES.hasMappings,
      type: fieldMappingValidation.hasMappings ? 'ok' : 'warn',
      text: `${Array.isArray(state?.mappings) ? state.mappings.length : 0} field mapping(s) defined`,
    },
    {
      key: 'transformersConfigured',
      stepIndex: SUMMARY_VALIDATION_STEP_INDEXES.transformersConfigured,
      type: fieldMappingValidation.invalidTransformers.length === 0 ? 'ok' : 'err',
      text: fieldMappingValidation.invalidTransformers.length === 0
        ? 'All required transformer properties configured'
        : `Incomplete transformer configuration: ${invalidTransformerSummary}`,
    },
    {
      key: 'sourceConfigured',
      stepIndex: SUMMARY_VALIDATION_STEP_INDEXES.sourceConfigured,
      type: missingSourceFields.length === 0 ? 'ok' : 'err',
      text: missingSourceFields.length === 0
        ? `Source configured: ${srcMeta?.name || 'unknown'}${source.sourceType === 'kafka' && source.kafkaOffset ? ` (offset: ${source.kafkaOffset})` : ''}`
        : `Source configuration incomplete. ${formatMissingRequiredFieldsText(missingSourceFields)}`,
    },
    {
      key: 'metadataConfigured',
      stepIndex: SUMMARY_VALIDATION_STEP_INDEXES.metadataConfigured,
      type: missingMetadataFields.length === 0 ? 'ok' : 'err',
      text: missingMetadataFields.length === 0
        ? `Metadata configured: ${metadata.productSource || ''} / ${metadata.productType || ''}`
        : `Metadata incomplete. ${formatMissingRequiredFieldsText(missingMetadataFields)}`,
    },
    {
      key: 'filtersConfigured',
      stepIndex: SUMMARY_VALIDATION_STEP_INDEXES.filtersConfigured,
      type: filterValidation.isValid ? 'ok' : 'err',
      text: !filterValidation.hasFilters
        ? '0 filter rule(s) active (all records will pass)'
        : filterValidation.isValid
          ? `${filterValidation.ruleCount} filter rule(s) active`
          : `Filters incomplete. ${filterValidation.invalidGroups.map(group => {
            const groupIssues = []
            if (group.missingFields.length > 0) {
              groupIssues.push(`${group.path}: ${group.missingFields.join(', ')}`)
            }
            group.invalidRules.forEach(rule => {
              groupIssues.push(`${rule.path}: ${rule.missingFields.join(', ')}`)
            })
            group.invalidSubgroups.forEach(subgroup => {
              if (subgroup.missingFields.length > 0) {
                groupIssues.push(`${subgroup.path}: ${subgroup.missingFields.join(', ')}`)
              }
              subgroup.invalidRules.forEach(rule => {
                groupIssues.push(`${rule.path}: ${rule.missingFields.join(', ')}`)
              })
            })
            return groupIssues.join('; ')
          }).filter(Boolean).join('; ')}`,
    },
    {
      key: 'sinkConfigured',
      stepIndex: SUMMARY_VALIDATION_STEP_INDEXES.sinkConfigured,
      type: missingSinkFields.length === 0 ? 'ok' : 'err',
      text: missingSinkFields.length === 0
        ? `Sink configured: ${sink.sinkType || 'none'}`
        : `Sink configuration incomplete. ${formatMissingRequiredFieldsText(missingSinkFields)}`,
    },
  ]
}

export function canDeployFromSummaryChecklist(state, targetSchema = getResolvedTargetSchema(state), transformers = [], filterOperators = MOCK_FILTER_OPERATORS) {
  return getSummaryValidations(state, targetSchema, transformers, filterOperators).every(item => item.type === 'ok')
}

export function getSummaryFailingStepIndexes(state, targetSchema = getResolvedTargetSchema(state), transformers = [], filterOperators = MOCK_FILTER_OPERATORS) {
  return new Set(
    getSummaryValidations(state, targetSchema, transformers, filterOperators)
      .filter(item => item.type !== 'ok')
      .map(item => item.stepIndex)
  )
}

export function isWizardStepValid(stepIndex, state, targetSchema = getResolvedTargetSchema(state), transformers = [], filterOperators = MOCK_FILTER_OPERATORS) {
  const { metadata = {}, source = {}, upload = {}, sink = {}, filters = [] } = state || {}

  if (stepIndex === 0) {
    return getMissingMetadataRequiredFields(metadata, source).length === 0
  }

  if (stepIndex === 1) {
    return getMissingSourceRequiredFields(source, metadata).length === 0
  }

  if (stepIndex === 2) {
    return Boolean(upload && (upload.done || upload.fileName || (Array.isArray(upload.schema) && upload.schema.length > 0)))
  }

  if (stepIndex === 3) {
    const filterValidation = getFilterValidation(filters, filterOperators)
    return !filterValidation.hasFilters || filterValidation.isValid
  }

  if (stepIndex === 4) {
    return getFieldMappingValidation(state, targetSchema, transformers).isValid
  }

  if (stepIndex === 5) {
    return getMissingSinkRequiredFields(sink, metadata).length === 0
  }

  if (stepIndex === 6) {
    return true
  }

  return true
}

export function canNavigateToWizardStep(targetStep, state, targetSchema = getResolvedTargetSchema(state), transformers = [], filterOperators = MOCK_FILTER_OPERATORS) {
  const currentStep = state?.currentStep ?? 0
  const completedSteps = state?.completedSteps instanceof Set
    ? state.completedSteps
    : new Set(Array.isArray(state?.completedSteps) ? state.completedSteps : [])
  const completedIndexes = Array.from(completedSteps).filter(Number.isInteger)
  const furthestCompletedStep = completedIndexes.length > 0 ? Math.max(...completedIndexes) : 0
  const furthestVisitedStep = Math.max(
    currentStep,
    furthestCompletedStep,
    Number.isInteger(state?.furthestStepVisited) ? state.furthestStepVisited : 0,
  )

  if (targetStep <= furthestVisitedStep) return true
  if (targetStep !== currentStep + 1) return false

  return isWizardStepValid(currentStep, state, targetSchema, transformers, filterOperators)
}