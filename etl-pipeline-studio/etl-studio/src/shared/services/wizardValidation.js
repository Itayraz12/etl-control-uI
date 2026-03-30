import { resolveTargetSchema } from '../types/index.js'
import { findTransformer, getMissingRequiredTransformerProps } from './transformerValidation.js'

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

export function isWizardStepValid(stepIndex, state, targetSchema = getResolvedTargetSchema(state), transformers = []) {
  const { metadata = {}, source = {}, upload = {}, sink = {} } = state || {}

  if (stepIndex === 0) {
    return Boolean(metadata.productSource && metadata.productType && metadata.environment && metadata.entityName)
  }

  if (stepIndex === 1) {
    if (!source.sourceType) return false

    if (source.sourceType === 'kafka') {
      return Boolean(source.kafkaEnv && source.kafkaTopic && source.kafkaOffset)
    }

    return true
  }

  if (stepIndex === 2) {
    return Boolean(upload && (upload.done || upload.fileName || (Array.isArray(upload.schema) && upload.schema.length > 0)))
  }

  if (stepIndex === 3) {
    return true
  }

  if (stepIndex === 4) {
    return getFieldMappingValidation(state, targetSchema, transformers).isValid
  }

  if (stepIndex === 5) {
    return Boolean(sink.sinkType)
  }

  if (stepIndex === 6) {
    return true
  }

  return true
}

export function canNavigateToWizardStep(targetStep, state, targetSchema = getResolvedTargetSchema(state), transformers = []) {
  const currentStep = state?.currentStep ?? 0
  const completedSteps = state?.completedSteps instanceof Set
    ? state.completedSteps
    : new Set(Array.isArray(state?.completedSteps) ? state.completedSteps : [])

  if (targetStep <= currentStep) return true
  if (completedSteps.has(targetStep)) return true
  if (targetStep !== currentStep + 1) return false

  return isWizardStepValid(currentStep, state, targetSchema, transformers)
}