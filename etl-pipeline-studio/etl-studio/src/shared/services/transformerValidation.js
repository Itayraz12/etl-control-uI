export function findTransformer(transformers = [], transformerRef) {
  if (!transformerRef || transformerRef === 'none') return null
  return transformers.find(t => t._id === transformerRef || t.name === transformerRef) || null
}

export function getTransformerPropsSchema(transformers = [], transformerRef) {
  return findTransformer(transformers, transformerRef)?.propsSchema || []
}

export function isMissingRequiredTransformerPropValue(value) {
  if (value === 0 || value === false) return false
  if (typeof value === 'string') return value.trim() === ''
  return !value
}

export function getMissingRequiredTransformerProps(transformers = [], transformerRef, savedProps = {}) {
  const schema = getTransformerPropsSchema(transformers, transformerRef)
  return schema.filter(prop => prop.required && isMissingRequiredTransformerPropValue(savedProps[prop.key]))
}
