import { resolveTargetSchema } from '../types/index.js'

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

export function getFieldMappingValidation(state, targetSchema = getResolvedTargetSchema(state)) {
  const mappings = Array.isArray(state?.mappings) ? state.mappings : []
  const unmappedRequiredTargets = getUnmappedRequiredTargets(mappings, targetSchema)
  const hasMappings = mappings.length > 0

  return {
    hasMappings,
    unmappedRequiredTargets,
    isValid: hasMappings && unmappedRequiredTargets.length === 0,
  }
}

export function isWizardStepValid(stepIndex, state, targetSchema = getResolvedTargetSchema(state)) {
  const { metadata = {}, source = {}, upload = {}, sink = {} } = state || {}

  if (stepIndex === 0) {
    return Boolean(metadata.productSource && metadata.productType && metadata.environment && metadata.entityName)
  }

  if (stepIndex === 1) {
    return Boolean(source.sourceType)
  }

  if (stepIndex === 2) {
    return Boolean(upload && (upload.done || upload.fileName || (Array.isArray(upload.schema) && upload.schema.length > 0)))
  }

  if (stepIndex === 3) {
    return true
  }

  if (stepIndex === 4) {
    return getFieldMappingValidation(state, targetSchema).isValid
  }

  if (stepIndex === 5) {
    return Boolean(sink.sinkType)
  }

  if (stepIndex === 6) {
    return true
  }

  return true
}

export function canNavigateToWizardStep(targetStep, state, targetSchema = getResolvedTargetSchema(state)) {
  const currentStep = state?.currentStep ?? 0

  if (targetStep <= currentStep) return true
  if (targetStep !== currentStep + 1) return false

  return isWizardStepValid(currentStep, state, targetSchema)
}