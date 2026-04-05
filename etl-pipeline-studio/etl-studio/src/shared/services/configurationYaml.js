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

export function compactYamlDocument(yaml = '') {
  return String(yaml ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]+$/g, ''))
    .filter(line => line.trim() !== '')
    .join('\n')
    .trim()
}

export function formatTransformationYamlItem(expression = '') {
  return `  - ${quoteYamlDoubleQuoted(expression)}`
}

export function formatFilterYamlItem(expression = '') {
  return `  - ${quoteYamlDoubleQuoted(expression)}`
}

export function normalizeKeyValueEntries(entries = []) {
  if (!Array.isArray(entries)) return []

  return entries
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null

      return {
        id: entry.id == null ? `entry-${index}` : String(entry.id),
        key: entry.key == null ? '' : String(entry.key).trim(),
        value: entry.value == null ? '' : String(entry.value),
      }
    })
    .filter(Boolean)
}

export function formatKeyValueYamlSection(sectionName = '', entries = [], indent = '  ') {
  const normalizedEntries = normalizeKeyValueEntries(entries).filter(entry => entry.key)
  if (!sectionName || normalizedEntries.length === 0) return ''

  const childIndent = `${indent}  `
  return `${indent}${sectionName}:\n${normalizedEntries.map(entry => `${childIndent}${quoteYamlDoubleQuoted(entry.key)}: ${quoteYamlDoubleQuoted(entry.value)}`).join('\n')}`
}

export function formatInputFieldsYamlSection(fields = [], indent = '  ') {
  const normalizedFields = fields
    .map(field => ({
      name: field?.name == null ? '' : String(field.name).trim(),
      type: field?.type == null ? 'unknown' : String(field.type).trim() || 'unknown',
    }))
    .filter(field => field.name)
    .filter((field, index, list) => list.findIndex(candidate => candidate.name === field.name) === index)

  if (normalizedFields.length === 0) return ''

  const childIndent = `${indent}  `
  return `${indent}mapping:\n${normalizedFields.map(field => `${childIndent}- name: ${field.name}\n${childIndent}  type: ${field.type}`).join('\n')}`
}
