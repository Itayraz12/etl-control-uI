const API_BASE = 'http://localhost:8080/api'
const KAFKA_TEST_CONNECTION_PATH = `${API_BASE}/backend/kafka/test-connection`

export function buildKafkaTestConnectionUrl({ topic, environment }) {
  const url = new URL(KAFKA_TEST_CONNECTION_PATH)
  url.searchParams.set('topicName', String(topic ?? '').trim())
  url.searchParams.set('environment', String(environment ?? '').trim())
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

export async function testKafkaConnection({ topic, environment }) {
  const normalizedTopic = String(topic ?? '').trim()
  const normalizedEnvironment = String(environment ?? '').trim()

  if (!normalizedTopic || !normalizedEnvironment) {
    throw new Error('Topic and environment are required.')
  }

  const response = await fetch(buildKafkaTestConnectionUrl({
    topic: normalizedTopic,
    environment: normalizedEnvironment,
  }), {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain',
    },
  })

  const payload = await readResponsePayload(response)

  if (!response.ok) {
    throw new Error(normalizeResponseMessage(payload, `Kafka connection test failed with status: ${response.status}`))
  }

  if (payload && typeof payload === 'object' && payload.success === false) {
    throw new Error(normalizeResponseMessage(payload, 'Kafka connection test failed.'))
  }

  return {
    success: true,
    message: normalizeResponseMessage(payload, 'Kafka connection succeeded.'),
    payload,
  }
}


