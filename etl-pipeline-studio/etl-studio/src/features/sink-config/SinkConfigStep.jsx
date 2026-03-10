import { useWizard } from '../../shared/store/wizardStore.jsx'
import { Card, CardTitle, FormRow, FormGroup, SidePanel, CfgPanel, Btn } from '../../shared/components/index.jsx'

const SINK_TYPES = [
  { id: 'kafka', icon: '☕', name: 'Kafka',     sub: 'Streaming sink' },
  { id: 'file',  icon: '📂', name: 'File',      sub: 'JSON / CSV / Parquet' },
  { id: 'db',    icon: '🗄️', name: 'Database', sub: 'PostgreSQL · MySQL'    },
  { id: 'rabbitmq',  icon: '🐇', name: 'RabbitMQ',      sub: 'Message queue'        },
]

function SinkConfigPanel({ type, sink, u }) {
  const hasCatalogOption = sink?.shadow || sink?.saknay
  
  if (type === 'kafka') return (
    <CfgPanel title="☕ Kafka Sink">
      <FormGroup label="Output Topic" required={!hasCatalogOption} hint={hasCatalogOption ? 'Optional - system will auto-generate if empty' : undefined}>
        <input value={sink.sinkKafkaTopic || ''} onChange={e => u('sinkKafkaTopic', e.target.value)} placeholder={hasCatalogOption ? 'Leave empty for auto-generation' : 'products.output'} />
      </FormGroup>
      <FormGroup label="Bootstrap Environment" required>
        <select value={sink.sinkKafkaEnv || 'prod'} onChange={e => u('sinkKafkaEnv', e.target.value)}>
          <option value="prod">Production</option>
          <option value="cap">Captive</option>
          <option value="stage">Staging</option>
        </select>
      </FormGroup>
      <Btn sm v="ghost" onClick={() => alert('Connection tested!')} style={{ marginTop: 8 }}>🔌 Test Connection</Btn>
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
          <input value={sink.sinkRmqVhost || ''} onChange={e => u('sinkRmqVhost', e.target.value)} placeholder="/" />
        </FormGroup>
        <FormGroup label="PORT" required>
          <input value={sink.sinkRmqPort || ''} onChange={e => u('sinkRmqPort', e.target.value)} placeholder="5672" />
        </FormGroup>
      </FormRow>
      <FormGroup label="Queue Name" required>
        <input value={sink.sinkRmqQueue || ''} onChange={e => u('sinkRmqQueue', e.target.value)} placeholder="products.sink" />
      </FormGroup>
      <FormGroup label="Exchange">
        <input value={sink.sinkRmqExchange || ''} onChange={e => u('sinkRmqExchange', e.target.value)} placeholder="etl.exchange" />
      </FormGroup>
      <Btn sm v="ghost" onClick={() => alert('Connection tested!')} style={{ marginTop: 8 }}>🔌 Test Connection</Btn>
    </CfgPanel>
  )
  return null
}

export default function SinkConfigStep() {
  const { state, actions } = useWizard()
  const sink = state.sink
  const u = (k, v) => actions.updateSink({ [k]: v })
  const sinkMeta = SINK_TYPES.find(t => t.id === sink.sinkType)

  return (
    <div style={{ display: 'flex', gap: 22, flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 30px' }}>
        <Card>
          <CardTitle>🔀 Sink Configuration</CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
            {SINK_TYPES.map(t => (
              <div
                key={t.id}
                onClick={() => u('sinkType', t.id)}
                style={{
                  background: sink.sinkType === t.id ? 'rgba(79,110,247,.12)' : 'var(--surf2)',
                  border: `2px solid ${sink.sinkType === t.id ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 10, padding: '16px 12px', textAlign: 'center',
                  cursor: 'pointer', transition: 'all .18s',
                }}
                onMouseEnter={e => { if (sink.sinkType !== t.id) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(79,110,247,.07)' } }}
                onMouseLeave={e => { if (sink.sinkType !== t.id) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surf2)' } }}
              >
                <div style={{ fontSize: 28, marginBottom: 6 }}>{t.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{t.name}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{t.sub}</div>
              </div>
            ))}
          </div>
          {sink.sinkType && <SinkConfigPanel type={sink.sinkType} sink={sink} u={u} />}
        </Card>

        {sink.sinkType === 'kafka' && (
          <Card>
            <CardTitle>🏷️ Data Catalog Options</CardTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', marginBottom: '8px' }}>
                  <input
                    type="checkbox"
                    checked={sink.shadow || false}
                    onChange={e => u('shadow', e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span>🌬️ SHADOW</span>
                </label>
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
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', marginBottom: '8px' }}>
                  <input
                    type="checkbox"
                    checked={sink.saknay || false}
                    onChange={e => u('saknay', e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span>🦆 SAKNAY</span>
                </label>
                {sink.saknay && (
                  <input
                    type="text"
                    value={sink.saknayTopic || ''}
                    onChange={e => u('saknayTopic', e.target.value)}
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={sink.asg || false}
                  onChange={e => u('asg', e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span>📊 ASG</span>
              </label>
            </div>
          </Card>
        )}
      </div>

      <SidePanel title="Sink Summary" items={[
        ['Type',  sinkMeta?.name || '—'],
        ['Entry', sink.sinkKafkaTopic || sink.sinkFilePath || sink.sinkDbTable || sink.sinkRmqQueue || '—'],
      ]} />
    </div>
  )
}
