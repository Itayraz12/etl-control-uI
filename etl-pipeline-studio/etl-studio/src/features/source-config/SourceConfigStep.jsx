import { useWizard } from '../../shared/store/wizardStore.jsx'
import { Card, CardTitle, FormRow, FormGroup, SidePanel, CfgPanel, Btn } from '../../shared/components/index.jsx'
import { SOURCE_TYPES } from '../../shared/types/index.js'

function SourceConfigPanel({ type, state, u }) {
  const TestBtn = () => (
    <Btn v="ghost" sm onClick={() => alert('Connection test simulated!')} style={{ marginTop: 8 }}>
      🔌 Test Connection
    </Btn>
  )

  if (type === 'kafka') return (
    <CfgPanel title="☕ Kafka Source">
      <FormRow>
        <FormGroup label="Environment" required>
          <select value={state.kafkaEnv || ''} onChange={e => u('kafkaEnv', e.target.value)}>
            <option value="">Select Environment</option>
            <option value="prod">Production</option>
            <option value="cap">Captive</option>
            <option value="stage">Staging</option>
          </select>
        </FormGroup>
        <FormGroup label="Topic" required>
          <input value={state.kafkaTopic || ''} onChange={e => u('kafkaTopic', e.target.value)} />
        </FormGroup>
      </FormRow>
      <FormRow>
        <FormGroup label="Consumer Group">
          <input value={state.kafkaGroup || ''} onChange={e => u('kafkaGroup', e.target.value)} />
        </FormGroup>
        <FormGroup label="Auto Offset Reset">
          <select value={state.kafkaOffset || 'latest'} onChange={e => u('kafkaOffset', e.target.value)}>
            <option>earliest</option><option>latest</option>
          </select>
        </FormGroup>
      </FormRow>
      <TestBtn />
    </CfgPanel>
  )

  if (type === 'rabbitmq') return (
    <CfgPanel title="🐇 RabbitMQ Source">
      <FormRow>
        <FormGroup label="VHOST" required>
          <input value={state.rmqVhost || ''} onChange={e => u('rmqVhost', e.target.value)} placeholder="/" />
        </FormGroup>
        <FormGroup label="PORT" required>
          <input value={state.rmqPort || ''} onChange={e => u('rmqPort', e.target.value)} placeholder="5672" />
        </FormGroup>
      </FormRow>
      <FormGroup label="Queue">
        <input value={state.rmqQueue || ''} onChange={e => u('rmqQueue', e.target.value)} placeholder="products.ingest" />
      </FormGroup>
      <FormGroup label="Exchange">
        <input value={state.rmqExchange || ''} onChange={e => u('rmqExchange', e.target.value)} placeholder="etl.exchange" />
      </FormGroup>
      <TestBtn />
    </CfgPanel>
  )

  if (type === 'file') return (
    <CfgPanel title="📂 File / Object Source">
      <FormGroup label="Path / Glob">
        <input value={state.filePath || ''} onChange={e => u('filePath', e.target.value)} placeholder="/data/input/products_*.json" />
      </FormGroup>
      <TestBtn />
    </CfgPanel>
  )

  if (type === 'db') return (
    <CfgPanel title="🗄️ Database Source">
      <FormGroup label="JDBC Connection">
        <input value={state.dbConn || ''} onChange={e => u('dbConn', e.target.value)} placeholder="jdbc:postgresql://db:5432/erp" />
      </FormGroup>
      <FormGroup label="Query / Table">
        <input value={state.dbQuery || ''} onChange={e => u('dbQuery', e.target.value)} placeholder="SELECT * FROM products" />
      </FormGroup>
      <TestBtn />
    </CfgPanel>
  )

  if (type === 'http') return (
    <CfgPanel title="🌐 HTTP Source">
      <FormGroup label="Endpoint URL">
        <input value={state.httpUrl || ''} onChange={e => u('httpUrl', e.target.value)} placeholder="https://api.corp.com/products" />
      </FormGroup>
      <FormRow>
        <FormGroup label="Method">
          <select value={state.httpMethod || 'GET'} onChange={e => u('httpMethod', e.target.value)}>
            <option>GET</option><option>POST</option>
          </select>
        </FormGroup>
        <FormGroup label="Auth Type">
          <select value={state.httpAuth || 'None'} onChange={e => u('httpAuth', e.target.value)}>
            <option>None</option><option>Bearer</option><option>Basic</option>
          </select>
        </FormGroup>
      </FormRow>
      <TestBtn />
    </CfgPanel>
  )

  if (type === 's3') return (
    <CfgPanel title="☁️ S3 / Blob Source">
      <FormRow>
        <FormGroup label="Bucket">
          <input value={state.s3Bucket || ''} onChange={e => u('s3Bucket', e.target.value)} placeholder="etl-source-bucket" />
        </FormGroup>
        <FormGroup label="Prefix">
          <input value={state.s3Prefix || ''} onChange={e => u('s3Prefix', e.target.value)} placeholder="data/products/" />
        </FormGroup>
      </FormRow>
      <TestBtn />
    </CfgPanel>
  )
  return null
}

export default function SourceConfigStep() {
  const { state, actions } = useWizard()
  const src = state.source
  const u = (k, v) => actions.updateSource({ [k]: v })
  const srcMeta = SOURCE_TYPES.find(t => t.id === src.sourceType)

  return (
    <div style={{ display: 'flex', gap: 22, flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 30px' }}>
        <Card>
          <CardTitle>🔌 Source Config</CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}>
            {SOURCE_TYPES.map(t => (
              <div
                key={t.id}
                onClick={() => u('sourceType', t.id)}
                style={{
                  background: src.sourceType === t.id ? 'rgba(79,110,247,.12)' : 'var(--surf2)',
                  border: `2px solid ${src.sourceType === t.id ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 10, padding: '16px 12px', textAlign: 'center',
                  cursor: 'pointer', transition: 'all .18s',
                }}
                onMouseEnter={e => { if (src.sourceType !== t.id) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(79,110,247,.07)' } }}
                onMouseLeave={e => { if (src.sourceType !== t.id) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surf2)' } }}
              >
                <div style={{ fontSize: 28, marginBottom: 6 }}>{t.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{t.name}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{t.sub}</div>
              </div>
            ))}
          </div>
          {src.sourceType && <SourceConfigPanel type={src.sourceType} state={src} u={u} />}
        </Card>

        <Card>
          <CardTitle>⚙️ Source Format</CardTitle>
          <FormRow>
            <FormGroup label="Message / File Format" required>
              <select value={src.format} onChange={e => u('format', e.target.value)}>
                {['JSON', 'CSV', 'Parquet', 'Avro', 'XML'].map(o => <option key={o}>{o}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Encoding">
              <select value={src.encoding} onChange={e => u('encoding', e.target.value)}>
                <option>UTF-8</option><option>ISO-8859-1</option>
              </select>
            </FormGroup>
          </FormRow>

        </Card>
      </div>

      <SidePanel title="Source Summary" items={[
        ['Type',   srcMeta?.name || '—'],
        ['Mode',   srcMeta?.mode || '—'],
        ['Entry',  src.kafkaTopic || src.filePath || src.httpUrl || src.s3Bucket || '—'],
        ['Format', `${src.format} · ${src.encoding}`],
      ]} />
    </div>
  )
}
