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

function asFilterText(value = '') {
  if (value === undefined || value === null) return ''
  return String(value)
}

function normalizeFilterDependencyType(value = '') {
  return asFilterText(value).trim().toLowerCase().replace(/\s+/g, '_')
}

function formatFilterDependencyType(value = '') {
  return normalizeFilterDependencyType(value).toUpperCase()
}

function formatYamlTextValue(value = '') {
  const text = asFilterText(value)
  return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(text)
    ? text
    : quoteYamlDoubleQuoted(text)
}

function parseFilterTextValues(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue.map(asFilterText).map(value => value.trim()).filter(Boolean)
  }

  if (rawValue && typeof rawValue === 'object') {
    return Object.entries(rawValue)
      .map(([key, value]) => `${String(key).trim()}=${asFilterText(value).trim()}`)
      .filter(Boolean)
  }

  const text = asFilterText(rawValue).trim()
  if (!text) return []

  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) {
      return parsed.map(asFilterText).map(value => value.trim()).filter(Boolean)
    }
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed)
        .map(([key, value]) => `${String(key).trim()}=${asFilterText(value).trim()}`)
        .filter(Boolean)
    }
  } catch {
    // fall back to plain-text splitting below
  }

  return text
    .split(/[\r\n,]+/)
    .map(value => value.trim())
    .filter(Boolean)
}

function normalizeFilterMode(value = '') {
  return String(value || 'include').trim().toLowerCase() === 'exclude'
    ? 'exclude'
    : 'include'
}

function normalizeFilterLogic(value = '') {
  return String(value || 'AND').trim().toUpperCase() === 'OR'
    ? 'or'
    : 'and'
}

function buildStructuredFilterConfigEntries(groups = [], dependencyTypes = [], inheritedMode = 'include') {
  if (!Array.isArray(groups)) return []

  return groups
    .map((group) => {
      if (!group || typeof group !== 'object') return null

      const groupMode = normalizeFilterMode(group?.mode || inheritedMode)
      const logicKey = normalizeFilterLogic(group?.logic)
      const ruleItems = []
      const groupedConditions = new Map()

      ;(Array.isArray(group.rules) ? group.rules : []).forEach((rule) => {
        const field = asFilterText(rule?.field).trim()
        if (!field) return

        const values = Array.from(new Set(parseFilterTextValues(rule?.value)))
        const dependencyType = normalizeFilterDependencyType(rule?.op)
        const conditionKey = `${field}::${groupMode}::${dependencyType}`
        const existingCondition = groupedConditions.get(conditionKey) || {
          field,
          op: dependencyType,
          ...(groupMode !== 'include' ? { mode: groupMode } : {}),
          values: [],
        }

        dependencyTypes.push(dependencyType)
        existingCondition.values.push(...values)
        groupedConditions.set(conditionKey, existingCondition)
      })

      groupedConditions.forEach((condition) => {
        ruleItems.push({
          ...condition,
          values: Array.from(new Set(condition.values)),
        })
      })

      const subgroupEntries = buildStructuredFilterConfigEntries(group.subgroups, dependencyTypes, groupMode)
      subgroupEntries.forEach((entry) => {
        ruleItems.push(entry)
      })

      if (ruleItems.length === 0) return null

      return {
        rule: {
          [logicKey]: ruleItems,
        },
      }
    })
    .filter(Boolean)
}

function formatFilterConditionYaml(condition, indent = '') {
  const valuesYaml = condition.values.length > 0
    ? `${indent}  values:\n${condition.values.map(value => `${indent}    - ${formatYamlTextValue(value)}`).join('\n')}`
    : `${indent}  values: []`

  return [
    `${indent}- field: ${formatYamlTextValue(condition.field)}`,
    ...(condition.mode ? [`${indent}  mode: ${formatYamlTextValue(condition.mode)}`] : []),
    `${indent}  op: ${formatYamlTextValue(formatFilterDependencyType(condition.op))}`,
    valuesYaml,
  ].join('\n')
}

function formatFilterRuleYaml(entry, indent = '') {
  if (!entry || typeof entry !== 'object') return ''

  const rule = entry.rule && typeof entry.rule === 'object' ? entry.rule : null
  if (!rule) return ''

  const logicKey = Array.isArray(rule.or) ? 'or' : 'and'
  const items = Array.isArray(rule[logicKey]) ? rule[logicKey] : []
  const nestedIndent = `${indent}    `
  const itemIndent = `${nestedIndent}  `

  return [
    `${indent}- rule:`,
    `${nestedIndent}${logicKey}:`,
    items.map((item) => {
      if (item?.rule) {
        return formatFilterRuleYaml(item, itemIndent)
      }
      return formatFilterConditionYaml(item, itemIndent)
    }).filter(Boolean).join('\n'),
  ].filter(Boolean).join('\n')
}

export function formatFiltersYamlSection(filters = [], indent = '') {
  const dependencyTypes = []
  const configEntries = buildStructuredFilterConfigEntries(filters, dependencyTypes)
  if (configEntries.length === 0) return ''

  const normalizedDependencyTypes = dependencyTypes.filter(Boolean)
  const dependencyTypesForYaml = Array.from(new Set(normalizedDependencyTypes))

  const sectionIndent = indent
  const childIndent = `${sectionIndent}  `
  const grandChildIndent = `${childIndent}  `

  const dependenciesYaml = dependencyTypesForYaml.length > 0
    ? `${childIndent}dependencies:\n${dependencyTypesForYaml.map(type => `${grandChildIndent}- type: ${formatYamlTextValue(formatFilterDependencyType(type))}`).join('\n')}`
    : `${childIndent}dependencies: []`

  const configYaml = `${childIndent}config:\n${configEntries.map(entry => formatFilterRuleYaml(entry, grandChildIndent)).join('\n')}`

  return `${sectionIndent}filters:\n${dependenciesYaml}\n${configYaml}`
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
