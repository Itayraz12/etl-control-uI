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

function normalizeSimulatorPlanField(value) {
  return value == null ? '' : String(value).trim()
}

export function normalizeSimulatorRow(row = {}, { resetTransient = false } = {}) {
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
    status: resetTransient
      ? defaultRow.status
      : (typeof row?.status === 'string' && row.status.trim() ? row.status.trim() : defaultRow.status),
    statusMessage: resetTransient ? '' : (row?.statusMessage == null ? '' : String(row.statusMessage)),
    remoteTaskId: resetTransient
      ? null
      : (row?.remoteTaskId == null || row.remoteTaskId === '' ? null : String(row.remoteTaskId)),
    sentCount: resetTransient ? 0 : (Number.isFinite(Number(row?.sentCount)) ? Math.max(0, Number(row.sentCount)) : 0),
    _loading: resetTransient ? false : row?._loading === true,
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
    ? safeState.rows.map(row => normalizeSimulatorRow(row, { resetTransient }))
    : Array.isArray(fallbackState.rows)
      ? fallbackState.rows.map(row => normalizeSimulatorRow(row, { resetTransient }))
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

export function buildSimulationPlanPayload({ id = '', name = '', simulator = {} } = {}) {
  const normalizedSimulator = normalizeSimulatorState(simulator, buildDefaultSimulatorState(), { resetTransient: true })

  return {
    id: normalizeSimulatorPlanField(id),
    name: normalizeSimulatorPlanField(name),
    brokerEnv: normalizedSimulator.brokerEnv,
    topic: normalizedSimulator.topic,
    rows: normalizedSimulator.rows.map(row => ({
      id: row.id,
      messageFormat: row.messageFormat,
      sampleMessage: row.sampleMessage,
      messagesPerSecond: row.messagesPerSecond,
      totalMessages: row.totalMessages,
      intervalSeconds: row.intervalSeconds,
    })),
  }
}

export function normalizeSimulationPlanSummary(plan = {}) {
  return {
    id: normalizeSimulatorPlanField(plan?.id ?? plan?.planId),
    name: normalizeSimulatorPlanField(plan?.name ?? plan?.planName),
  }
}

export function normalizeSimulationPlans(plans = []) {
  return (Array.isArray(plans) ? plans : [])
    .map(normalizeSimulationPlanSummary)
    .filter(plan => plan.id || plan.name)
    .sort((left, right) => {
      const leftKey = `${left.name.toLowerCase()}::${left.id.toLowerCase()}`
      const rightKey = `${right.name.toLowerCase()}::${right.id.toLowerCase()}`
      return leftKey.localeCompare(rightKey)
    })
}

export function normalizeSimulationPlanDetails(plan = {}) {
  const sourcePlan = plan?.plan && typeof plan.plan === 'object' ? plan.plan : plan
  const simulatorSource = sourcePlan?.simulator && typeof sourcePlan.simulator === 'object'
    ? sourcePlan.simulator
    : sourcePlan
  const normalizedSimulator = normalizeSimulatorState({
    brokerEnv: simulatorSource?.brokerEnv ?? simulatorSource?.environment ?? '',
    topic: simulatorSource?.topic ?? '',
    rows: simulatorSource?.rows ?? simulatorSource?.tasks ?? [],
    connTest: null,
  }, buildDefaultSimulatorState(), { resetTransient: true })

  return {
    ...normalizeSimulationPlanSummary(sourcePlan),
    brokerEnv: normalizedSimulator.brokerEnv,
    topic: normalizedSimulator.topic,
    rows: normalizedSimulator.rows,
  }
}


