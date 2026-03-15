import { useWizard } from '../../shared/store/wizardStore.jsx'
import { useConfig } from '../../shared/store/configContext.jsx'
import { Card, CardTitle, Btn } from '../../shared/components/index.jsx'
import { resolveSourceSchema } from '../../shared/types/index.js'

function ConditionRow({ rule, onChange, onRemove, logic, operators, fieldOptions }) {
  const currentOperator = operators.find(o => o.id === rule.op)
  const additionalProps = currentOperator?.additionalProperties || {}
  const valueOptions = additionalProps.options || []
  const complexProps = additionalProps.properties || []
  const isSelect = valueOptions.length > 0
  const hasComplexProps = complexProps.length > 0

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
        <select value={rule.op} onChange={e => onChange({ ...rule, op: e.target.value })} style={{ flex: 1.2 }}>
          {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        {!rule.op.includes('null') && !hasComplexProps && (
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
      {hasComplexProps && !rule.op.includes('null') && (
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
                  placeholder={prop.default || ''} 
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

function GroupBlock({ group, depth, onUpdate, onRemove, operators, fieldOptions }) {
  const addRule = () => onUpdate({
    ...group,
    rules: [...group.rules, { id: `r-${Date.now()}`, field: fieldOptions[0] || 'id', op: 'eq', value: '1' }]
  })
  const addSubgroup = () => onUpdate({
    ...group,
    subgroups: [...group.subgroups, { id: `g-${Date.now()}`, logic: 'OR', rules: [], subgroups: [] }]
  })
  const updateRule = (id, updated) => onUpdate({ ...group, rules: group.rules.map(r => r.id === id ? updated : r) })
  const removeRule = id => onUpdate({ ...group, rules: group.rules.filter(r => r.id !== id) })
  const updateSubgroup = (id, updated) => onUpdate({ ...group, subgroups: group.subgroups.map(g => g.id === id ? updated : g) })
  const removeSubgroup = id => onUpdate({ ...group, subgroups: group.subgroups.filter(g => g.id !== id) })

  const colors = ['rgba(79,110,247,.12)', 'rgba(124,58,237,.12)', 'rgba(236,72,153,.1)']
  const borderColors = ['rgba(79,110,247,.4)', 'rgba(124,58,237,.4)', 'rgba(236,72,153,.4)']

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
            <button key={op} onClick={() => onUpdate({ ...group, logic: op })} style={{
              padding: '3px 10px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
              background: group.logic === op ? (depth === 0 ? 'var(--accent)' : 'var(--accent2)') : 'transparent',
              color: group.logic === op ? '#fff' : 'var(--muted)',
              transition: 'all .15s',
            }}>{op}</button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: 'var(--muted)', flex: 1 }}>
          {group.logic === 'AND' ? 'All must match' : 'Any must match'}
        </span>
        {depth === 0 && (
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 5, overflow: 'hidden' }}>
            {['include', 'exclude'].map(mode => (
              <button key={mode} onClick={() => onUpdate({ ...group, mode: mode || 'include' })} style={{
                padding: '3px 10px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', textTransform: 'capitalize',
                background: (group.mode || 'include') === mode ? 'var(--accent)' : 'transparent',
                color: (group.mode || 'include') === mode ? '#fff' : 'var(--muted)',
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
          />
        </div>
      ))}

      {/* Add buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Btn sm v="ghost" onClick={addRule}>+ Add Condition</Btn>
        {depth < 2 && <Btn sm v="ghost" onClick={addSubgroup}>+ Add Group</Btn>}
      </div>
    </div>
  )
}

export default function   FiltersStep() {
  const { state, actions } = useWizard()
  const { filters: operators } = useConfig()
  const filters = state.filters
  const setFilters = actions.setFilters
  const fieldOptions = resolveSourceSchema(state.upload).map(f => f.id)

  const formatRuleValue = (rule) => {
    try {
      const parsed = JSON.parse(rule.value)
      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.entries(parsed).map(([k, v]) => `${k}=${v}`).join(', ')
      }
    } catch {}
    return rule.value
  }

  const totalRules = filters.reduce((sum, g) => sum + g.rules.length + g.subgroups.reduce((s2, sg) => s2 + sg.rules.length, 0), 0)

  const updateGroup = (id, updated) => setFilters(filters.map(g => g.id === id ? updated : g))
  const removeGroup = id => setFilters(filters.filter(g => g.id !== id))

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Filter Rules</h2>
        <span style={{ fontSize: 12, background: 'rgba(79,110,247,.15)', color: 'var(--accent)', padding: '3px 10px', borderRadius: 20 }}>
          {totalRules} rule{totalRules !== 1 ? 's' : ''} active
        </span>
        <div style={{ flex: 1 }} />
        <Btn sm v="ghost" onClick={() => setFilters([...filters, { id: `g-${Date.now()}`, logic: 'AND', rules: [], subgroups: [] }])}>
          + Add Group
        </Btn>
      </div>

      {filters.map(g => (
        <GroupBlock
          key={g.id}
          group={g}
          depth={0}
          onUpdate={u => updateGroup(g.id, u)}
          onRemove={() => removeGroup(g.id)}
          operators={operators}
          fieldOptions={fieldOptions}
        />
      ))}

      {/* SQL preview */}
      <Card style={{ background: 'var(--surf2)', border: '1px solid var(--border)', marginTop: 8 }}>
        <CardTitle style={{ color: 'var(--accent)', fontSize: 11, textTransform: 'uppercase', letterSpacing: .6 }}>
          Generated Filter Expression
        </CardTitle>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)', lineHeight: 1.8, overflowX: 'auto', padding: '4px 0' }}>
          {filters.map((g, gi) => (
            <div key={g.id}>
              {gi > 0 && <span style={{ color: 'var(--muted)' }}>  {g.logic === 'AND' ? 'AND' : 'OR'} </span>}
              {(g.mode === 'exclude') && <span style={{ color: 'var(--danger)', fontWeight: 700 }}>NOT </span>}
              <span style={{ color: 'var(--muted)' }}>(</span>
              {g.rules.map((r, ri) => (
                <span key={r.id}>
                  {ri > 0 && <span style={{ color: 'var(--muted)' }}> {g.logic} </span>}
                  <span style={{ color: 'var(--accent2)' }}>{r.field}</span>
                  <span style={{ color: 'var(--warning)' }}> {r.op} </span>
                  {!r.op.includes('null') && <span style={{ color: 'var(--success)' }}>[{formatRuleValue(r)}]</span>}
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
                      <span style={{ color: 'var(--warning)' }}> {r.op} </span>
                      {!r.op.includes('null') && <span style={{ color: 'var(--success)' }}>[{formatRuleValue(r)}]</span>}
                    </span>
                  ))}
                  <span style={{ color: 'var(--muted)' }}>)</span>
                </span>
              ))}
              <span style={{ color: 'var(--muted)' }}>)</span>
            </div>
          ))}
          {filters.length === 0 && <span style={{ color: 'var(--muted)' }}>— No filters defined (all records will pass) —</span>}
        </div>
      </Card>
    </div>
  )
}
