import { useState } from 'react'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { Card, CardTitle, Btn, TypeBadge } from '../../shared/components/index.jsx'
import { MOCK_SCHEMA, TARGET_FIELDS } from '../../shared/types/index.js'

const OPS_LABELS = {
  PASSTHROUGH: 'PASSTHROUGH',
  CAST: '→ CAST',
  NULL: 'NULL SAFE',
}

export default function FieldMappingStep() {
  const { state, actions } = useWizard()
  const mappings = state.mappings
  const setMappings = actions.setMappings

  const [dragging, setDragging] = useState(null)
  const [selectedEdge, setSelectedEdge] = useState(null)
  const [searchSrc, setSearchSrc] = useState('')

  const mappedSrc = new Set(mappings.map(m => m.src))
  const mappedTgt = new Set(mappings.map(m => m.tgt))

  const filtered = MOCK_SCHEMA.filter(f => f.id.includes(searchSrc))

  const removeEdge = id => {
    setMappings(mappings.filter(m => m.id !== id))
    if (selectedEdge === id) setSelectedEdge(null)
  }

  const autoMap = () => {
    const auto = []
    MOCK_SCHEMA.forEach(sf => {
      TARGET_FIELDS.forEach(tf => {
        if ((sf.id === tf.id || sf.name === tf.name) && !mappedSrc.has(sf.id) && !mappedTgt.has(tf.id)) {
          auto.push({ id: 'auto-' + sf.id, src: sf.id, tgt: tf.id, warn: sf.type !== tf.type })
        }
      })
    })
    if (auto.length) setMappings([...mappings, ...auto])
  }

  const reqMapped = TARGET_FIELDS.filter(f => f.required && mappedTgt.has(f.id)).length
  const reqTotal  = TARGET_FIELDS.filter(f => f.required).length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        padding: '10px 30px', background: 'var(--surf2)', borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 12, alignItems: 'center',
      }}>
        <Btn sm v="ghost" onClick={autoMap}>✨ Auto-Map</Btn>
        <Btn sm v="danger" onClick={() => setMappings([])}>Clear Canvas</Btn>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, background: 'rgba(34,197,94,.15)', color: 'var(--success)', padding: '3px 10px', borderRadius: 20 }}>
          {mappings.length} connections
        </span>
        {reqMapped < reqTotal && (
          <span style={{ fontSize: 12, background: 'rgba(239,68,68,.15)', color: 'var(--danger)', padding: '3px 10px', borderRadius: 20 }}>
            ⚠ {reqTotal - reqMapped} required unconnected
          </span>
        )}
      </div>

      {/* Three-panel canvas */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '260px 1fr 260px', overflow: 'hidden' }}>
        {/* Source */}
        <Panel title="Source Fields" sub="Detected schema" bg="var(--surf)">
          <input
            value={searchSrc}
            onChange={e => setSearchSrc(e.target.value)}
            placeholder="Search fields…"
            style={{ margin: '8px', width: 'calc(100% - 16px)' }}
          />
          {filtered.map(f => {
            const isMapped = mappedSrc.has(f.id)
            return (
              <FieldRow
                key={f.id}
                field={f}
                isMapped={isMapped}
                isDragging={dragging?.id === f.id}
                draggable
                onDragStart={() => setDragging(f)}
                onDragEnd={() => setDragging(null)}
              />
            )
          })}
        </Panel>

        {/* Canvas */}
        <div style={{ background: 'var(--surf2)', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: mappings.length ? 'flex-start' : 'center', padding: '20px 14px', gap: 6 }}>
          {mappings.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '0 20px' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>↔</div>
              Drag a source field and drop it onto a target field to create a mapping
            </div>
          ) : (
            mappings.map(m => {
              const sf = MOCK_SCHEMA.find(f => f.id === m.src)
              const tf = TARGET_FIELDS.find(f => f.id === m.tgt)
              const op = m.warn ? 'CAST' : 'PASSTHROUGH'
              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedEdge(selectedEdge === m.id ? null : m.id)}
                  style={{
                    width: '100%', maxWidth: 380,
                    background: selectedEdge === m.id ? 'rgba(79,110,247,.15)' : m.warn ? 'rgba(245,158,11,.07)' : 'var(--surf)',
                    border: `1.5px solid ${selectedEdge === m.id ? 'var(--accent)' : m.warn ? 'rgba(245,158,11,.4)' : 'var(--border)'}`,
                    borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8,
                    transition: 'all .15s', boxShadow: selectedEdge === m.id ? '0 0 0 3px rgba(79,110,247,.2)' : 'none',
                    animation: 'fadeIn .2s ease',
                  }}
                >
                  <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sf?.name || m.src}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                    <div style={{ width: 8, height: 1.5, background: m.warn ? 'var(--warning)' : 'var(--accent)' }} />
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                      background: m.warn ? 'rgba(245,158,11,.2)' : 'rgba(79,110,247,.2)',
                      color: m.warn ? 'var(--warning)' : 'var(--accent)',
                    }}>{OPS_LABELS[op]}</span>
                    <div style={{ width: 8, height: 1.5, background: m.warn ? 'var(--warning)' : 'var(--accent)' }} />
                  </div>
                  <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{tf?.name || m.tgt}</span>
                  {m.warn && <span style={{ fontSize: 10, color: 'var(--warning)' }}>⚠</span>}
                  <button onClick={e => { e.stopPropagation(); removeEdge(m.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
                </div>
              )
            })
          )}
        </div>

        {/* Target */}
        <Panel title="Target Fields" sub="Entity schema" bg="var(--surf)">
          {TARGET_FIELDS.map(f => {
            const mapping = mappings.find(m => m.tgt === f.id)
            return (
              <div
                key={f.id}
                onDragOver={e => e.preventDefault()}
                onDrop={() => {
                  if (dragging && !mapping) {
                    setMappings([...mappings, {
                      id: `m-${Date.now()}`,
                      src: dragging.id,
                      tgt: f.id,
                      warn: dragging.type !== f.type,
                    }])
                    setDragging(null)
                  }
                }}
                style={{
                  padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,.03)',
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: mapping ? 'rgba(34,197,94,.06)' : f.required && !mapping ? 'rgba(239,68,68,.05)' : 'transparent',
                  borderLeft: `3px solid ${mapping ? 'var(--success)' : f.required ? 'var(--danger)' : 'transparent'}`,
                  transition: 'all .15s',
                }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', display: 'block', flexShrink: 0,
                  background: mapping ? 'var(--success)' : f.required ? 'var(--danger)' : 'var(--border)',
                }} />
                <span style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)' }}>{f.name}</span>
                <TypeBadge type={f.type} />
                {f.required && !mapping && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--danger)', background: 'rgba(239,68,68,.15)', padding: '1px 5px', borderRadius: 4 }}>REQ</span>}
                {mapping && <span style={{ fontSize: 9, color: 'var(--success)' }}>✓</span>}
              </div>
            )
          })}
        </Panel>
      </div>

      {/* Transformations summary */}
      <div style={{ background: 'var(--surf)', borderTop: '1px solid var(--border)', padding: '10px 30px', display: 'flex', gap: 12, overflowX: 'auto', flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Transformations:</span>
        {mappings.map(m => (
          <span key={m.id} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: m.warn ? 'rgba(245,158,11,.15)' : 'rgba(79,110,247,.15)', color: m.warn ? 'var(--warning)' : 'var(--accent)', whiteSpace: 'nowrap', fontFamily: 'var(--mono)' }}>
            {m.src} → {m.tgt}: {m.warn ? 'CAST' : 'PASSTHROUGH'}
          </span>
        ))}
      </div>
    </div>
  )
}

function Panel({ title, sub, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--surf)' }}>
      <div style={{ padding: '10px 14px', background: 'var(--surf2)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{sub}</div>
      </div>
      {children}
    </div>
  )
}

function FieldRow({ field, isMapped, isDragging, ...dragProps }) {
  return (
    <div
      {...dragProps}
      style={{
        padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,.03)',
        display: 'flex', alignItems: 'center', gap: 8,
        cursor: 'grab', background: isMapped ? 'rgba(34,197,94,.06)' : isDragging ? 'rgba(79,110,247,.1)' : 'transparent',
        transition: 'background .1s',
        userSelect: 'none',
      }}
      onMouseEnter={e => { if (!isMapped && !isDragging) e.currentTarget.style.background = 'rgba(79,110,247,.06)' }}
      onMouseLeave={e => { e.currentTarget.style.background = isMapped ? 'rgba(34,197,94,.06)' : 'transparent' }}
    >
      <span style={{ fontSize: 11, color: 'var(--muted)', cursor: 'grab' }}>⠿</span>
      <span style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {field.id}
      </span>
      <TypeBadge type={field.type} />
      {isMapped && <span style={{ fontSize: 9, color: 'var(--success)' }}>●</span>}
    </div>
  )
}
