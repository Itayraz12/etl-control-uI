import { useEffect, useState } from 'react'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { Card, CardTitle, FormRow, FormGroup, CfgPanel, Btn, InfoHint, Tooltip } from '../../shared/components/index.jsx'
import { ENVIRONMENTS } from '../../shared/types/index.js'
import { testRabbitMqConnection } from '../../shared/services/rabbitmqService.js'

const SINK_TYPES = [
  { id: 'kafka', icon: '☕', name: 'Kafka',     sub: 'Streaming sink' },
  { id: 'file',  icon: '📂', name: 'File',      sub: 'JSON / CSV / Parquet' },
  { id: 'db',    icon: '🗄️', name: 'Database', sub: 'PostgreSQL · MySQL'    },
  { id: 'rabbitmq',  icon: '🐇', name: 'RabbitMQ',      sub: 'Message queue'        },
]

function createKafkaAdditionalProperty() {
  return {
    id: `sink-kafka-prop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    key: '',
    value: '',
  }
}

function normalizeKafkaAdditionalProperties(entries = []) {
  if (!Array.isArray(entries)) return []

  return entries
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null
      return {
        id: entry.id == null ? `sink-kafka-prop-${index}` : String(entry.id),
        key: entry.key == null ? '' : String(entry.key),
        value: entry.value == null ? '' : String(entry.value),
      }
    })
    .filter(Boolean)
}

function hasSaknayTargetMappings(mappings = []) {
  if (!Array.isArray(mappings)) return false

  return mappings.some(mapping => (
    Boolean(mapping?.tgt) && (mapping?.tgtMetadata?.sendToSaknay ?? true)
  ))
}

function ConnectionTestStatus({ status, message, label }) {
  if (status === 'loading') {
    return <Tooltip content={message || `Testing ${label}...`}><span aria-label={`${label} in progress`} style={{ fontSize: 18 }}>⏳</span></Tooltip>
  }

  if (status === 'success') {
    return <Tooltip content={message || `${label} succeeded.`}><span aria-label={`${label} succeeded`} style={{ fontSize: 18 }}>✅</span></Tooltip>
  }

  if (status === 'error') {
    return <Tooltip content={message || `${label} failed.`}><span aria-label={`${label} failed`} style={{ fontSize: 18 }}>❌</span></Tooltip>
  }

  return null
}

function SinkConfigPanel({ type, sink, u, metadata, hasSaknayTargets, readOnly = false }) {
  const hasCatalogOption = sink?.shadow || hasSaknayTargets
  const kafkaAdditionalProperties = normalizeKafkaAdditionalProperties(sink?.sinkKafkaAdditionalProperties)
  const isApssPropertiesEnabled = sink?.sinkKafkaAdditionalPropertiesEnabled ?? kafkaAdditionalProperties.length > 0
  const [rabbitMqTestState, setRabbitMqTestState] = useState({ status: 'idle', message: '' })

  useEffect(() => {
    if (type !== 'rabbitmq') {
      setRabbitMqTestState({ status: 'idle', message: '' })
      return
    }

    setRabbitMqTestState({ status: 'idle', message: '' })
  }, [type, sink?.sinkRmqVhost, sink?.sinkRmqPort, sink?.sinkRmqQueue, sink?.sinkRmqExchange, metadata?.environment])

  const updateKafkaAdditionalProperties = (nextEntries) => {
    u('sinkKafkaAdditionalProperties', normalizeKafkaAdditionalProperties(nextEntries))
  }

  const handleKafkaAdditionalPropertyChange = (id, field, value) => {
    updateKafkaAdditionalProperties(
      kafkaAdditionalProperties.map(entry => (
        entry.id === id
          ? { ...entry, [field]: value }
          : entry
      ))
    )
  }

  const handleAddKafkaAdditionalProperty = () => {
    updateKafkaAdditionalProperties([
      ...kafkaAdditionalProperties,
      createKafkaAdditionalProperty(),
    ])
  }

  const handleRemoveKafkaAdditionalProperty = (id) => {
    updateKafkaAdditionalProperties(kafkaAdditionalProperties.filter(entry => entry.id !== id))
  }

  const handleRabbitMqConnectionTest = async () => {
    if (readOnly) return

    const vhost = String(sink?.sinkRmqVhost || '').trim()
    const port = String(sink?.sinkRmqPort || '').trim()
    const queue = String(sink?.sinkRmqQueue || '').trim()
    const exchange = String(sink?.sinkRmqExchange || '').trim()
    const environment = String(metadata?.environment || '').trim()

    if (!vhost || !port || !queue) {
      setRabbitMqTestState({
        status: 'error',
        message: 'VHOST, port, and queue name are required to test the RabbitMQ connection.',
      })
      return
    }

    setRabbitMqTestState({ status: 'loading', message: 'Testing RabbitMQ connection...' })

    try {
      const result = await testRabbitMqConnection({ vhost, port, queue, exchange, environment })
      setRabbitMqTestState({ status: 'success', message: result.message })
    } catch (error) {
      setRabbitMqTestState({
        status: 'error',
        message: error?.message || 'RabbitMQ connection test failed.',
      })
    }
  }


  if (type === 'kafka') return (
    <CfgPanel title="☕ Kafka Sink">
      <FormGroup label={
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Output Topic
          <InfoHint text="Overrides the auto-generated topic name" />
        </span>
      } hint={hasCatalogOption ? 'Optional - system will auto-generate if empty' : 'Optional'}>
        <input value={sink.sinkKafkaTopic || ''} onChange={e => u('sinkKafkaTopic', e.target.value)} placeholder={hasCatalogOption ? 'Leave empty for auto-generation' : 'products.output'} />
      </FormGroup>
      <FormGroup label="Bootstrap Environment" required>
        <select value={sink.sinkKafkaEnv || metadata?.environment || ''} onChange={e => u('sinkKafkaEnv', e.target.value)}>
          <option value="">select an environment...</option>
          {ENVIRONMENTS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </FormGroup>

      <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: 'var(--text)' }}>
          <input
            type="checkbox"
            checked={Boolean(isApssPropertiesEnabled)}
            onChange={e => u('sinkKafkaAdditionalPropertiesEnabled', e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          <span>Add APSS properties (optional)</span>
        </label>

        {isApssPropertiesEnabled && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>⚙️ Additional Properties</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Add APSS properties as key / value pairs.</div>
              </div>
              <Btn v="ghost" sm onClick={handleAddKafkaAdditionalProperty}>＋ Add property</Btn>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surf2)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) minmax(180px, 1fr) 84px', gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--border)', background: 'rgba(79,110,247,.06)', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <div>Key</div>
                <div>Value</div>
                <div>Action</div>
              </div>

              {kafkaAdditionalProperties.length === 0 ? (
                <div style={{ padding: '14px 12px', fontSize: 12, color: 'var(--muted)' }}>No additional Kafka properties defined.</div>
              ) : kafkaAdditionalProperties.map((entry) => (
                <div key={entry.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) minmax(180px, 1fr) 84px', gap: 10, padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.03)', alignItems: 'center' }}>
                  <input
                    value={entry.key}
                    onChange={e => handleKafkaAdditionalPropertyChange(entry.id, 'key', e.target.value)}
                    placeholder="acks"
                    aria-label={`Kafka property key ${entry.id}`}
                  />
                  <input
                    value={entry.value}
                    onChange={e => handleKafkaAdditionalPropertyChange(entry.id, 'value', e.target.value)}
                    placeholder="all"
                    aria-label={`Kafka property value ${entry.id}`}
                  />
                  <Btn
                    v="danger"
                    sm
                    onClick={() => handleRemoveKafkaAdditionalProperty(entry.id)}
                    style={{ justifyContent: 'center', paddingInline: 0 }}
                  >
                    Remove
                  </Btn>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {hasSaknayTargets && (
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🦆 SAKNAY</span>
            <InfoHint text="Enabled automatically because at least one target field is marked to send to Saknay in Field Mapping." />
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
            Enabled automatically from Field Mapping target settings.
          </div>
          <FormGroup label="Saknay Topic" hint="Optional - system will auto-generate if empty">
            <input value={sink.saknayTopic || ''} onChange={e => u('saknayTopic', e.target.value)} placeholder="Leave empty for auto-generation" />
          </FormGroup>
        </div>
      )}

      {/* Data Catalog Options */}
      <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text)' }}>🏷️ Data Catalog Options</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={sink.shadow || false}
                  onChange={e => u('shadow', e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span>🌬️ SHADOW</span>
              </label>
              <InfoHint text="Mirrors output data to a shadow topic for audit and validation purposes" />
            </div>
            {sink.shadow && (
              <input
                type="text"
                value={sink.shadowTopic || ''}
                onChange={e => u('shadowTopic', e.target.value)}
                placeholder="Topic name (optional)"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  marginLeft: '26px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text)',
                  fontSize: '12px',
                  boxSizing: 'border-box',
                }}
              />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={sink.asg || false}
                onChange={e => u('asg', e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>📊 ASG</span>
            </label>
            <InfoHint text="Asgard data governance system for compliance and metadata management" />
          </div>
        </div>
      </div>
    </CfgPanel>
  )

  if (type === 'file') return (
    <CfgPanel title="📂 File Sink">
      <FormRow>
        <FormGroup label="Output Path">
          <input value={sink.sinkFilePath || ''} onChange={e => u('sinkFilePath', e.target.value)} placeholder="/output/products/" />
        </FormGroup>
        <FormGroup label="Format">
          <select value={sink.sinkFileFormat || 'JSON'} onChange={e => u('sinkFileFormat', e.target.value)}>
            <option>JSON</option><option>CSV</option><option>Parquet</option>
          </select>
        </FormGroup>
      </FormRow>
    </CfgPanel>
  )

  if (type === 'db') return (
    <CfgPanel title="🗄️ Database Sink">
      <FormGroup label="Connection String">
        <input value={sink.sinkDbConn || ''} onChange={e => u('sinkDbConn', e.target.value)} placeholder="jdbc:postgresql://db:5432/warehouse" />
      </FormGroup>
      <FormGroup label="Target Table">
        <input value={sink.sinkDbTable || ''} onChange={e => u('sinkDbTable', e.target.value)} placeholder="public.products_v2" />
      </FormGroup>
    </CfgPanel>
  )

  if (type === 'rabbitmq') return (
    <CfgPanel title="🐇 RabbitMQ Sink">
      <FormRow>
        <FormGroup label="VHOST" required>
          <input aria-label="VHOST" value={sink.sinkRmqVhost || ''} onChange={e => u('sinkRmqVhost', e.target.value)} placeholder="/" />
        </FormGroup>
        <FormGroup label="PORT" required>
          <input aria-label="PORT" value={sink.sinkRmqPort || ''} onChange={e => u('sinkRmqPort', e.target.value)} placeholder="5672" />
        </FormGroup>
      </FormRow>
      <FormGroup label="Queue Name" required>
        <input aria-label="Queue Name" value={sink.sinkRmqQueue || ''} onChange={e => u('sinkRmqQueue', e.target.value)} placeholder="products.sink" />
      </FormGroup>
      <FormGroup label="Exchange">
        <input aria-label="Exchange" value={sink.sinkRmqExchange || ''} onChange={e => u('sinkRmqExchange', e.target.value)} placeholder="etl.exchange" />
      </FormGroup>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Btn v="primary" sm onClick={handleRabbitMqConnectionTest} disabled={readOnly || rabbitMqTestState.status === 'loading'}>
          {rabbitMqTestState.status === 'loading' ? '⏳ Testing…' : '🔌 Test Connection'}
        </Btn>
        <ConnectionTestStatus status={rabbitMqTestState.status} message={rabbitMqTestState.message} label="RabbitMQ connection test" />
        {rabbitMqTestState.status !== 'idle' && rabbitMqTestState.message && (
          <span
            style={{
              fontSize: 12,
              color: rabbitMqTestState.status === 'error' ? 'var(--danger)' : 'var(--muted)',
            }}
          >
            {rabbitMqTestState.message}
          </span>
        )}
      </div>
    </CfgPanel>
  )
  return null
}

export default function SinkConfigStep() {
  const { state, actions } = useWizard()
  const sink = state.sink
  const metadata = state.metadata
  const hasSaknayTargets = hasSaknayTargetMappings(state.mappings)
  const u = (k, v) => actions.updateSink({ [k]: v })

  // Sync Kafka environment with metadata environment
  useEffect(() => {
    if (metadata?.environment) {
      actions.updateSink({ sinkKafkaEnv: metadata.environment })
    }
  }, [metadata?.environment, actions])

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 30px' }}>
        <Card>
          <CardTitle>🔀 Sink Configuration</CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
            {SINK_TYPES.map(t => {
              const isEnabled = ['kafka', 'rabbitmq'].includes(t.id);
              const sinkTypeCard = (
                <div
                  key={t.id}
                  onClick={() => isEnabled && u('sinkType', t.id)}
                  aria-disabled={!isEnabled}
                  style={{
                    background: sink.sinkType === t.id ? 'rgba(79,110,247,.12)' : 'var(--surf2)',
                    border: `2px solid ${sink.sinkType === t.id ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 10, padding: '16px 12px', textAlign: 'center',
                    cursor: isEnabled ? 'pointer' : 'not-allowed',
                    transition: 'all .18s',
                    opacity: isEnabled ? 1 : 0.5,
                  }}
                  onMouseEnter={e => { 
                    if (isEnabled && sink.sinkType !== t.id) { 
                      e.currentTarget.style.borderColor = 'var(--accent)'; 
                      e.currentTarget.style.background = 'rgba(79,110,247,.07)' 
                    }
                  }}
                  onMouseLeave={e => { 
                    if (isEnabled && sink.sinkType !== t.id) { 
                      e.currentTarget.style.borderColor = 'var(--border)'; 
                      e.currentTarget.style.background = 'var(--surf2)' 
                    }
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{t.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{t.sub}</div>
                </div>
              )

              return (
                <Tooltip key={t.id} content={isEnabled ? '' : 'Planned for a future ETL Studio release.'} triggerStyle={{ display: 'block' }}>
                  {sinkTypeCard}
                </Tooltip>
            );
            })}
          </div>
          {sink.sinkType && <SinkConfigPanel type={sink.sinkType} sink={sink} u={u} metadata={metadata} hasSaknayTargets={hasSaknayTargets} readOnly={state.readOnly} />}
        </Card>
      </div>
    </div>
  )
}
