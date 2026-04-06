import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRabbitMqTestConnectionUrl, testRabbitMqConnection } from './rabbitmqService.js'
import { writePersistedActiveUser } from '../store/userSessionPersistence.js'

describe('rabbitmqService', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    localStorage.clear()
    writePersistedActiveUser({ userId: 'user-123', teamName: 'data-platform' })
  })

  it('builds the RabbitMQ connection test URL with encoded request params', () => {
    expect(buildRabbitMqTestConnectionUrl({
      vhost: '/etl ingest',
      port: '5672',
      queue: 'orders.retry',
      exchange: 'etl.exchange',
      environment: 'prod blue',
    })).toBe('http://localhost:8080/api/backend/rabbitmq/test-connection?vhost=%2Fetl+ingest&port=5672&queueName=orders.retry&exchange=etl.exchange&environment=prod+blue')
  })

  it('returns a normalized success payload when the backend responds successfully', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, message: 'RabbitMQ reachable' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(testRabbitMqConnection({
      vhost: '/etl',
      port: '5672',
      queue: 'orders.retry',
      exchange: 'etl.exchange',
      environment: 'production',
    })).resolves.toEqual(expect.objectContaining({
      success: true,
      message: 'RabbitMQ reachable',
      payload: { success: true, message: 'RabbitMQ reachable' },
    }))

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/api/backend/rabbitmq/test-connection?vhost=%2Fetl&port=5672&queueName=orders.retry&exchange=etl.exchange&environment=production', {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain',
        'X-user-ID': 'user-123',
      },
    })
  })

  it('throws the backend text body when the request fails', async () => {
    fetchMock.mockResolvedValue(new Response('RabbitMQ broker unreachable', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    }))

    await expect(testRabbitMqConnection({
      vhost: '/etl',
      port: '5672',
      queue: 'orders.retry',
    })).rejects.toThrow('RabbitMQ broker unreachable')
  })

  it('treats a success=false JSON payload as a failed connection test', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: false, message: 'Queue not found' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(testRabbitMqConnection({
      vhost: '/etl',
      port: '5672',
      queue: 'orders.retry',
    })).rejects.toThrow('Queue not found')
  })
})

