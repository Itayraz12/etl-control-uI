import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildKafkaTestConnectionUrl, testKafkaConnection } from './kafkaService.js'
import { writePersistedActiveUser } from '../store/userSessionPersistence.js'

describe('kafkaService', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    localStorage.clear()
    writePersistedActiveUser({ userId: 'user-123', teamName: 'data-platform' })
  })

  it('builds the Kafka connection test URL with encoded request params', () => {
    expect(buildKafkaTestConnectionUrl({
      topic: 'orders.v1',
      environment: 'prod blue',
    })).toBe('http://localhost:8080/api/backend/kafka/test-connection?topicName=orders.v1&environment=prod+blue')
  })

  it('returns a normalized success payload when the backend responds successfully', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, message: 'Kafka reachable' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(testKafkaConnection({ topic: 'orders.v1', environment: 'PROD' })).resolves.toEqual(
      expect.objectContaining({
        success: true,
        message: 'Kafka reachable',
        payload: { success: true, message: 'Kafka reachable' },
      })
    )

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/api/backend/kafka/test-connection?topicName=orders.v1&environment=PROD', {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain',
        'X-user-ID': 'user-123',
      },
    })
  })

  it('throws the backend text body when the request fails', async () => {
    fetchMock.mockResolvedValue(new Response('Broker unreachable', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    }))

    await expect(testKafkaConnection({ topic: 'orders.v1', environment: 'PROD' })).rejects.toThrow('Broker unreachable')
  })

  it('treats a success=false JSON payload as a failed connection test', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: false, message: 'Topic not found' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(testKafkaConnection({ topic: 'orders.v1', environment: 'PROD' })).rejects.toThrow('Topic not found')
  })
})


