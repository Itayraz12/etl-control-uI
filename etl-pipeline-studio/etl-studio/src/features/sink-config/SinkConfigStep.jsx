import { useWizard } from '../../shared/store/wizardStore.jsx'
import { Card, CardTitle, FormRow, FormGroup, SidePanel, CfgPanel, Btn } from '../../shared/components/index.jsx'

const SINK_TYPES = [
  { id: 'kafka', icon: '☕', name: 'Kafka',     sub: 'Streaming sink' },
  { id: 'file',  icon: '📂', name: 'File',      sub: 'JSON / CSV / Parquet' },
  { id: 'db',    icon: '🗄️', name: 'Database', sub: 'PostgreSQL · MySQL'    },
  { id: 'http',  icon: '🌐', name: 'HTTP',      sub: 'Webhook / POST'        },
]

function SinkConfigPanel({ type, sink, u }) {
  if (type === 'kafka') return (
    <CfgPanel title="☕ Kafka Sink">
      <FormGroup label="Output Topic" required>
        <input value={sink.sinkKafkaTopic || ''} onChange={e => u('sinkKafkaTopic', e.target.value)} />
      </FormGroup>
      <FormGroup label="Bootstrap Servers">
        <input value={sink.sinkKafkaBootstrap || ''} onChange={e => u('sinkKafkaBootstrap', e.target.value)} placeholder="kafka-1:9092" />
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

  if (type === 'http') return (
    <CfgPanel title="🌐 HTTP Sink">
      <FormRow>
        <FormGroup label="Endpoint URL">
          <input value={sink.sinkHttpUrl || ''} onChange={e => u('sinkHttpUrl', e.target.value)} placeholder="https://api.corp.com/ingest" />
        </FormGroup>
        <FormGroup label="Method">
          <select value={sink.sinkHttpMethod || 'POST'} onChange={e => u('sinkHttpMethod', e.target.value)}>
            <option>POST</option><option>PUT</option>
          </select>
        </FormGroup>
      </FormRow>
      <FormGroup label="Auth Type">
        <select value={sink.sinkHttpAuth || 'None'} onChange={e => u('sinkHttpAuth', e.target.value)}>
          <option>None</option><option>Bearer Token</option><option>Basic</option>
        </select>
      </FormGroup>
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
      </div>

      <SidePanel title="Sink Summary" items={[
        ['Type',  sinkMeta?.name || '—'],
        ['Entry', sink.sinkKafkaTopic || sink.sinkFilePath || sink.sinkDbTable || sink.sinkHttpUrl || '—'],
      ]} />
    </div>
  )
}
