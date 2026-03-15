import { useState, useRef, useEffect } from 'react'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { useConfig } from '../../shared/store/configContext.jsx'
import { resolveSourceSchema, resolveTargetSchema } from '../../shared/types/index.js'

// TRANSFORMER_PROPS_SCHEMA is now derived from each transformer's propsSchema field.
// Helper: resolve a transformer by either its backend _id or its YAML/display name.
function findTransformer(transformers, transformerRef) {
  if (!transformerRef || transformerRef === 'none') return null
  return transformers.find(t => t._id === transformerRef || t.name === transformerRef) || null
}

function normalizeTransformerRef(transformers, transformerRef) {
  return findTransformer(transformers, transformerRef)?._id || transformerRef || 'none'
}

// Helper: look up the propsSchema array for a transformer by its _id or name.
function getPropsSchema(transformers, transformerRef) {
  const t = findTransformer(transformers, transformerRef)
  console.log('[getPropsSchema] ref:', transformerRef, '→ found:', t?.name, 'propsSchema:', JSON.stringify(t?.propsSchema))
  return t?.propsSchema || []
}

function getSourceFieldLabel(field) {
  return String(field?.path ?? field?.id ?? field?.name ?? '').trim()
}

function getTargetFieldLabel(field) {
  return String(field?.path ?? field?.id ?? field?.name ?? '').trim()
}

function getConnectedNodeIds(edges = []) {
  return new Set(
    edges.flatMap(edge => [edge.from, edge.to, ...(Array.isArray(edge.extraInputs) ? edge.extraInputs : [])])
  )
}

const NODE_WIDTH = 260
const NODE_HEIGHT = 74
const NODE_HALF_WIDTH = NODE_WIDTH / 2
const NODE_HALF_HEIGHT = NODE_HEIGHT / 2
const NODE_ROW_GAP = 84
const CANVAS_NODE_BOUND_HEIGHT = NODE_HEIGHT + 28

