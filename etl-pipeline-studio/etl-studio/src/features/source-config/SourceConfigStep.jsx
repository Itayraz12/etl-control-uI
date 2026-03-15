import { useWizard } from '../../shared/store/wizardStore.jsx'
import { useState } from 'react'
import { Card, CardTitle, FormRow, FormGroup, CfgPanel, Btn } from '../../shared/components/index.jsx'
import { SOURCE_TYPES, ENVIRONMENTS } from '../../shared/types/index.js'

function SourceConfigPanel({ type, state, u, metadata }) {
  const [keyFilterOpen, setKeyFilterOpen] = useState(false)
  const TestBtn = () => (
    <Btn v="primary" sm onClick={() => alert('Connection test simulated!')}>
      🔌 Test Connection
    </Btn>
  )

  if (type === 'kafka') return (
    <CfgPanel title="☕ Kafka Source">
      <FormRow>
        <FormGroup label="Environment" required>
          <select value={state.kafkaEnv || metadata?.environment || ''} onChange={e => u('kafkaEnv', e.target.value)}>
            <option value="">select an environment...</option>
            {ENVIRONMENTS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Topic" required>
          <input value={state.kafkaTopic || ''} onChange={e => u('kafkaTopic', e.target.value)} />
        </FormGroup>
      </FormRow>
      <TestBtn />
      
      {/* Kafka Key Filter */}
      <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Btn v="secondary" sm onClick={() => setKeyFilterOpen(!keyFilterOpen)}>
            {keyFilterOpen ? '▼' : '▶'} 🔑 Key Filter {(state.kafkaKeys || '').split(',').filter(k => k.trim()).length > 0 && `(${(state.kafkaKeys || '').split(',').filter(k => k.trim()).length})`}
          </Btn>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Include only records with this key</span>
        </div>
        {keyFilterOpen && (
          <div style={{ marginTop: 8 }}>
            <input
              type="text"
              value={state.kafkaKeys || ''}
              onChange={e => u('kafkaKeys', e.target.value)}
              placeholder="Comma-separated keys (optional). Example: user-001, order-456"
              style={{
                width: '100%',
                padding: 8,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text)',
                fontSize: 12,
              }}
            />
          </div>
        )}
      </div>
    </CfgPanel>
  )

  if (type === 'rabbitmq') return (
    <CfgPanel title="🐇 RabbitMQ Source">
      <FormRow>
        <FormGroup label="IP" required>
          <input value={state.rmqIp || ''} onChange={e => u('rmqIp', e.target.value)} placeholder="192.168.1.10" />
        </FormGroup>
        <FormGroup label="PORT" required>
          <input value={state.rmqPort || ''} onChange={e => u('rmqPort', e.target.value)} placeholder="5672" />
        </FormGroup>
      </FormRow>
      <FormRow>
        <FormGroup label="Username" required>
          <input value={state.rmqUsername || ''} onChange={e => u('rmqUsername', e.target.value)} placeholder="guest" />
        </FormGroup>
        <FormGroup label="Password" required>
          <input type="password" value={state.rmqPassword || ''} onChange={e => u('rmqPassword', e.target.value)} placeholder="••••••••" />
        </FormGroup>
      </FormRow>
      <FormGroup label="Queue" required>
        <input value={state.rmqQueue || ''} onChange={e => u('rmqQueue', e.target.value)} placeholder="products.ingest" />
      </FormGroup>
      <FormGroup label="VHOST">
        <input value={state.rmqVhost || ''} onChange={e => u('rmqVhost', e.target.value)} placeholder="/" />
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
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 30px' }}>
        <Card>
          <CardTitle>🔌 Source Config</CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}>
            {SOURCE_TYPES.map(t => {
              const isEnabled = ['kafka', 'rabbitmq'].includes(t.id);
              return (
              <div
                key={t.id}
                onClick={() => isEnabled && u('sourceType', t.id)}
                title={isEnabled ? '' : 'Future feature'}
                style={{
                  background: src.sourceType === t.id ? 'rgba(79,110,247,.12)' : 'var(--surf2)',
                  border: `2px solid ${src.sourceType === t.id ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 10, padding: '16px 12px', textAlign: 'center',
                  cursor: isEnabled ? 'pointer' : 'not-allowed', 
                  transition: 'all .18s',
                  opacity: isEnabled ? 1 : 0.5,
                }}
                onMouseEnter={e => { 
                  if (isEnabled && src.sourceType !== t.id) { 
                    e.currentTarget.style.borderColor = 'var(--accent)'; 
                    e.currentTarget.style.background = 'rgba(79,110,247,.07)' 
                  }
                }}
                onMouseLeave={e => { 
                  if (isEnabled && src.sourceType !== t.id) { 
                    e.currentTarget.style.borderColor = 'var(--border)'; 
                    e.currentTarget.style.background = 'var(--surf2)' 
                  }
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 6 }}>{t.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{t.name}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{t.sub}</div>
              </div>
            );
            })}
          </div>
          {src.sourceType && <SourceConfigPanel type={src.sourceType} state={src} u={u} metadata={state.metadata} />}
        </Card>

        <Card>
          <CardTitle>📊 Data Stream Info</CardTitle>
          <FormRow>
            <FormGroup label="Streaming Continuity" required>
              <select value={src.streamingContinuity || 'continuous'} onChange={e => u('streamingContinuity', e.target.value)}>
                <option value="once">Once</option>
                <option value="every-hour">Every Hour</option>
                <option value="every-few-hours">Every Few Hours</option>
                <option value="every-day">Once a Day</option>
                <option value="continuous">Continuous</option>
              </select>
            </FormGroup>
            <FormGroup label="Avg Records Per Day" required>
              <select value={src.recordsPerDay || 'millions'} onChange={e => u('recordsPerDay', e.target.value)}>
                <option value="hundreds">Hundreds</option>
                <option value="thousands">Thousands</option>
                <option value="hun-thousands">Hundred of Thousands</option>
                <option value="millions">A Few Millions</option>
                <option value="tens-millions">Tens of Millions</option>
                <option value="hundreds-millions">Hundreds of Millions</option>
              </select>
            </FormGroup>
          </FormRow>
        </Card>

        <Card>
          <CardTitle>⚙️ Source Format</CardTitle>
          <FormGroup label="Message / File Format" required>
            <select value={src.format} onChange={e => u('format', e.target.value)}>
              {['JSON', 'CSV'].map(o => <option key={o}>{o}</option>)}
            </select>
          </FormGroup>
          {src.format === 'JSON' && (
            <FormGroup label="Split Key (optional)">
              <input value={src.jsonSplit || ''} onChange={e => u('jsonSplit', e.target.value)} placeholder="e.g., records, items, data" />
            </FormGroup>
          )}
          {src.format === 'CSV' && (
            <FormGroup label="Column Delimiter">
              <input value={src.csvDelimiter || ','} onChange={e => u('csvDelimiter', e.target.value)} placeholder="," maxLength="1" />
            </FormGroup>
          )}
        </Card>
      </div>


    </div>
  )
}
