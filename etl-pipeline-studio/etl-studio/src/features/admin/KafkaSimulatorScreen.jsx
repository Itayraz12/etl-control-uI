import { useState, useCallback, useEffect, useRef } from 'react'
import { Card, CardTitle, FormRow, FormGroup, Btn, Chip } from '../../shared/components/index.jsx'
import { ENVIRONMENT_OPTIONS } from '../../shared/types/index.js'
import { startSimulation, stopSimulation, deleteSimulation, testKafkaConnection, getSimulationStatus } from '../../shared/services/simulatorService.js'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { DEFAULT_SIMULATOR_SAMPLES, createEmptySimulatorRow } from '../../shared/services/simulatorState.js'

// ── Constants ─────────────────────────────────────────────────────────────

const INTERVAL_OPTIONS = [
  { value: 0,   label: 'Once'            },
  { value: 1,   label: 'Every 1 second'  },
  { value: 5,   label: 'Every 5 seconds' },
  { value: 10,  label: 'Every 10 seconds'},
  { value: 30,  label: 'Every 30 seconds'},
  { value: 60,  label: 'Every 1 minute'  },
  { value: 300, label: 'Every 5 minutes' },
]

const MESSAGE_FORMATS = [
  { value: 'json',     label: 'JSON'     },
  { value: 'csv',      label: 'CSV'      },
  { value: 'xml',      label: 'XML'      },
  { value: 'protobuf', label: 'Protobuf' },
  { value: 'plain',    label: 'Plain Text'},
]

const DEFAULT_SAMPLES = DEFAULT_SIMULATOR_SAMPLES

// ── Status Badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    idle:    { c: 'muted',  icon: '○', label: 'Idle'    },
    running: { c: 'green',  icon: '▶', label: 'Running' },
    stopped: { c: 'amber',  icon: '■', label: 'Stopped' },
    error:   { c: 'red',    icon: '✖', label: 'Error'   },
  }
  const cfg = map[status] || map.idle
  return (
    <Chip c={cfg.c}>
      {cfg.icon} {cfg.label}
    </Chip>
  )
}

// ── Sample Message Editor ─────────────────────────────────────────────────

