import { API_BASE } from './appConfig.js'
import { fetchWithUserId } from './requestHeaders.js'

const RABBITMQ_TEST_CONNECTION_PATH = `${API_BASE}/backend/rabbitmq/test-connection`

export function buildRabbitMqTestConnectionUrl({ ip, port, username, password, queue, vhost, exchange, environment }) {
  const url = new URL(RABBITMQ_TEST_CONNECTION_PATH)
  const normalizedIp = String(ip ?? '').trim()
  const normalizedPort = String(port ?? '').trim()
  const normalizedUsername = String(username ?? '').trim()
  const normalizedPassword = String(password ?? '').trim()
  const normalizedQueue = String(queue ?? '').trim()
  const normalizedVhost = String(vhost ?? '').trim()

  const normalizedExchange = String(exchange ?? '').trim()
  const normalizedEnvironment = String(environment ?? '').trim()

  if (normalizedVhost) {
    url.searchParams.set('vhost', normalizedVhost)
  }

  if (normalizedPort) {
    url.searchParams.set('port', normalizedPort)
  }

  if (normalizedQueue) {
    url.searchParams.set('queueName', normalizedQueue)
  }

  if (normalizedIp) {
    url.searchParams.set('ip', normalizedIp)
  }

  if (normalizedUsername) {
    url.searchParams.set('username', normalizedUsername)
  }

  if (normalizedPassword) {
    url.searchParams.set('password', normalizedPassword)
  }

  if (normalizedExchange) {
    url.searchParams.set('exchange', normalizedExchange)
  }

  if (normalizedEnvironment) {
    url.searchParams.set('environment', normalizedEnvironment)
  }

  return url.toString()
}

async function readResponsePayload(response) {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    try {
      return await response.json()
    } catch {
      return null
    }
  }

  try {
    const text = await response.text()
    return text || null
  } catch {
    return null
  }
}

function normalizeResponseMessage(payload, fallbackMessage) {
  if (typeof payload === 'string') {
    return payload.trim() || fallbackMessage
  }

  if (payload && typeof payload === 'object') {
    const message = payload.message ?? payload.error ?? payload.details ?? payload.status
    if (message != null) return String(message).trim() || fallbackMessage
  }

  return fallbackMessage
}

export async function testRabbitMqConnection({ ip, port, username, password, queue, vhost, exchange, environment }) {
  const normalizedIp = String(ip ?? '').trim()
  const normalizedVhost = String(vhost ?? '').trim()
  const normalizedPort = String(port ?? '').trim()
  const normalizedUsername = String(username ?? '').trim()
  const normalizedPassword = String(password ?? '').trim()
  const normalizedQueue = String(queue ?? '').trim()

  if (!normalizedPort || !normalizedQueue) {
    throw new Error('Port and queue name are required.')
  }

  const response = await fetchWithUserId(buildRabbitMqTestConnectionUrl({
    ip: normalizedIp,
    vhost: normalizedVhost,
    port: normalizedPort,
    username: normalizedUsername,
    password: normalizedPassword,
    queue: normalizedQueue,
    exchange,
    environment,
  }), {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain',
    },
  })

  const payload = await readResponsePayload(response)

  if (!response.ok) {
    throw new Error(normalizeResponseMessage(payload, `RabbitMQ connection test failed with status: ${response.status}`))
  }

  if (payload && typeof payload === 'object' && payload.success === false) {
    throw new Error(normalizeResponseMessage(payload, 'RabbitMQ connection test failed.'))
  }

  return {
    success: true,
    message: normalizeResponseMessage(payload, 'RabbitMQ connection succeeded.'),
    payload,
  }
}



