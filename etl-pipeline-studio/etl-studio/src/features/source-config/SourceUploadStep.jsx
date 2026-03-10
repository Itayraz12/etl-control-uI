import { useState } from 'react'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { Card, CardTitle, SidePanel, ValidationItem, Btn, Spinner, TypeBadge } from '../../shared/components/index.jsx'
import { MOCK_SCHEMA } from '../../shared/types/index.js'

export default function SourceUploadStep() {
  const { state, actions } = useWizard()
  const [sampleMode, setSampleMode] = useState('local')
  const [phase, setPhase] = useState(state.upload.done ? 'done' : 'idle')

  const handleUpload = () => {
    if (phase === 'parsing') return
    setPhase('parsing')
    setTimeout(() => {
      setPhase('done')
      actions.setUploadDone(true)
    }, 1300)
  }

  return (
    <div style={{ display: 'flex', gap: 22, flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 30px' }}>
        <Card>
          <CardTitle>📥 Source Upload / Preview</CardTitle>

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sample origin:</span>
            <Btn sm v={sampleMode === 'local' ? 'primary' : 'ghost'} onClick={() => setSampleMode('local')}>Upload sample</Btn>
            <Btn sm v={sampleMode === 'source' ? 'primary' : 'ghost'} onClick={() => setSampleMode('source')}>Pull from source config</Btn>
          </div>

          {/* Drop zone */}
          <DropZone phase={phase} sampleMode={sampleMode} onUpload={handleUpload} />

          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
            {sampleMode === 'source'
              ? 'Uses Kafka / RabbitMQ settings from Source Config to pull a live sample.'
              : 'Drop a JSON or CSV file — schema is extracted automatically via Web Worker.'}
          </div>
        </Card>

        {phase === 'done' && <SchemaCard />}
      </div>

      <SidePanel title="Sample Info" items={[
        ['Mode',     sampleMode === 'local' ? 'Upload' : 'From Source'],
        ['Status',   phase === 'done' ? '✓ Ready' : phase === 'parsing' ? 'Parsing…' : 'Waiting…'],
        ['Type',     phase === 'done' ? 'JSON' : '—'],
        ['Size',     phase === 'done' ? '14.2 MB' : '—'],
        ['Fields',   phase === 'done' ? String(MOCK_SCHEMA.length) : '—'],
        ['Encoding', phase === 'done' ? 'UTF-8' : '—'],
      ]}>
        {phase === 'done' && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: .5, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>Worker</div>
            <ValidationItem type="ok">Web Worker completed</ValidationItem>
          </div>
        )}
      </SidePanel>
    </div>
  )
}

function DropZone({ phase, sampleMode, onUpload }) {
  const [hovering, setHovering] = useState(false)

  return (
    <div
      onClick={phase !== 'parsing' ? onUpload : undefined}
      onDragOver={e => { e.preventDefault(); setHovering(true) }}
      onDragLeave={() => setHovering(false)}
      onDrop={e => { e.preventDefault(); setHovering(false); if (phase !== 'parsing') onUpload() }}
      style={{
        border: `2px dashed ${phase === 'done' ? 'var(--success)' : hovering ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)', padding: 40, textAlign: 'center',
        cursor: phase === 'parsing' ? 'default' : 'pointer',
        transition: 'all .2s',
        background: phase === 'done' ? 'rgba(34,197,94,.07)' : hovering ? 'rgba(79,110,247,.07)' : 'var(--surf2)',
      }}
    >
      {phase === 'idle' && (
        <>
          <div style={{ fontSize: 42, marginBottom: 10 }}>☁️</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 5 }}>
            {sampleMode === 'local' ? 'Drop a sample file here' : 'Click to pull from source'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {sampleMode === 'local' ? 'or click to browse · JSON / CSV' : 'Uses source config settings'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 14 }}>
            {['JSON', 'CSV', 'AVRO', 'Parquet'].map(f => {
              const isEnabled = ['JSON', 'CSV'].includes(f);
              return (
                <span 
                  key={f} 
                  title={isEnabled ? '' : 'Future feature'}
                  style={{ 
                    background: 'var(--surf)', 
                    border: `1px solid ${isEnabled ? 'var(--border)' : 'var(--border)'}`, 
                    borderRadius: 5, 
                    padding: '3px 10px', 
                    fontSize: 11, 
                    fontWeight: 600, 
                    color: isEnabled ? 'var(--accent)' : 'var(--muted)',
                    opacity: isEnabled ? 1 : 0.5,
                    cursor: isEnabled ? 'default' : 'not-allowed',
                  }}
                >
                  {f}
                </span>
              );
            })}
          </div>
        </>
      )}
      {phase === 'parsing' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <Spinner />
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Parsing sample via Web Worker…</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Streaming sample records…</div>
          </div>
        </div>
      )}
      {phase === 'done' && (
        <>
          <div style={{ fontSize: 42, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Sample parsed</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Schema extracted · {MOCK_SCHEMA.length} fields detected</div>
        </>
      )}
    </div>
  )
}

function SchemaCard() {
  return (
    <Card style={{ animation: 'fadeIn .3s ease' }}>
      <CardTitle>
        🔍 Detected Schema
        <span style={{ background: 'rgba(239,68,68,.15)', color: 'var(--danger)', fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 700 }}>INFERRED</span>
      </CardTitle>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>Extracted from sample — {MOCK_SCHEMA.length} fields</div>
      {MOCK_SCHEMA.map(f => (
        <div
          key={f.id}
          style={{ padding: '6px 10px 6px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,.03)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,110,247,.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: f.required ? 'var(--success)' : f.type === 'number' ? 'var(--warning)' : f.type === 'boolean' ? 'var(--accent2)' : 'var(--accent)', flexShrink: 0, display: 'block' }} />
          <span style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 12 }}>{f.id}</span>
          <TypeBadge type={f.type} />
          {f.isArray && <span style={{ fontSize: 10, padding: '1px 4px', borderRadius: 6, background: 'rgba(251,146,60,.18)', color: '#fed7aa' }}>[ ]</span>}
          {f.required && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 6, background: 'rgba(239,68,68,.18)', color: '#fecaca', marginLeft: 'auto' }}>req</span>}
        </div>
      ))}
    </Card>
  )
}