function SampleMessageEditor({ value, onChange, disabled, messageFormat }) {
  const isJson = messageFormat === 'json'
  const [jsonError, setJsonError] = useState(false)

  const handleChange = (e) => {
    const raw = e.target.value
    onChange(raw)
    if (isJson) {
      try { JSON.parse(raw); setJsonError(false) } catch { setJsonError(true) }
    } else {
      setJsonError(false)
    }
  }

  const invalid = isJson && jsonError

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        value={value}
        onChange={handleChange}
        disabled={disabled}
        rows={4}
        spellCheck={false}
        style={{
          width: '100%',
          padding: '8px 10px',
          background: invalid ? 'rgba(239,68,68,.06)' : 'var(--surf2)',
          border: `1px solid ${invalid ? 'var(--danger)' : 'var(--border)'}`,
          borderRadius: 6,
          color: 'var(--text)',
          fontSize: 11,
          fontFamily: 'var(--mono, monospace)',
          lineHeight: 1.55,
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />
      {invalid && (
        <span style={{ fontSize: 10, color: 'var(--danger)', marginTop: 2, display: 'block' }}>
          ⚠ Invalid JSON
        </span>
      )}
    </div>
  )
}

// ── Simulator Row ─────────────────────────────────────────────────────────

function SimulatorRow({ row, index, brokerEnv, topic, onUpdate, onDelete, isTopicValid }) {
  const isRunning = row.status === 'running'
  const isLoading = row._loading

  const update = (key, val) => onUpdate(row.id, { [key]: val })

  const handleFormatChange = (e) => {
    const fmt = e.target.value
    onUpdate(row.id, {
      messageFormat: fmt,
      sampleMessage: DEFAULT_SAMPLES[fmt] ?? '',
    })
  }

  const handleStart = async () => {
    if (!isTopicValid) return
    onUpdate(row.id, { _loading: true })
    try {
      const result = await startSimulation({
        topic,
        environment:        brokerEnv,
        messageFormat:      row.messageFormat,
        sampleMessage:      row.sampleMessage,
        messagesPerSecond:  Number(row.messagesPerSecond),
        totalMessages:      Number(row.totalMessages),
        intervalSeconds:    Number(row.intervalSeconds),
      })
      onUpdate(row.id, {
        status: 'running',
        statusMessage: 'Simulation started',
        remoteTaskId: result.taskId,
        _loading: false,
      })
    } catch (err) {
      onUpdate(row.id, {
        status: 'error',
        statusMessage: err?.message || 'Failed to start',
        _loading: false,
      })
    }
  }

  const handleStop = async () => {
    if (!row.remoteTaskId) {
      onUpdate(row.id, { status: 'stopped', statusMessage: 'Stopped locally', _loading: false })
      return
    }
    onUpdate(row.id, { _loading: true })
    try {
      await stopSimulation(row.remoteTaskId)
      onUpdate(row.id, { status: 'stopped', statusMessage: 'Simulation stopped', _loading: false })
    } catch (err) {
      onUpdate(row.id, {
        status: 'error',
        statusMessage: err?.message || 'Failed to stop',
        _loading: false,
      })
    }
  }

  const handleDelete = async () => {
    if (row.status === 'running' && row.remoteTaskId) {
      try { await stopSimulation(row.remoteTaskId) } catch { /* ignore */ }
    }
    if (row.remoteTaskId) {
      try { await deleteSimulation(row.remoteTaskId) } catch { /* ignore */ }
    }
    onDelete(row.id)
  }

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      {/* # */}
      <td style={tdStyle({ width: 36, textAlign: 'center', color: 'var(--muted)', fontSize: 12 })}>
        {index + 1}
      </td>

      {/* Format + Sample Message */}
      <td style={tdStyle({ minWidth: 280, verticalAlign: 'top' })}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <select
            value={row.messageFormat}
            onChange={handleFormatChange}
            disabled={isRunning || isLoading}
            style={{
              width: '100%',
              padding: '5px 8px',
              background: 'var(--surf2)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text)',
              fontSize: 12,
            }}
          >
            {MESSAGE_FORMATS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <SampleMessageEditor
            value={row.sampleMessage}
            onChange={(v) => update('sampleMessage', v)}
            disabled={isRunning || isLoading}
            messageFormat={row.messageFormat}
          />
        </div>
      </td>

      {/* Messages / second */}
      <td style={tdStyle({ width: 110 })}>
        <input
          type="number"
          min="1"
          max="10000"
          value={row.messagesPerSecond}
          onChange={e => update('messagesPerSecond', Math.max(1, Number(e.target.value)))}
          disabled={isRunning || isLoading}
          style={numInputStyle()}
        />
      </td>

      {/* Total messages */}
      <td style={tdStyle({ width: 120 })}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <input
            type="number"
            min="-1"
            value={row.totalMessages}
            onChange={e => update('totalMessages', Number(e.target.value))}
            disabled={isRunning || isLoading}
            style={numInputStyle()}
          />
          {row.totalMessages === -1 && (
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>∞ Unlimited</span>
          )}
        </div>
      </td>

      {/* Interval */}
      <td style={tdStyle({ width: 150 })}>
        <select
          value={row.intervalSeconds}
          onChange={e => update('intervalSeconds', Number(e.target.value))}
          disabled={isRunning || isLoading}
          style={{
            width: '100%',
            padding: '6px 8px',
            background: 'var(--surf2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text)',
            fontSize: 12,
          }}
        >
          {INTERVAL_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </td>

      {/* Status */}
      <td style={tdStyle({ width: 100 })}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          <StatusBadge status={row.status} />
          {row.status === 'running' && row.sentCount > 0 && (
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>
              {row.sentCount.toLocaleString()} sent
            </span>
          )}
          {row.statusMessage && (
            <span style={{
              fontSize: 10,
              color: row.status === 'error' ? 'var(--danger)' : 'var(--muted)',
              maxWidth: 90,
              wordBreak: 'break-word',
            }}>
              {row.statusMessage}
            </span>
          )}
        </div>
      </td>

      {/* Actions */}
      <td style={tdStyle({ width: 130, textAlign: 'right' })}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {!isRunning ? (
            <Btn
              v="success"
              sm
              disabled={isLoading || !isTopicValid}
              onClick={handleStart}
            >
              {isLoading ? '⏳' : '▶'} Start
            </Btn>
          ) : (
            <Btn
              v="danger"
              sm
              disabled={isLoading}
              onClick={handleStop}
            >
              {isLoading ? '⏳' : '■'} Stop
            </Btn>
          )}
          <Btn
            v="ghost"
            sm
            disabled={isLoading}
            onClick={handleDelete}
            style={{ padding: '5px 10px', color: 'var(--danger)' }}
          >
            🗑 Remove
          </Btn>
        </div>
      </td>
    </tr>
  )
}

// ── Style helpers ─────────────────────────────────────────────────────────

function tdStyle(extra = {}) {
  return {
    padding: '10px 10px',
    verticalAlign: 'middle',
    ...extra,
  }
}

function numInputStyle() {
  return {
    width: '100%',
    padding: '6px 8px',
    background: 'var(--surf2)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text)',
    fontSize: 12,
    boxSizing: 'border-box',
  }
}

// ── Main Screen ───────────────────────────────────────────────────────────

export default function KafkaSimulatorScreen() {
  const { state, actions } = useWizard()
  const brokerEnv = state.simulator?.brokerEnv ?? ''
  const topic = state.simulator?.topic ?? ''
  const rows = state.simulator?.rows ?? [createEmptySimulatorRow()]
  const connTest = state.simulator?.connTest ?? null

  const updateSimulator = useCallback((patch) => {
    actions.updateSimulator(patch)
  }, [actions])

  const isTopicValid = Boolean(brokerEnv.trim() && topic.trim())

  const handleTestConnection = async () => {
    if (!brokerEnv || !topic.trim()) return
    updateSimulator({ connTest: { status: 'testing', message: 'Connecting…' } })
    try {
      const result = await testKafkaConnection(brokerEnv, topic.trim())
      updateSimulator({ connTest: {
        status: result.topicExists === false ? 'warn' : 'ok',
        message: result.message,
        brokerAddress: result.brokerAddress,
        latencyMs: result.latencyMs,
        topicExists: result.topicExists,
        partitionCount: result.partitionCount,
      } })
    } catch (err) {
      updateSimulator({ connTest: { status: 'error', message: err?.message || 'Connection failed' } })
    }
  }

  const addRow = () => updateSimulator(current => ({
    rows: [...(current?.rows ?? []), createEmptySimulatorRow()],
  }))

  const updateRow = useCallback((id, patch) => {
    updateSimulator(current => ({
      rows: (current?.rows ?? []).map(r => r.id === id ? { ...r, ...patch } : r),
    }))
  }, [updateSimulator])

  const deleteRow = useCallback((id) => {
    updateSimulator(current => ({
      rows: (current?.rows ?? []).filter(r => r.id !== id),
    }))
  }, [updateSimulator])

  const stopAll = async () => {
    const running = rows.filter(r => r.status === 'running')
    await Promise.allSettled(
      running.map(r =>
        stopSimulation(r.remoteTaskId).then(() =>
          updateRow(r.id, { status: 'stopped', statusMessage: 'Stopped' })
        ).catch(err =>
          updateRow(r.id, { status: 'error', statusMessage: err?.message || 'Stop failed' })
        )
      )
    )
  }

  const runningCount = rows.filter(r => r.status === 'running').length

  // ── Poll backend for status updates on running tasks ──────────────────────
  const rowsRef = useRef(rows)
  rowsRef.current = rows

  useEffect(() => {
    if (runningCount === 0) return
    const POLL_MS = 3000
    const intervalId = setInterval(async () => {
      const running = rowsRef.current.filter(r => r.status === 'running' && r.remoteTaskId)
      await Promise.allSettled(
        running.map(async (r) => {
          try {
            const s = await getSimulationStatus(r.remoteTaskId)
            updateRow(r.id, {
              status:        s.status === 'running' ? 'running' : s.status,
              sentCount:     s.sentCount,
              statusMessage: s.statusMessage || (s.status === 'completed' ? 'Completed' : ''),
            })
          } catch {
            // silently ignore transient poll errors
          }
        })
      )
    }, POLL_MS)
    return () => clearInterval(intervalId)
  }, [runningCount, updateRow])

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 30px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10 }}>
            📡 Kafka Simulator
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            Publish test messages to a Kafka topic at controlled rates
          </div>
        </div>
        {runningCount > 0 && (
          <Btn v="danger" onClick={stopAll}>
            ■ Stop All ({runningCount})
          </Btn>
        )}
      </div>

      {/* Broker Config */}
      <Card>
        <CardTitle>🔧 Kafka Broker</CardTitle>
        <FormRow>
          <FormGroup label="Broker Environment" required>
            <select
              aria-label="Broker Environment"
              value={brokerEnv}
              onChange={e => updateSimulator({ brokerEnv: e.target.value, connTest: null })}
            >
              <option value="">Select environment…</option>
              {ENVIRONMENT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </FormGroup>
          <FormGroup label="Kafka Topic" required>
            <input
              aria-label="Kafka Topic"
              value={topic}
              onChange={e => updateSimulator({ topic: e.target.value })}
              placeholder="e.g. my-events-topic"
            />
          </FormGroup>
        </FormRow>

        {/* Test Connection row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <Btn
            v="secondary"
            sm
            disabled={!isTopicValid || connTest?.status === 'testing'}
            onClick={handleTestConnection}
          >
            {connTest?.status === 'testing' ? '⏳ Testing…' : '🔌 Test Connection'}
          </Btn>

          {connTest && connTest.status !== 'testing' && (
            <span style={{
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: connTest.status === 'ok' ? 'var(--success)'
                   : connTest.status === 'warn' ? 'var(--warning, #f59e0b)'
                   : 'var(--danger)',
            }}>
              {connTest.status === 'ok' ? '✔' : connTest.status === 'warn' ? '⚠' : '✖'} {connTest.message}
              {connTest.status === 'ok' && (
                <span style={{ color: 'var(--muted)' }}>
                  ({connTest.brokerAddress}{connTest.latencyMs != null ? ` · ${connTest.latencyMs} ms` : ''}
                  {connTest.partitionCount != null ? ` · ${connTest.partitionCount} partition${connTest.partitionCount !== 1 ? 's' : ''}` : ''})
                </span>
              )}
              {connTest.status === 'warn' && (
                <span style={{ color: 'var(--muted)' }}>— topic does not exist yet</span>
              )}
            </span>
          )}
        </div>

        {!isTopicValid && !connTest && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
            ⚠ Select an environment and enter a topic to enable simulations.
          </div>
        )}
      </Card>

      {/* Simulation Tasks Table */}
      <Card p="0">
        <div style={{ padding: '16px 20px 12px' }}>
          <CardTitle style={{ marginBottom: 0 }}>
            📋 Simulation Tasks
            {runningCount > 0 && (
              <Chip c="green" style={{ marginLeft: 8 }}>{runningCount} running</Chip>
            )}
          </CardTitle>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--surf2)' }}>
                <Th style={{ width: 36, textAlign: 'center' }}>#</Th>
                <Th>Format / Sample Message</Th>
                <Th style={{ width: 110 }}>Msgs / sec</Th>
                <Th style={{ width: 120 }}>Total Messages<br /><span style={{ fontSize: 10, fontWeight: 400 }}>(-1 = unlimited)</span></Th>
                <Th style={{ width: 150 }}>Send Interval</Th>
                <Th style={{ width: 100 }}>Status</Th>
                <Th style={{ width: 130, textAlign: 'right' }}>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                    No tasks yet. Click <strong>+ Add Task</strong> to create one.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <SimulatorRow
                    key={row.id}
                    row={row}
                    index={idx}
                    brokerEnv={brokerEnv}
                    topic={topic}
                    onUpdate={updateRow}
                    onDelete={deleteRow}
                    isTopicValid={isTopicValid}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <Btn v="secondary" sm onClick={addRow}>
            + Add Task
          </Btn>
        </div>
      </Card>

      {/* Legend */}
      <Card>
        <CardTitle>ℹ️ Notes</CardTitle>
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--muted)', fontSize: 13, lineHeight: 2 }}>
          <li><strong>Format</strong> – choose JSON, CSV, XML, Protobuf, or Plain Text. JSON is validated in real time.</li>
          <li><strong>Sample Message</strong> – payload template sent as the Kafka message value. Supports <code>{'{{uuid}}'}</code> and <code>{'{{now}}'}</code> placeholders.</li>
          <li><strong>Msgs / sec</strong> – number of messages published per second within each burst.</li>
          <li><strong>Total Messages</strong> – total count across all intervals. Use <code>-1</code> for unlimited streaming.</li>
          <li><strong>Send Interval</strong> – how often a burst of messages is triggered (e.g. every 5 seconds). <em>Once</em> sends a single burst and stops.</li>
          <li>You can run multiple tasks targeting the same or different topics simultaneously.</li>
        </ul>
      </Card>
    </div>
  )
}

function Th({ children, style = {} }) {
  return (
    <th style={{
      padding: '10px 10px',
      textAlign: 'left',
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {children}
    </th>
  )
}

