import { useWizard } from '../../shared/store/wizardStore.jsx'
import { useConfig } from '../../shared/store/configContext.jsx'
import { Card, CardTitle, Btn } from '../../shared/components/index.jsx'
import { resolveSourceSchema } from '../../shared/types/index.js'

function createDefaultRootGroup() {
  return { id: 'root-group', logic: 'AND', mode: 'include', isRevertible: true, rules: [], subgroups: [] }
}

function getOperatorSelectionValue(operatorLike = {}) {
  const operatorId = String(operatorLike?.id ?? operatorLike?.op ?? '').trim()
  const isReverted = operatorLike?.isReverted === true
  return `${operatorId}::${isReverted ? '1' : '0'}`
}

function parseOperatorSelectionValue(value = '') {
  const [rawOperatorId = '', revertedToken = '0'] = String(value ?? '').split('::')
  return {
    op: rawOperatorId.trim(),
    isReverted: revertedToken === '1',
  }
}

function getDefaultRuleOperator(group = {}, operators = []) {
  const availableSelectionValues = new Set(
    (Array.isArray(operators) ? operators : [])
      .map(getOperatorSelectionValue)
      .filter(Boolean)
  )

  const lastRuleOperator = [...(Array.isArray(group?.rules) ? group.rules : [])]
    .reverse()
    .map(rule => getOperatorSelectionValue({ op: rule?.op, isReverted: rule?.isReverted }))
    .find(selectionValue => availableSelectionValues.has(selectionValue))

  if (lastRuleOperator) return lastRuleOperator
  return getOperatorSelectionValue(operators?.[0] || { id: 'eq', isReverted: false }) || 'eq::0'
}

