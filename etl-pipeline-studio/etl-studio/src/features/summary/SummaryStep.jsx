import { useRef, useState, useEffect } from 'react'
import { useWizard } from "../../shared/store/wizardStore.jsx";
import { useConfig } from "../../shared/store/configContext.jsx";
import { Card, CardTitle, ValidationItem, Btn, DeployProgressModal } from '../../shared/components/index.jsx'
import { useDeploymentProgress } from '../../shared/hooks/useDeploymentProgress.js'
import { SOURCE_TYPES, formatEnvironmentLabel, normalizeMetadataLocation, resolveSourceSchema, resolveTargetSchema } from '../../shared/types/index.js'
import { saveDraftConfiguration } from '../../shared/services/configService.js'
import { fetchDeploymentSteps, deployFromYaml, subscribeToDeploymentProgress }
  from '../../shared/services/deploymentsService.js'
import { setDeploymentStatus } from '../../shared/services/deploymentsService.js'
import { compactYamlDocument, formatTransformationYamlItem, quoteYamlDoubleQuoted, formatKeyValueYamlSection, formatFiltersYamlSection } from '../../shared/services/configurationYaml.js'
import { formatInputFieldsYamlSection } from '../../shared/services/configurationYaml.js'
import { copyTextToClipboard } from '../../shared/services/clipboard.js'
import { hydrateWizardStateFromYaml } from '../../shared/services/configurationHydrator.js'
import { buildPipelineChangeSignature } from '../../shared/services/pipelineChangeDetection.js'
import {
  ASG_YAML_FLAG_KEY,
  PRODUCT_CODE_YAML_KEY,
  SAKNAY_TOPIC_YAML_KEY,
  SAKNAY_YAML_FLAG_KEY,
  SAKNAY_YAML_SECTION_KEY,
  SHADOW_TOPIC_YAML_KEY,
  SHADOW_YAML_FLAG_KEY,
  TARGET_SAKNAY_YAML_KEY,
} from '../../shared/services/appConfig.js'
import { canDeployFromSummaryChecklist, getSummaryValidations } from '../../shared/services/wizardValidation.js'
import { useSummaryFooter } from './summaryFooterContext.jsx'

function FlinkFlow({ sourceType, mappings, filters, sink }) {
  const nodes = []
  
  // Source node
  nodes.push({ id: 'src',    label: 'Source',   sub: sourceType?.toUpperCase() || 'KAFKA',      color: '#4f6ef7', pl: 2 })
  
  // Filter node - only if filters exist
  const totalFilterRules = filters.reduce((a, g) => a + g.rules.length, 0)
  if (totalFilterRules > 0) {
    nodes.push({ id: 'filter', label: 'Filter',   sub: `${totalFilterRules} rules`, color: '#f59e0b', pl: 2 })
  }
  
  // Mapping node
  nodes.push({ id: 'map',    label: 'Mapping',  sub: `${mappings.length} fields`,               color: '#22c55e', pl: 4 })
  
  // Sink node
  nodes.push({ id: 'sink',   label: 'Sink',     sub: sink?.sinkType?.toUpperCase() || 'KAFKA',  color: '#ec4899', pl: 2 })
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap', justifyContent: 'center', padding: '10px 0' }}>
      {nodes.map((n, i) => (
        <div key={n.id} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            background: `${n.color}22`, border: `2px solid ${n.color}`,
            borderRadius: 10, padding: '12px 20px', textAlign: 'center', minWidth: 100,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: n.color }}>{n.label}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, fontFamily: 'var(--mono)' }}>{n.sub}</div>
          </div>
          {i < nodes.length - 1 && (
            <div style={{ display: 'flex', alignItems: 'center', margin: '0 4px' }}>
              <div style={{ width: 20, height: 2, background: 'var(--border)' }} />
              <div style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '8px solid var(--border)' }} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function getYamlPreviewPalette(theme = 'dark') {
  return theme === 'light'
    ? {
        text: '#334155',
        background: '#f8fafc',
        comment: '#64748b',
        section: '#1d4ed8',
        value: '#0369a1',
      }
    : {
        text: '#a3b4cd',
        background: '#0d1117',
        comment: '#586e75',
        section: '#d0e0ff',
        value: '#7dd3fc',
      }
}

function YamlPreview({ yaml, theme = 'dark' }) {
  const lines = yaml.split('\n')
  const palette = getYamlPreviewPalette(theme)

  return (
    <pre data-testid="yaml-preview" style={{
      fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.75,
      color: palette.text, background: palette.background, borderRadius: 8,
      padding: '14px 18px', overflowX: 'auto', margin: 0,
    }}>
      {lines.map((line, i) => {
        const trimmed = line.trim()
        const isComment = trimmed.startsWith('#')
        const isListItem = /^-\s/.test(trimmed)
        const hasBareKey = /^[A-Za-z_][A-Za-z0-9_]*:\s*$/.test(trimmed) && !isListItem
        const currentIndent = line.match(/^\s*/)?.[0]?.length || 0
        const nextNonEmptyLine = lines.slice(i + 1).find(candidate => candidate.trim() !== '')
        const nextIndent = nextNonEmptyLine?.match(/^\s*/)?.[0]?.length ?? -1
        const isSectionKey = hasBareKey && nextIndent > currentIndent
        const isEmptyProperty = hasBareKey && !isSectionKey
        const isValue = (trimmed.includes(': ') || isEmptyProperty) && !isComment && !isSectionKey
        return (
          <span key={i} style={{
            color: isComment ? palette.comment : isSectionKey ? palette.section : isValue ? palette.value : palette.text,
            display: 'block',
            fontWeight: isSectionKey ? 600 : 400,
          }}>
            {line}
          </span>
        )
      })}
    </pre>
  )
}

