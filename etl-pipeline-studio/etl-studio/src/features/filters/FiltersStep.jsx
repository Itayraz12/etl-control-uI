import { useWizard } from '../../shared/store/wizardStore.jsx'
import { Card, CardTitle, Btn } from '../../shared/components/index.jsx'
import { MOCK_SCHEMA } from '../../shared/types/index.js'

const OPERATORS = ['equals', 'not equals', 'greater than', 'less than', 'contains', 'starts with', 'ends with', 'is null', 'is not null']
const FIELD_OPTIONS = MOCK_SCHEMA.map(f => f.id)

function ConditionRow({ rule, onChange, onRemove, logic }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center', animation: 'slideIn .2s ease' }}>
      <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, minWidth: 26, textAlign: 'center' }}>{logic}</span>
      <select value={rule.field} onChange={e => onChange({ ...rule, field: e.target.value })} style={{ flex: 1.5 }}>
        {FIELD_OPTIONS.map(f => <option key={f}>{f}</option>)}
      </select>
      <select value={rule.op} onChange={e => onChange({ ...rule, op: e.target.value })} style={{ flex: 1.2 }}>
        {OPERATORS.map(o => <option key={o}>{o}</option>)}
      </select>
      {!rule.op.includes('null') && (
        <input value={rule.value} onChange={e => onChange({ ...rule, value: e.target.value })} placeholder="value" style={{ flex: 1 }} />
      )}
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16, lineHeight: 1, padding: '0 4px' }}>×</button>
    </div>
  )
}

function GroupBlock({ group, depth, onUpdate, onRemove }) {
  const addRule = () => onUpdate({
    ...group,
    rules: [...group.rules, { id: `r-${Date.now()}`, field: 'id', op: 'equals', value: '' }]
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
  const filters = state.filters
  const setFilters = actions.setFilters
  const kafkaFilters = state.kafkaFilters || { keys: '', mode: 'include' }
  const setKafkaFilters = (updated) => actions.setKafkaFilters(updated)

  const totalRules = filters.reduce((sum, g) => sum + g.rules.length + g.subgroups.reduce((s2, sg) => s2 + sg.rules.length, 0), 0)

  const updateGroup = (id, updated) => setFilters(filters.map(g => g.id === id ? updated : g))
  const removeGroup = id => setFilters(filters.filter(g => g.id !== id))

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 30px' }}>
      {/* Kafka Key Filter */}
      <Card style={{ marginBottom: 24, background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
        <CardTitle style={{ color: '#22c55e', marginBottom: 12 }}>🔑 Kafka Key Filter</CardTitle>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="radio"
              checked={kafkaFilters.mode === 'include'}
              onChange={() => setKafkaFilters({ ...kafkaFilters, mode: 'include' })}
            />
            <span>✓ Include Only These Keys</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="radio"
              checked={kafkaFilters.mode === 'exclude'}
              onChange={() => setKafkaFilters({ ...kafkaFilters, mode: 'exclude' })}
            />
            <span>✗ Exclude These Keys</span>
          </label>
        </div>
        <div>
          <textarea
            value={kafkaFilters.keys}
            onChange={e => setKafkaFilters({ ...kafkaFilters, keys: e.target.value })}
            placeholder="Enter Kafka keys (comma-separated)&#10;Example: user-001, order-456, transaction-789"
            style={{
              width: '100%',
              minHeight: 80,
              padding: 12,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text)',
              fontFamily: 'var(--mono)',
              fontSize: 12,
              lineHeight: 1.6,
              resize: 'vertical',
            }}
          />
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
          {kafkaFilters.keys.split(',').filter(k => k.trim()).length} key{kafkaFilters.keys.split(',').filter(k => k.trim()).length !== 1 ? 's' : ''} specified
        </div>
      </Card>

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
        />
      ))}

      {/* SQL preview */}
      <Card style={{ background: '#101320', border: '1px solid rgba(79,110,247,.3)', marginTop: 8 }}>
        <CardTitle style={{ color: 'var(--accent)', fontSize: 11, textTransform: 'uppercase', letterSpacing: .6 }}>
          Generated Filter Expression
        </CardTitle>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#7dd3fc', lineHeight: 1.8 }}>
          {filters.map((g, gi) => (
            <div key={g.id}>
              {gi > 0 && <span style={{ color: '#94a3b8' }}>  {g.logic} </span>}
              <span style={{ color: '#94a3b8' }}>(</span>
              {g.rules.map((r, ri) => (
                <span key={r.id}>
                  {ri > 0 && <span style={{ color: '#94a3b8' }}> {g.logic} </span>}
                  <span style={{ color: '#f0abfc' }}>{r.field}</span>
                  <span style={{ color: '#fde68a' }}> {r.op} </span>
                  {!r.op.includes('null') && <span style={{ color: '#86efac' }}>'{r.value}'</span>}
                </span>
              ))}
              {g.subgroups.map(sg => (
                <span key={sg.id}>
                  {g.rules.length > 0 && <span style={{ color: '#94a3b8' }}> {g.logic} </span>}
                  <span style={{ color: '#94a3b8' }}>(</span>
                  {sg.rules.map((r, ri) => (
                    <span key={r.id}>
                      {ri > 0 && <span style={{ color: '#94a3b8' }}> {sg.logic} </span>}
                      <span style={{ color: '#f0abfc' }}>{r.field}</span>
                      <span style={{ color: '#fde68a' }}> {r.op} </span>
                      {!r.op.includes('null') && <span style={{ color: '#86efac' }}>'{r.value}'</span>}
                    </span>
                  ))}
                  <span style={{ color: '#94a3b8' }}>)</span>
                </span>
              ))}
              <span style={{ color: '#94a3b8' }}>)</span>
            </div>
          ))}
          {filters.length === 0 && <span style={{ color: '#64748b' }}>— No filters defined (all records will pass) —</span>}
        </div>
      </Card>
    </div>
  )
}