export default function FieldMappingStep() {
  const { state, actions } = useWizard()
  const { transformers } = useConfig()
  const sourceSchema = resolveSourceSchema(state.upload)
  const targetSchema = resolveTargetSchema(state.targetSchema)
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const hasAutoAlignedOnEntryRef = useRef(false)
  // Stores { edgeIdx, x, y, w, h } for each edge that has a transformer node,
  // in SVG/canvas coordinates. Updated every render — used for multi-input drop detection.
  const tfBoxesRef = useRef([])
  const skipInitialMappingsSyncRef = useRef(true)
  const latestMappingsRef = useRef(Array.isArray(state.mappings) ? state.mappings : [])
  const nodesRef = useRef([])
  const edgesRef = useRef([])
  const setMappings = actions.setMappings


  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [, setDrag] = useState(null)
  const [ctxMenu, setCtxMenu] = useState(null)
  const [currentCtxId, setCurrentCtxId] = useState(null)
  const [transformerMenu, setTransformerMenu] = useState(null)
  const [currentEdge, setCurrentEdge] = useState(null)
  const [sourceSearch, setSourceSearch] = useState('')
  const [targetSearch, setTargetSearch] = useState('')
  const [successModal, setSuccessModal] = useState(null)
  const [clearCanvasConfirm, setClearCanvasConfirm] = useState(false)
  const [transformerModal, setTransformerModal] = useState(false)
  const [fieldPropertiesModal, setFieldPropertiesModal] = useState(null)
  // Right-click context menu on + circle
  const [plusCtxMenu, setPlusCtxMenu] = useState(null) // { x, y, edge, mode }
  // Add/replace/edit transformer modal with search
  const [addTransformerModal, setAddTransformerModal] = useState(null) // { edge, mode: 'add'|'replace'|'edit' }
  const [transformerSearch, setTransformerSearch] = useState('')
  const [selectedTf, setSelectedTf] = useState(null)
  const [tfPropValues, setTfPropValues] = useState({})

    // Load saved mappings from state on mount
    useEffect(() => {
    if (Array.isArray(state.mappings) && state.mappings.length > 0) {
      // Convert state.mappings back to nodes and edges
      const loadedNodes = []
      const loadedEdges = []
      const nodeIdMap = {}

      state.mappings.forEach((mapping) => {
        // Create source node if not exists
        const srcKey = mapping.srcNodeId || `src-${mapping.src}`
        if (!nodeIdMap[srcKey]) {
          const srcNode = {
            id: srcKey,
            name: mapping.src,
            emoji: '📄',
            type: 'source',
            fieldId: mapping.src,
            isRequired: false,
            x: mapping.srcPos?.x ?? 100,
            y: mapping.srcPos?.y ?? 100,
            sendToSaknay: mapping.srcMetadata?.sendToSaknay ?? true,
            expression: mapping.srcMetadata?.expression || '',
          }
          loadedNodes.push(srcNode)
          nodeIdMap[srcKey] = srcNode.id
        }

        // Create target node if not exists
        const tgtKey = mapping.tgtNodeId || `tgt-${mapping.tgt}`
        if (!nodeIdMap[tgtKey]) {
          const tgtNode = {
            id: tgtKey,
            name: mapping.tgt,
            emoji: '🎯',
            type: 'target',
            fieldId: mapping.tgt,
            isRequired: false,
            x: mapping.tgtPos?.x ?? 400,
            y: mapping.tgtPos?.y ?? 100,
            sendToSaknay: mapping.tgtMetadata?.sendToSaknay ?? true,
            expression: mapping.tgtMetadata?.expression || '',
          }
          loadedNodes.push(tgtNode)
          nodeIdMap[tgtKey] = tgtNode.id
        }

        // Create edge
        const extraInputNodeIds = []
        if (Array.isArray(mapping.extraInputs)) {
          mapping.extraInputs.forEach(ei => {
            const eiKey = ei.nodeId || `src-${ei.field}`
            if (!nodeIdMap[eiKey]) {
              const eiNode = {
                id: eiKey,
                name: ei.field,
                emoji: '📄',
                type: 'source',
                fieldId: ei.field,
                isRequired: false,
                x: ei.pos?.x ?? 100,
                y: ei.pos?.y ?? 100,
                sendToSaknay: true,
                expression: '',
              }
              loadedNodes.push(eiNode)
              nodeIdMap[eiKey] = eiNode.id
            }
            extraInputNodeIds.push(nodeIdMap[eiKey])
          })
        }

        const normalizedTransformer = normalizeTransformerRef(
          transformers,
          mapping.transformer || mapping.transformerChain?.[0] || 'none'
        )

        loadedEdges.push({
          from: nodeIdMap[srcKey],
          to: nodeIdMap[tgtKey],
          fromType: 'source',
          toType: 'target',
          transformer: normalizedTransformer,
          additionalTransformers: (mapping.transformerChain?.slice(1) || []).map(t => normalizeTransformerRef(transformers, t)),
          transformerInputType: mapping.transformerInputType,
          transformerOutputType: mapping.transformerOutputType,
          transformerProps: mapping.transformerProps || {},
          extraInputs: extraInputNodeIds,
        })
      })

      nodesRef.current = loadedNodes
      edgesRef.current = loadedEdges
      setNodes(loadedNodes)
      setEdges(loadedEdges)
      latestMappingsRef.current = state.mappings
    }
    }, [])

    useEffect(() => {
    skipInitialMappingsSyncRef.current = false
    }, [])

  // Filter source and target fields based on search
  const filteredSource = sourceSchema.filter(f => 
    getSourceFieldLabel(f).toLowerCase().includes(sourceSearch.toLowerCase())
  )
  const filteredTarget = targetSchema.filter(f => 
    getTargetFieldLabel(f).toLowerCase().includes(targetSearch.toLowerCase())
  )

  const existingSourceFieldIds = new Set(
    nodes.filter(n => n.type === 'source' && n.fieldId).map(n => n.fieldId)
  )
  const existingTargetFieldIds = new Set(
    nodes.filter(n => n.type === 'target' && n.fieldId).map(n => n.fieldId)
  )
  const allSourceOnCanvas = existingSourceFieldIds.size === sourceSchema.length
  const allTargetOnCanvas = existingTargetFieldIds.size === targetSchema.length

  const toCanvasPoint = (clientX, clientY) => {
    const canvas = canvasRef.current
    const rect = canvas?.getBoundingClientRect()

    return {
      x: clientX - (rect?.left ?? 0) + (canvas?.scrollLeft ?? 0),
      y: clientY - (rect?.top ?? 0) + (canvas?.scrollTop ?? 0),
    }
  }

    const addEdge = (fromId, toId, fromType, toType) => {
    if (fromId === toId) return false

    // Validate: source to target only
    if (fromType !== 'source' || toType !== 'target') return false
    // Block duplicate from→to
    if (edgesRef.current.some(e => e.from === fromId && e.to === toId)) return false
    // Target can only have ONE incoming connection
    if (edgesRef.current.some(e => e.to === toId)) return false

    applyEdges(prev => [...prev, { from: fromId, to: toId, fromType, toType, transformer: 'none', extraInputs: [] }])
    return true
    }

    const removeEdge = (edge) => {
    applyEdges(prev => prev.filter(e => !(e.from === edge.from && e.to === edge.to)))
    setTransformerMenu(null)
    }

    const setEdgeTransformer = (edge, transformerId) => {
    applyEdges(prev => prev.map(e =>
      e.from === edge.from && e.to === edge.to
        ? { 
            ...e, 
            transformer: transformerId,
            transformerInputType: e.transformerInputType || 'any',
            transformerOutputType: e.transformerOutputType || 'any',
            transformerProps: e.transformerProps || {},
          }
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
      applyNodes(prev => prev.map(n =>
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

  const startConnection = (e, nodeId) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    const fx = node.type === 'source' ? node.x + NODE_WIDTH : node.x
    const fy = node.y + NODE_HALF_HEIGHT

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

    let lastPointer = null

    const renderPendingPath = (clientX, clientY) => {
      const { x, y } = toCanvasPoint(clientX, clientY)
      const d = bezier(fx, fy, x, y)
      if (pendingPath) pendingPath.setAttribute('d', d)
    }

    const onMove = (me) => {
      lastPointer = { clientX: me.clientX, clientY: me.clientY }
      renderPendingPath(me.clientX, me.clientY)
    }

    const scrollCanvas = canvasRef.current
    const onScroll = () => {
      if (!lastPointer) return
      renderPendingPath(lastPointer.clientX, lastPointer.clientY)
    }

    const onUp = (me) => {
      try {
        // Canvas-space coordinates of the drop point
        const { x: dropX, y: dropY } = toCanvasPoint(me.clientX, me.clientY)

        // ── Drop on a transformer node (multi-input) ──────────────────────
        // Hit-test against registered transformer bounding boxes in canvas space.
        // This avoids DOM closest() which cannot cross SVG foreignObject boundaries.
        if (node.type === 'source') {
          const hit = tfBoxesRef.current.find(box =>
            dropX >= box.x && dropX <= box.x + box.w &&
            dropY >= box.y && dropY <= box.y + box.h
          )
          if (hit) {
            applyEdges(prev => {
              const targetEdge = prev[hit.edgeIdx]
              if (!targetEdge) return prev
              const tf = findTransformer(transformers, targetEdge.transformer)
              if (!tf?.isMultipleInput) return prev
              if (targetEdge.from === nodeId) return prev
              if (targetEdge.extraInputs?.includes(nodeId)) return prev
              return prev.map((e, i) => i === hit.edgeIdx
                ? { ...e, extraInputs: [...(e.extraInputs || []), nodeId] }
                : e
              )
            })
            return
          }
        }

        // ── Drop on a target port (normal connection) ─────────────────────
        const el = document.elementFromPoint(me.clientX, me.clientY)
        const targetPortEl = el?.closest('[data-nid]')
        if (targetPortEl) {
          const targetNodeId = targetPortEl.dataset.nid
          const targetNode = nodes.find(n => n.id === targetNodeId)
          if (targetNode && targetNode.id !== nodeId) {
            const isValidConnection = node.type === 'source' && targetNode.type === 'target'
            if (isValidConnection) {
              const success = addEdge(nodeId, targetNodeId, node.type, targetNode.type)
              if (!success) {
                targetPortEl.parentElement?.classList.add('shake')
                setTimeout(() => targetPortEl.parentElement?.classList.remove('shake'), 250)
              }
            } else {
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
        scrollCanvas?.removeEventListener('scroll', onScroll)
        setDrag(null)
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    scrollCanvas?.addEventListener('scroll', onScroll, { passive: true })
  }

    const removeNode = (nodeId) => {
    const nextNodes = nodesRef.current.filter(n => n.id !== nodeId)
    const nextEdges = edgesRef.current
      .filter(e => e.from !== nodeId && e.to !== nodeId)
      .map(e => e.extraInputs?.includes(nodeId)
        ? { ...e, extraInputs: e.extraInputs.filter(id => id !== nodeId) }
        : e
      )

    applyCanvas(nextNodes, nextEdges)
    }

  const buildCanvasFieldNode = (field, type, x, y) => ({
    id: `${type}-${field.id}-${Date.now()}-${Math.random()}`,
    name: type === 'source' ? getSourceFieldLabel(field) : getTargetFieldLabel(field),
    emoji: type === 'source' ? '📄' : '🎯',
    type,
    fieldId: field.id,
    isRequired: field.required,
    x: Math.max(0, x),
    y: Math.max(0, y),
    sendToSaknay: true,
    expression: '',
  })

  const addFieldToCanvas = (field, type, position = null) => {
    applyNodes(prev => {
      const exists = prev.some(n => n.type === type && n.fieldId === field.id)
      if (exists) return prev

      const x = position?.x ?? (type === 'source' ? 40 : 650)
      const baseY = type === 'source'
        ? (prev.length ? Math.max(...prev.filter(n => n.type === 'source').map(n => n.y), -NODE_ROW_GAP) + NODE_ROW_GAP : 30)
        : (prev.length ? Math.max(...prev.filter(n => n.type === 'target').map(n => n.y), -NODE_ROW_GAP) + NODE_ROW_GAP : 80)
      const y = position?.y ?? baseY

      return [...prev, buildCanvasFieldNode(field, type, x, y)]
    })
  }

  const dragFromPanel = (e, field, type) => {
    e.preventDefault()

    // Enforce single instance per field/type on canvas
    const exists = nodes.some(n => n.type === type && n.fieldId === field.id)
    if (exists) return

    const { x: canvasX, y: canvasY } = toCanvasPoint(e.clientX, e.clientY)
    const x = canvasX - NODE_HALF_WIDTH
    const y = canvasY - NODE_HALF_HEIGHT

    if (x >= 0 && y >= 0) {
      addFieldToCanvas(field, type, { x, y })
    }
    }

    const addAllSourceFieldsToCanvas = () => {
    const xPos = 40
    const yGap = NODE_ROW_GAP

    applyNodes(prev => {
      const existingSourceFieldIds = new Set(
        prev.filter(n => n.type === 'source' && n.fieldId).map(n => n.fieldId)
      )

      const baseY = prev.length
        ? Math.max(...prev.filter(n => n.type === 'source').map(n => n.y), -yGap) + yGap
        : 30

      const newSourceNodes = sourceSchema
        .filter(field => !existingSourceFieldIds.has(field.id))
        .map((field, idx) => ({
          id: `source-${field.id}-${Date.now()}-${Math.random()}`,
          name: getSourceFieldLabel(field),
          emoji: '📄',
          type: 'source',
          fieldId: field.id,
          isRequired: field.required,
          x: xPos,
          y: baseY + idx * yGap,
          sendToSaknay: true,
          expression: '',
        }))

      return [...prev, ...newSourceNodes]
    })
    }

    const removeUnconnectedSourceFieldsFromCanvas = () => {
    applyNodes(prevNodes => {
      const connectedNodeIds = getConnectedNodeIds(edgesRef.current)
      return prevNodes.filter(n => !(n.type === 'source' && !connectedNodeIds.has(n.id)))
    })
    }

  const handleSourceBulkAction = () => {
    if (allSourceOnCanvas) {
      removeUnconnectedSourceFieldsFromCanvas()
    } else {
      addAllSourceFieldsToCanvas()
    }
  }

    const addAllTargetFieldsToCanvas = () => {
    const xPos = 650
    const yGap = NODE_ROW_GAP

    applyNodes(prev => {
      const existingTargetFieldIds = new Set(
        prev.filter(n => n.type === 'target' && n.fieldId).map(n => n.fieldId)
      )

      const baseY = prev.length
        ? Math.max(...prev.filter(n => n.type === 'target').map(n => n.y), -yGap) + yGap
        : 80

      const newTargetNodes = targetSchema
        .filter(field => !existingTargetFieldIds.has(field.id))
        .map((field, idx) => ({
          id: `target-${field.id}-${Date.now()}-${Math.random()}`,
          name: getTargetFieldLabel(field),
          emoji: '🎯',
          type: 'target',
          fieldId: field.id,
          isRequired: field.required,
          x: xPos,
          y: baseY + idx * yGap,
          sendToSaknay: true,
          expression: '',
        }))

      return [...prev, ...newTargetNodes]
    })
    }

    const removeUnconnectedTargetFieldsFromCanvas = () => {
    applyNodes(prevNodes => {
      const connectedNodeIds = getConnectedNodeIds(edgesRef.current)
      return prevNodes.filter(n => !(n.type === 'target' && !connectedNodeIds.has(n.id)))
    })
    }

  const handleTargetBulkAction = () => {
    if (allTargetOnCanvas) {
      removeUnconnectedTargetFieldsFromCanvas()
    } else {
      addAllTargetFieldsToCanvas()
    }
  }

  const showContextMenu = (e, nodeId) => {
    const node = nodes.find(n => n.id === nodeId)
    e.preventDefault()
    e.stopPropagation()
    if (!node || node.type !== 'target') {
      setCurrentCtxId(null)
      setCtxMenu(null)
      return
    }
    setTransformerMenu(null)
    setPlusCtxMenu(null)
    setCurrentCtxId(nodeId)
    setCtxMenu({
      x: e.clientX,
      y: e.clientY,
      name: node?.name || '',
      nodeId: nodeId,
      node: node,
    })
  }

    const buildMappingsList = (nodesInput, edgesInput) => {
    return edgesInput.map(edge => {
      const srcNode = nodesInput.find(n => n.id === edge.from)
      const tgtNode = nodesInput.find(n => n.id === edge.to)
      const normalizedTransformer = normalizeTransformerRef(transformers, edge.transformer)

      return {
        src: srcNode?.fieldId || srcNode?.name || '',
        tgt: tgtNode?.fieldId || tgtNode?.name || '',
        srcNodeId: srcNode?.id,
        tgtNodeId: tgtNode?.id,
        srcPos: { x: srcNode?.x || 0, y: srcNode?.y || 0 },
        tgtPos: { x: tgtNode?.x || 0, y: tgtNode?.y || 0 },
        srcMetadata: {
          sendToSaknay: srcNode?.sendToSaknay ?? true,
          expression: srcNode?.expression || '',
        },
        tgtMetadata: {
          sendToSaknay: tgtNode?.sendToSaknay ?? true,
          expression: tgtNode?.expression || '',
        },
        transformer: normalizedTransformer,
        transformerInputType: edge.transformerInputType || 'any',
        transformerOutputType: edge.transformerOutputType || 'any',
        transformerProps: edge.transformerProps || {},
        transformerChain: [normalizedTransformer, ...(edge.additionalTransformers || []).map(t => normalizeTransformerRef(transformers, t))].filter(t => t && t !== 'none'),
        // Multi-input: extra source node IDs and their field names
        extraInputs: (edge.extraInputs || []).map(id => {
          const n = nodesInput.find(nd => nd.id === id)
          return { nodeId: id, field: n?.fieldId || n?.name || '', pos: { x: n?.x || 0, y: n?.y || 0 } }
        }),
      }
    })
    }

    const persistMappings = (nextNodes = nodesRef.current, nextEdges = edgesRef.current) => {
    const nextMappings = buildMappingsList(nextNodes, nextEdges)
    latestMappingsRef.current = nextMappings
    if (!skipInitialMappingsSyncRef.current) {
      setMappings(nextMappings)
    }
    return nextMappings
    }

    const applyNodes = (updater, { persist = true } = {}) => {
    const nextNodes = typeof updater === 'function' ? updater(nodesRef.current) : updater
    nodesRef.current = nextNodes
    setNodes(nextNodes)
    if (persist) persistMappings(nextNodes, edgesRef.current)
    return nextNodes
    }

    const applyEdges = (updater, { persist = true } = {}) => {
    const nextEdges = typeof updater === 'function' ? updater(edgesRef.current) : updater
    edgesRef.current = nextEdges
    setEdges(nextEdges)
    if (persist) persistMappings(nodesRef.current, nextEdges)
    return nextEdges
    }

    const applyCanvas = (nextNodes, nextEdges, { persist = true } = {}) => {
    nodesRef.current = nextNodes
    edgesRef.current = nextEdges
    setNodes(nextNodes)
    setEdges(nextEdges)
    if (persist) persistMappings(nextNodes, nextEdges)
    }

    useEffect(() => {
    return () => {
      setMappings(latestMappingsRef.current)
    }
    }, [setMappings])

    const clearCanvas = () => {
    setClearCanvasConfirm(true)
    }

    const confirmClearCanvas = () => {
    applyCanvas([], [])
    setClearCanvasConfirm(false)
    }

    const cancelClearCanvas = () => {
    setClearCanvasConfirm(false)
    }

    const toggleTargetNodeFlag = (nodeId, flagKey) => {
    applyNodes(prev => prev.map(node =>
      node.id === nodeId && node.type === 'target'
        ? { ...node, [flagKey]: !(node[flagKey] ?? true) }
        : node
    ))
    }

    const updateTargetNodeMeta = (nodeId, patch) => {
    applyNodes(prev => prev.map(node =>
      node.id === nodeId && node.type === 'target'
        ? { ...node, ...patch }
        : node
    ))
    }

    const suppressEmptyCanvasContextMenu = (e) => {
    if (e.target === e.currentTarget) {
      e.preventDefault()
    }
    }

    const alignNodes = () => {
    const LEFT_X = 40
    const RIGHT_X = 650
    const START_Y = 30
    const GAP = NODE_ROW_GAP

    applyNodes(prev => {
      const nextById = new Map(prev.map(node => [node.id, { ...node }]))
      const currentById = new Map(prev.map(node => [node.id, node]))
      const placedSources = new Set()
      const placedTargets = new Set()

      const getNodeY = (id) => currentById.get(id)?.y ?? 0
      const rows = []

      const orderedEdges = [...edgesRef.current].sort((a, b) => {
        const aPrimaryY = getNodeY(a.from)
        const bPrimaryY = getNodeY(b.from)
        if (aPrimaryY !== bPrimaryY) return aPrimaryY - bPrimaryY
        return getNodeY(a.to) - getNodeY(b.to)
      })

      orderedEdges.forEach(edge => {
        rows.push({ sourceId: edge.from, targetId: edge.to })

        const transformer = findTransformer(transformers, edge.transformer)
        if (transformer?.isMultipleInput) {
          ;[...(edge.extraInputs || [])]
            .sort((a, b) => getNodeY(a) - getNodeY(b))
            .forEach(extraId => {
              rows.push({ sourceId: extraId, targetId: null })
            })
        }
      })

      const reservedSourceIds = new Set(rows.map(row => row.sourceId).filter(Boolean))
      const reservedTargetIds = new Set(rows.map(row => row.targetId).filter(Boolean))

      const unpairedSources = prev
        .filter(n => n.type === 'source' && !reservedSourceIds.has(n.id))
        .sort((a, b) => a.y - b.y)
      const unpairedTargets = prev
        .filter(n => n.type === 'target' && !reservedTargetIds.has(n.id))
        .sort((a, b) => a.y - b.y)

      const pairedRowCount = Math.min(unpairedSources.length, unpairedTargets.length)

      for (let index = 0; index < pairedRowCount; index += 1) {
        rows.push({
          sourceId: unpairedSources[index].id,
          targetId: unpairedTargets[index].id,
        })
      }

      unpairedSources.slice(pairedRowCount).forEach(node => {
        rows.push({ sourceId: node.id, targetId: null })
      })

      unpairedTargets.slice(pairedRowCount).forEach(node => {
        rows.push({ sourceId: null, targetId: node.id })
      })

      rows.forEach((row, index) => {
        const y = START_Y + index * GAP

        if (row.sourceId && !placedSources.has(row.sourceId)) {
          const src = nextById.get(row.sourceId)
          if (src) {
            src.x = LEFT_X
            src.y = y
            placedSources.add(row.sourceId)
          }
        }

        if (row.targetId && !placedTargets.has(row.targetId)) {
          const tgt = nextById.get(row.targetId)
          if (tgt) {
            tgt.x = RIGHT_X
            tgt.y = y
            placedTargets.add(row.targetId)
          }
        }
      })

      return prev.map(node => nextById.get(node.id) ?? node)
    })
    }

    useEffect(() => {
    if (hasAutoAlignedOnEntryRef.current) return
    if (nodes.length === 0) return

    hasAutoAlignedOnEntryRef.current = true
    alignNodes()
    }, [nodes.length])

  // Calculate string similarity (Levenshtein-inspired)
  const calculateSimilarity = (str1, str2) => {
    const s1 = str1.toLowerCase()
    const s2 = str2.toLowerCase()
    
    // Exact match
    if (s1 === s2) return 100
    
    // Substring match
    if (s1.includes(s2) || s2.includes(s1)) return 85
    
    // Check for common prefixes or suffixes
    const minLen = Math.min(s1.length, s2.length)
    let commonStart = 0
    for (let i = 0; i < minLen; i++) {
      if (s1[i] === s2[i]) commonStart++
      else break
    }
    
    if (commonStart >= 2) return 60 + commonStart * 5
    
    // Check for word boundaries (e.g., "productName" vs "product")
    if (s1.includes(s2.split(/(?=[A-Z])/)[0]) || s2.includes(s1.split(/(?=[A-Z])/)[0])) {
      return 50
    }
    
    return 0
  }

  const mapAllFields = () => {
    const existingNodes = nodesRef.current
    const existingEdges = edgesRef.current
    const sourceNodesById = new Map(existingNodes.filter(n => n.type === 'source').map(n => [n.id, n]))
    const targetNodesById = new Map(existingNodes.filter(n => n.type === 'target').map(n => [n.id, n]))

    const connectedSourceFieldIds = new Set()
    const connectedTargetFieldIds = new Set()

    existingEdges.forEach(edge => {
      const srcNode = sourceNodesById.get(edge.from)
      const tgtNode = targetNodesById.get(edge.to)
      if (srcNode?.fieldId) connectedSourceFieldIds.add(srcNode.fieldId)
      if (tgtNode?.fieldId) connectedTargetFieldIds.add(tgtNode.fieldId)

      ;(edge.extraInputs || []).forEach(extraId => {
        const extraNode = sourceNodesById.get(extraId)
        if (extraNode?.fieldId) connectedSourceFieldIds.add(extraNode.fieldId)
      })
    })

    const candidateSources = sourceSchema.filter(field => !connectedSourceFieldIds.has(field.id))
    const candidateTargets = targetSchema.filter(field => !connectedTargetFieldIds.has(field.id))

    if (candidateSources.length === 0 || candidateTargets.length === 0) return

    const nextNodes = [...existingNodes]
    const nextEdges = [...existingEdges]
    const sourceNodeIds = {}
    const targetNodeIds = {}
    const yGap = NODE_ROW_GAP
    const sourceBaseY = existingNodes.filter(n => n.type === 'source').length
      ? Math.max(...existingNodes.filter(n => n.type === 'source').map(n => n.y)) + yGap
      : 30
    const targetBaseY = existingNodes.filter(n => n.type === 'target').length
      ? Math.max(...existingNodes.filter(n => n.type === 'target').map(n => n.y)) + yGap
      : 80

    candidateSources.forEach((field, idx) => {
      const existingNode = existingNodes.find(n => n.type === 'source' && n.fieldId === field.id)
      if (existingNode) {
        sourceNodeIds[field.id] = existingNode.id
        return
      }

      const nodeId = `src-${field.id}-${Date.now()}-${Math.random()}`
      nextNodes.push({
        id: nodeId,
        name: getSourceFieldLabel(field),
        emoji: '📄',
        type: 'source',
        fieldId: field.id,
        isRequired: field.required,
        x: 40,
        y: sourceBaseY + idx * yGap,
        sendToSaknay: true,
        expression: '',
      })
      sourceNodeIds[field.id] = nodeId
    })

    candidateTargets.forEach((field, idx) => {
      const existingNode = existingNodes.find(n => n.type === 'target' && n.fieldId === field.id)
      if (existingNode) {
        targetNodeIds[field.id] = existingNode.id
        return
      }

      const nodeId = `tgt-${field.id}-${Date.now()}-${Math.random()}`
      nextNodes.push({
        id: nodeId,
        name: getTargetFieldLabel(field),
        emoji: '🎯',
        type: 'target',
        fieldId: field.id,
        isRequired: field.required,
        x: 650,
        y: targetBaseY + idx * yGap,
        sendToSaknay: true,
        expression: '',
      })
      targetNodeIds[field.id] = nodeId
    })

    const sourceByType = {}
    const targetByType = {}
    candidateSources.forEach(field => {
      if (!sourceByType[field.type]) sourceByType[field.type] = []
      sourceByType[field.type].push(field)
    })
    candidateTargets.forEach(field => {
      if (!targetByType[field.type]) targetByType[field.type] = []
      targetByType[field.type].push(field)
    })

    const matchedTargets = new Set()
    const mappedSources = new Set()

    Object.keys(sourceByType).forEach(type => {
      if (!targetByType[type]) return

      sourceByType[type].forEach(srcField => {
        let bestMatch = null
        let bestScore = 0

        targetByType[type].forEach(tgtField => {
          if (matchedTargets.has(tgtField.id)) return
          const score = calculateSimilarity(srcField.name, tgtField.name)
          if (score > bestScore) {
            bestScore = score
            bestMatch = tgtField
          }
        })

        if (bestMatch) {
          matchedTargets.add(bestMatch.id)
          mappedSources.add(srcField.id)
          nextEdges.push({
            from: sourceNodeIds[srcField.id],
            to: targetNodeIds[bestMatch.id],
            fromType: 'source',
            toType: 'target',
            transformer: 'none',
            extraInputs: [],
          })
        }
      })
    })

    Object.keys(sourceByType).forEach(type => {
      sourceByType[type].forEach(srcField => {
        if (mappedSources.has(srcField.id)) return
        const availableTarget = targetByType[type]?.find(field => !matchedTargets.has(field.id))
        if (!availableTarget) return

        matchedTargets.add(availableTarget.id)
        mappedSources.add(srcField.id)
        nextEdges.push({
          from: sourceNodeIds[srcField.id],
          to: targetNodeIds[availableTarget.id],
          fromType: 'source',
          toType: 'target',
          transformer: 'none',
          extraInputs: [],
        })
      })
    })

    applyCanvas(nextNodes, nextEdges)
  }

  const bezier = (x1, y1, x2, y2) => {
    const dx = Math.max(Math.abs(x2 - x1) * 0.55, 50)
    return `M ${x1},${y1} C ${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`
  }

  const getTransformerGeometry = (x1, y1, x2, y2, tfWidth = 140, tfHeight = 55) => {
    const midX = (x1 + x2) / 2
    const midY = (y1 + y2) / 2

    return {
      midX,
      midY,
      tfWidth,
      tfHeight,
      leftX: midX - tfWidth / 2,
      rightX: midX + tfWidth / 2,
    }
  }

  const resetTransformerModal = () => {
    setAddTransformerModal(null)
    setTransformerSearch('')
    setSelectedTf(null)
    setTfPropValues({})
  }

  const openTransformerModal = (edge, mode = 'replace') => {
    const liveEdge = edges.find(e => e.from === edge?.from && e.to === edge?.to) || edge
    setAddTransformerModal({ edge: liveEdge, mode })
    setTransformerSearch('')

    if (liveEdge?.transformer && liveEdge.transformer !== 'none') {
      const transformer = findTransformer(transformers, liveEdge.transformer)
      const defaults = {}
      if (transformer) {
        getPropsSchema(transformers, transformer._id).forEach(p => { defaults[p.key] = p.default })
      }
      setSelectedTf(transformer)
      setTfPropValues({ ...defaults, ...(liveEdge.transformerProps || {}) })
      return
    }

    setSelectedTf(null)
    setTfPropValues({})
  }

  tfBoxesRef.current = []

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--bg)', height: '100%' }}>
      <div style={{ display: 'flex', flex: 1, gap: '0', overflow: 'hidden' }}>
        
        {/* LEFT PANEL - Source Fields */}
        <div style={{
          width: '190px',
          background: 'var(--surf)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>Source Fields <span style={{background: 'var(--accent)', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px'}}>{filteredSource.length}</span></div>
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
            <button
              onClick={handleSourceBulkAction}
              style={{
                width: '100%',
                marginTop: '8px',
                padding: '8px',
                border: '1px solid var(--accent)',
                borderRadius: '6px',
                background: 'rgba(79,110,247,.12)',
                color: 'var(--accent)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {allSourceOnCanvas ? '<<<' : '>>>'}
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {filteredSource.map((field) => (
              <div
                key={field.id}
                data-testid={`source-list-item-${field.id}`}
                draggable={!existingSourceFieldIds.has(field.id)}
                onDragEnd={(e) => !existingSourceFieldIds.has(field.id) && dragFromPanel(e, field, 'source')}
                onDoubleClick={() => !existingSourceFieldIds.has(field.id) && addFieldToCanvas(field, 'source')}
                style={{
                  padding: '10px 8px',
                  marginBottom: '6px',
                  background: existingSourceFieldIds.has(field.id) ? 'rgba(148,163,184,.18)' : 'var(--surf2)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  cursor: existingSourceFieldIds.has(field.id) ? 'not-allowed' : 'grab',
                  fontSize: '12px',
                  color: existingSourceFieldIds.has(field.id) ? 'var(--muted)' : 'var(--text)',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'flex-start',
                  transition: 'all 0.2s',
                  opacity: existingSourceFieldIds.has(field.id) ? 0.55 : 1,
                }}
                title={existingSourceFieldIds.has(field.id) ? 'Field already added to canvas' : ''}
                onMouseEnter={(e) => {
                  if (existingSourceFieldIds.has(field.id)) return
                  e.currentTarget.style.background = 'var(--surf3)'
                  e.currentTarget.style.borderColor = 'var(--accent)'
                }}
                onMouseLeave={(e) => {
                  if (existingSourceFieldIds.has(field.id)) return
                  e.currentTarget.style.background = 'var(--surf2)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
              >
                <span>📄</span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span data-testid={`source-list-name-${field.id}`} style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: 1.3 }}>
                    {getSourceFieldLabel(field)}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--muted)', contentVisibility: 'auto' }}>{field.type}</span>
                </div>
                {field.required && <span style={{ color: 'var(--danger)', fontSize: '10px', marginTop: '2px' }}>*</span>}
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
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={alignNodes}
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
                  e.target.style.borderColor = 'var(--accent)'
                  e.target.style.color = 'var(--accent)'
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = 'var(--border)'
                  e.target.style.color = 'var(--text)'
                }}
              >
                Align
              </button>
              <button
                onClick={() => setTransformerModal(true)}
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
                  e.target.style.borderColor = 'var(--accent)'
                  e.target.style.color = 'var(--accent)' 
                }}
                onMouseLeave={(e) => { 
                  e.target.style.borderColor = 'var(--border)'
                  e.target.style.color = 'var(--text)' 
                }}
              >
                ⚙ Show Transformers ({transformers.length})
              </button>
              <button
                onClick={mapAllFields}
                style={{
                  padding: '6px 12px',
                  border: '1px solid var(--accent)',
                  background: 'rgba(79, 110, 247, 0.08)',
                  color: 'var(--accent)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { 
                  e.target.style.background = 'var(--accent)'
                  e.target.style.color = 'white' 
                }}
                onMouseLeave={(e) => { 
                  e.target.style.background = 'rgba(79, 110, 247, 0.08)'
                  e.target.style.color = 'var(--accent)' 
                }}
              >
                ⚡ Map All Fields
              </button>
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
          </div>

          {/* Canvas Area */}
          <div
            ref={canvasRef}
            data-testid="field-mapping-canvas"
            onContextMenu={suppressEmptyCanvasContextMenu}
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
              onContextMenu={suppressEmptyCanvasContextMenu}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: nodes.length > 0 ? Math.max(1000, Math.max(...nodes.map(n => n.x + NODE_WIDTH)) + 200) : 1000,
                height: nodes.length > 0 ? Math.max(700, Math.max(...nodes.map(n => n.y + CANVAS_NODE_BOUND_HEIGHT)) + 200) : 700,
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

                const x1 = fromNode.x + NODE_WIDTH
                const y1 = fromNode.y + NODE_HALF_HEIGHT
                const x2 = toNode.x
                const y2 = toNode.y + NODE_HALF_HEIGHT
                const transformer = findTransformer(transformers, edge.transformer)
                const tf = getTransformerGeometry(x1, y1, x2, y2)
                const directPath = bezier(x1, y1, x2, y2)
                const inboundPath = bezier(x1, y1, tf.leftX, tf.midY)
                const outboundPath = bezier(tf.rightX, tf.midY, x2, y2)

                // Register bounding box for multi-input drop detection
                if (transformer && transformer._id) {
                  tfBoxesRef.current.push({
                    edgeIdx: idx,
                    x: tf.leftX,
                    y: tf.midY - tf.tfHeight / 2,
                    w: tf.tfWidth,
                    h: tf.tfHeight,
                  })
                }

                return (
                  <g key={idx} style={{ cursor: 'pointer' }}>
                    {transformer && transformer._id ? (
                      <>
                        <path d={inboundPath} stroke="#4f6ef7" strokeWidth="7" fill="none" opacity="0.12" />
                        <path d={inboundPath} stroke="#4f6ef7" strokeWidth="2.5" fill="none" style={{ strokeDasharray: '600', animation: 'eDraw 0.4s ease forwards' }} />
                        <path d={outboundPath} stroke="#4f6ef7" strokeWidth="7" fill="none" opacity="0.12" />
                        <path d={outboundPath} stroke="#4f6ef7" strokeWidth="2.5" fill="none" markerEnd="url(#arr)" style={{ strokeDasharray: '600', animation: 'eDraw 0.4s ease forwards' }} />
                      </>
                    ) : (
                      <>
                        <path d={directPath} stroke="#4f6ef7" strokeWidth="7" fill="none" opacity="0.12" />
                        <path d={directPath} stroke="#4f6ef7" strokeWidth="2.5" fill="none" markerEnd="url(#arr)" style={{ strokeDasharray: '600', animation: 'eDraw 0.4s ease forwards' }} />
                      </>
                    )}
                    
                    {/* Transformer Node - using foreignObject for field-style component */}
                     {transformer && transformer._id && (
                       <foreignObject
                         x={tf.leftX}
                         y={tf.midY - tf.tfHeight / 2}
                         width={tf.tfWidth}
                         height={tf.tfHeight}
                         data-edge-idx={idx}
                         style={{ pointerEvents: 'auto' }}
                       >
                         <div
                           onClick={(e) => {
                             e.stopPropagation()
                             e.preventDefault()
                             setCurrentEdge(edge)
                             openTransformerModal(edge, 'replace')
                           }}
                           onContextMenu={(e) => {
                             e.preventDefault()
                             e.stopPropagation()
                             setCurrentEdge(edge)
                             setPlusCtxMenu({ x: e.clientX, y: e.clientY, edge, mode: 'replace' })
                           }}
                           className={transformer?.isMultipleInput ? 'tf-multi-input-node' : ''}
                           style={{
                            width: '100%',
                            height: '100%',
                            background: 'var(--surf2)',
                            border: '1.5px solid var(--accent)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                            userSelect: 'none',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent)'
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(79,110,247,0.2)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent)'
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'
                          }}
                        >
                          {/* Left stripe */}
                          <div style={{
                            position: 'absolute',
                            left: 0,
                            top: '4px',
                            bottom: '4px',
                            width: '3px',
                            borderRadius: '2px',
                            background: 'var(--accent)',
                          }} />

                          {/* Icon */}
                          <div style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '4px',
                            background: 'rgba(79,110,247,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            flexShrink: 0,
                            marginLeft: '2px',
                          }}>
                            {transformer?.icon || '⚙'}
                          </div>

                          {/* Text */}
                          <div style={{
                            flex: 1,
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column',
                          }}>
                            <div style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              color: 'var(--text)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              lineHeight: '1.2',
                            }}>
                              {transformer?.name}
                            </div>
                             <div style={{
                              fontSize: '8px',
                              fontWeight: 600,
                              color: 'var(--muted)',
                              textTransform: 'uppercase',
                            }}>
                              Transformer
                            </div>
                            {/* Extra inputs badge */}
                            {(edge.extraInputs?.length > 0) && (
                              <div style={{
                                fontSize: '8px', fontWeight: 700,
                                color: 'var(--success)',
                                display: 'flex', alignItems: 'center', gap: '2px',
                              }}>
                                <span>⇉</span>
                                <span>{edge.extraInputs.length + 1} inputs</span>
                              </div>
                            )}
                            {/* Drop hint for multi-input transformers with no extra inputs yet */}
                            {transformer?.isMultipleInput && !edge.extraInputs?.length && (
                              <div style={{
                                fontSize: '8px', fontWeight: 600,
                                color: 'rgba(79,110,247,0.6)',
                                fontStyle: 'italic',
                              }}>
                                + drop src here
                              </div>
                            )}
                          </div>
                        </div>
                      </foreignObject>
                    )}

                    {/* Click area for empty transformer (to add one) */}
                    {(!transformer || transformer.id === 'none') && (
                      <g
                        data-testid={`add-transformer-trigger-${idx}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setCurrentEdge(edge)
                          openTransformerModal(edge, 'replace')
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setCurrentEdge(edge)
                          setPlusCtxMenu({ x: e.clientX, y: e.clientY, edge, mode: 'replace' })
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle cx={tf.midX} cy={tf.midY} r="18" fill="transparent" />
                        <circle cx={tf.midX} cy={tf.midY} r="11" fill="var(--surf)" stroke="#4f6ef7" strokeWidth="2" />
                        <text
                          x={tf.midX}
                          y={tf.midY}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="#4f6ef7"
                          fontSize="14"
                          fontWeight="700"
                          style={{ userSelect: 'none', pointerEvents: 'none' }}
                        >
                          +
                        </text>
                      </g>
                    )}
                    {/* Extra input lines — additional source nodes feeding the transformer */}
                    {transformer && edge.extraInputs?.map((extraSrcId) => {
                      const extraSrc = nodes.find(n => n.id === extraSrcId)
                      if (!extraSrc) return null
                      const ex1 = extraSrc.x + NODE_WIDTH
                      const ey1 = extraSrc.y + NODE_HALF_HEIGHT
                      const ed = bezier(ex1, ey1, tf.leftX, tf.midY)
                      return (
                        <g key={extraSrcId}>
                          {/* Glow — matches primary line */}
                          <path d={ed} stroke="#4f6ef7" strokeWidth="7" fill="none" opacity="0.12" />
                          {/* Solid line with arrow — matches primary line */}
                          <path d={ed} stroke="#4f6ef7" strokeWidth="2.5" fill="none" markerEnd="url(#arr)" style={{ strokeDasharray: '600', animation: 'eDraw 0.4s ease forwards' }} />
                        </g>
                      )
                    })}
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
            <div style={{ position: 'absolute', top: 0, left: 0, width: nodes.length > 0 ? Math.max(1000, Math.max(...nodes.map(n => n.x + NODE_WIDTH)) + 200) : 1000, height: nodes.length > 0 ? Math.max(700, Math.max(...nodes.map(n => n.y + CANVAS_NODE_BOUND_HEIGHT)) + 200) : 700, pointerEvents: 'none' }}>
              {nodes.map((node) => {
                const isRequired = node.type === 'source' 
                  ? sourceSchema.find(f => f.id === node.fieldId)?.required
                  : targetSchema.find(f => f.id === node.fieldId)?.required
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
                      width: `${NODE_WIDTH}px`,
                      height: `${NODE_HEIGHT}px`,
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
                      top: 6,
                      bottom: 6,
                      width: '3px',
                      borderRadius: '2px',
                      background: node.type === 'source' ? 'var(--accent)' : 'var(--success)',
                    }} />

                    {/* Input port */}
                    {rules.hasIn && (
                      <div
                        data-testid={`target-port-${node.id}`}
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
                        <div data-testid={`canvas-node-name-${node.id}`} style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--text)',
                          whiteSpace: 'normal',
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                          lineHeight: 1.25,
                        }}>
                          {node.name}
                          {isRequired && <span style={{ color: 'var(--danger)', marginLeft: '4px' }}>*</span>}
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          columnGap: '8px',
                          rowGap: '4px',
                          marginTop: '2px',
                        }}>
                          <div style={{
                            fontSize: '9px',
                            fontWeight: 600,
                            color: 'var(--muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            minWidth: 0,
                            flexShrink: 0,
                          }}>
                            {node.type === 'source' ? 'SOURCE' : 'TARGET'}
                          </div>

                          {node.type === 'target' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexShrink: 0, marginLeft: 'auto', maxWidth: '100%' }}>
                              {!!node.expression?.trim() && (
                                <span
                                  data-testid={`target-expression-badge-${node.id}`}
                                  title="Expression configured"
                                  style={{
                                    background: 'rgba(79,110,247,0.12)',
                                    border: '1px solid rgba(79,110,247,0.45)',
                                    borderRadius: '4px',
                                    padding: '1px 5px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    fontSize: '9px',
                                    fontWeight: 700,
                                    color: 'var(--accent)',
                                    letterSpacing: '0.04em',
                                    userSelect: 'none',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                  }}
                                >
                                  exp
                                </span>
                              )}

                              <button
                                type="button"
                                data-testid={`target-saknay-toggle-${node.id}`}
                                title={node.sendToSaknay ? 'Send to Saknay: Yes' : 'Send to Saknay: No'}
                                aria-label={`Toggle Saknay for ${node.name}`}
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                }}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  toggleTargetNodeFlag(node.id, 'sendToSaknay')
                                }}
                                style={{
                                  background: node.sendToSaknay ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                                  border: node.sendToSaknay ? '1px solid rgba(34,197,94,0.55)' : '1px solid rgba(239,68,68,0.55)',
                                  borderRadius: '4px',
                                  padding: '1px 5px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  fontSize: '9px',
                                  fontWeight: 700,
                                  color: node.sendToSaknay ? '#22c55e' : '#ef4444',
                                  letterSpacing: '0.04em',
                                  userSelect: 'none',
                                  whiteSpace: 'nowrap',
                                  cursor: 'pointer',
                                  pointerEvents: 'auto',
                                  appearance: 'none',
                                  outline: 'none',
                                  flexShrink: 0,
                                }}
                              >
                                <span style={{ fontSize: '10px', lineHeight: 1 }}>{node.sendToSaknay ? '✓' : '⊘'}</span>
                                <span>Saknay</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Output port */}
                    {rules.hasOut && (
                      <div
                        data-testid={`source-port-${node.id}`}
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
                          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79, 110, 247, 0.2)'
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
          width: '190px',
          background: 'var(--surf)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>Target Fields <span style={{background: 'var(--success)', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px'}}>{filteredTarget.length}</span></div>
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
            <button
              onClick={handleTargetBulkAction}
              style={{
                width: '100%',
                marginTop: '8px',
                padding: '8px',
                border: '1px solid var(--success)',
                borderRadius: '6px',
                background: 'rgba(34,197,94,.12)',
                color: 'var(--success)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {allTargetOnCanvas ? '>>>' : '<<<'}
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {filteredTarget.map((field) => (
              <div
                key={field.id}
                data-testid={`target-list-item-${field.id}`}
                draggable={!existingTargetFieldIds.has(field.id)}
                onDragEnd={(e) => !existingTargetFieldIds.has(field.id) && dragFromPanel(e, field, 'target')}
                onDoubleClick={() => !existingTargetFieldIds.has(field.id) && addFieldToCanvas(field, 'target')}
                style={{
                  padding: '10px 8px',
                  marginBottom: '6px',
                  background: existingTargetFieldIds.has(field.id) ? 'rgba(148,163,184,.18)' : 'var(--surf2)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  cursor: existingTargetFieldIds.has(field.id) ? 'not-allowed' : 'grab',
                  fontSize: '12px',
                  color: existingTargetFieldIds.has(field.id) ? 'var(--muted)' : 'var(--text)',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'flex-start',
                  transition: 'all 0.2s',
                  opacity: existingTargetFieldIds.has(field.id) ? 0.55 : 1,
                }}
                title={existingTargetFieldIds.has(field.id) ? 'Field already added to canvas' : ''}
                onMouseEnter={(e) => {
                  if (existingTargetFieldIds.has(field.id)) return
                  e.currentTarget.style.background = 'var(--surf3)'
                  e.currentTarget.style.borderColor = 'var(--success)'
                }}
                onMouseLeave={(e) => {
                  if (existingTargetFieldIds.has(field.id)) return
                  e.currentTarget.style.background = 'var(--surf2)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
              >
                <span>🎯</span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span data-testid={`target-list-name-${field.id}`} style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: 1.3 }}>
                    {getTargetFieldLabel(field)}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--muted)', contentVisibility: 'auto' }}>{field.type}</span>
                </div>
                {field.required && <span style={{ color: 'var(--danger)', fontSize: '10px', marginTop: '2px' }}>*</span>}
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

      {/* Target field context menu */}
      {ctxMenu && (() => {
        const liveNode = nodes.find(n => n.id === (currentCtxId || ctxMenu.nodeId)) || ctxMenu.node
        if (!liveNode || liveNode.type !== 'target') return null

        return (
          <>
            <div
              data-testid="ctxmenu-backdrop"
              style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
              onClick={() => {
                setCtxMenu(null)
                setCurrentCtxId(null)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            />
            <div
              style={{
                position: 'fixed',
                left: Math.min(ctxMenu.x, window.innerWidth - 360),
                top: Math.min(ctxMenu.y, window.innerHeight - 320),
                width: '320px',
                background: 'var(--surf)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                boxShadow: '0 14px 36px rgba(0,0,0,0.22)',
                zIndex: 1001,
                overflow: 'hidden',
                animation: 'ctxIn 0.16s ease',
              }}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              <div style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Target Field
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{liveNode.name}</div>
              </div>

              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', fontSize: '13px', color: 'var(--text)' }}>
                  <span>Saknay</span>
                  <input
                    data-testid="ctxmenu-saknay-toggle"
                    type="checkbox"
                    checked={liveNode.sendToSaknay ?? true}
                    onChange={(e) => updateTargetNodeMeta(liveNode.id, { sendToSaknay: e.target.checked })}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--text)' }}>
                  <span>Expression</span>
                  <textarea
                    data-testid="ctxmenu-expression-input"
                    value={liveNode.expression || ''}
                    onChange={(e) => updateTargetNodeMeta(liveNode.id, { expression: e.target.value })}
                    placeholder="Enter expression..."
                    rows={4}
                    style={{
                      width: '100%',
                      resize: 'vertical',
                      padding: '8px 10px',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      background: 'var(--surf2)',
                      color: 'var(--text)',
                      fontSize: '12px',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </label>
              </div>
            </div>
          </>
        )
      })()}

      {/* Plus circle right-click context menu */}
      {plusCtxMenu && (() => {
        const liveEdge = edges.find(e => e.from === plusCtxMenu.edge?.from && e.to === plusCtxMenu.edge?.to) || plusCtxMenu.edge
        const hasTransformer = !!(liveEdge?.transformer && liveEdge.transformer !== 'none')

        return (
          <div
            style={{
              position: 'fixed',
              left: plusCtxMenu.x,
              top: Math.min(plusCtxMenu.y, window.innerHeight - 320),
              background: 'var(--surf)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
              zIndex: 1001,
              minWidth: '200px',
              maxHeight: '400px',
              overflowY: 'auto',
              animation: 'ctxIn 0.15s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Connection
            </div>

            <div
              style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '13px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.15s' }}
              onClick={() => {
                setPlusCtxMenu(null)
                openTransformerModal(liveEdge, hasTransformer ? 'replace' : 'add')
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(79,110,247,0.10)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: '16px' }}>⚙</span>
              <span>{hasTransformer ? 'Replace Transformer' : 'Add Transformer'}</span>
            </div>

            {hasTransformer && (
              <div
                style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '13px', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.15s', borderTop: '1px solid var(--border)' }}
                onClick={() => {
                  setPlusCtxMenu(null)
                  openTransformerModal(liveEdge, 'edit')
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(79,110,247,0.10)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: '16px' }}>✏️</span>
                <span>Edit Transformer</span>
              </div>
            )}

            {hasTransformer && (
              <div
                style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '13px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.15s' }}
                onClick={() => {
                  applyEdges(prev => prev.map(e =>
                    (e.from === liveEdge.from && e.to === liveEdge.to)
                      ? { ...e, transformer: 'none', extraInputs: [], transformerProps: {} }
                      : e
                  ))
                  setPlusCtxMenu(null)
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: '16px' }}>✕</span>
                <span>Remove Transformer</span>
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border)' }}>
              {liveEdge?.extraInputs?.length > 0 && (
                <>
                  <div style={{ padding: '6px 12px 2px', fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Extra Inputs
                  </div>
                  {liveEdge.extraInputs.map(extraId => {
                    const extraNode = nodes.find(n => n.id === extraId)
                    return (
                      <div
                        key={extraId}
                        style={{ padding: '8px 14px', cursor: 'pointer', fontSize: '12px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.15s' }}
                        onClick={() => {
                          applyEdges(prev => prev.map(e =>
                            (e.from === liveEdge.from && e.to === liveEdge.to)
                              ? { ...e, extraInputs: (e.extraInputs || []).filter(id => id !== extraId) }
                              : e
                          ))
                          setPlusCtxMenu(null)
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <span style={{ fontSize: '14px' }}>✕</span>
                        <span>Remove "{extraNode?.name || extraId}"</span>
                      </div>
                    )
                  })}
                  <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                </>
              )}

              <div
                style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '13px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.15s' }}
                onClick={() => {
                  removeEdge(liveEdge)
                  setPlusCtxMenu(null)
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: '16px' }}>🗑</span>
                <span>Delete Connection</span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Transformer menu (existing transformer square click) */}
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
          {transformers.map((t) => (
            <div
              key={t._id}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                color: 'var(--text)',
                transition: 'background 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderLeft: currentEdge.transformer === t._id ? '3px solid #4f6ef7' : '3px solid transparent',
              }}
              onClick={() => setEdgeTransformer(currentEdge, t._id)}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: '14px' }}>{t.icon}</span>
              <span>{t.name}</span>
              {currentEdge.transformer === t._id && <span style={{ marginLeft: 'auto', color: '#4f6ef7' }}>✓</span>}
            </div>
          ))}
          {currentEdge.transformer && currentEdge.transformer !== 'none' && (
            <div style={{ borderTop: '1px solid var(--border)' }}>
              <div
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'var(--text)',
                  transition: 'background 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onClick={() => {
                  openTransformerModal(currentEdge, 'edit')
                  setTransformerMenu(null)
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.1)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                ✏ Edit Properties
              </div>
            </div>
          )}
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <div
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                color: 'var(--danger)',
                transition: 'background 0.15s',
              }}
              onClick={() => removeEdge(currentEdge)}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              Delete Connection
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Transformer Modal */}
      {addTransformerModal && (() => {
        const currentModalEdge = edges.find(e => e.from === addTransformerModal.edge?.from && e.to === addTransformerModal.edge?.to) || addTransformerModal.edge
        const hadAssignedTransformer = !!(currentModalEdge?.transformer && currentModalEdge.transformer !== 'none')
        const currentAssignedTransformer = findTransformer(transformers, currentModalEdge?.transformer)
        const filtered = transformers.filter(t =>
          t.name.toLowerCase().includes(transformerSearch.toLowerCase()) ||
          t._id.toLowerCase().includes(transformerSearch.toLowerCase())
        )
        const schema = selectedTf ? getPropsSchema(transformers, selectedTf._id) : []
        const hasProps = schema.length > 0

        const handleSelectTf = (t) => {
          setSelectedTf(t)
          const defaults = {}
          getPropsSchema(transformers, t._id).forEach(p => { defaults[p.key] = p.default })
          const keepExisting = currentAssignedTransformer?._id === t._id ? (currentModalEdge.transformerProps || {}) : {}
          setTfPropValues({ ...defaults, ...keepExisting })
        }

        const handleApply = () => {
          if (!selectedTf) return

          applyEdges(prev => prev.map(e => {
            if (e.from !== currentModalEdge.from || e.to !== currentModalEdge.to) return e
            return {
              ...e,
              transformer: selectedTf._id,
              transformerProps: { ...tfPropValues },
              extraInputs: selectedTf.isMultipleInput ? (e.extraInputs || []) : [],
            }
          }))

          resetTransformerModal()
        }

        return (
          <>
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1099 }}
              onClick={resetTransformerModal}
            />
            <div
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'var(--surf)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                zIndex: 1100,
                width: selectedTf && hasProps ? '680px' : '380px',
                maxHeight: '600px',
                display: 'flex',
                flexDirection: 'column',
                animation: 'scaleIn 0.22s ease',
                transition: 'width 0.22s ease',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ background: 'var(--accent)', padding: '16px 18px', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <span style={{ fontSize: '20px' }}>⚙</span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff', flex: 1 }}>
                  {selectedTf ? `${selectedTf.name} — Properties` : (hadAssignedTransformer ? 'Replace Transformer' : 'Add Transformer')}
                </span>
                {selectedTf && (
                  <button
                    onClick={() => { setSelectedTf(null); setTfPropValues({}) }}
                    style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', marginRight: '4px' }}
                  >← Back</button>
                )}
                <button
                  onClick={resetTransformerModal}
                  style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', borderRadius: '6px', width: '26px', height: '26px', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >×</button>
              </div>

              <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                <div style={{ width: selectedTf && hasProps ? '260px' : '100%', display: 'flex', flexDirection: 'column', borderRight: selectedTf && hasProps ? '1px solid var(--border)' : 'none', flexShrink: 0 }}>
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search transformers..."
                      value={transformerSearch}
                      onChange={(e) => setTransformerSearch(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--accent)', borderRadius: '7px', background: 'var(--surf2)', color: 'var(--text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                    {filtered.length === 0 && (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>No transformers found</div>
                    )}
                    {filtered.map((t) => {
                      const isSelected = selectedTf?._id === t._id
                      const propCount = getPropsSchema(transformers, t._id).length
                      return (
                        <div
                          key={t._id}
                          onClick={() => handleSelectTf(t)}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.15s', marginBottom: '2px', background: isSelected ? 'rgba(79,110,247,0.18)' : 'transparent', border: isSelected ? '1.5px solid rgba(79,110,247,0.5)' : '1.5px solid transparent' }}
                          onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(79,110,247,0.09)' }}
                          onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                        >
                          <div style={{ width: '30px', height: '30px', borderRadius: '7px', background: isSelected ? 'rgba(79,110,247,0.25)' : 'rgba(79,110,247,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0 }}>{t.icon}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {t.name}
                              {t.isMultipleInput && <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)', color: 'var(--success)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>multi</span>}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {propCount > 0 ? `${propCount} propert${propCount === 1 ? 'y' : 'ies'}` : 'no properties'}
                            </div>
                          </div>
                          {isSelected && <span style={{ color: '#4f6ef7', fontSize: '14px' }}>›</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {selectedTf && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(79,110,247,0.06)' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(79,110,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>{selectedTf.icon}</div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{selectedTf.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Configure the transformer properties below</div>
                      </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--border)' }}>
                            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--muted)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.07em', width: '36%' }}>Property</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--muted)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.07em', width: '40%' }}>Value</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--muted)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schema.map((prop, pi) => (
                            <tr key={prop.key} style={{ borderBottom: '1px solid rgba(71,85,105,0.4)', background: pi % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                              <td style={{ padding: '8px 8px', fontWeight: 600, color: 'var(--text)', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  {prop.label}
                                  {prop.required && <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: 'var(--danger)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>req</span>}
                                </div>
                              </td>
                              <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                                {prop.type === 'select' ? (
                                  <select value={tfPropValues[prop.key] ?? prop.default} onChange={(e) => setTfPropValues(v => ({ ...v, [prop.key]: e.target.value }))} style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '5px', background: 'var(--surf2)', color: 'var(--text)', fontSize: '12px', cursor: 'pointer' }}>
                                    {prop.options.map(o => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                ) : (
                                  <input type={prop.type === 'number' ? 'number' : 'text'} value={tfPropValues[prop.key] ?? prop.default} onChange={(e) => setTfPropValues(v => ({ ...v, [prop.key]: e.target.value }))} placeholder={String(prop.default)} style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '5px', background: 'var(--surf2)', color: 'var(--text)', fontSize: '12px', boxSizing: 'border-box' }} />
                                )}
                              </td>
                              <td style={{ padding: '8px 8px', color: 'var(--muted)', fontSize: '11px', verticalAlign: 'middle', lineHeight: '1.4' }}>{prop.description}</td>
                            </tr>
                          ))}
                          {!hasProps && (
                            <tr>
                              <td colSpan={3} style={{ padding: '14px 8px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px', fontStyle: 'italic' }}>No additional configurable properties</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg)', borderRadius: '0 0 12px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <div>
                  {hadAssignedTransformer && (
                    <button
                      onClick={() => {
                        applyEdges(prev => prev.map(e =>
                          (e.from === currentModalEdge.from && e.to === currentModalEdge.to)
                            ? { ...e, transformer: 'none', extraInputs: [], transformerProps: {}, transformerInputType: undefined, transformerOutputType: undefined }
                            : e
                        ))
                        resetTransformerModal()
                      }}
                      style={{ padding: '7px 16px', background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                    >
                      ✕ Remove Transformer
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={resetTransformerModal} style={{ padding: '7px 16px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                    Cancel
                  </button>
                  {selectedTf && (
                    <button onClick={handleApply} style={{ padding: '7px 18px', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                      ✓ {hadAssignedTransformer ? 'Save' : 'Apply'} {selectedTf.name}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )
      })()}

      {/* Clear canvas confirmation modal */}
      {clearCanvasConfirm && (
        <>
          <div
            data-testid="clear-canvas-modal-backdrop"
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1099 }}
            onClick={cancelClearCanvas}
          />
          <div
            data-testid="clear-canvas-modal"
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '420px',
              maxWidth: 'calc(100vw - 32px)',
              background: 'var(--surf)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              zIndex: 1100,
              overflow: 'hidden',
              animation: 'scaleIn 0.22s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ background: 'var(--accent)', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>🗑</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Clear Canvas</div>
              </div>
              <button
                type="button"
                onClick={cancelClearCanvas}
                style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', borderRadius: '6px', width: '26px', height: '26px', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >×</button>
            </div>

            <div style={{ padding: '18px', color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>Clear all nodes and mappings from the canvas?</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>
                This action removes all source fields, target fields, connections, and transformer assignments currently shown in the canvas.
              </div>
            </div>

            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                data-testid="clear-canvas-cancel"
                onClick={cancelClearCanvas}
                style={{ padding: '7px 16px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="clear-canvas-confirm"
                onClick={confirmClearCanvas}
                style={{ padding: '7px 16px', background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.35)', color: 'var(--danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
              >
                Clear Canvas
              </button>
            </div>
          </div>
        </>
      )}

      {/* Add / Edit Transformer Modal */}
      {addTransformerModal && (() => {
        const currentModalEdge = edges.find(e => e.from === addTransformerModal.edge?.from && e.to === addTransformerModal.edge?.to) || addTransformerModal.edge
        const hadAssignedTransformer = !!(currentModalEdge?.transformer && currentModalEdge.transformer !== 'none')
        const currentAssignedTransformer = findTransformer(transformers, currentModalEdge?.transformer)
        const filtered = transformers.filter(t =>
          t.name.toLowerCase().includes(transformerSearch.toLowerCase()) ||
          t._id.toLowerCase().includes(transformerSearch.toLowerCase())
        )
        const schema = selectedTf ? getPropsSchema(transformers, selectedTf._id) : []
        const hasProps = schema.length > 0

        const handleSelectTf = (t) => {
          setSelectedTf(t)
          const defaults = {}
          getPropsSchema(transformers, t._id).forEach(p => { defaults[p.key] = p.default })
          const keepExisting = currentAssignedTransformer?._id === t._id ? (currentModalEdge.transformerProps || {}) : {}
          setTfPropValues({ ...defaults, ...keepExisting })
        }

        const handleApply = () => {
          if (!selectedTf) return

          applyEdges(prev => prev.map(e => {
            if (e.from !== currentModalEdge.from || e.to !== currentModalEdge.to) return e
            return {
              ...e,
              transformer: selectedTf._id,
              transformerProps: { ...tfPropValues },
              extraInputs: selectedTf.isMultipleInput ? (e.extraInputs || []) : [],
            }
          }))

          resetTransformerModal()
        }

        return (
          <>
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1099 }}
              onClick={resetTransformerModal}
            />
            <div
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'var(--surf)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                zIndex: 1100,
                width: selectedTf && hasProps ? '680px' : '380px',
                maxHeight: '600px',
                display: 'flex',
                flexDirection: 'column',
                animation: 'scaleIn 0.22s ease',
                transition: 'width 0.22s ease',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ background: 'var(--accent)', padding: '16px 18px', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <span style={{ fontSize: '20px' }}>⚙</span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff', flex: 1 }}>
                  {selectedTf ? `${selectedTf.name} — Properties` : (hadAssignedTransformer ? 'Replace Transformer' : 'Add Transformer')}
                </span>
                {selectedTf && (
                  <button
                    onClick={() => { setSelectedTf(null); setTfPropValues({}) }}
                    style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', marginRight: '4px' }}
                  >← Back</button>
                )}
                <button
                  onClick={resetTransformerModal}
                  style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', borderRadius: '6px', width: '26px', height: '26px', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >×</button>
              </div>

              <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                <div style={{ width: selectedTf && hasProps ? '260px' : '100%', display: 'flex', flexDirection: 'column', borderRight: selectedTf && hasProps ? '1px solid var(--border)' : 'none', flexShrink: 0 }}>
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search transformers..."
                      value={transformerSearch}
                      onChange={(e) => setTransformerSearch(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--accent)', borderRadius: '7px', background: 'var(--surf2)', color: 'var(--text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                    {filtered.length === 0 && (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>No transformers found</div>
                    )}
                    {filtered.map((t) => {
                      const isSelected = selectedTf?._id === t._id
                      const propCount = getPropsSchema(transformers, t._id).length
                      return (
                        <div
                          key={t._id}
                          onClick={() => handleSelectTf(t)}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.15s', marginBottom: '2px', background: isSelected ? 'rgba(79,110,247,0.18)' : 'transparent', border: isSelected ? '1.5px solid rgba(79,110,247,0.5)' : '1.5px solid transparent' }}
                          onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(79,110,247,0.09)' }}
                          onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                        >
                          <div style={{ width: '30px', height: '30px', borderRadius: '7px', background: isSelected ? 'rgba(79,110,247,0.25)' : 'rgba(79,110,247,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0 }}>{t.icon}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {t.name}
                              {t.isMultipleInput && <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)', color: 'var(--success)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>multi</span>}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {propCount > 0 ? `${propCount} propert${propCount === 1 ? 'y' : 'ies'}` : 'no properties'}
                            </div>
                          </div>
                          {isSelected && <span style={{ color: '#4f6ef7', fontSize: '14px' }}>›</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {selectedTf && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(79,110,247,0.06)' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(79,110,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>{selectedTf.icon}</div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{selectedTf.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Configure the transformer properties below</div>
                      </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--border)' }}>
                            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--muted)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.07em', width: '36%' }}>Property</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--muted)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.07em', width: '40%' }}>Value</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--muted)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schema.map((prop, pi) => (
                            <tr key={prop.key} style={{ borderBottom: '1px solid rgba(71,85,105,0.4)', background: pi % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                              <td style={{ padding: '8px 8px', fontWeight: 600, color: 'var(--text)', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  {prop.label}
                                  {prop.required && <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: 'var(--danger)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>req</span>}
                                </div>
                              </td>
                              <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                                {prop.type === 'select' ? (
                                  <select value={tfPropValues[prop.key] ?? prop.default} onChange={(e) => setTfPropValues(v => ({ ...v, [prop.key]: e.target.value }))} style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '5px', background: 'var(--surf2)', color: 'var(--text)', fontSize: '12px', cursor: 'pointer' }}>
                                    {prop.options.map(o => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                ) : (
                                  <input type={prop.type === 'number' ? 'number' : 'text'} value={tfPropValues[prop.key] ?? prop.default} onChange={(e) => setTfPropValues(v => ({ ...v, [prop.key]: e.target.value }))} placeholder={String(prop.default)} style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '5px', background: 'var(--surf2)', color: 'var(--text)', fontSize: '12px', boxSizing: 'border-box' }} />
                                )}
                              </td>
                              <td style={{ padding: '8px 8px', color: 'var(--muted)', fontSize: '11px', verticalAlign: 'middle', lineHeight: '1.4' }}>{prop.description}</td>
                            </tr>
                          ))}
                          {!hasProps && (
                            <tr>
                              <td colSpan={3} style={{ padding: '14px 8px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px', fontStyle: 'italic' }}>No additional configurable properties</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg)', borderRadius: '0 0 12px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <div>
                  {hadAssignedTransformer && (
                    <button
                      onClick={() => {
                        applyEdges(prev => prev.map(e =>
                          (e.from === currentModalEdge.from && e.to === currentModalEdge.to)
                            ? { ...e, transformer: 'none', extraInputs: [], transformerProps: {}, transformerInputType: undefined, transformerOutputType: undefined }
                            : e
                        ))
                        resetTransformerModal()
                      }}
                      style={{ padding: '7px 16px', background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                    >
                      ✕ Remove Transformer
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={resetTransformerModal} style={{ padding: '7px 16px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                    Cancel
                  </button>
                  {selectedTf && (
                    <button onClick={handleApply} style={{ padding: '7px 18px', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                      ✓ {hadAssignedTransformer ? 'Save' : 'Apply'} {selectedTf.name}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )
      })()}

      {/* Transformers list modal */}
      {transformerModal && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1099 }}
            onClick={() => setTransformerModal(false)}
          />
          <div
            style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--surf)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', zIndex: 1100, width: '90%', maxWidth: '500px', maxHeight: '80vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ background: 'var(--accent)', padding: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '24px' }}>⚙</div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' }}>Available Transformers</h3>
              <div style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600 }}>{transformers.length}</div>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {transformers.map((transformer) => {
                  const usageCount = edges.filter(e => e.transformer === transformer._id).length
                  return (
                    <div
                      key={transformer._id}
                      style={{ padding: '14px', background: 'var(--surf2)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(79,110,247,0.2)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
                      onClick={() => {
                        if (!currentEdge) {
                          alert('Please select a connection first')
                          return
                        }
                        openTransformerModal(currentEdge, 'replace')
                        setTransformerModal(false)
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <div style={{ fontSize: '18px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(79,110,247,0.1)', borderRadius: '6px' }}>{transformer.icon}</div>
                        <div style={{ flex: 1 }}><div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>{transformer.name}</div></div>
                        {usageCount > 0 && <div style={{ background: 'var(--accent)', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600 }}>{usageCount}</div>}
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '8px 0 0 0' }}>{transformer.description || transformer.name}</p>
                    </div>
                  )
                })}
              </div>
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg)' }}>
              <button onClick={() => setTransformerModal(false)} style={{ padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Close</button>
            </div>
          </div>
        </>
      )}

      {/* Close menus on canvas click */}
      {(transformerMenu || plusCtxMenu) && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} 
          onClick={() => {
            setTransformerMenu(null)
            setPlusCtxMenu(null)
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
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.92); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
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

      {/* Success Modal */}
      {successModal && (
        <>
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 999,
            }}
          />
          <div 
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'var(--surf)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              zIndex: 1000,
              minWidth: '380px',
              maxWidth: '500px',
              animation: 'scaleIn 0.3s ease',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              background: 'var(--success)',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <div style={{ fontSize: '32px' }}>✅</div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' }}>Mappings Saved</h3>
              </div>
            </div>

            {/* Body */}
            <div style={{
              padding: '20px',
              color: 'var(--text)',
              fontSize: '14px',
              lineHeight: '1.6',
              textAlign: 'center',
            }}>
              Successfully saved {successModal} mapping{successModal !== 1 ? 's' : ''} to your pipeline.
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'center',
              background: 'var(--bg)',
            }}>
              <button
                onClick={() => setSuccessModal(null)}
                style={{
                  padding: '8px 16px',
                  background: 'var(--success)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                Got it!
              </button>
            </div>
          </div>

          <style>{`
            @keyframes scaleIn {
              from { transform: translate(-50%, -50%) scale(0.9); opacity: 0; }
              to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            }
          `}</style>
        </>
      )}
    </div>
  )
}
