import { useEffect } from 'react'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { useConfig } from '../../shared/store/configContext.jsx'
import { Card, CardTitle, Btn, Tooltip } from '../../shared/components/index.jsx'
import { resolveSourceSchema } from '../../shared/types/index.js'

function createDefaultRootGroup() {
  return { id: 'root-group', logic: 'AND', mode: 'exclude', isRevertible: true, rules: [], subgroups: [] }
}

function normalizeRootFilterGroup(group = {}) {
  if (!group || typeof group !== 'object') return createDefaultRootGroup()
  return {
    ...group,
    mode: 'exclude',
  }
}

function getLongestLabelLength(items = [], getLabel = item => item) {
  return (Array.isArray(items) ? items : [])
    .map(item => String(getLabel(item) ?? '').trim().length)
    .reduce((maxLength, currentLength) => Math.max(maxLength, currentLength), 0)
}

function getSelectWidthFromLongestLabel(items = [], getLabel = item => item, {
  minChars = 12,
  extraChars = 4,
} = {}) {
  const longestLabelLength = getLongestLabelLength(items, getLabel)
  const totalChars = Math.max(minChars, longestLabelLength + extraChars)
  return `${totalChars}ch`
}

function getOperatorSelectionValue(operatorLike = {}) {
  const operatorId = String(operatorLike?.op ?? operatorLike?.id ?? '').trim()
  const isReverted = operatorLike?.isReverted === true
  return `${operatorId}::${isReverted ? '1' : '0'}`
}

function resolveOperatorDefinition(operators = [], operatorLike = {}) {
  const normalizedOperators = Array.isArray(operators) ? operators : []
  const rawOperatorId = String(operatorLike?.op ?? operatorLike?.id ?? '').trim()
  const normalizedOperatorId = rawOperatorId.toLowerCase()
  const isReverted = operatorLike?.isReverted === true

  if (!rawOperatorId) return null

  return normalizedOperators.find(operator => getOperatorSelectionValue(operator) === getOperatorSelectionValue({ id: rawOperatorId, isReverted }))
    || normalizedOperators.find(operator => String(operator?.id ?? '').trim() === rawOperatorId && Boolean(operator?.isReverted) === isReverted)
    || normalizedOperators.find(operator => String(operator?.name ?? '').trim() === rawOperatorId && Boolean(operator?.isReverted) === isReverted)
    || normalizedOperators.find((operator) => {
      if (Boolean(operator?.isReverted) !== isReverted) return false

      return [operator?.id, operator?.name, operator?.symbol, operator?.rule]
        .map(value => String(value ?? '').trim().toLowerCase())
        .filter(Boolean)
        .includes(normalizedOperatorId)
    })
    || null
}

function resolveOperatorDisplayName(operators = [], operatorId = '', isReverted = false) {
  const normalizedOperatorId = String(operatorId ?? '').trim()
  if (!normalizedOperatorId) return ''

  const matchingOperator = resolveOperatorDefinition(operators, { op: normalizedOperatorId, isReverted })

  return String(matchingOperator?.name ?? normalizedOperatorId).trim()
}

function parseOperatorSelectionValue(value = '') {
  const [rawOperatorId = '', revertedToken = '0'] = String(value ?? '').split('::')
  return {
    op: rawOperatorId.trim(),
    isReverted: revertedToken === '1',
  }
}

function hasRequiredValue(value) {
  if (value === 0 || value === false) return true
  if (typeof value === 'string') return value.trim() !== ''
  return value != null && Boolean(value)
}

