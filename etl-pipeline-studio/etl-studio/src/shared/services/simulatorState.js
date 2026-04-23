export const DEFAULT_SIMULATOR_SAMPLES = {
  json: JSON.stringify({ id: '{{uuid}}', timestamp: '{{now}}', value: '{{value}}' }, null, 2),
  csv: '{{uuid}},{{now}},{{value}}',
  xml: '<event>\n  <id>{{uuid}}</id>\n  <timestamp>{{now}}</timestamp>\n  <value>{{value}}</value>\n</event>',
  protobuf: '// Protobuf binary is base64-encoded below\nCgMxMjMQKhj///////8B',
  plain: 'Event id={{uuid}} at {{now}} value={{value}}',
}

export function createEmptySimulatorRow() {
  return {
    id: crypto.randomUUID(),
    messageFormat: 'json',
    sampleMessage: DEFAULT_SIMULATOR_SAMPLES.json,
    messagesPerSecond: 1,
    totalMessages: 10,
    intervalSeconds: 1,
    status: 'idle',
    statusMessage: '',
    remoteTaskId: null,
    sentCount: 0,
  }
}

export function normalizeSimulatorRow(row = {}) {
  const messageFormat = typeof row?.messageFormat === 'string' && row.messageFormat.trim()
    ? row.messageFormat.trim()
    : 'json'

  const defaultRow = createEmptySimulatorRow()

  return {
    ...defaultRow,
    ...row,
    id: row?.id == null ? defaultRow.id : String(row.id),
    messageFormat,
    sampleMessage: row?.sampleMessage == null || row.sampleMessage === ''
      ? (DEFAULT_SIMULATOR_SAMPLES[messageFormat] ?? '')
      : String(row.sampleMessage),
    messagesPerSecond: Number.isFinite(Number(row?.messagesPerSecond)) ? Math.max(1, Number(row.messagesPerSecond)) : defaultRow.messagesPerSecond,
    totalMessages: Number.isFinite(Number(row?.totalMessages)) ? Number(row.totalMessages) : defaultRow.totalMessages,
    intervalSeconds: Number.isFinite(Number(row?.intervalSeconds)) ? Number(row.intervalSeconds) : defaultRow.intervalSeconds,
    status: typeof row?.status === 'string' && row.status.trim() ? row.status.trim() : defaultRow.status,
    statusMessage: row?.statusMessage == null ? '' : String(row.statusMessage),
    remoteTaskId: row?.remoteTaskId == null || row.remoteTaskId === '' ? null : String(row.remoteTaskId),
    sentCount: Number.isFinite(Number(row?.sentCount)) ? Math.max(0, Number(row.sentCount)) : 0,
    _loading: row?._loading === true,
  }
}

export function buildDefaultSimulatorState() {
  return {
    brokerEnv: '',
    topic: '',
    rows: [createEmptySimulatorRow()],
    connTest: null,
  }
}

export function normalizeSimulatorState(simulator = {}, fallbackState = buildDefaultSimulatorState(), { resetTransient = false } = {}) {
  const safeState = simulator && typeof simulator === 'object' ? simulator : {}
  const rows = Array.isArray(safeState.rows)
    ? safeState.rows.map(normalizeSimulatorRow)
    : Array.isArray(fallbackState.rows)
      ? fallbackState.rows.map(normalizeSimulatorRow)
      : []

  const connTest = safeState.connTest && typeof safeState.connTest === 'object' && (!resetTransient || safeState.connTest.status !== 'testing')
    ? {
        status: String(safeState.connTest.status ?? ''),
        message: safeState.connTest.message == null ? '' : String(safeState.connTest.message),
        brokerAddress: safeState.connTest.brokerAddress == null ? null : String(safeState.connTest.brokerAddress),
        latencyMs: Number.isFinite(Number(safeState.connTest.latencyMs)) ? Number(safeState.connTest.latencyMs) : null,
        topicExists: typeof safeState.connTest.topicExists === 'boolean' ? safeState.connTest.topicExists : null,
        partitionCount: Number.isFinite(Number(safeState.connTest.partitionCount)) ? Number(safeState.connTest.partitionCount) : null,
      }
    : null

  return {
    brokerEnv: safeState.brokerEnv == null ? String(fallbackState.brokerEnv ?? '') : String(safeState.brokerEnv),
    topic: safeState.topic == null ? String(fallbackState.topic ?? '') : String(safeState.topic),
    rows: rows.length > 0 ? rows : [createEmptySimulatorRow()],
    connTest,
  }
}


