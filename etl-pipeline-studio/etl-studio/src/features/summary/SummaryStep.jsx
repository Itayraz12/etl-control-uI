import { useState } from 'react'
import { useWizard } from "../../shared/store/wizardStore";
import { useConfig } from "../../shared/store/configContext.jsx";
import { Card, CardTitle, ValidationItem, Btn, DeployProgressModal } from '../../shared/components/index.jsx'
import { useDeploymentProgress } from '../../shared/hooks/useDeploymentProgress.js'
import { SOURCE_TYPES, resolveSourceSchema, resolveTargetSchema } from '../../shared/types/index.js'
import { MOCK_FILTER_OPERATORS, saveDraftConfiguration } from '../../shared/services/configService.js'
import { formatTransformationYamlItem, quoteYamlDoubleQuoted } from '../../shared/services/configurationYaml.js'
import { formatInputFieldsYamlSection } from '../../shared/services/configurationYaml.js'
import { formatFilterYamlItem } from '../../shared/services/configurationYaml.js'

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

function YamlPreview({ yaml }) {
  return (
    <pre style={{
      fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.75,
      color: '#a3b4cd', background: '#0d1117', borderRadius: 8,
      padding: '14px 18px', overflowX: 'auto', margin: 0,
    }}>
      {yaml.split('\n').map((line, i) => {
        const isComment   = line.startsWith('#')
        const isKey       = /^[a-z_]+:/.test(line.trim()) && !line.startsWith('  ')
        const isSubKey    = /^\s+[a-z_]+:/.test(line) && !line.includes('  - ')
        const isValue     = line.includes(': ') && !isKey
        return (
          <span key={i} style={{
            color: isComment ? '#586e75' : isKey ? '#d0e0ff' : isSubKey ? '#a3b4cd' : isValue ? '#7dd3fc' : '#a3b4cd',
            display: 'block',
            fontWeight: isKey ? 600 : 400,
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
  const sourceSchema = resolveSourceSchema(state.upload)
  const targetSchema = resolveTargetSchema(state.targetSchema)
  const [submitted, setSubmitted] = useState(false)
  const [copying, setCopying] = useState(false)
  const [copiedDash, setCopiedDash] = useState(false)
  const [errorModal, setErrorModal] = useState(null)
  const [savingDraft, setSavingDraft] = useState(false)
  const [draftModal, setDraftModal] = useState(null)
  const [deployDisabled, setDeployDisabled] = useState(false)

  // Deployment progress modal hook
  const deployment = useDeploymentProgress({
    autoAdvance: true,
    stepDuration: 2000,
    onDeploymentComplete: () => {
      setDeployDisabled(false)
      // Show the success screen after deployment completes
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

  const srcMeta = SOURCE_TYPES.find(t => t.id === state.source.sourceType)
  const requiredTargetFieldIds = targetSchema.filter(field => field.required).map(field => field.id)
  const reqMapped = state.mappings.filter(m => requiredTargetFieldIds.includes(m.tgt)).length
  const unmappedRequired = requiredTargetFieldIds.filter(f => !state.mappings.some(m => m.tgt === f))

  const getMappingSources = (mapping) => [
    mapping.src,
    ...(Array.isArray(mapping.extraInputs) ? mapping.extraInputs.map(input => input?.field).filter(Boolean) : []),
  ].filter(Boolean)

  // Helper function to get transformer name and build readable description
  const getTransformerDescription = (transformerId, props = {}) => {
    if (!transformerId || transformerId === 'none') return null
    const tf = transformers.find(t => t._id === transformerId)
    if (!tf) return transformerId
    
    const propsStr = Object.entries(props)
      .filter(([k, v]) => v !== '' && v !== undefined && v !== null)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')
    
    return propsStr ? `${tf.name}(${propsStr})` : tf.name
  }

  // Generate YAML with improved transformer descriptions
  const generateYaml = () => {
    // Helper to map operator ID to name
    const getOperatorName = (opId) => {
      const op = MOCK_FILTER_OPERATORS.find(o => o.id === opId)
      return op?.name?.toLowerCase().replace(/\s+/g, '_') || opId
    }

    // Helper to format a filter group with parentheses
    const formatFilterGroup = (group, depth = 0) => {
      const conditions = group.rules
        .map(r => `(${r.field} ${getOperatorName(r.op)} ${r.value || 'null'})`)
        .join(` ${group.logic} `)
      
      const subgroupConditions = group.subgroups?.length > 0
        ? group.subgroups.map(sg => `(${formatFilterGroup(sg, depth + 1)})`).join(` ${group.logic} `)
        : ''
      
      if (conditions && subgroupConditions) {
        return `${conditions} ${group.logic} ${subgroupConditions}`
      }
      return conditions || subgroupConditions
    }

    // Find source and target field types
    const sourceFieldsYaml = formatInputFieldsYamlSection(sourceSchema)

    const getFieldType = (fieldName, isTarget = false) => {
      const schema = isTarget ? targetSchema : sourceSchema
      const field = schema.find(f => f.name === fieldName || f.id === fieldName || f.path === fieldName)
      return field?.type || 'unknown'
    }

    // Get transformations with field details
    const transformations = state.mappings
      .filter(m => m.transformer && m.transformer !== 'none')
      .map(m => {
        const tfDesc = getTransformerDescription(m.transformer, m.transformerProps)
        const sourceFields = getMappingSources(m)
        const sourcesDesc = sourceFields
          .map(src => `(${getFieldType(src, false)}, ${src})`)
          .join(', ')
        const tgtType = getFieldType(m.tgt, true)
        const expression = `${tfDesc}${sourcesDesc ? `${sourcesDesc}` : ''} -> (${tgtType}, ${m.tgt})`
        return formatTransformationYamlItem(expression)
      })

    return `# Generated by ETL Pipeline Studio
metadata:
  id: etl-${Math.random().toString(36).slice(2, 9)}
  entity: ${state.metadata.entityName}
  product_source: ${state.metadata.productSource}
  product_type: ${state.metadata.productType}
  environment: ${state.metadata.environment}
  team: ${state.metadata.team}
  data_stream_info:
    streaming_continuity: ${state.source.streamingContinuity || 'continuous'}
    avg_records_amount: ${state.source.recordsPerDay || 'millions'}

source:
  type: ${state.source.sourceType}
  format: ${state.source.format}
  topic: ${state.source.kafkaTopic || 'N/A'}
${state.source.jsonSplit ? `  split_key: ${state.source.jsonSplit}
` : ''}
${sourceFieldsYaml ? `${sourceFieldsYaml}
` : ''}mappings:
${state.mappings.map(m => {
  let mapping = `  - src: ${m.src}\n    tgt: ${m.tgt}`
  const additionalInputs = Array.isArray(m.extraInputs) ? m.extraInputs.map(input => input?.field).filter(Boolean) : []
  if (additionalInputs.length > 0) {
    mapping += `\n    additional_inputs:\n${additionalInputs.map(input => `      - ${input}`).join('\n')}`
  }
  if (m.srcMetadata?.expression) {
    mapping += `\n    src_expression: ${quoteYamlDoubleQuoted(String(m.srcMetadata.expression).trim())}`
  }
  if (m.tgtMetadata?.expression) {
    mapping += `\n    tgt_expression: ${quoteYamlDoubleQuoted(String(m.tgtMetadata.expression).trim())}`
  }
  return mapping
}).join('\n')}
${transformations.length > 0 ? `
transformations:
${transformations.join('\n')}` : ''}
${state.filters.length > 0 ? `
filters:
${state.filters.map(group => formatFilterYamlItem(formatFilterGroup(group))).join('\n')}` : ''}

sink:
  type: ${state.sink.sinkType}
  topic: ${state.sink.sinkKafkaTopic || 'N/A'}
${state.sink.shadow ? `  shadow: true\n  shadow_topic: ${state.sink.shadowTopic || 'auto'}\n` : ''}${state.sink.saknay ? `  saknay: true\n  saknay_topic: ${state.sink.saknayTopic || 'auto'}\n` : ''}${state.sink.asg ? `  asg: true\n` : ''}`
  }

  const yaml = generateYaml()

  const validations = [
    { type: unmappedRequired.length === 0 ? 'ok' : 'err',  text: `Required fields mapped (${reqMapped}/${requiredTargetFieldIds.length || 0})` },
    { type: state.mappings.length > 0 ? 'ok' : 'warn', text: `${state.mappings.length} field mapping(s) defined` },
    { type: state.source.kafkaTopic ? 'ok' : 'warn', text: `Source configured: ${srcMeta?.name || 'unknown'}` },
    { type: state.metadata.productSource ? 'ok' : 'err', text: `Metadata: product source "${state.metadata.productSource}"` },
    { type: state.filters.length > 0 ? 'ok' : 'warn', text: `${state.filters.reduce((a, g) => a + g.rules.length, 0)} filter rule(s) active` },
    { type: state.sink.sinkType ? 'ok' : 'err', text: `Sink configured: ${state.sink.sinkType || 'none'}` },
  ]

  const handleCreatePipeline = () => {
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
    if (!state.source.sourceType || !state.source.kafkaTopic) {
      setErrorModal({
        icon: '⚠️',
        title: 'Source Configuration Incomplete',
        message: 'Please configure your source settings (type and topic) and try again.',
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
    
    // All validations passed - start deployment
    setDeployDisabled(true)
    
    const deploymentSteps = [
      { id: 'validate-config', label: 'Validating pipeline configuration' },
      { id: 'prepare-resources', label: 'Preparing Kafka topics' },
      { id: 'validate-mappings', label: 'Validating field mappings' },
      { id: 'prepare-flink', label: 'Preparing Flink job' },
      { id: 'upload-artifacts', label: 'Uploading pipeline artifacts' },
      { id: 'register-pipeline', label: 'Registering pipeline' },
      { id: 'deploy-job', label: 'Deploying Flink job' },
      { id: 'health-checks', label: 'Running health checks' },
    ]

    deployment.startDeployment(deploymentSteps)
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
      })
    } catch (error) {
      setDraftModal({
        title: 'Save Draft Failed',
        icon: '⚠️',
        accent: 'var(--danger)',
        message: error?.message || 'Failed to save the YAML draft.',
      })
    } finally {
      setSavingDraft(false)
    }
  }

  if (submitted) {
    const pipelineId = `ETL-${Date.now().toString(36).toUpperCase()}`
    const grafanaLink = `https://grafana.etl-studio.io/d/pipeline-${pipelineId.toLowerCase()}?source=${state.metadata.productSource}&type=${state.metadata.productType}&refresh=30s`
    
    const copyGrafanaLink = () => {
      navigator.clipboard.writeText(grafanaLink)
      setCopiedDash(true)
      setTimeout(() => setCopiedDash(false), 2000)
    }

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
              ['Environment', state.metadata.environment],
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
                onClick={copyGrafanaLink}
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
            <Btn v="secondary" onClick={() => actions.setNavigationMode('etl-management')}>View in Management</Btn>
            <Btn v="primary" onClick={() => {
              actions.setNavigationMode('etl-config');
              actions.setStep(0);
              actions.loadState({
                currentStep: 0,
                completedSteps: new Set(),
              });
              actions.updateMetadata({
                team: state.metadata.team,
                productSource: '',
                productType: '',
                environment: '',
                entityName: '',
                tags: '',
              });
              actions.updateSource({});
              actions.setUploadDone(false);
              actions.setMappings([]);
              actions.setFilters([]);
              actions.updateSink({});
              setSubmitted(false);
            }}>Create Another</Btn>
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
            <Btn sm v="ghost" onClick={() => {
              navigator.clipboard.writeText(yaml).then(() => {
                setCopying(true)
                setTimeout(() => setCopying(false), 1500)
              })
            }}
              style={{ marginLeft: 'auto' }}>
              {copying ? '✓ Copied' : '📋 Copy YAML'}
            </Btn>
          </CardTitle>
          <YamlPreview yaml={yaml} />
        </Card>
      </div>

      {/* Sticky footer buttons */}
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
        <Btn v="success" onClick={handleCreatePipeline} disabled={deployDisabled}>{deployDisabled ? '🚀 Deploying...' : '🚀 Deploy'}</Btn>
      </div>

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
            onClick={() => setDraftModal(null)}
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
              <Btn v="primary" onClick={() => setDraftModal(null)}>Close</Btn>
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