function ConditionRow({ rule, onChange, onRemove, logic, operators, fieldOptions }) {
  const currentSelectionValue = getOperatorSelectionValue({ op: rule.op, isReverted: rule.isReverted })
  const currentOperator = operators.find(o => getOperatorSelectionValue(o) === currentSelectionValue)
    || operators.find(o => o.id === rule.op)
  const additionalProps = currentOperator?.additionalProperties || {}
  const valueOptions = additionalProps.options || []
  const complexProps = additionalProps.properties || []
  const isSelect = valueOptions.length > 0
  const hasComplexProps = complexProps.length > 0
  const operatorId = String(currentOperator?.id ?? rule.op ?? '').trim()

  let parsedValues = {}
  if (hasComplexProps) {
    try {
      parsedValues = typeof rule.value === 'string' ? JSON.parse(rule.value) : rule.value
    } catch {
      parsedValues = {}
      complexProps.forEach(p => { parsedValues[p.key] = p.default || '' })
    }
  }

  const updateComplexValue = (key, val) => {
    const updated = { ...parsedValues, [key]: val }
    onChange({ ...rule, value: JSON.stringify(updated) })
  }
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6, animation: 'slideIn .2s ease' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, minWidth: 26, textAlign: 'center' }}>{logic}</span>
        <select value={rule.field} onChange={e => onChange({ ...rule, field: e.target.value })} style={{ flex: 1.5 }}>
          {fieldOptions.map(f => <option key={f}>{f}</option>)}
        </select>
        <select value={currentSelectionValue} onChange={e => onChange({ ...rule, ...parseOperatorSelectionValue(e.target.value) })} style={{ flex: 1.2 }}>
          {operators.map(o => (
            <option key={`${o.id}-${o.isReverted === true ? 'reverted' : 'regular'}`} value={getOperatorSelectionValue(o)}>{o.name}</option>
          ))}
        </select>
        {!operatorId.includes('null') && !hasComplexProps && (
          isSelect ? (
            <select value={rule.value} onChange={e => onChange({ ...rule, value: e.target.value })} style={{ flex: 1 }}>
              <option value="">-- Select --</option>
              {valueOptions.map(opt => <option key={opt}>{opt}</option>)}
            </select>
          ) : (
            <input value={rule.value} onChange={e => onChange({ ...rule, value: e.target.value })} placeholder="1" style={{ flex: 1 }} />
          )
        )}
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16, lineHeight: 1, padding: '0 4px' }}>×</button>
      </div>
      {hasComplexProps && !operatorId.includes('null') && (
        <div style={{ display: 'flex', gap: 6, marginLeft: 26, flexWrap: 'wrap' }}>
          {complexProps.map(prop => (
            <div key={prop.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--muted)', minWidth: 'fit-content' }}>{prop.label}:</label>
              {prop.type === 'boolean' ? (
                <select value={parsedValues[prop.key] || prop.default || 'true'} onChange={e => updateComplexValue(prop.key, e.target.value)} style={{ flex: 0.6, minWidth: 80 }}>
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              ) : (
                <input 
                  type={prop.type === 'number' ? 'number' : 'text'} 
                  value={parsedValues[prop.key] || prop.default || ''} 
                  onChange={e => updateComplexValue(prop.key, e.target.value)} 
                  placeholder={prop.default || prop.description || (prop.isArray ? 'Comma-separated values' : '')} 
                  style={{ flex: 0.8, minWidth: 80 }} 
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function GroupBlock({ group, depth, onUpdate, onRemove, operators, fieldOptions, readOnly = false }) {
  const addRule = () => {
    const defaultOperator = getDefaultRuleOperator(group, operators)
    const defaultRuleOperator = parseOperatorSelectionValue(defaultOperator)

    onUpdate({
      ...group,
      rules: [...group.rules, { id: `r-${Date.now()}`, field: fieldOptions[0] || 'id', ...defaultRuleOperator, value: '1' }]
    })
  }
  const updateRule = (id, updated) => onUpdate({ ...group, rules: group.rules.map(r => r.id === id ? updated : r) })
  const removeRule = id => onUpdate({ ...group, rules: group.rules.filter(r => r.id !== id) })
  const updateSubgroup = (id, updated) => onUpdate({ ...group, subgroups: group.subgroups.map(g => g.id === id ? updated : g) })
  const removeSubgroup = id => onUpdate({ ...group, subgroups: group.subgroups.filter(g => g.id !== id) })

  const colors = ['rgba(79,110,247,.12)', 'rgba(124,58,237,.12)', 'rgba(236,72,153,.1)']
  const borderColors = ['rgba(79,110,247,.4)', 'rgba(124,58,237,.4)', 'rgba(236,72,153,.4)']
  const disableRootGroupButtons = readOnly && depth === 0
  const canToggleGroupMode = depth === 0 && group.isRevertible !== false

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
            <button key={op} onClick={() => onUpdate({ ...group, logic: op })} disabled={disableRootGroupButtons} style={{
              padding: '3px 10px', fontSize: 11, fontWeight: 700, border: 'none', cursor: disableRootGroupButtons ? 'not-allowed' : 'pointer',
              background: group.logic === op ? (depth === 0 ? 'var(--accent)' : 'var(--accent2)') : 'transparent',
              color: group.logic === op ? '#fff' : 'var(--muted)',
              opacity: disableRootGroupButtons ? 0.5 : 1,
              transition: 'all .15s',
            }}>{op}</button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: 'var(--muted)', flex: 1 }}>
          {group.logic === 'AND' ? 'All must match' : 'Any must match'}
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
      {group.rules.map((r, i) => (
        <ConditionRow
          key={r.id}
          rule={r}
          logic={i === 0 ? 'WHERE' : group.logic}
          onChange={u => updateRule(r.id, u)}
          onRemove={() => removeRule(r.id)}
          operators={operators}
          fieldOptions={fieldOptions}
        />
      ))}

      {/* Subgroups */}
      {group.subgroups.map(sg => (
        <div key={sg.id} style={{ marginLeft: 20, marginTop: 8 }}>
          <GroupBlock
            group={sg}
            depth={depth + 1}
            onUpdate={u => updateSubgroup(sg.id, u)}
            onRemove={() => removeSubgroup(sg.id)}
            operators={operators}
            fieldOptions={fieldOptions}
            readOnly={readOnly}
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
  const displayedFilters = filters.length > 0 ? filters : [createDefaultRootGroup()]
  const previewFilters = filters.length > 0 ? filters : []

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

  const updateGroup = (id, updated) => setFilters(filters.map(g => g.id === id ? updated : g))
  const removeGroup = id => setFilters(filters.filter(g => g.id !== id))
  const handleRootGroupUpdate = (id, updated) => {
    if (filters.length === 0) {
      setFilters([updated])
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
                  <span style={{ color: 'var(--warning)' }}> {r.isReverted ? 'not ' : ''}{r.op} </span>
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
                      <span style={{ color: 'var(--warning)' }}> {r.isReverted ? 'not ' : ''}{r.op} </span>
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
