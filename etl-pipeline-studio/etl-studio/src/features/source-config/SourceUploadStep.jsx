import { useEffect, useRef, useState } from 'react'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { Card, CardTitle, Btn, Spinner, TypeBadge, Tooltip } from '../../shared/components/index.jsx'
import { hasSourceSchemaFieldChanges, normalizeSourceSchema } from '../../shared/types/index.js'
import { extractSchemaNameFromExamplePayload, fetchSchemaByExample } from '../../shared/services/configService.js'
import { useMockMode } from '../../shared/store/mockModeContext.jsx'

export default function SourceUploadStep() {
  const { state, actions } = useWizard()
  const { useMock } = useMockMode()
  const fileInputRef = useRef(null)
  const uploadedSchema = normalizeSourceSchema(state.upload?.schema)
  const hasUploadedSchema = uploadedSchema.length > 0
  const [phase, setPhase] = useState(state.upload.done && hasUploadedSchema ? 'done' : 'idle')
  const [error, setError] = useState('')
  const isReadOnly = state.readOnly === true

  useEffect(() => {
    setPhase(state.upload.done && hasUploadedSchema ? 'done' : 'idle')
  }, [state.upload.done, hasUploadedSchema])

  const openFilePicker = () => {
    if (isReadOnly || phase === 'parsing') return
    fileInputRef.current?.click()
  }

  const inferSchemaFromFile = async (file) => {
    if (isReadOnly || !file || phase === 'parsing') return

    const previousPhase = phase
    if (phase === 'parsing') return

    setError('')
    setPhase('parsing')

    try {
      const example = await file.text()
      const schemaResponse = await fetchSchemaByExample({
        example,
        fileName: file.name,
        contentType: file.type || (file.name.toLowerCase().endsWith('.json') ? 'application/json' : 'text/plain'),
        sourceFormat: state.source?.format,
      }, useMock)
      const schemaPayload = schemaResponse?.schema ?? schemaResponse
      const schema = normalizeSourceSchema(schemaPayload)
      if (schema.length === 0) {
        throw new Error('Schema inference returned no fields')
      }

      const previousSchema = normalizeSourceSchema(state.upload?.schema)
      const shouldClearMappings = previousSchema.length > 0
        && hasSourceSchemaFieldChanges(previousSchema, schema)

      const schemaName = extractSchemaNameFromExamplePayload(schemaResponse, file.name.replace(/\.[^.]+$/, ''))

      if (shouldClearMappings) {
        actions.setMappings([])
      }

      actions.updateUpload({
        done: true,
        schema,
        schemaName,
        fileName: file.name,
        fileType: file.type || inferFileType(file.name),
        fileSize: file.size || 0,
      })
      setPhase('done')
    } catch (uploadError) {
      setError(uploadError?.message || 'Failed to infer schema from the selected sample file.')
      setPhase(state.upload.done ? previousPhase : 'idle')
    }
  }

  const handleInputChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    await inferSchemaFromFile(file)
  }

  return (
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 30px' }}>
          <Card>
            <CardTitle>📥 Source Upload / Preview</CardTitle>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <Btn sm onClick={openFilePicker} disabled={isReadOnly}>Upload sample</Btn>
            </div>

            <input
                ref={fileInputRef}
                data-testid="sample-file-input"
                type="file"
                accept=".json,.csv,application/json,text/csv,text/plain"
                style={{ display: 'none' }}
                disabled={isReadOnly}
                onChange={handleInputChange}
            />

            {/* Drop zone */}
            <DropZone
                phase={phase}
                readOnly={isReadOnly}
                onBrowse={openFilePicker}
                onFileSelected={inferSchemaFromFile}
                detectedFieldCount={uploadedSchema.length}
            />

            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
              Drop a JSON or CSV file — the selected sample is sent to the backend for schema inference.
            </div>

            {!!error && (
                <div data-testid="source-upload-error" style={{ marginTop: 12, fontSize: 12, color: 'var(--danger)' }}>
                  {error}
                </div>
            )}
          </Card>

          {phase === 'done' && hasUploadedSchema && <SchemaCard schema={uploadedSchema} />}
        </div>
      </div>
  )
}

function DropZone({ phase, readOnly, onBrowse, onFileSelected, detectedFieldCount }) {
  const [hovering, setHovering] = useState(false)

  const handleDrop = async (e) => {
    e.preventDefault()
    setHovering(false)
    if (readOnly || phase === 'parsing') return
    const file = e.dataTransfer?.files?.[0]
    await onFileSelected(file)
  }

  return (
      <div
          aria-disabled={readOnly ? 'true' : undefined}
          onClick={!readOnly && phase !== 'parsing' ? onBrowse : undefined}
          onDragOver={e => {
            e.preventDefault()
            if (!readOnly) setHovering(true)
          }}
          onDragLeave={() => setHovering(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${phase === 'done' ? 'var(--success)' : hovering ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)', padding: 40, textAlign: 'center',
            cursor: readOnly || phase === 'parsing' ? 'default' : 'pointer',
            transition: 'all .2s',
            opacity: readOnly ? 0.65 : 1,
            background: phase === 'done' ? 'rgba(34,197,94,.07)' : hovering ? 'rgba(79,110,247,.07)' : 'var(--surf2)',
          }}
      >
        {phase === 'idle' && (
            <>
              <div style={{ fontSize: 42, marginBottom: 10 }}>☁️</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 5 }}>Drop a sample file here</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                or click to browse · JSON / CSV
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 14 }}>
                {['JSON', 'CSV'].map(f => {
                  const isEnabled = ['JSON', 'CSV'].includes(f);
                  return (
                      <Tooltip key={f} content={isEnabled ? '' : 'Planned for a future ETL Studio release.'}>
                  <span
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
                      </Tooltip>
                  );
                })}
              </div>
            </>
        )}
        {phase === 'parsing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <Spinner />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Inferring schema from sample…</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Uploading file content to the backend…</div>
              </div>
            </div>
        )}
        {phase === 'done' && (
            <>
              <div style={{ fontSize: 42, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Sample uploaded</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Schema extracted · {detectedFieldCount} fields detected</div>
            </>
        )}
      </div>
  )
}

function SchemaCard({ schema }) {
  return (
      <Card style={{ animation: 'fadeIn .3s ease' }}>
        <CardTitle>
          <span>🔍</span>
          <span>Detected Schema</span>
          <span style={{ background: 'rgba(239,68,68,.15)', color: 'var(--danger)', fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 700 }}>INFERRED</span>
        </CardTitle>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>Extracted from sample — {schema.length} fields</div>
        {schema.map(f => (
            <div
                key={f.id}
                style={{ padding: '6px 10px 6px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,110,247,.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: f.required ? 'var(--success)' : f.type === 'number' ? 'var(--warning)' : f.type === 'boolean' ? 'var(--accent2)' : 'var(--accent)', flexShrink: 0, display: 'block' }} />
              <span style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 12 }}>{f.id}</span>
              <TypeBadge type={f.type} />
              {f.isArray && <span style={{ fontSize: 10, padding: '1px 4px', borderRadius: 6, background: 'rgba(79,110,247,.15)', color: 'var(--accent)' }}>[ ]</span>}
              {f.required && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 6, background: 'rgba(34,197,94,.15)', color: 'var(--success)', marginLeft: 'auto' }}>req</span>}
            </div>
        ))}
      </Card>
  )
}

function inferFileType(fileName = '') {
  const lower = String(fileName).toLowerCase()
  if (lower.endsWith('.json')) return 'application/json'
  if (lower.endsWith('.csv')) return 'text/csv'
  return 'text/plain'
}


