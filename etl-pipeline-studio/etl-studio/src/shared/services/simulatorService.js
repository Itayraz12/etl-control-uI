import { API_BASE } from './appConfig.js'
import { fetchWithUserId } from './requestHeaders.js'

const SIMULATOR_BASE = `${API_BASE}/simulator/kafka`

async function readPayload(response) {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try { return await response.json() } catch { return null }
  }
  try { const t = await response.text(); return t || null } catch { return null }
}

function normalizeMessage(payload, fallback) {
  if (typeof payload === 'string') return payload.trim() || fallback
  if (payload && typeof payload === 'object') {
    const m = payload.message ?? payload.error ?? payload.details
    if (m != null) return String(m).trim() || fallback
  }
  return fallback
}

/**
 * Test connectivity to a Kafka broker environment and verify a topic exists.
 * POST /api/simulator/kafka/test-connection
 *
 * Body: { environment: string, topic: string }
 */
export async function testKafkaConnection(environment, topic) {
  const response = await fetchWithUserId(`${SIMULATOR_BASE}/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ environment, topic }),
  })
  const payload = await readPayload(response)
  if (!response.ok) {
    throw new Error(normalizeMessage(payload, `Connection failed (${response.status})`))
  }
  return {
    success: true,
    brokerAddress: payload?.brokerAddress ?? null,
    latencyMs: payload?.latencyMs ?? null,
    topicExists: payload?.topicExists ?? null,
    partitionCount: payload?.partitionCount ?? null,
    message: normalizeMessage(payload, 'Connection successful'),
  }
}

/**
 * Start a Kafka simulation task.
 * POST /api/simulator/kafka/start
 *
 * Body:
 * {
 *   topic:              string,  // Kafka topic name
 *   environment:        string,  // HOME | OFFICE
 *   messageFormat:      string,  // json | csv | xml | protobuf | plain
 *   sampleMessage:      string,  // payload template with {{uuid}}, {{now}}, {{value}}
 *   messagesPerSecond:  number,  // >= 1, max 10000
 *   totalMessages:      number,  // >= 1, or -1 for unlimited
 *   intervalSeconds:    number,  // 0 = send once; >0 = repeat every N seconds
 * }
 */
export async function startSimulation(task) {
  const response = await fetchWithUserId(`${SIMULATOR_BASE}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(task),
  })
  const payload = await readPayload(response)
  if (!response.ok) {
    throw new Error(normalizeMessage(payload, `Failed to start simulation (${response.status})`))
  }
  return { success: true, taskId: payload?.taskId ?? payload?.id ?? null, payload }
}

/**
 * Stop a running Kafka simulation task.
 * POST /api/simulator/kafka/stop/{taskId}
 */
export async function stopSimulation(taskId) {
  const response = await fetchWithUserId(`${SIMULATOR_BASE}/stop/${encodeURIComponent(taskId)}`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  })
  const payload = await readPayload(response)
  if (!response.ok) {
    throw new Error(normalizeMessage(payload, `Failed to stop simulation (${response.status})`))
  }
  return { success: true, payload }
}

/**
 * Get all active simulation tasks.
 * GET /api/simulator/kafka/tasks
 */
export async function getSimulationTasks() {
  const response = await fetchWithUserId(`${SIMULATOR_BASE}/tasks`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const payload = await readPayload(response)
  if (!response.ok) {
    throw new Error(normalizeMessage(payload, `Failed to fetch simulation tasks (${response.status})`))
  }
  return Array.isArray(payload) ? payload : (payload?.tasks ?? [])
}

/**
 * Get current status of a single simulation task.
 * GET /api/simulator/kafka/status/{taskId}
 *
 * Response: { taskId, status, sentCount, statusMessage, completedAt? }
 */
export async function getSimulationStatus(taskId) {
  const response = await fetchWithUserId(`${SIMULATOR_BASE}/status/${encodeURIComponent(taskId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const payload = await readPayload(response)
  if (!response.ok) {
    throw new Error(normalizeMessage(payload, `Failed to get status (${response.status})`))
  }
  return {
    taskId,
    status:        payload?.status        ?? 'unknown',
    sentCount:     payload?.sentCount     ?? 0,
    statusMessage: payload?.statusMessage ?? payload?.message ?? '',
  }
}

/**
 * Delete / remove a simulation task permanently.
 * DELETE /api/simulator/kafka/tasks/{taskId}
 */
export async function deleteSimulation(taskId) {
  const response = await fetchWithUserId(`${SIMULATOR_BASE}/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  })
  const payload = await readPayload(response)
  if (!response.ok) {
    throw new Error(normalizeMessage(payload, `Failed to delete simulation (${response.status})`))
  }
  return { success: true, payload }
}

