import { useState, useRef, useEffect, forwardRef } from 'react'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { Card, CardTitle, Btn, TypeBadge } from '../../shared/components/index.jsx'
import { MOCK_SCHEMA, TARGET_FIELDS } from '../../shared/types/index.js'

const TRANSFORMERS = [
  { id: 'PASSTHROUGH', label: 'Pass-through (No change)' },
  { id: 'CAST', label: 'Cast (Type conversion)' },
  { id: 'UPPERCASE', label: 'Uppercase' },
  { id: 'LOWERCASE', label: 'Lowercase' },
  { id: 'TRIM', label: 'Trim whitespace' },
  { id: 'ROUND', label: 'Round (Numbers)' },
  { id: 'NULL_SAFE', label: 'Null Safe' },
]

export default function FieldMappingStep() {
  const { state, actions } = useWizard()
  const canvasRef = useRef(null)
  
  // Split mappings from transformers
  const [fields, setFields] = useState([])
  const [connections, setConnections] = useState([])
  const [selectedConnection, setSelectedConnection] = useState(null)
  const [draggingField, setDraggingField] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [searchSrc, setSearchSrc] = useState('')

  const filtered = MOCK_SCHEMA.filter(f => f.id.includes(searchSrc))
  const mappedSrc = new Set(fields.filter(f => f.type === 'src').map(f => f.fieldId))
  const mappedTgt = new Set(fields.filter(f => f.type === 'tgt').map(f => f.fieldId))

  // Initialize with clearing previous mappings (clear canvas on mount)
  useEffect(() => {
    // Start with empty canvas
    setFields([])
    setConnections([])
  }, [])

  const addFieldToCanvas = (fieldId, fieldName, type, fieldType) => {
    const id = `${type}-${fieldId}-${Date.now()}`
    
    // Count existing fields of this type to stack them vertically
    const fieldsOfType = fields.filter(f => f.type === type).length
    
    // Source fields on left (x: 20), target fields on right (x: 400)
    // Stack them vertically with 80px spacing
    const x = type === 'src' ? 20 : 400
    const y = 50 + fieldsOfType * 80
    
    const newField = {
      id,
      fieldId,
      fieldName,
      type, // 'src' or 'tgt'
      fieldType,
      x,
      y,
    }
    setFields([...fields, newField])
  }

  const updateFieldPosition = (id, x, y) => {
    setFields(fields.map(f => f.id === id ? { ...f, x, y } : f))
  }

  const deleteField = (id) => {
    setFields(fields.filter(f => f.id !== id))
    setConnections(connections.filter(c => c.from !== id && c.to !== id))
  }

  const createConnection = (fromId, toId) => {
    console.log('createConnection called with:', fromId, toId)
    if (fromId === toId) {
      console.log('Same field, ignoring')
      return
    }
    const from = fields.find(f => f.id === fromId)
    const to = fields.find(f => f.id === toId)
    console.log('From field:', from, 'To field:', to)
    if (!from || !to) {
      console.log('One or both fields not found')
      return
    }
    if (from.type === to.type) {
      console.log('Same type, cannot connect')
      return
    }
    
    const connId = `conn-${Date.now()}`
    const newConnection = {
      id: connId,
      from: fromId,
      to: toId,
      transformer: 'PASSTHROUGH',
    }
    console.log('Creating connection:', newConnection)
    setConnections([...connections, newConnection])
  }

  const deleteConnection = (id) => {
    setConnections(connections.filter(c => c.id !== id))
    if (selectedConnection === id) setSelectedConnection(null)
  }

  const updateTransformer = (connId, transformerId) => {
    setConnections(connections.map(c => 
      c.id === connId ? { ...c, transformer: transformerId } : c
    ))
  }

  const reqMapped = TARGET_FIELDS.filter(f => f.required).length
  const reqConnected = connections.filter(c => {
    const toField = fields.find(f => f.id === c.to)
    if (!toField) return false
    const tgtField = TARGET_FIELDS.find(tf => tf.id === toField.fieldId)
    return tgtField?.required
  }).length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        padding: '10px 30px', background: 'var(--surf2)', borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 12, alignItems: 'center',
      }}>
        <Btn sm v="danger" onClick={() => { setFields([]); setConnections([]); setSelectedConnection(null) }}>Clear Canvas</Btn>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, background: 'rgba(79,110,247,.15)', color: 'var(--accent)', padding: '3px 10px', borderRadius: 20 }}>
          {connections.length} connections
        </span>
        {reqConnected < reqMapped && (
          <span style={{ fontSize: 12, background: 'rgba(239,68,68,.15)', color: 'var(--danger)', padding: '3px 10px', borderRadius: 20 }}>
            ⚠ {reqMapped - reqConnected} required unmapped
          </span>
        )}
      </div>

      {/* Main Layout */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr 280px', overflow: 'hidden', gap: 0 }}>
        {/* Source Panel */}
        <FieldPanel 
          title="Source Fields" 
          sub="Drag to canvas"
          fields={filtered}
          onDragStart={f => setDraggingField({ id: f.id, name: f.name, type: f.type, panelType: 'src' })}
          mappedFields={mappedSrc}
          searchValue={searchSrc}
          onSearchChange={setSearchSrc}
        />

        {/* Canvas */}
        <Canvas 
          ref={canvasRef}
          fields={fields}
          connections={connections}
          draggingField={draggingField}
          selectedConnection={selectedConnection}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            if (!draggingField || !canvasRef.current) return
            const rect = canvasRef.current.getBoundingClientRect()
            const x = e.clientX - rect.left
            const y = e.clientY - rect.top
            const field = draggingField.panelType === 'src' 
              ? MOCK_SCHEMA.find(f => f.id === draggingField.id)
              : TARGET_FIELDS.find(f => f.id === draggingField.id)
            if (field) {
              addFieldToCanvas(field.id, field.name, draggingField.panelType, field.type)
            }
            setDraggingField(null)
          }}
          onFieldMove={updateFieldPosition}
          onFieldDelete={deleteField}
          onFieldConnect={createConnection}
          onConnectionSelect={setSelectedConnection}
          onConnectionDelete={deleteConnection}
          onContextMenu={(e, connId) => {
            e.preventDefault()
            setSelectedConnection(connId)
            setContextMenu({ x: e.clientX, y: e.clientY, connId })
          }}
        />

        {/* Target Panel */}
        <FieldPanel 
          title="Target Fields" 
          sub="Drag to canvas"
          fields={TARGET_FIELDS}
          onDragStart={f => setDraggingField({ id: f.id, name: f.name, type: f.type, panelType: 'tgt' })}
          mappedFields={mappedTgt}
          isTarget
        />
      </div>

      {/* Transformers Summary */}
      <div style={{ background: 'var(--surf)', borderTop: '1px solid var(--border)', padding: '10px 30px', display: 'flex', gap: 12, overflowX: 'auto', flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Mappings:</span>
        {connections.map(c => {
          const fromField = fields.find(f => f.id === c.from)
          const toField = fields.find(f => f.id === c.to)
          const srcName = fromField?.fieldName || '?'
          const tgtName = toField?.fieldName || '?'
          const transformer = TRANSFORMERS.find(t => t.id === c.transformer)
          return (
            <span key={c.id} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(79,110,247,.15)', color: 'var(--accent)', whiteSpace: 'nowrap', fontFamily: 'var(--mono)' }}>
              {srcName} → {tgtName} ({transformer?.id})
            </span>
          )
        })}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          transformers={TRANSFORMERS}
          currentTransformer={connections.find(c => c.id === contextMenu.connId)?.transformer}
          onSelectTransformer={(tid) => {
            updateTransformer(contextMenu.connId, tid)
            setContextMenu(null)
          }}
          onDelete={() => {
            deleteConnection(contextMenu.connId)
            setContextMenu(null)
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

function FieldPanel({ title, sub, fields, onDragStart, mappedFields, searchValue, onSearchChange, isTarget }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surf)', borderRight: isTarget ? 'none' : '1px solid var(--border)' }}>
      <div style={{ padding: '10px 14px', background: 'var(--surf2)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{sub}</div>
      </div>
      {!isTarget && (
        <input
          value={searchValue || ''}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search fields…"
          style={{ margin: '8px', width: 'calc(100% - 16px)', fontSize: 12, padding: '6px', borderRadius: 4, background: 'var(--surf)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />
      )}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {fields.map(f => (
          <div
            key={f.id}
            draggable
            onDragStart={() => onDragStart(f)}
            style={{
              padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,.03)',
              display: 'flex', alignItems: 'center', gap: 8,
              cursor: 'grab', background: mappedFields?.has(f.id) ? 'rgba(34,197,94,.06)' : 'transparent',
              transition: 'background .1s', userSelect: 'none',
            }}
            onMouseEnter={e => { if (!mappedFields?.has(f.id)) e.currentTarget.style.background = 'rgba(79,110,247,.06)' }}
            onMouseLeave={e => { e.currentTarget.style.background = mappedFields?.has(f.id) ? 'rgba(34,197,94,.06)' : 'transparent' }}
          >
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>⠿</span>
            <span style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {f.name}
            </span>
            <TypeBadge type={f.type} />
            {mappedFields?.has(f.id) && <span style={{ fontSize: 9, color: 'var(--success)' }}>✓</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

const Canvas = forwardRef(({ fields, connections, draggingField, selectedConnection, onDragOver, onDrop, onFieldMove, onFieldDelete, onFieldConnect, onConnectionSelect, onConnectionDelete, onContextMenu }, ref) => {
  const [connectFrom, setConnectFrom] = useState(null)
  const [draggedFieldId, setDraggedFieldId] = useState(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const handleFieldMouseDown = (fieldId, e) => {
    // Don't drag if clicking on a button
    if (e.target.closest('button')) return
    
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    
    setDraggedFieldId(fieldId)
    
    const startX = e.clientX
    const startY = e.clientY
    
    const field = fields.find(f => f.id === fieldId)
    if (!field) return

    const handleMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX
      const dy = moveEvent.clientY - startY
      onFieldMove(fieldId, Math.max(0, field.x + dx), Math.max(0, field.y + dy))
    }

    const handleMouseUp = () => {
      setDraggedFieldId(null)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleCanvasMouseMove = (e) => {
    if (connectFrom) {
      const rect = e.currentTarget.getBoundingClientRect()
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
  }

  const handleCanvasMouseLeave = () => {
    if (connectFrom) {
      setConnectFrom(null)
    }
  }

  return (
    <div
      ref={ref}
      data-canvas
      onDragOver={onDragOver}
      onDrop={onDrop}
      onMouseMove={handleCanvasMouseMove}
      onMouseLeave={handleCanvasMouseLeave}
      onClick={() => { onConnectionSelect(null); setConnectFrom(null) }}
      style={{
        background: 'var(--surf2)', position: 'relative', overflow: 'auto',
        borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)',
      }}
    >
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {/* Existing connections */}
        {connections.map(conn => {
          const from = fields.find(f => f.id === conn.from)
          const to = fields.find(f => f.id === conn.to)
          if (!from || !to) return null
          
          const x1 = from.x + 80
          const y1 = from.y + 20
          const x2 = to.x
          const y2 = to.y + 20
          const isSelected = selectedConnection === conn.id
          
          // Calculate middle point for transformer badge
          const midX = (x1 + x2) / 2
          const midY = (y1 + y2) / 2
          
          // Get transformer info
          const transformer = TRANSFORMERS.find(t => t.id === conn.transformer)
          const showBadge = conn.transformer && conn.transformer !== 'PASSTHROUGH'
          
          // Get short label for transformer
          const getTransformerLabel = (id) => {
            const labelMap = {
              'CAST': 'Cast',
              'UPPERCASE': 'Upper',
              'LOWERCASE': 'Lower',
              'TRIM': 'Trim',
              'ROUND': 'Round',
              'NULL_SAFE': 'Null',
            }
            return labelMap[id] || id
          }
          
          return (
            <g key={conn.id}>
              <path
                d={`M ${x1} ${y1} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2} ${x2} ${y2}`}
                stroke={isSelected ? 'var(--accent)' : 'rgba(79,110,247,.4)'}
                strokeWidth={isSelected ? 2.5 : 2}
                fill="none"
                strokeLinecap="round"
                style={{ transition: 'all .15s' }}
              />
              <circle cx={x2} cy={y2} r={4} fill={isSelected ? 'var(--accent)' : 'rgba(79,110,247,.6)'} />
              
              {/* Transformer badge in middle of connection */}
              {showBadge && (
                <g style={{ cursor: 'help' }}>
                  <title>{transformer?.label || conn.transformer}</title>
                  {/* Background rect for badge */}
                  <rect 
                    x={midX - 24} 
                    y={midY - 11} 
                    width={48} 
                    height={22} 
                    rx={6}
                    fill={isSelected ? 'var(--accent)' : 'rgba(59,130,246,.95)'}
                    stroke={isSelected ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.2)'}
                    strokeWidth="1"
                  />
                  {/* Badge text - full transformer name */}
                  <text 
                    x={midX} 
                    y={midY} 
                    textAnchor="middle" 
                    dominantBaseline="central"
                    fontSize="9"
                    fontWeight="600"
                    fill="white"
                    style={{ pointerEvents: 'none', fontFamily: 'system-ui', letterSpacing: '-0.3px' }}
                  >
                    {getTransformerLabel(conn.transformer)}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {/* Temporary connection line while connecting */}
        {connectFrom && (
          <path
            d={`M ${connectFrom.x + 80} ${connectFrom.y + 20} Q ${(connectFrom.x + 80 + mousePos.x) / 2} ${(connectFrom.y + 20 + mousePos.y) / 2} ${mousePos.x} ${mousePos.y}`}
            stroke="var(--accent)"
            strokeWidth="2"
            fill="none"
            strokeDasharray="5,5"
            strokeLinecap="round"
          />
        )}
      </svg>

      {/* Interactive layer for connection clicks - behind fields */}
      <svg 
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'auto', zIndex: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {connections.map(conn => {
          const from = fields.find(f => f.id === conn.from)
          const to = fields.find(f => f.id === conn.to)
          if (!from || !to) return null
          
          const x1 = from.x + 80
          const y1 = from.y + 20
          const x2 = to.x
          const y2 = to.y + 20
          
          return (
            <path
              key={conn.id}
              d={`M ${x1} ${y1} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2} ${x2} ${y2}`}
              stroke="transparent"
              strokeWidth="12"
              fill="none"
              onClick={(e) => { e.stopPropagation(); onConnectionSelect(conn.id) }}
              onContextMenu={(e) => { 
                e.preventDefault()
                e.stopPropagation()
                onConnectionSelect(conn.id)
                onContextMenu(e, conn.id) 
              }}
              style={{ cursor: 'pointer' }}
            />
          )
        })}
      </svg>

      {fields.map(f => (
        <CanvasField
          key={f.id}
          field={f}
          isSource={f.type === 'src'}
          isDragging={draggedFieldId === f.id}
          isConnecting={connectFrom?.id === f.id}
          onMouseDown={(e) => handleFieldMouseDown(f.id, e)}
          onDelete={() => onFieldDelete(f.id)}
          onConnectStart={() => setConnectFrom(f)}
          onConnectEnd={(targetFieldId) => {
            console.log('Connect end called with:', targetFieldId, 'From:', connectFrom?.id)
            if (connectFrom && targetFieldId !== connectFrom.id) {
              console.log('Creating connection from', connectFrom.id, 'to', targetFieldId)
              onFieldConnect(connectFrom.id, targetFieldId)
            }
            setConnectFrom(null)
          }}
        />
      ))}

      {fields.length === 0 && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
          Drag source fields from left and target fields from right to start mapping
        </div>
      )}
    </div>
  )
})

const CanvasField = ({ field, isSource, isDragging, isConnecting, onMouseDown, onDelete, onConnectStart, onConnectEnd }) => {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute', left: `${field.x}px`, top: `${field.y}px`,
        background: isSource ? 'rgba(59,130,246,.1)' : 'rgba(34,197,94,.1)',
        border: `1.5px solid ${isSource ? 'var(--accent)' : 'var(--success)'}`,
        borderRadius: 8, padding: '12px', cursor: isDragging ? 'grabbing' : 'grab', minWidth: 140,
        boxShadow: isDragging ? '0 8px 16px rgba(0,0,0,.3)' : 'none',
        userSelect: 'none', transition: isDragging ? 'none' : 'box-shadow .1s',
        zIndex: isDragging ? 100 : 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>⠿</span>
        <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {field.fieldName}
        </span>
        <button onClick={e => { e.stopPropagation(); onDelete() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14, padding: 0 }}>×</button>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {isSource && (
          <button
            onClick={e => { e.stopPropagation(); e.preventDefault(); onConnectStart() }}
            style={{
              flex: 1, padding: '4px 8px', fontSize: 10, 
              background: isConnecting ? 'var(--accent)' : 'rgba(79,110,247,.2)',
              border: '1px solid var(--accent)', 
              color: isConnecting ? 'var(--text)' : 'var(--accent)',
              borderRadius: 4, cursor: 'crosshair', transition: 'all .15s', fontWeight: isConnecting ? 700 : 400,
            }}
          >
            {isConnecting ? '⚡ Connecting' : 'Connect →'}
          </button>
        )}
        {!isSource && (
          <button
            onClick={e => { e.stopPropagation(); e.preventDefault(); onConnectEnd(field.id) }}
            style={{
              flex: 1, padding: '4px 8px', fontSize: 10, background: 'rgba(34,197,94,.2)',
              border: '1px solid var(--success)', color: 'var(--success)',
              borderRadius: 4, cursor: 'pointer',
            }}
          >
            ← Connect
          </button>
        )}
      </div>
    </div>
  )
}

const ContextMenu = ({ x, y, transformers, currentTransformer, onSelectTransformer, onDelete, onClose }) => {
  useEffect(() => {
    const handleClick = () => onClose()
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed', top: y, left: x,
        background: 'var(--surf)', border: '1px solid var(--border)', borderRadius: 6,
        boxShadow: '0 8px 24px rgba(0,0,0,.4)', zIndex: 1000, minWidth: 200,
      }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ fontSize: 11, color: 'var(--muted)', padding: '8px 12px', fontWeight: 700 }}>Add Transformer</div>
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {transformers.map(t => (
          <button
            key={t.id}
            onClick={() => onSelectTransformer(t.id)}
            style={{
              width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none',
              background: currentTransformer === t.id ? 'rgba(79,110,247,.15)' : 'transparent',
              color: currentTransformer === t.id ? 'var(--accent)' : 'var(--text)',
              cursor: 'pointer', fontSize: 11, transition: 'all .1s',
            }}
            onMouseEnter={e => { if (currentTransformer !== t.id) e.currentTarget.style.background = 'rgba(79,110,247,.08)' }}
            onMouseLeave={e => { if (currentTransformer !== t.id) e.currentTarget.style.background = 'transparent' }}
          >
            {currentTransformer === t.id && '✓ '} {t.label}
          </button>
        ))}
      </div>
      <div style={{ borderTop: '1px solid var(--border)', padding: '8px' }}>
        <button
          onClick={onDelete}
          style={{
            width: '100%', padding: '6px 12px', fontSize: 11, background: 'rgba(239,68,68,.1)',
            border: '1px solid rgba(239,68,68,.3)', color: 'var(--danger)', borderRadius: 4,
            cursor: 'pointer', transition: 'all .1s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,.2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,.1)'}
        >
          Delete Connection
        </button>
      </div>
    </div>
  )
}
