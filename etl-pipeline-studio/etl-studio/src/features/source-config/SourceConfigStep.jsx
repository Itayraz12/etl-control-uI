import { useWizard } from '../../shared/store/wizardStore.jsx'
import { useEffect, useState } from 'react'
import { Card, CardTitle, FormRow, FormGroup, CfgPanel, Btn, Tooltip } from '../../shared/components/index.jsx'
import { SOURCE_TYPES, ENVIRONMENTS } from '../../shared/types/index.js'
import { testKafkaConnection } from '../../shared/services/kafkaService.js'

function KafkaConnectionStatus({ status, message }) {
  if (status === 'loading') {
    return <Tooltip content={message || 'Testing Kafka connection...'}><span aria-label="Kafka connection test in progress" style={{ fontSize: 18 }}>⏳</span></Tooltip>
  }

  if (status === 'success') {
    return <Tooltip content={message || 'Kafka connection succeeded.'}><span aria-label="Kafka connection test succeeded" style={{ fontSize: 18 }}>✅</span></Tooltip>
  }

  if (status === 'error') {
    return <Tooltip content={message || 'Kafka connection test failed.'}><span aria-label="Kafka connection test failed" style={{ fontSize: 18 }}>❌</span></Tooltip>
  }

  return null
}

function SourceConfigPanel({ type, state, u, metadata, readOnly = false }) {
  const [keyFilterOpen, setKeyFilterOpen] = useState(false)
  const [kafkaTestState, setKafkaTestState] = useState({ status: 'idle', message: '' })
  const TestBtn = () => (
    <Btn v="primary" sm onClick={() => alert('Connection test simulated!')} disabled={readOnly}>
      🔌 Test Connection
    </Btn>
  )

  useEffect(() => {
    if (type !== 'kafka') {
      setKafkaTestState({ status: 'idle', message: '' })
      return
    }

    setKafkaTestState({ status: 'idle', message: '' })
  }, [type, state.kafkaTopic, state.kafkaEnv, metadata?.environment])

  const handleKafkaConnectionTest = async () => {
    if (readOnly) return

    const topic = String(state.kafkaTopic || '').trim()
    const environment = String(state.kafkaEnv || metadata?.environment || '').trim()

    if (!topic || !environment) {
      setKafkaTestState({
        status: 'error',
        message: 'Topic and environment are required to test the Kafka connection.',
      })
      return
    }

    setKafkaTestState({ status: 'loading', message: 'Testing Kafka connection...' })

    try {
      const result = await testKafkaConnection({ topic, environment })
      setKafkaTestState({ status: 'success', message: result.message })
    } catch (error) {
      setKafkaTestState({
        status: 'error',
        message: error?.message || 'Kafka connection test failed.',
      })
    }
  }

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
      <FormRow>
        <FormGroup label="Offset" required>
          <select aria-label="Offset" value={state.kafkaOffset || ''} onChange={e => u('kafkaOffset', e.target.value)}>
            <option value="">select an offset...</option>
            <option value="earliest">earliest</option>
            <option value="latest">latest</option>
          </select>
        </FormGroup>
        <div />
      </FormRow>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Btn v="primary" sm onClick={handleKafkaConnectionTest} disabled={readOnly || kafkaTestState.status === 'loading'}>
          {kafkaTestState.status === 'loading' ? '⏳ Testing…' : '🔌 Test Connection'}
        </Btn>
        <KafkaConnectionStatus status={kafkaTestState.status} message={kafkaTestState.message} />
        {kafkaTestState.status !== 'idle' && kafkaTestState.message && (
          <span
            style={{
              fontSize: 12,
              color: kafkaTestState.status === 'error' ? 'var(--danger)' : 'var(--muted)',
            }}
          >
            {kafkaTestState.message}
          </span>
        )}
      </div>
      
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

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 30px' }}>
        <Card>
          <CardTitle>🔌 Source Config</CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}>
            {SOURCE_TYPES.map(t => {
              const isEnabled = ['kafka', 'rabbitmq'].includes(t.id);
              const sourceTypeCard = (
                <div
                  key={t.id}
                  onClick={() => isEnabled && u('sourceType', t.id)}
                  aria-disabled={!isEnabled}
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
              )

              return (
                <Tooltip key={t.id} content={isEnabled ? '' : 'Planned for a future ETL Studio release.'} triggerStyle={{ display: 'block' }}>
                  {sourceTypeCard}
                </Tooltip>
            );
            })}
          </div>
          {src.sourceType && <SourceConfigPanel type={src.sourceType} state={src} u={u} metadata={state.metadata} readOnly={state.readOnly} />}
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
            <FormRow>
              <FormGroup label="Column Delimiter" required>
                <input
                  aria-label="Column Delimiter"
                  required
                  value={src.csvDelimiter || ''}
                  onChange={e => u('csvDelimiter', e.target.value)}
                  placeholder="," 
                  maxLength="1"
                />
              </FormGroup>
              <FormGroup label="Row Delimiter">
                <input value={src.rowDelimiter || ''} onChange={e => u('rowDelimiter', e.target.value)} placeholder="\\n or \\r\\n" />
              </FormGroup>
            </FormRow>
          )}
        </Card>
      </div>


    </div>
  )
}