export default function SummaryStep() {
  const { state, actions } = useWizard()
  const { transformers } = useConfig()
  const summaryFooter = useSummaryFooter()
  const sourceSchema = resolveSourceSchema(state.upload)
  const targetSchema = resolveTargetSchema(state.targetSchema)
  const srcMeta = SOURCE_TYPES.find(t => t.id === state.source.sourceType)
  const hasSaknayTargets = state.mappings.some(mapping => Boolean(mapping?.tgt) && (mapping?.tgtMetadata?.sendToSaknay ?? true))
  const [submitted, setSubmitted] = useState(false)
  const [copying, setCopying] = useState(false)
  const [copiedDash, setCopiedDash] = useState(false)
  const [errorModal, setErrorModal] = useState(null)
  const [noChangesModalOpen, setNoChangesModalOpen] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [draftModal, setDraftModal] = useState(null)
  const [deployDisabled, setDeployDisabled] = useState(false)

  const closeDraftModal = () => {
    const shouldNavigateToManagement = Boolean(draftModal?.navigateToManagement)
    setDraftModal(null)

    if (shouldNavigateToManagement) {
      actions.setNavigationMode('etl-management')
    }
  }

  const showCopyFailure = (contentLabel) => {
    setErrorModal({
      icon: '⚠️',
      title: 'Copy Failed',
      message: `Clipboard access is blocked in this environment. Please copy the ${contentLabel} manually.`,
    })
  }

  const handleCopyYaml = async () => {
    try {
      await copyTextToClipboard(yaml)
      setCopying(true)
      setTimeout(() => setCopying(false), 1500)
    } catch {
      showCopyFailure('YAML preview')
    }
  }

  const handleCopyGrafanaLink = async (grafanaLink) => {
    try {
      await copyTextToClipboard(grafanaLink)
      setCopiedDash(true)
      setTimeout(() => setCopiedDash(false), 2000)
    } catch {
      showCopyFailure('Grafana dashboard link')
    }
  }

  const acknowledgeNoChanges = () => {
    setNoChangesModalOpen(false)
    actions.setNavigationMode('etl-management')
  }

  // Deployment progress modal hook
  const deployment = useDeploymentProgress({
    autoAdvance: false,   // driven by real SSE events from the backend
    stepDuration: 2000,
    onDeploymentComplete: () => {
      setDeployDisabled(false)
      setTimeout(() => {
        setSubmitted(true)
        deployment.reset()
      }, 500)
    },
    onDeploymentError: (stepIndex, error) => {
      setDeployDisabled(false)
      setErrorModal({
        icon: '❌',
        title: 'Deployment Failed',
        message: error,
      })
      deployment.reset()
    },
  })

  // Holds the SSE cleanup function — closed when the modal closes or component unmounts
  const sseCleanupRef = useRef(null)

  useEffect(() => {
    if (!deployment.isOpen && sseCleanupRef.current) {
      sseCleanupRef.current()
      sseCleanupRef.current = null
    }
  }, [deployment.isOpen])

  useEffect(() => {
    if (!draftModal?.navigateToManagement) {
      return undefined
    }

    const timeoutId = setTimeout(() => {
      closeDraftModal()
    }, 1800)

    return () => clearTimeout(timeoutId)
  }, [draftModal])

  useEffect(() => () => { sseCleanupRef.current?.() }, [])

  const requiredTargetFieldIds = targetSchema.filter(field => field.required).map(field => field.id)
  const unmappedRequired = requiredTargetFieldIds.filter(f => !state.mappings.some(m => m.tgt === f))

  const getMappingSources = (mapping) => [
    mapping.src,
    ...(Array.isArray(mapping.extraInputs) ? mapping.extraInputs.map(input => input?.field).filter(Boolean) : []),
  ].filter(Boolean)

  // Helper function to get transformer name and build readable description
  const getTransformerDescription = (transformerId, props = {}) => {
    if (!transformerId || transformerId === 'none') return null
    const tf = transformers.find(t => t._id === transformerId || t.name === transformerId)
    const transformerName = tf?.name || String(transformerId)

    const requiredKeys = new Set(
      Array.isArray(tf?.propsSchema)
        ? tf.propsSchema.filter(p => p?.required && p?.key).map(p => p.key)
        : []
    )

    const schemaDefaults = new Map(
      Array.isArray(tf?.propsSchema)
        ? tf.propsSchema.filter(p => p?.key).map(p => [p.key, p.default ?? ''])
        : []
    )

    const allKeys = new Set([...requiredKeys, ...Object.keys(props || {})])
    const propsStr = Array.from(allKeys)
      .map((key) => {
        const rawValue = (props && Object.prototype.hasOwnProperty.call(props, key))
          ? props[key]
          : schemaDefaults.get(key)
        const value = rawValue === undefined || rawValue === null ? '' : rawValue
        return [key, value]
      })
      .filter(([key, value]) => requiredKeys.has(key) || (value !== '' && value !== undefined && value !== null))
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')
    
    return propsStr ? `${transformerName}[${propsStr}]` : transformerName
  }

  const getTransformerChainDescriptions = (mapping) => {
    if (Array.isArray(mapping?.transformerChainDetailed) && mapping.transformerChainDetailed.length > 0) {
      return mapping.transformerChainDetailed
        .map(item => getTransformerDescription(item?.id || item?.transformer || item?._id, item?.props || item?.transformerProps || {}))
        .filter(Boolean)
    }

    if (Array.isArray(mapping?.transformerChain) && mapping.transformerChain.length > 0) {
      return mapping.transformerChain
        .map((item, index) => {
          if (typeof item === 'string') {
            return getTransformerDescription(item, index === 0 ? (mapping?.transformerProps || {}) : {})
          }
          return getTransformerDescription(
            item?.id || item?.transformer || item?._id,
            item?.props || item?.transformerProps || (index === 0 ? (mapping?.transformerProps || {}) : {})
          )
        })
        .filter(Boolean)
    }

    const single = getTransformerDescription(mapping?.transformer, mapping?.transformerProps || {})
    return single ? [single] : []
  }

  // Generate YAML with improved transformer descriptions
  const generateYaml = () => {
    // Find source and target field types
    const nestedInputMappingYaml = formatInputFieldsYamlSection(sourceSchema, '    ')
    const columnDelimiter = state.source.csvDelimiter == null
      ? ''
      : String(state.source.csvDelimiter)
    const rowDelimiter = state.source.rowDelimiter == null ? '' : String(state.source.rowDelimiter)
    const sourceSectionYaml = (() => {
      const sourceType = String(state.source.sourceType || '').trim().toLowerCase()

      if (!sourceType) {
        return '  {}'
      }

      const details = []

      if (sourceType === 'kafka') {
        details.push(`    topic: ${state.source.kafkaTopic || 'N/A'}`)
        if (state.source.kafkaOffset) details.push(`    offset: ${state.source.kafkaOffset}`)
        if (state.source.kafkaKeys) details.push(`    filter: ${quoteYamlDoubleQuoted(String(state.source.kafkaKeys).trim())}`)
      }

      if (sourceType === 'rabbitmq') {
        details.push(`    ip: ${String(state.source.rmqIp || '').trim()}`)
        details.push(`    port: ${String(state.source.rmqPort || '').trim()}`)
        details.push(`    username: ${String(state.source.rmqUsername || '').trim()}`)
        details.push(`    password: ${String(state.source.rmqPassword || '').trim()}`)
        details.push(`    queue: ${String(state.source.rmqQueue || '').trim()}`)
        details.push(`    vhost: ${String(state.source.rmqVhost || '').trim()}`)
      }

      return [`  ${sourceType}:`, ...details].join('\n')
    })()
    const inputSectionYaml = state.source.format === 'CSV'
      ? `input:
  delimited:
    columnDelimiter: ${quoteYamlDoubleQuoted(columnDelimiter)}${nestedInputMappingYaml ? `
${nestedInputMappingYaml}` : ''}
`
      : `input:
  convert:${state.source.jsonSplit ? `
    splitByPath: ${quoteYamlDoubleQuoted(String(state.source.jsonSplit).trim())}` : ''}${nestedInputMappingYaml ? `
${nestedInputMappingYaml}` : ''}
`

    const getFieldType = (fieldName, isTarget = false) => {
      const schema = isTarget ? targetSchema : sourceSchema
      const field = schema.find(f => f.name === fieldName || f.id === fieldName || f.path === fieldName)
      return field?.type || 'unknown'
    }

    const getHopInputsDescription = (sourceFields, hopIndex) => {
      if (!Array.isArray(sourceFields) || sourceFields.length === 0) return ''

      // First transformer: use source field names directly.
      if (hopIndex === 0) {
        return `[${sourceFields.join(',')}]`
      }

      // Chained transformers: reference prior hop output with unique tokens per source field:
      // $<sourceFieldName><hopIndex>, e.g. $stockQty1, $stockQty2
      return `[${sourceFields
        .map((src) => {
          const safeSourceName = String(src || 'input').replace(/[^a-zA-Z0-9_]/g, '_')
          return `$${safeSourceName}${hopIndex}`
        })
        .join(',')}]`
    }

    // Get transformations with field details
    const transformations = state.mappings
      .filter(m => m.transformer && m.transformer !== 'none')
      .map(m => {
        const transformerChain = getTransformerChainDescriptions(m)
        const sourceFields = getMappingSources(m)
        const chainWithInputs = transformerChain
          .map((desc, hopIndex) => {
            const fieldsList = getHopInputsDescription(sourceFields, hopIndex)
            // Split desc into transformer name and props bracket (e.g. "Name[props]" or "Name")
            const bracketStart = desc.indexOf('[')
            const transformerName = bracketStart !== -1 ? desc.slice(0, bracketStart) : desc
            const propsStr = bracketStart !== -1 ? desc.slice(bracketStart) : '' // e.g. "[logic: a:b?1]"
            const argParts = []
            if (fieldsList) {
              argParts.push(fieldsList)
            } else if (propsStr) {
              argParts.push('[]') // keep field slot empty when there are no fields but props exist
            }
            if (propsStr) argParts.push(propsStr)
            const transformerCall = argParts.length > 0
              ? `${transformerName}(${argParts.join(',')})`
              : transformerName
            // For a multi-transformer chain each hop uses the same -> (type, outField) structure
            // as a single transformer. Intermediate hops emit a named token consumed by the next hop;
            // the last hop emits the actual target field. Hops are joined by -->.
            if (transformerChain.length > 1) {
              const isLast = hopIndex === transformerChain.length - 1
              if (isLast) {
                const tgtType = getFieldType(m.tgt, true)
                return `${transformerCall} -> (${tgtType}, ${m.tgt})`
              } else {
                const primarySrc = sourceFields[0] || 'input'
                const safeSrcName = String(primarySrc).replace(/[^a-zA-Z0-9_]/g, '_')
                const outToken = `$${safeSrcName}${hopIndex + 1}`
                const srcType = getFieldType(primarySrc, false)
                return `${transformerCall} -> (${srcType}, ${outToken})`
              }
            }
            return transformerCall
          })
          .join(' --> ')
        const tgtType = getFieldType(m.tgt, true)
        // Single transformer: append the output suffix here.
        // Multiple transformers: each hop already contains its own -> (type, outField) suffix.
        const expression = transformerChain.length > 1
          ? chainWithInputs
          : `${chainWithInputs} -> (${tgtType}, ${m.tgt})`
        return formatTransformationYamlItem(expression)
      })

    const filtersYaml = formatFiltersYamlSection(state.filters)
    const sinkAdditionalConfigYaml = state.sink.sinkType === 'kafka'
      ? formatKeyValueYamlSection('additionalConfig', state.sink.sinkKafkaAdditionalProperties, '')
      : ''
    const outputSinkYaml = (() => {
      const sinkType = String(state.sink.sinkType || '').trim().toLowerCase()

      if (sinkType === 'rabbitmq') {
        return [
          '  rabbitmq:',
          `    vhost: ${String(state.sink.sinkRmqVhost || '').trim()}`,
          `    port: ${String(state.sink.sinkRmqPort || '').trim()}`,
          `    queue: ${String(state.sink.sinkRmqQueue || '').trim()}`,
          ...(String(state.sink.sinkRmqExchange || '').trim()
            ? [`    exchange: ${String(state.sink.sinkRmqExchange || '').trim()}`]
            : []),
        ].join('\n')
      }

      if (sinkType === 'kafka') {
        return [
          '  kafka:',
          `    topic: ${String(state.sink.sinkKafkaTopic || '').trim()}`,
          ...(state.sink.shadow ? [`    ${SHADOW_TOPIC_YAML_KEY}: ${String(state.sink.shadowTopic || '').trim()}`] : []),
        ].join('\n')
      }

      return ''
    })()
    const outputSaknayYaml = (() => {
      const productCode = String(state.metadata.productCode || '').trim()
      const saknayTopic = String(state.sink.saknayTopic || '').trim()
      const saknaySectionKey = SAKNAY_YAML_SECTION_KEY || 'saknay'

      if (!productCode && !hasSaknayTargets) {
        return ''
      }

      return [
        `  ${saknaySectionKey}:`,
        ...(productCode ? [`    ${PRODUCT_CODE_YAML_KEY}: ${quoteYamlDoubleQuoted(productCode)}`] : []),
        ...(hasSaknayTargets || saknayTopic ? [`    ${SAKNAY_TOPIC_YAML_KEY}: ${saknayTopic}`] : []),
      ].join('\n')
    })()
    const metadataLocation = normalizeMetadataLocation(state.metadata.location, state.metadata.environment)

    const generalFormat = state.source.format === 'CSV' ? 'delimited' : state.source.format

    return `metadata:
  genomeEntity: ${state.metadata.entityName}
${metadataLocation ? `  location: ${quoteYamlDoubleQuoted(String(metadataLocation).trim())}
` : ''}  productSource: ${state.metadata.productSource}
  productType: ${state.metadata.productType}
  environment: ${state.metadata.environment}
  owner: ${state.metadata.team}
  dataStreamInfo:
    streamingContinuity: ${state.source.streamingContinuity || 'continuous'}
    avgRecordsAmount: ${state.source.recordsPerDay || 'millions'}

general:
  inputFormat: ${generalFormat}
  outputFormat: ${generalFormat}
${state.source.format === 'CSV' && rowDelimiter ? `  split:
    delimiter: ${quoteYamlDoubleQuoted(rowDelimiter)}
` : ''}  ${SHADOW_YAML_FLAG_KEY}: ${state.sink.shadow ? 'true' : 'false'}
  ${SAKNAY_YAML_FLAG_KEY}: ${hasSaknayTargets ? 'true' : 'false'}
  ${ASG_YAML_FLAG_KEY}: ${state.sink.asg ? 'true' : 'false'}

source:
${sourceSectionYaml}
${inputSectionYaml}${state.upload.schemaName ? `schema:
  inputSchema: ${quoteYamlDoubleQuoted(String(state.upload.schemaName).trim())}

` : ''}

output:
  mapping:
${state.mappings.map(m => {
  let mapping = m.src
    ? `    - inName: ${m.src}\n      outName: ${m.tgt}`
    : `    - outName: ${m.tgt}`
  mapping += `\n      sendToGP: true`
  mapping += `\n      ${TARGET_SAKNAY_YAML_KEY}: ${m.tgtMetadata?.sendToSaknay ?? true}`
  const additionalInputs = Array.isArray(m.extraInputs) ? m.extraInputs.map(input => input?.field).filter(Boolean) : []
  if (additionalInputs.length > 0) {
    mapping += `\n      additionalInputs:\n${additionalInputs.map(input => `        - ${input}`).join('\n')}`
  }
  if (m.srcMetadata?.expression) {
    mapping += `\n      src_expression: ${quoteYamlDoubleQuoted(String(m.srcMetadata.expression).trim())}`
  }
  if (m.tgtMetadata?.expression) {
    mapping += `\n      expression: ${quoteYamlDoubleQuoted(String(m.tgtMetadata.expression).trim())}`
  }
  return mapping
}).join('\n')}
${outputSinkYaml ? `
${outputSinkYaml}` : ''}
${outputSaknayYaml ? `
${outputSaknayYaml}` : ''}
${transformations.length > 0 ? `
transformations:
${transformations.join('\n')}` : ''}
${filtersYaml ? `
${filtersYaml}` : ''}
${sinkAdditionalConfigYaml ? `
${sinkAdditionalConfigYaml}` : ''}
`
  }

  const yaml = compactYamlDocument(generateYaml())
  const currentPipelineSignature = buildPipelineChangeSignature(state)
  const originalPipelineSignature = state.originalDraftSignature || (
    state.originalDraftYaml
      ? buildPipelineChangeSignature(
          hydrateWizardStateFromYaml(state.originalDraftYaml, {
            productType: state.metadata.productType,
            source: state.metadata.productSource,
            teamName: state.metadata.team,
            environment: state.metadata.environment,
          })
        )
      : ''
  )
  const originalDraftYaml = compactYamlDocument(state.originalDraftYaml || '')
  const hasChangesComparedToOriginalDraft = !state.originalDraftYaml
    || !originalPipelineSignature
    || originalPipelineSignature !== currentPipelineSignature
    || originalDraftYaml !== yaml

  const validations = getSummaryValidations(state, targetSchema, transformers)
  const canDeployFromChecklist = canDeployFromSummaryChecklist(state, targetSchema, transformers)

  const handleCreatePipeline = async () => {
    // Validate required fields
    if (unmappedRequired.length > 0) {
      setErrorModal({
        icon: '❌',
        title: 'Missing Required Fields',
        message: `Not all required fields have been mapped.\n\nMissing: ${unmappedRequired.join(', ')}\n\nPlease go back to Field Mapping and map all required fields marked with *.`,
        showNavigate: true,
      })
      return
    }
    
    // Validate critical config
    const sourceType = String(state.source.sourceType || '').trim().toLowerCase()
    const isKafkaSourceIncomplete = sourceType === 'kafka'
      && (!state.source.kafkaTopic || !state.source.kafkaOffset)
    const isRabbitMqSourceIncomplete = sourceType === 'rabbitmq'
      && (!state.source.rmqIp || !state.source.rmqPort || !state.source.rmqUsername || !state.source.rmqPassword || !state.source.rmqQueue)

    if (!sourceType || isKafkaSourceIncomplete || isRabbitMqSourceIncomplete) {
      setErrorModal({
        icon: '⚠️',
        title: 'Source Configuration Incomplete',
        message: sourceType === 'kafka'
          ? 'Please configure your Kafka source settings (type, topic, and offset) and try again.'
          : sourceType === 'rabbitmq'
            ? 'Please configure your RabbitMQ source settings (IP, port, username, password, and queue) and try again.'
          : 'Please configure your source settings (type and topic) and try again.',
      })
      return
    }
    
    if (!state.sink.sinkType) {
      setErrorModal({
        icon: '⚠️',
        title: 'Sink Configuration Incomplete',
        message: 'Please configure your sink settings and try again.',
      })
      return
    }
    
    if (state.mappings.length === 0) {
      setErrorModal({
        icon: '⚠️',
        title: 'No Field Mappings',
        message: 'Please define at least one field mapping and try again.',
        showNavigate: true,
      })
      return
    }

    if (!hasChangesComparedToOriginalDraft) {
      setNoChangesModalOpen(true)
      return
    }
    
    // All validations passed — deploy via real backend
    setDeployDisabled(true)

    console.log('[SummaryStep] handleCreatePipeline — start')

    // 1. Fetch ordered step list from backend (falls back to built-in list)
    const steps = await fetchDeploymentSteps(false)
    console.log('[SummaryStep] steps:', steps.length, steps.map(s => s.id))

    // 2. Open the progress modal immediately
    deployment.startDeployment(steps)

    // 3. POST the generated YAML to the backend to create + start the deployment
    console.log('[SummaryStep] posting YAML to backend...')
    const result = await deployFromYaml({
      productType: state.metadata.productType,
      source: state.metadata.productSource,
      team: state.metadata.team,
      environment: state.metadata.environment,
      isDeploy: true,
      configurationYaml: yaml,
    })
    console.log('[SummaryStep] deployFromYaml result:', JSON.stringify(result))

    if (!result || result.success === false) {
      const msg = result?.error || 'Unable to start deployment.'
      console.warn('[SummaryStep] deploy failed:', msg)
        setDeploymentStatus({
          teamName: state.metadata.team,
          productSource: state.metadata.productSource,
          productType: state.metadata.productType,
          environment: state.metadata.environment,
          deploymentStatus: 'failed',
        })
      deployment.updateStep(0, { status: 'failed', error: msg })
      deployment.setIsError(true)
      deployment.setErrorMessage(msg)
      setDeployDisabled(false)
      return
    }

    // 4. Open SSE stream keyed by the run ID returned by the backend
    // The backend may use any of these field names for the deployment run ID.
    const deploymentId =
      result?.deploymentId ??
      result?.id           ??
      result?.runId        ??
      result?.run_id       ??
      result?.jobId        ??
      result?.job_id
    console.log('[SummaryStep] deployFromYaml full result:', JSON.stringify(result))
    console.log('[SummaryStep] opening SSE stream for deploymentId:', deploymentId)

    if (!deploymentId) {
      console.error('[SummaryStep] backend did not return a deploymentId — cannot track progress. Full result:', result)
        setDeploymentStatus({
          teamName: state.metadata.team,
          productSource: state.metadata.productSource,
          productType: state.metadata.productType,
          environment: state.metadata.environment,
          deploymentStatus: 'failed',
        })
      deployment.updateStep(0, { status: 'failed', error: 'Server did not return a deployment ID.' })
      deployment.setIsError(true)
      deployment.setErrorMessage('Server did not return a deployment ID. Check the backend response.')
      setDeployDisabled(false)
      return
    }

    // ── Shared failure handler ────────────────────────────────────────────
    const handleFailure = (stepIndex, error) => {
      const msg = error || 'Deployment step failed.'
      const idx = typeof stepIndex === 'number' ? stepIndex : 0
      console.warn('[SummaryStep] failure at step', idx, ':', msg)
        setDeploymentStatus({
          teamName: state.metadata.team,
          productSource: state.metadata.productSource,
          productType: state.metadata.productType,
          environment: state.metadata.environment,
          deploymentStatus: 'failed',
        })
      deployment.updateStep(idx, { status: 'failed', error: msg })
      deployment.setIsError(true)
      deployment.setErrorMessage(msg)
      setDeployDisabled(false)
      setErrorModal({ icon: '❌', title: 'Deployment Failed', message: msg })
      deployment.reset()
    }

    // ── SSE progress callbacks ────────────────────────────────────────────
    sseCleanupRef.current = subscribeToDeploymentProgress(deploymentId, {
      onStepStart: ({ stepIndex, label } = {}) => {
        console.log('[SummaryStep] → step-start', stepIndex, label)
        if (typeof stepIndex !== 'number') {
          console.warn('[SummaryStep] step-start missing stepIndex:', { stepIndex, label })
          return
        }
        deployment.setCurrentStepIndex(stepIndex)
        // If the backend provides a label in the SSE event, use it so the modal
        // shows the real backend step name instead of the fallback/cached label.
        deployment.updateStep(stepIndex, {
          status: 'active',
          ...(label ? { label } : {}),
        })
      },
      onStepComplete: ({ stepIndex, label } = {}) => {
        console.log('[SummaryStep] → step-complete', stepIndex)
        if (typeof stepIndex !== 'number') {
          console.warn('[SummaryStep] step-complete missing stepIndex:', { stepIndex })
          return
        }
        deployment.updateStep(stepIndex, {
          status: 'done',
          ...(label ? { label } : {}),
        })
        if (stepIndex < steps.length - 1) {
          deployment.setCurrentStepIndex(stepIndex + 1)
          deployment.updateStep(stepIndex + 1, { status: 'active' })
        }
      },
      onStepFailed: ({ stepIndex, error } = {}) => handleFailure(stepIndex, error),
      onComplete: () => {
        console.log('[SummaryStep] → deployment-complete')
          setDeploymentStatus({
            teamName: state.metadata.team,
            productSource: state.metadata.productSource,
            productType: state.metadata.productType,
            environment: state.metadata.environment,
            deploymentStatus: 'running',
          })
        deployment.updateStep(steps.length - 1, { status: 'done' })
        deployment.setIsComplete(true)
        // setIsComplete doesn't trigger onDeploymentComplete — call it directly
        setDeployDisabled(false)
        setTimeout(() => {
          setSubmitted(true)
          deployment.reset()
        }, 500)
      },
      onConnectionError: (msg) => {
        console.warn('[SummaryStep] → SSE connection error:', msg)
        handleFailure(undefined, msg)
      },
    })
    console.log('[SummaryStep] SSE stream opened')
  }

  const handleSaveDraft = async () => {
    try {
      setSavingDraft(true)
      await saveDraftConfiguration({
        productType: state.metadata.productType,
        source: state.metadata.productSource,
        team: state.metadata.team,
        environment: state.metadata.environment,
        yaml,
      })
      setDraftModal({
        title: 'Draft Saved',
        icon: '💾',
        accent: 'var(--success)',
        message: 'The YAML draft was saved successfully.',
        navigateToManagement: true,
      })
    } catch (error) {
      setDraftModal({
        title: 'Save Draft Failed',
        icon: '⚠️',
        accent: 'var(--danger)',
        message: error?.message || 'Failed to save the YAML draft.',
        navigateToManagement: false,
      })
    } finally {
      setSavingDraft(false)
    }
  }

  useEffect(() => {
    if (!summaryFooter?.setSummaryFooterActions) {
      return undefined
    }

    if (state.readOnly || submitted) {
      summaryFooter.setSummaryFooterActions(null)
      return () => summaryFooter.setSummaryFooterActions(null)
    }

    summaryFooter.setSummaryFooterActions({
      saveDraftLabel: savingDraft ? 'Saving…' : '💾 Save Draft',
      deployLabel: deployDisabled ? '🚀 Saving & Deploying...' : '🚀 Save & Deploy',
      saveDraftDisabled: savingDraft || deployDisabled,
      deployDisabled: deployDisabled || !canDeployFromChecklist,
      onSaveDraft: handleSaveDraft,
      onDeploy: handleCreatePipeline,
    })

    return () => summaryFooter.setSummaryFooterActions(null)
  }, [
    summaryFooter,
    state.readOnly,
    submitted,
    savingDraft,
    deployDisabled,
    canDeployFromChecklist,
    handleCreatePipeline,
    handleSaveDraft,
  ])

  if (submitted) {
    const pipelineId = `ETL-${Date.now().toString(36).toUpperCase()}`
    const grafanaLink = `https://grafana.etl-studio.io/d/pipeline-${pipelineId.toLowerCase()}?source=${state.metadata.productSource}&type=${state.metadata.productType}&refresh=30s`

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
        {/* Header - Logo and Title */}
        <div style={{ padding: '30px 20px 10px', textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 64, marginBottom: 10 }}>🎉</div>
          <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8, background: 'linear-gradient(135deg,#4f6ef7,#7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Pipeline Created!
          </h2>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 40px' }}>
          {/* Subtitle - centered in middle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120, marginBottom: 20 }}>
            <p style={{ color: 'var(--muted)', maxWidth: 440, textAlign: 'center' }}>
              Your ETL pipeline has been registered and is ready for deployment.
            </p>
          </div>

          {/* Main Info Card */}
          <Card style={{ width: '100%', maxWidth: 460, textAlign: 'left', marginBottom: 20 }} p="18px 22px">
            {[
              ['Pipeline ID', pipelineId],
              ['Entity',      state.metadata.entityName],
              ['Mappings',    state.mappings.length],
              ['Environment', formatEnvironmentLabel(state.metadata.environment, state.metadata.environment)],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>{k}</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{v}</span>
              </div>
            ))}
          </Card>

          {/* Dashboard Card */}
          <Card style={{ width: '100%', maxWidth: 460, textAlign: 'left', marginBottom: 20 }} p="18px 22px">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--accent)' }}>📊 Grafana Dashboard</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Dashboard Link</div>
                <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text)', wordBreak: 'break-all', background: 'var(--surf2)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  {grafanaLink}
                </div>
              </div>
              <button
                    onClick={() => handleCopyGrafanaLink(grafanaLink)}
                style={{
                  padding: '8px 12px',
                  background: copiedDash ? 'var(--success)' : 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => !copiedDash && (e.target.style.opacity = '0.9')}
                onMouseLeave={(e) => !copiedDash && (e.target.style.opacity = '1')}
              >
                {copiedDash ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
            <a href={grafanaLink} target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-block',
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid var(--accent)',
              color: 'var(--accent)',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
              onMouseEnter={(e) => { e.target.style.background = 'var(--accent)'; e.target.style.color = 'white' }}
              onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--accent)' }}
            >
              🔗 Open in Grafana
            </a>
          </Card>

          <div style={{ display: 'flex', gap: 12 }}>
            <Btn v="primary" onClick={() => actions.setNavigationMode('etl-management')}>View in Management</Btn>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 30px' }}>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 20 }}>
          {[
            { icon: '🏷️', label: 'Entity',   value: `${state.metadata.entityName} ${state.metadata.schemaVersion}` },
            { icon: '🔌', label: 'Source',   value: srcMeta?.name || '—' },
            { icon: '↔',  label: 'Mappings', value: state.mappings.length },
            { icon: '⚙',  label: 'Filters',  value: state.filters.reduce((a, g) => a + g.rules.length, 0) },
            { icon: '🔀', label: 'Sink',     value: (state.sink.sinkType || '—').toUpperCase() },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--surf)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '14px 18px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Flink flow */}
        <Card>
          <CardTitle>⚡ Flink Pipeline Flow</CardTitle>
          <FlinkFlow sourceType={state.source.sourceType} mappings={state.mappings} filters={state.filters} sink={state.sink} />
        </Card>

        <div style={{ marginBottom: 20 }}>
          {/* Validation - Full Width */}
          <Card>
            <CardTitle>✅ Validation Checklist</CardTitle>
            {validations.map((v, i) => (
              <ValidationItem key={i} type={v.type}>{v.text}</ValidationItem>
            ))}
          </Card>
        </div>

        {/* YAML Preview */}
        <Card>
          <CardTitle>
            📄 YAML Preview
            <Btn sm v="ghost" onClick={handleCopyYaml}
              style={{ marginLeft: 'auto' }}>
              {copying ? '✓ Copied' : '📋 Copy YAML'}
            </Btn>
          </CardTitle>
          <YamlPreview yaml={yaml} theme={state.theme || 'dark'} />
        </Card>
      </div>

      {/* Sticky footer buttons — fallback when the shared wizard footer host is unavailable */}
      {!state.readOnly && !summaryFooter?.setSummaryFooterActions && (
        <div style={{
          borderTop: '1px solid var(--border)',
          background: 'var(--surf)',
          padding: '16px 30px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 12,
          flexShrink: 0,
        }}>
          <Btn v="secondary" onClick={handleSaveDraft} disabled={savingDraft || deployDisabled}>{savingDraft ? 'Saving…' : '💾 Save Draft'}</Btn>
          <Btn v="success" onClick={handleCreatePipeline} disabled={deployDisabled || !canDeployFromChecklist}>{deployDisabled ? '🚀 Saving & Deploying...' : '🚀 Save & Deploy'}</Btn>
        </div>
      )}

      {draftModal && (
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
            onClick={closeDraftModal}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'var(--surf)',
              border: '1px solid var(--border)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              zIndex: 1000,
              minWidth: '360px',
              maxWidth: '500px',
              overflow: 'hidden',
            }}
          >
            <div style={{
              background: draftModal.accent,
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <div style={{ fontSize: '30px' }}>{draftModal.icon}</div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' }}>{draftModal.title}</h3>
              </div>
            </div>
            <div style={{
              padding: '20px',
              color: 'var(--text)',
              fontSize: '14px',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
            }}>
              {draftModal.message}
            </div>
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'var(--bg)',
            }}>
              <Btn v="primary" onClick={closeDraftModal}>Close</Btn>
            </div>
          </div>
        </>
      )}

      {noChangesModalOpen && (
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
              overflow: 'hidden',
            }}
          >
            <div style={{
              background: 'var(--danger)',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <div style={{ fontSize: '32px' }}>⚠️</div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' }}>No Changes Detected</h3>
              </div>
            </div>
            <div style={{
              padding: '20px',
              color: 'var(--text)',
              fontSize: '14px',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
            }}>
              No changes were detected compared to the existing pipeline YAML. The system will not deploy anything.
            </div>
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'var(--bg)',
            }}>
              <Btn v="primary" onClick={acknowledgeNoChanges}>OK</Btn>
            </div>
          </div>
        </>
      )}

      {/* Error Modal */}
      {errorModal && (
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
            onClick={() => setErrorModal(null)}
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
              background: 'var(--danger)',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <div style={{ fontSize: '32px' }}>{errorModal.icon}</div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' }}>{errorModal.title}</h3>
              </div>
            </div>

            {/* Body */}
            <div style={{
              padding: '20px',
              color: 'var(--text)',
              fontSize: '14px',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
            }}>
              {errorModal.message}
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--bg)',
              gap: '12px',
            }}>
              <div />
              <div style={{ display: 'flex', gap: '8px' }}>
                {errorModal.showNavigate && (
                  <Btn 
                    v="primary" 
                    onClick={() => {
                      setErrorModal(null)
                      actions.goTo(4, state)
                    }}
                    style={{ fontWeight: 600 }}
                  >
                    ↔ Go to Field Mapping
                  </Btn>
                )}
                <Btn 
                  v="ghost" 
                  onClick={() => setErrorModal(null)}
                  style={{ fontWeight: 600 }}
                >
                  Got it, I'll fix it
                </Btn>
              </div>
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


      {/* Deployment Progress Modal */}
      <DeployProgressModal
        isOpen={deployment.isOpen}
        steps={deployment.steps}
        currentStepIndex={deployment.currentStepIndex}
        isComplete={deployment.isComplete}
        isError={deployment.isError}
        errorMessage={deployment.errorMessage}
        onClose={() => {
          deployment.reset()
          setDeployDisabled(false)
        }}
        title="Deploying your ETL pipeline..."
        successTitle="Pipeline deployed successfully!"
        failureTitle="Deployment failed"
      />
    </div>
  )
}