function parseRuleObjectValue(value) {
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

function asTrimmedText(value = '') {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

function resolveAdditionalParamLabelOverride(param = {}) {
  const displayName = asTrimmedText(param.displayName ?? param.display_name)
  if (displayName) return displayName

  const explicitLabel = asTrimmedText(param.label)
  if (explicitLabel) return explicitLabel

  return ''
}

function getOperatorAdditionalParams(operator = {}) {
  if (Array.isArray(operator?.additionalParams)) return operator.additionalParams
  if (Array.isArray(operator?.additional_params)) return operator.additional_params
  return null
}

function hasExplicitNoAdditionalParams(operator = {}) {
  const additionalParams = getOperatorAdditionalParams(operator)
  return Array.isArray(additionalParams) && additionalParams.length === 0
}

function getOperatorComplexProperties(operator = {}) {
  const properties = Array.isArray(operator?.additionalProperties?.properties)
    ? operator.additionalProperties.properties
    : []
  const additionalParams = getOperatorAdditionalParams(operator)
  const displayLabelByKey = new Map(
    (Array.isArray(additionalParams) ? additionalParams : [])
      .map((param, index) => {
        const key = asTrimmedText(param?.name ?? param?.key)
        if (!key) return null

        return [key, resolveAdditionalParamLabelOverride(param)]
      })
      .filter(Boolean)
  )
  const normalizedProperties = properties.map((property, index) => {
    const key = asTrimmedText(property?.key)

    return {
      ...property,
      label: displayLabelByKey.get(key)
        || asTrimmedText(property?.label)
        || key
        || `param_${index + 1}`,
    }
  })

  if (additionalParams) {
    return additionalParams.length > 0 ? normalizedProperties : []
  }

  return normalizedProperties
}

function getRuleValueForOperator(operator = {}, previousValue = '') {
  const operatorId = String(operator?.id ?? '').trim()
  if (operatorId.includes('null')) return ''

   if (hasExplicitNoAdditionalParams(operator)) return ''

  const complexProps = getOperatorComplexProperties(operator)
  if (complexProps.length > 0) {
    const parsedValue = parseRuleObjectValue(previousValue) || {}

    return JSON.stringify(
      complexProps.reduce((result, prop) => {
        result[prop.key] = parsedValue[prop.key] ?? prop.default ?? ''
        return result
      }, {})
    )
  }

  const valueOptions = Array.isArray(operator?.additionalProperties?.options)
    ? operator.additionalProperties.options
    : []
  if (valueOptions.length > 0) {
    return valueOptions.includes(previousValue) ? previousValue : ''
  }

  return parseRuleObjectValue(previousValue) ? '' : String(previousValue ?? '')
}

function getDefaultRuleOperator(group = {}, operators = []) {
  const availableSelectionValues = new Set(
    (Array.isArray(operators) ? operators : [])
      .map(getOperatorSelectionValue)
      .filter(Boolean)
  )

  const lastRuleOperator = [...(Array.isArray(group?.rules) ? group.rules : [])]
    .reverse()
    .map(rule => resolveOperatorDefinition(operators, rule) || { op: rule?.op, isReverted: rule?.isReverted })
    .map(getOperatorSelectionValue)
    .find(selectionValue => availableSelectionValues.has(selectionValue))

  if (lastRuleOperator) return lastRuleOperator
  return getOperatorSelectionValue(operators?.[0] || { id: 'eq', isReverted: false }) || 'eq::0'
}

function ConditionRow({ rule, onChange, onRemove, logic, operators, fieldOptions, isRootGroup = false, rootLayout = null }) {
  const currentOperator = resolveOperatorDefinition(operators, rule)
  const currentSelectionValue = getOperatorSelectionValue(currentOperator || { op: rule.op, isReverted: rule.isReverted })
  const additionalProps = currentOperator?.additionalProperties || {}
  const valueOptions = additionalProps.options || []
  const complexProps = getOperatorComplexProperties(currentOperator)
  const hidesScalarValueInput = hasExplicitNoAdditionalParams(currentOperator)
  const isSelect = valueOptions.length > 0
  const hasComplexProps = complexProps.length > 0
  const operatorId = String(currentOperator?.id ?? rule.op ?? '').trim()
  const operatorDescription = String(currentOperator?.description ?? '').trim()
  const isNullOperator = operatorId.includes('null')
  const parsedRuleObjectValue = hasComplexProps ? parseRuleObjectValue(rule.value) : null
  const parsedValues = hasComplexProps
    ? complexProps.reduce((result, prop) => {
      result[prop.key] = parsedRuleObjectValue?.[prop.key] ?? prop.default ?? ''
      return result
    }, {})
    : {}
  const isRuleValueInvalid = !isNullOperator && !hasComplexProps && !hidesScalarValueInput && !hasRequiredValue(rule.value)
  const fieldSelectStyle = isRootGroup
    ? { width: rootLayout?.fieldSelectWidth || '16ch', minWidth: rootLayout?.fieldSelectWidth || '16ch', flex: '0 0 auto' }
    : { flex: 1.5 }
  const logicLabelStyle = isRootGroup
    ? {
      width: rootLayout?.logicLabelWidth || '6ch',
      minWidth: rootLayout?.logicLabelWidth || '6ch',
      flex: '0 0 auto',
      textAlign: 'right',
    }
    : {
      minWidth: 26,
      textAlign: 'center',
    }
  const operatorSelectStyle = isRootGroup
    ? { width: rootLayout?.operatorSelectWidth || '18ch', minWidth: rootLayout?.operatorSelectWidth || '18ch', flex: '0 0 auto' }
    : { flex: 1.2 }
  const scalarValueStyle = isRootGroup
    ? { width: 'min(240px, 100%)', minWidth: 0, flex: '0 1 240px' }
    : { flex: 1 }
  const rootValueGapStyle = {
    width: rootLayout?.valueGapWidth || '1cm',
    minWidth: rootLayout?.valueGapWidth || '1cm',
    flex: '0 0 auto',
  }
  const rootValueAreaStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    flexWrap: 'wrap',
    flex: '1 1 auto',
    minWidth: 0,
  }
  const inlineComplexParamsContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    flexWrap: 'wrap',
    flex: '0 1 auto',
    minWidth: 0,
  }
  const inlineComplexParamItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flex: '0 1 auto',
    minWidth: 0,
  }
  const inlineComplexParamInputStyle = {
    width: 'min(220px, 100%)',
    minWidth: '120px',
    flex: '0 1 180px',
  }

  const wrapParamControlWithHint = (control, description = '', triggerStyle = {}) => {
    const hintText = String(description ?? '').trim()
    if (!hintText) return control

    return (
      <Tooltip content={hintText} placement="right" triggerStyle={triggerStyle}>
        {control}
      </Tooltip>
    )
  }

  const handleOperatorChange = (nextSelectionValue) => {
    const nextSelection = parseOperatorSelectionValue(nextSelectionValue)
    const nextOperator = resolveOperatorDefinition(operators, nextSelection)

    onChange({
      ...rule,
      ...nextSelection,
      value: getRuleValueForOperator(nextOperator, rule.value),
    })
  }

  const updateComplexValue = (key, val) => {
    const updated = { ...parsedValues, [key]: val }
    onChange({ ...rule, value: JSON.stringify(updated) })
  }

  const complexParamsContent = complexProps.map(prop => (
    isRootGroup ? (
      <div key={prop.key} style={inlineComplexParamItemStyle}>
        <label style={{ fontSize: 11, color: 'var(--muted)', minWidth: 'fit-content', textAlign: 'left', whiteSpace: 'nowrap' }}>{prop.label}:</label>
        {wrapParamControlWithHint(
          prop.type === 'boolean' ? (
            <select
              aria-label={prop.label}
              aria-invalid={!hasRequiredValue(parsedValues[prop.key])}
              value={String(parsedValues[prop.key] ?? prop.default ?? 'true')}
              onChange={e => updateComplexValue(prop.key, e.target.value)}
              style={inlineComplexParamInputStyle}
            >
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          ) : (
            <input
              aria-label={prop.label}
              aria-invalid={!hasRequiredValue(parsedValues[prop.key])}
              type={prop.type === 'number' ? 'number' : 'text'}
              value={parsedValues[prop.key] ?? prop.default ?? ''}
              onChange={e => updateComplexValue(prop.key, e.target.value)}
              placeholder={prop.default || prop.description || (prop.isArray ? 'Comma-separated values' : '')}
              style={inlineComplexParamInputStyle}
            />
          ),
          prop.description
        )}
      </div>
    ) : (
      <div key={prop.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, max-content) minmax(180px, 320px)', gap: 8, alignItems: 'center', justifyContent: 'flex-start', width: 'min(100%, 440px)' }}>
        <label style={{ fontSize: 11, color: 'var(--muted)', minWidth: 'fit-content', textAlign: 'left' }}>{prop.label}:</label>
        {wrapParamControlWithHint(
          prop.type === 'boolean' ? (
            <select aria-label={prop.label} aria-invalid={!hasRequiredValue(parsedValues[prop.key])} value={String(parsedValues[prop.key] ?? prop.default ?? 'true')} onChange={e => updateComplexValue(prop.key, e.target.value)} style={{ width: '100%', minWidth: 0 }}>
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          ) : (
            <input
              aria-label={prop.label}
              aria-invalid={!hasRequiredValue(parsedValues[prop.key])}
              type={prop.type === 'number' ? 'number' : 'text'}
              value={parsedValues[prop.key] ?? prop.default ?? ''}
              onChange={e => updateComplexValue(prop.key, e.target.value)}
              placeholder={prop.default || prop.description || (prop.isArray ? 'Comma-separated values' : '')}
              style={{ width: '100%', minWidth: 0 }}
            />
          ),
          prop.description,
          { width: '100%', minWidth: 0 }
        )}
      </div>
    )
  ))
  const rootScalarValueControl = !isNullOperator && !hasComplexProps && !hidesScalarValueInput
    ? (isSelect ? (
      <select aria-label="Filter value" aria-invalid={isRuleValueInvalid} value={rule.value} onChange={e => onChange({ ...rule, value: e.target.value })} style={scalarValueStyle}>
        <option value="">-- Select --</option>
        {valueOptions.map(opt => <option key={opt}>{opt}</option>)}
      </select>
    ) : (
      <input aria-label="Filter value" aria-invalid={isRuleValueInvalid} value={rule.value} onChange={e => onChange({ ...rule, value: e.target.value })} placeholder="1" style={scalarValueStyle} />
    ))
    : null
  const shouldShowRootValueArea = isRootGroup && (Boolean(rootScalarValueControl) || (hasComplexProps && !isNullOperator))
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6, animation: 'slideIn .2s ease' }}>
      <div
        data-testid={isRootGroup ? `root-filter-row-${rule.id}` : undefined}
        style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-start', flexWrap: isRootGroup ? 'wrap' : 'nowrap' }}
      >
        <span
          data-testid={isRootGroup ? `root-filter-logic-${rule.id}` : undefined}
          style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, ...logicLabelStyle }}
        >
          {logic}
        </span>
        <select
          data-testid={isRootGroup ? `root-filter-field-${rule.id}` : undefined}
          value={rule.field}
          onChange={e => onChange({ ...rule, field: e.target.value })}
          style={fieldSelectStyle}
        >
          {fieldOptions.map(f => <option key={f}>{f}</option>)}
        </select>
        <Tooltip content={operatorDescription} placement="right">
          <select
            data-testid={isRootGroup ? `root-filter-operator-${rule.id}` : undefined}
            value={currentSelectionValue}
            onChange={e => handleOperatorChange(e.target.value)}
            style={operatorSelectStyle}
          >
            {operators.map(o => (
              <option key={`${o.id}-${o.isReverted === true ? 'reverted' : 'regular'}`} value={getOperatorSelectionValue(o)}>{o.name}</option>
            ))}
          </select>
        </Tooltip>
        {!isRootGroup && !isNullOperator && !hasComplexProps && !hidesScalarValueInput && (
          isSelect ? (
            <select aria-label="Filter value" aria-invalid={isRuleValueInvalid} value={rule.value} onChange={e => onChange({ ...rule, value: e.target.value })} style={scalarValueStyle}>
              <option value="">-- Select --</option>
              {valueOptions.map(opt => <option key={opt}>{opt}</option>)}
            </select>
          ) : (
            <input aria-label="Filter value" aria-invalid={isRuleValueInvalid} value={rule.value} onChange={e => onChange({ ...rule, value: e.target.value })} placeholder="1" style={scalarValueStyle} />
          )
        )}
        {shouldShowRootValueArea && (
          <>
            <div data-testid={`root-filter-value-gap-${rule.id}`} style={rootValueGapStyle} />
            <div data-testid={`root-filter-value-area-${rule.id}`} style={rootValueAreaStyle}>
              {rootScalarValueControl}
              {hasComplexProps && !isNullOperator && (
                <div data-testid={`root-filter-inline-params-${rule.id}`} style={inlineComplexParamsContainerStyle}>
                  {complexParamsContent}
                </div>
              )}
            </div>
          </>
        )}
        <div
          data-testid={isRootGroup ? `root-filter-remove-${rule.id}` : undefined}
          style={{ marginLeft: 'auto', flex: '0 0 auto', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}
        >
          <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16, lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>
      </div>
      {hasComplexProps && !isNullOperator && !isRootGroup && (
        <div data-testid={`filter-params-${rule.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 34, alignItems: 'flex-start' }}>
          {complexParamsContent}
        </div>
      )}
    </div>
  )
}

function GroupBlock({ group, depth, onUpdate, onRemove, operators, fieldOptions, readOnly = false, rootLayout = null }) {
  const normalizedGroup = depth === 0 ? normalizeRootFilterGroup(group) : group
  const emitGroupUpdate = (updatedGroup) => onUpdate(depth === 0 ? normalizeRootFilterGroup(updatedGroup) : updatedGroup)
  const addRule = () => {
    const defaultOperator = getDefaultRuleOperator(normalizedGroup, operators)
    const defaultRuleOperator = parseOperatorSelectionValue(defaultOperator)
    const defaultOperatorDefinition = resolveOperatorDefinition(operators, defaultRuleOperator)

    emitGroupUpdate({
      ...normalizedGroup,
      rules: [...normalizedGroup.rules, {
        id: `r-${Date.now()}`,
        field: fieldOptions[0] || 'id',
        ...defaultRuleOperator,
        value: getRuleValueForOperator(defaultOperatorDefinition, '1'),
      }]
    })
  }
  const updateRule = (id, updated) => emitGroupUpdate({ ...normalizedGroup, rules: normalizedGroup.rules.map(r => r.id === id ? updated : r) })
  const removeRule = id => emitGroupUpdate({ ...normalizedGroup, rules: normalizedGroup.rules.filter(r => r.id !== id) })
  const updateSubgroup = (id, updated) => emitGroupUpdate({ ...normalizedGroup, subgroups: normalizedGroup.subgroups.map(g => g.id === id ? updated : g) })
  const removeSubgroup = id => emitGroupUpdate({ ...normalizedGroup, subgroups: normalizedGroup.subgroups.filter(g => g.id !== id) })

  const colors = ['rgba(79,110,247,.12)', 'rgba(124,58,237,.12)', 'rgba(236,72,153,.1)']
  const borderColors = ['rgba(79,110,247,.4)', 'rgba(124,58,237,.4)', 'rgba(236,72,153,.4)']
  const disableRootGroupButtons = readOnly && depth === 0
  const canToggleGroupMode = false

  return (
    <div style={{
      background: colors[depth] || colors[2],
      border: `1.5px solid ${borderColors[depth] || borderColors[2]}`,
      borderRadius: 10, padding: 14, marginBottom: depth > 0 ? 0 : 12,
    }}>
      {/* Group header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: depth === 0 ? 'var(--accent)' : 'var(--accent2)' }}>
          {depth === 0 ? 'ROOT GROUP' : `SUBGROUP ${depth}`}
        </span>
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 5, overflow: 'hidden' }}>
          {['AND', 'OR'].map(op => (
            <button key={op} onClick={() => emitGroupUpdate({ ...normalizedGroup, logic: op })} disabled={disableRootGroupButtons} style={{
              padding: '3px 10px', fontSize: 11, fontWeight: 700, border: 'none', cursor: disableRootGroupButtons ? 'not-allowed' : 'pointer',
              background: normalizedGroup.logic === op ? (depth === 0 ? 'var(--accent)' : 'var(--accent2)') : 'transparent',
              color: normalizedGroup.logic === op ? '#fff' : 'var(--muted)',
              opacity: disableRootGroupButtons ? 0.5 : 1,
              transition: 'all .15s',
            }}>{op}</button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: 'var(--muted)', flex: 1 }}>
          {normalizedGroup.logic === 'AND' ? 'All must match' : 'Any must match'}
        </span>
        {canToggleGroupMode && (
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 5, overflow: 'hidden' }}>
            {['include', 'exclude'].map(mode => (
              <button key={mode} onClick={() => onUpdate({ ...group, mode: mode || 'include' })} disabled={disableRootGroupButtons} style={{
                padding: '3px 10px', fontSize: 11, fontWeight: 700, border: 'none', cursor: disableRootGroupButtons ? 'not-allowed' : 'pointer', textTransform: 'capitalize',
                background: (group.mode || 'include') === mode ? 'var(--accent)' : 'transparent',
                color: (group.mode || 'include') === mode ? '#fff' : 'var(--muted)',
                opacity: disableRootGroupButtons ? 0.5 : 1,
                transition: 'all .15s',
              }}>{mode}</button>
            ))}
          </div>
        )}
        {onRemove && (
          <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 18, fontWeight: 700, padding: '0 4px', lineHeight: 1 }}>×</button>
        )}
      </div>

      {/* Rules */}
      {normalizedGroup.rules.map((r, i) => (
        <ConditionRow
          key={r.id}
          rule={r}
          logic={i === 0 ? 'WHERE' : group.logic}
          onChange={u => updateRule(r.id, u)}
          onRemove={() => removeRule(r.id)}
          operators={operators}
          fieldOptions={fieldOptions}
          isRootGroup={depth === 0}
          rootLayout={rootLayout}
        />
      ))}

      {/* Subgroups */}
      {normalizedGroup.subgroups.map(sg => (
        <div key={sg.id} style={{ marginLeft: 20, marginTop: 8 }}>
          <GroupBlock
            group={sg}
            depth={depth + 1}
            onUpdate={u => updateSubgroup(sg.id, u)}
            onRemove={() => removeSubgroup(sg.id)}
            operators={operators}
            fieldOptions={fieldOptions}
            readOnly={readOnly}
            rootLayout={rootLayout}
          />
        </div>
      ))}

      {/* Add buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Btn sm v="ghost" onClick={addRule}>+ Add Condition</Btn>
      </div>
    </div>
  )
}

export default function   FiltersStep() {
  const { state, actions } = useWizard()
  const { filters: operators } = useConfig()
  const filters = state.filters
  const setFilters = actions.setFilters
  const isReadOnly = state.readOnly === true
  const fieldOptions = resolveSourceSchema(state.upload).map(f => f.id)
  const normalizedFilters = filters.map(normalizeRootFilterGroup)
  const displayedFilters = normalizedFilters.length > 0 ? normalizedFilters : [createDefaultRootGroup()]
  const previewFilters = normalizedFilters.length > 0 ? normalizedFilters : []
  const rootLayout = {
    logicLabelWidth: getSelectWidthFromLongestLabel(['WHERE', 'AND', 'OR'], item => item, { minChars: 6, extraChars: 1 }),
    fieldSelectWidth: getSelectWidthFromLongestLabel(fieldOptions, item => item, { minChars: 12, extraChars: 3 }),
    operatorSelectWidth: getSelectWidthFromLongestLabel(operators, item => item?.name, { minChars: 14, extraChars: 4 }),
    valueGapWidth: '1cm',
  }
  const getRuleOperatorLabel = (rule) => resolveOperatorDisplayName(operators, rule?.op, rule?.isReverted)

  const formatRuleValue = (rule) => {
    try {
      const parsed = JSON.parse(rule.value)
      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.entries(parsed).map(([k, v]) => `${k}=${v}`).join(', ')
      }
    } catch {}
    return rule.value
  }

  const totalRules = displayedFilters.reduce((sum, g) => sum + g.rules.length + g.subgroups.reduce((s2, sg) => s2 + sg.rules.length, 0), 0)

  useEffect(() => {
    const hasRootModeMismatch = filters.some(group => String(group?.mode || '').trim().toLowerCase() !== 'exclude')
    if (!hasRootModeMismatch) return
    setFilters(filters.map(normalizeRootFilterGroup))
  }, [filters, setFilters])

  const updateGroup = (id, updated) => setFilters(filters.map(g => g.id === id ? normalizeRootFilterGroup(updated) : normalizeRootFilterGroup(g)))
  const removeGroup = id => setFilters(filters.filter(g => g.id !== id))
  const handleRootGroupUpdate = (id, updated) => {
    if (filters.length === 0) {
      setFilters([normalizeRootFilterGroup(updated)])
      return
    }

    updateGroup(id, updated)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Filter Rules</h2>
        <span style={{ fontSize: 12, background: 'rgba(79,110,247,.15)', color: 'var(--accent)', padding: '3px 10px', borderRadius: 20 }}>
          {totalRules} rule{totalRules !== 1 ? 's' : ''} active
        </span>
        <div style={{ flex: 1 }} />
      </div>

      {displayedFilters.map(g => (
        <GroupBlock
          key={g.id}
          group={g}
          depth={0}
          onUpdate={u => handleRootGroupUpdate(g.id, u)}
          onRemove={filters.length > 0 ? () => removeGroup(g.id) : undefined}
          operators={operators}
          fieldOptions={fieldOptions}
          readOnly={isReadOnly}
          rootLayout={rootLayout}
        />
      ))}

      {/* SQL preview */}
      <Card style={{ background: 'var(--surf2)', border: '1px solid var(--border)', marginTop: 8 }}>
        <CardTitle style={{ color: 'var(--accent)', fontSize: 11, textTransform: 'uppercase', letterSpacing: .6 }}>
          Generated Filter Expression
        </CardTitle>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)', lineHeight: 1.8, overflowX: 'auto', padding: '4px 0' }}>
          {previewFilters.map((g, gi) => (
            <div key={g.id}>
              {gi > 0 && <span style={{ color: 'var(--muted)' }}>  {g.logic === 'AND' ? 'AND' : 'OR'} </span>}
              {(g.mode === 'exclude') && <span style={{ color: 'var(--danger)', fontWeight: 700 }}>NOT </span>}
              <span style={{ color: 'var(--muted)' }}>(</span>
              {g.rules.map((r, ri) => (
                <span key={r.id}>
                  {ri > 0 && <span style={{ color: 'var(--muted)' }}> {g.logic} </span>}
                  <span style={{ color: 'var(--accent2)' }}>{r.field}</span>
                  <span style={{ color: 'var(--warning)' }}> {getRuleOperatorLabel(r) || r.op} </span>
                  {!String(r.op || '').includes('null') && <span style={{ color: 'var(--success)' }}>[{formatRuleValue(r)}]</span>}
                </span>
              ))}
              {g.subgroups.map(sg => (
                <span key={sg.id}>
                  {g.rules.length > 0 && <span style={{ color: 'var(--muted)' }}> {g.logic} </span>}
                  <span style={{ color: 'var(--muted)' }}>(</span>
                  {sg.rules.map((r, ri) => (
                    <span key={r.id}>
                      {ri > 0 && <span style={{ color: 'var(--muted)' }}> {sg.logic} </span>}
                      <span style={{ color: 'var(--accent2)' }}>{r.field}</span>
                      <span style={{ color: 'var(--warning)' }}> {getRuleOperatorLabel(r) || r.op} </span>
                      {!String(r.op || '').includes('null') && <span style={{ color: 'var(--success)' }}>[{formatRuleValue(r)}]</span>}
                    </span>
                  ))}
                  <span style={{ color: 'var(--muted)' }}>)</span>
                </span>
              ))}
              <span style={{ color: 'var(--muted)' }}>)</span>
            </div>
          ))}
          {filters.length === 0 && totalRules === 0 && <span style={{ color: 'var(--muted)' }}>— No filters defined (all records will pass) —</span>}
        </div>
      </Card>
    </div>
  )
}
