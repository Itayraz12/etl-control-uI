import { useState, useRef, useEffect } from 'react'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { MOCK_SCHEMA, TARGET_FIELDS } from '../../shared/types/index.js'

const TRANSFORMERS = [
  { id: 'none', name: 'None', icon: '–' },
  { id: 'uppercase', name: 'Uppercase', icon: 'Aa' },
  { id: 'lowercase', name: 'Lowercase', icon: 'aa' },
  { id: 'trim', name: 'Trim', icon: '✂' },
  { id: 'concat', name: 'Concatenate', icon: '∥' },
  { id: 'replace', name: 'Replace', icon: 'R' },
  { id: 'substring', name: 'Substring', icon: 'S' },
  { id: 'split', name: 'Split', icon: '⊣' },
  { id: 'round', name: 'Round', icon: '◯' },
  { id: 'hash', name: 'Hash', icon: '#' },
]

export default function FieldMappingStep() {
  const { state, actions } = useWizard()
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [drag, setDrag] = useState(null)
  const [ctxMenu, setCtxMenu] = useState(null)
  const [currentCtxId, setCurrentCtxId] = useState(null)
  const [transformerMenu, setTransformerMenu] = useState(null)
  const [currentEdge, setCurrentEdge] = useState(null)
  const [sourceSearch, setSourceSearch] = useState('')
  const [targetSearch, setTargetSearch] = useState('')

  // Filter source and target fields based on search
  const filteredSource = MOCK_SCHEMA.filter(f => 
    f.name.toLowerCase().includes(sourceSearch.toLowerCase())
  )
  const filteredTarget = TARGET_FIELDS.filter(f => 
    f.name.toLowerCase().includes(targetSearch.toLowerCase())
  )

  const addEdge = (fromId, toId, fromType, toType) => {
    if (fromId === toId) return false

    // Validate: source to target only
    if (fromType !== 'source' || toType !== 'target') return false
    if (edges.some(e => e.from === fromId && e.to === toId)) return false

    setEdges(prev => [...prev, { from: fromId, to: toId, fromType, toType, transformer: 'none' }])
    return true
  }

  const removeEdge = (edge) => {
    setEdges(prev => prev.filter(e => !(e.from === edge.from && e.to === edge.to)))
    setTransformerMenu(null)
  }

  const setEdgeTransformer = (edge, transformerId) => {
    setEdges(prev => prev.map(e => 
      e.from === edge.from && e.to === edge.to 
        ? { ...e, transformer: transformerId }
        : e
    ))
    setTransformerMenu(null)
  }

  const startMoveNode = (e, nodeId) => {
    if (e.button !== 0 || e.target.closest('button')) return
    e.preventDefault()

    const node = nodes.find(n => n.id === nodeId)
    const el = document.getElementById(`nd-${nodeId}`)
    el?.classList.add('dragging')

    setDrag({
      type: 'move',
      id: nodeId,
      mx0: e.clientX,
      my0: e.clientY,
      nx0: node.x,
      ny0: node.y,
    })

    const onMove = (me) => {
      const dx = me.clientX - e.clientX
      const dy = me.clientY - e.clientY
      setNodes(prev => prev.map(n => 
        n.id === nodeId 
          ? { ...n, x: Math.max(0, node.x + dx), y: Math.max(0, node.y + dy) }
          : n
      ))
    }

    const onUp = () => {
      el?.classList.remove('dragging')
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      setDrag(null)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const startConnection = (e, nodeId, nodeType) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    const fx = node.type === 'source' ? node.x + 172 : node.x
    const fy = node.y + 29

    setDrag({
      type: 'connect',
      fromId: nodeId,
      fromType: node.type,
      fx,
      fy,
    })

    document.body.classList.add('connecting')

    const pendingPath = document.getElementById('pending-path')
    if (pendingPath) pendingPath.style.display = 'block'

    const onMove = (me) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const d = bezier(fx, fy, me.clientX - rect.left, me.clientY - rect.top)
      if (pendingPath) pendingPath.setAttribute('d', d)
    }

    const onUp = (me) => {
      try {
        const el = document.elementFromPoint(me.clientX, me.clientY)
        const targetPortEl = el?.closest('[data-nid]')
        
        if (targetPortEl) {
          const targetNodeId = targetPortEl.dataset.nid
          const targetNode = nodes.find(n => n.id === targetNodeId)
          
          if (targetNode && targetNode.id !== nodeId) {
            // Target should be the opposite type
            const isValidConnection = node.type === 'source' && targetNode.type === 'target'
            
            if (isValidConnection) {
              const success = addEdge(nodeId, targetNodeId, node.type, targetNode.type)
              if (!success) {
                // Connection rejected (duplicate or other reason)
                targetPortEl.parentElement?.classList.add('shake')
                setTimeout(() => targetPortEl.parentElement?.classList.remove('shake'), 250)
              }
            } else {
              // Invalid connection type
              targetPortEl.parentElement?.classList.add('shake')
              setTimeout(() => targetPortEl.parentElement?.classList.remove('shake'), 250)
            }
          }
        }
      } finally {
        if (pendingPath) pendingPath.style.display = 'none'
        document.body.classList.remove('connecting')
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        setDrag(null)
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const removeNode = (nodeId) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId))
    setEdges(prev => prev.filter(e => e.from !== nodeId && e.to !== nodeId))
  }

  const dragFromPanel = (e, field, type) => {
    e.preventDefault()
    const canvasRect = canvasRef.current.getBoundingClientRect()
    const scrollLeft = canvasRef.current.scrollLeft
    const scrollTop = canvasRef.current.scrollTop
    const x = e.clientX - canvasRect.left + scrollLeft - 86
    const y = e.clientY - canvasRect.top + scrollTop - 29

    if (x >= 0 && y >= 0) {
      const newNode = {
        id: `${type}-${Date.now()}-${Math.random()}`,
        name: field.name,
        emoji: type === 'source' ? '📄' : '🎯',
        type,
        fieldId: field.id,
        isRequired: field.required,
        x: Math.max(0, x),
        y: Math.max(0, y),
      }
      setNodes(prev => [...prev, newNode])
    }
  }

  const showContextMenu = (e, nodeId) => {
    const node = nodes.find(n => n.id === nodeId)
    e.preventDefault()
    setCurrentCtxId(nodeId)
    setCtxMenu({
      x: e.clientX,
      y: e.clientY,
      name: node?.name || '',
    })
  }

  const clearCanvas = () => {
    if (confirm('Clear all nodes and mappings?')) {
      setNodes([])
      setEdges([])
    }
  }

  const bezier = (x1, y1, x2, y2) => {
    const dx = Math.max(Math.abs(x2 - x1) * 0.55, 50)
    return `M ${x1},${y1} C ${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`
  }

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--bg)', height: '100%' }}>
      <div style={{ display: 'flex', flex: 1, gap: '0', overflow: 'hidden' }}>
        
        {/* LEFT PANEL - Source Fields */}
        <div style={{
          width: '240px',
          background: 'var(--surf)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Source Assets</div>
            <input
              type="text"
              placeholder="Search..."
              value={sourceSearch}
              onChange={(e) => setSourceSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                background: 'var(--surf2)',
                color: 'var(--text)',
                fontSize: '12px',
              }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {filteredSource.map((field) => (
              <div
                key={field.id}
                draggable
                onDragEnd={(e) => dragFromPanel(e, field, 'source')}
                style={{
                  padding: '10px 8px',
                  marginBottom: '6px',
                  background: 'var(--surf2)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  cursor: 'grab',
                  fontSize: '12px',
                  color: 'var(--text)',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surf3)'
                  e.currentTarget.style.borderColor = 'var(--accent)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surf2)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
              >
                <span>📄</span>
                <span>{field.name}</span>
                {field.required && <span style={{ color: 'var(--danger)', fontSize: '10px', marginLeft: 'auto' }}>*</span>}
              </div>
            ))}
            {filteredSource.length === 0 && (
              <div style={{ padding: '16px 8px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                No fields found
              </div>
            )}
          </div>
        </div>

        {/* CENTER - Canvas */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
          {/* Toolbar */}
          <div style={{
            height: '50px',
            background: 'var(--surf)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            flexShrink: 0,
          }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Lineage Canvas</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                Drag fields from panels, then connect them
              </div>
            </div>
            <button
              onClick={clearCanvas}
              style={{
                padding: '6px 12px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { 
                e.target.style.borderColor = 'var(--danger)'
                e.target.style.color = 'var(--danger)' 
              }}
              onMouseLeave={(e) => { 
                e.target.style.borderColor = 'var(--border)'
                e.target.style.color = 'var(--text)' 
              }}
            >
              Clear Canvas
            </button>
          </div>

          {/* Canvas Area */}
          <div
            ref={canvasRef}
            style={{
              flex: 1,
              position: 'relative',
              backgroundImage: 'radial-gradient(circle, rgba(79,110,247,.08) 0.5px, transparent 0.5px)',
              backgroundSize: '22px 22px',
              backgroundColor: 'var(--surf)',
              overflow: 'auto',
            }}
          >
            {/* SVG Edges */}
            <svg
              id="edges-svg"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: nodes.length > 0 ? Math.max(1000, Math.max(...nodes.map(n => n.x + 172)) + 200) : 1000,
                height: nodes.length > 0 ? Math.max(700, Math.max(...nodes.map(n => n.y + 86)) + 200) : 700,
                pointerEvents: 'auto',
                zIndex: 5,
              }}
            >
              <defs>
                <marker id="arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#4f6ef7" />
                </marker>
              </defs>
              {edges.map((edge, idx) => {
                const fromNode = nodes.find(n => n.id === edge.from)
                const toNode = nodes.find(n => n.id === edge.to)
                if (!fromNode || !toNode) return null

                const x1 = fromNode.x + 172
                const y1 = fromNode.y + 29
                const x2 = toNode.x
                const y2 = toNode.y + 29

                const d = bezier(x1, y1, x2, y2)
                const midX = (x1 + x2) / 2
                const midY = (y1 + y2) / 2
                const transformer = TRANSFORMERS.find(t => t.id === edge.transformer)
                
                return (
                  <g key={idx} style={{ cursor: 'pointer' }}>
                    <path d={d} stroke="#4f6ef7" strokeWidth="7" fill="none" opacity="0.12" />
                    <path d={d} stroke="#4f6ef7" strokeWidth="2.5" fill="none" markerEnd="url(#arr)" style={{ strokeDasharray: '600', animation: 'eDraw 0.4s ease forwards' }} />
                    
                    {/* Invisible click area - larger for easier clicking */}
                    <circle 
                      cx={midX} 
                      cy={midY} 
                      r="22" 
                      fill="transparent" 
                      onClick={(e) => {
                        e.stopPropagation()
                        setCurrentEdge(edge)
                        setTransformerMenu({ x: e.clientX, y: e.clientY })
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setCurrentEdge(edge)
                        setTransformerMenu({ x: e.clientX, y: e.clientY })
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    
                    {/* Visible circle */}
                    <circle 
                      cx={midX} 
                      cy={midY} 
                      r="16" 
                      fill="#1a1f36" 
                      stroke="#4f6ef7" 
                      strokeWidth="1.5"
                      opacity="0.8"
                      style={{ transition: 'all 0.2s', pointerEvents: 'none' }}
                    />
                    
                    {/* Transformer icon */}
                    <text 
                      x={midX} 
                      y={midY - 5} 
                      textAnchor="middle" 
                      dy="0.3em"
                      fontSize="11" 
                      fontWeight="700" 
                      fill="#4f6ef7"
                      pointerEvents="none"
                      style={{ userSelect: 'none' }}
                    >
                      {transformer?.icon || '–'}
                    </text>
                    
                    {/* Transformer name */}
                    {transformer && transformer.id !== 'none' && (
                      <text 
                        x={midX} 
                        y={midY + 6} 
                        textAnchor="middle" 
                        fontSize="7" 
                        fontWeight="600" 
                        fill="#4f6ef7"
                        pointerEvents="none"
                        style={{ userSelect: 'none' }}
                      >
                        {transformer?.name.substring(0, 8)}
                      </text>
                    )}
                  </g>
                )
              })}
              <path
                id="pending-path"
                stroke="#4f6ef7"
                strokeWidth="2"
                fill="none"
                strokeDasharray="7 4"
                opacity="0.8"
                markerEnd="url(#arr)"
                style={{ display: 'none' }}
              />
            </svg>

            {/* Nodes */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: nodes.length > 0 ? Math.max(1000, Math.max(...nodes.map(n => n.x + 172)) + 200) : 1000, height: nodes.length > 0 ? Math.max(700, Math.max(...nodes.map(n => n.y + 86)) + 200) : 700, pointerEvents: 'none' }}>
              {nodes.map((node) => {
                const isRequired = node.type === 'source' 
                  ? MOCK_SCHEMA.find(f => f.id === node.fieldId)?.required
                  : TARGET_FIELDS.find(f => f.id === node.fieldId)?.required
                const rules = { hasOut: node.type === 'source', hasIn: node.type === 'target' }

                return (
                  <div
                    key={node.id}
                    id={`nd-${node.id}`}
                    data-nid={node.id}
                    onMouseDown={(e) => startMoveNode(e, node.id)}
                    onContextMenu={(e) => showContextMenu(e, node.id)}
                    style={{
                      position: 'absolute',
                      left: node.x + 'px',
                      top: node.y + 'px',
                      width: '172px',
                      height: '58px',
                      background: 'var(--surf2)',
                      border: isRequired ? '2px solid var(--danger)' : '1.5px solid var(--border)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px',
                      cursor: 'grab',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      userSelect: 'none',
                      zIndex: 10,
                      transition: 'all 0.15s',
                      pointerEvents: 'auto',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.querySelector('.nd-del').style.display = 'flex'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.querySelector('.nd-del').style.display = 'none'
                    }}
                  >
                    {/* Left stripe */}
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: '6px',
                      bottom: '6px',
                      width: '3px',
                      borderRadius: '2px',
                      background: node.type === 'source' ? 'var(--accent)' : 'var(--success)',
                    }} />

                    {/* Input port */}
                    {rules.hasIn && (
                      <div
                        data-nid={node.id}
                        className="port-in"
                        style={{
                          position: 'absolute',
                          left: '-7px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: '13px',
                          height: '13px',
                          borderRadius: '50%',
                          border: '2.5px solid var(--surf)',
                          background: 'var(--success)',
                          cursor: 'default',
                          transition: 'all 0.15s',
                          zIndex: 15,
                        }}
                      />
                    )}

                    {/* Icon & Text */}
                    <div style={{
                      display: 'flex',
                      gap: '6px',
                      flex: 1,
                      minWidth: 0,
                    }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: node.type === 'source' ? 'rgba(79,110,247,0.1)' : 'rgba(34,197,94,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        flexShrink: 0,
                      }}>
                        {node.emoji}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--text)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {node.name}
                          {isRequired && <span style={{ color: 'var(--danger)', marginLeft: '4px' }}>*</span>}
                        </div>
                        <div style={{
                          fontSize: '9px',
                          fontWeight: 600,
                          color: 'var(--muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}>
                          {node.type === 'source' ? 'SOURCE' : 'TARGET'}
                        </div>
                      </div>
                    </div>

                    {/* Output port */}
                    {rules.hasOut && (
                      <div
                        data-nid={node.id}
                        onMouseDown={(e) => startConnection(e, node.id, node.type)}
                        style={{
                          position: 'absolute',
                          right: '-7px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: '13px',
                          height: '13px',
                          borderRadius: '50%',
                          border: '2.5px solid var(--surf)',
                          background: 'var(--accent)',
                          cursor: 'crosshair',
                          transition: 'all 0.15s',
                          zIndex: 15,
                        }}
                        onMouseEnter={(e) => { 
                          e.currentTarget.style.transform = 'translateY(-50%) scale(1.4)'
                          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,110,247,0.2)' 
                        }}
                        onMouseLeave={(e) => { 
                          e.currentTarget.style.transform = 'translateY(-50%)'
                          e.currentTarget.style.boxShadow = 'none' 
                        }}
                      />
                    )}

                    {/* Delete button */}
                    <button
                      className="nd-del"
                      onClick={() => removeNode(node.id)}
                      style={{
                        display: 'none',
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: 'var(--danger)',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '16px',
                        fontWeight: 300,
                        zIndex: 100,
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.1s',
                        pointerEvents: 'auto',
                      }}
                      onMouseEnter={(e) => { e.target.style.transform = 'scale(1.15)' }}
                      onMouseLeave={(e) => { e.target.style.transform = 'scale(1)' }}
                    >
                      ×
                    </button>

                    <style>{`
                      #nd-${node.id}:hover .nd-del {
                        display: flex !important;
                      }
                    `}</style>
                  </div>
                )
              })}
            </div>

            {/* Empty State */}
            {nodes.length === 0 && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                pointerEvents: 'none',
              }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>→</div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Canvas is empty</h3>
                <p style={{ fontSize: '12px', color: 'var(--muted)' }}>Drag fields from the side panels onto this canvas</p>
              </div>
            )}

          </div>

          {/* Stats bar - outside canvas */}
          <div style={{
            height: '36px',
            background: 'var(--surf)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            fontSize: '11px',
            color: 'var(--muted)',
            flexShrink: 0,
          }}>
            <span>Connections: <strong>{edges.length}</strong></span>
          </div>
        </div>

        {/* RIGHT PANEL - Target Fields */}
        <div style={{
          width: '240px',
          background: 'var(--surf)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Target Assets</div>
            <input
              type="text"
              placeholder="Search..."
              value={targetSearch}
              onChange={(e) => setTargetSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                background: 'var(--surf2)',
                color: 'var(--text)',
                fontSize: '12px',
              }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {filteredTarget.map((field) => (
              <div
                key={field.id}
                draggable
                onDragEnd={(e) => dragFromPanel(e, field, 'target')}
                style={{
                  padding: '10px 8px',
                  marginBottom: '6px',
                  background: 'var(--surf2)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  cursor: 'grab',
                  fontSize: '12px',
                  color: 'var(--text)',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surf3)'
                  e.currentTarget.style.borderColor = 'var(--success)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surf2)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
              >
                <span>🎯</span>
                <span>{field.name}</span>
                {field.required && <span style={{ color: 'var(--danger)', fontSize: '10px', marginLeft: 'auto' }}>*</span>}
              </div>
            ))}
            {filteredTarget.length === 0 && (
              <div style={{ padding: '16px 8px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                No fields found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transformer menu */}
      {transformerMenu && currentEdge && (
        <div
          style={{
            position: 'fixed',
            left: transformerMenu.x,
            top: transformerMenu.y,
            background: 'var(--surf)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
            zIndex: 1001,
            minWidth: '180px',
            maxHeight: '400px',
            overflowY: 'auto',
            animation: 'ctxIn 0.18s ease',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            padding: '10px 12px',
            borderBottom: '1px solid var(--border)',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            ⚙ Select Transformer
          </div>
          {TRANSFORMERS.map((t) => (
            <div
              key={t.id}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                color: 'var(--text)',
                transition: 'background 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderLeft: currentEdge.transformer === t.id ? '3px solid #4f6ef7' : '3px solid transparent',
              }}
              onClick={() => setEdgeTransformer(currentEdge, t.id)}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: '14px' }}>{t.icon}</span>
              <span>{t.name}</span>
              {currentEdge.transformer === t.id && <span style={{ marginLeft: 'auto', color: '#4f6ef7' }}>✓</span>}
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <div
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                color: 'var(--danger)',
                transition: 'background 0.15s',
              }}
              onClick={() => {
                removeEdge(currentEdge)
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              Delete Connection
            </div>
          </div>
        </div>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <div
          style={{
            position: 'fixed',
            left: ctxMenu.x,
            top: ctxMenu.y,
            background: 'var(--surf)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
            zIndex: 1000,
            minWidth: '200px',
            animation: 'ctxIn 0.18s ease',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            padding: '10px 12px',
            borderBottom: '1px solid var(--border)',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} />
            {ctxMenu.name}
          </div>
          <div
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '12px',
              color: 'var(--text)',
              transition: 'background 0.15s',
            }}
            onClick={() => {
              removeNode(currentCtxId)
              setCtxMenu(null)
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.1)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            Remove from Canvas
          </div>
        </div>
      )}

      {/* Close menus on canvas click */}
      {(ctxMenu || transformerMenu) && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} 
          onClick={() => {
            setCtxMenu(null)
            setTransformerMenu(null)
          }} 
        />
      )}

      <style>{`
        @keyframes eDraw {
          from { stroke-dashoffset: 600; opacity: 0; }
          to { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes ctxIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes shake {
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        @keyframes portPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(79, 110, 247, 0.5); }
          50% { box-shadow: 0 0 0 7px rgba(79, 110, 247, 0); }
        }
        body.connecting .node:not(.has-in) {
          opacity: 0.3;
          pointer-events: none;
        }
        body.connecting .node.has-in {
          border-color: rgba(79, 110, 247, 0.4);
        }
        body.connecting .node.has-in .port-in {
          animation: portPulse 1.2s ease-in-out infinite;
        }
        .node.dragging {
          box-shadow: 0 10px 30px rgba(79, 110, 247, 0.22) !important;
          transform: scale(1.02);
          z-index: 50;
        }
        .node.shake {
          animation: shake 0.25s ease;
        }
      `}</style>
    </div>
  )
}
