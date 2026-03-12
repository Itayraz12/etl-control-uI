export function quoteYamlDoubleQuoted(value = '') {
  const text = value == null ? '' : String(value)
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')

  return `"${escaped}"`
}

export function formatTransformationYamlItem(expression = '') {
  return `  - ${quoteYamlDoubleQuoted(expression)}`
}

export function formatFilterYamlItem(expression = '') {
  return `  - ${quoteYamlDoubleQuoted(expression)}`
}

export function formatInputFieldsYamlSection(fields = []) {
  const normalizedFields = fields
    .map(field => ({
      name: field?.name == null ? '' : String(field.name).trim(),
      type: field?.type == null ? 'unknown' : String(field.type).trim() || 'unknown',
    }))
    .filter(field => field.name)
    .filter((field, index, list) => list.findIndex(candidate => candidate.name === field.name) === index)

  if (normalizedFields.length === 0) return ''

  return `inputFields:\n${normalizedFields.map(field => `  - name: ${field.name}\n    type: ${field.type}`).join('\n')}`
}
