import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteSimulationPlan, getSimulationPlan, getSimulationPlans, saveSimulationPlan } from './simulatorService.js'
import { writePersistedActiveUser } from '../store/userSessionPersistence.js'

describe('simulatorService', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    localStorage.clear()
    writePersistedActiveUser({ userId: 'user-123', teamName: 'data-platform' })
  })

  it('saves a task plan with id/name and normalized task details', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      plan: {
        id: 'plan-1',
        name: 'Nightly Smoke',
        brokerEnv: 'CAP',
        topic: 'sim-topic',
        rows: [],
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(saveSimulationPlan({
      id: 'plan-1',
      name: 'Nightly Smoke',
      simulator: {
        brokerEnv: 'CAP',
        topic: 'sim-topic',
        connTest: { status: 'ok', message: 'Connected' },
        rows: [
          {
            id: 'row-1',
            messageFormat: 'json',
            sampleMessage: '{"id":"1"}',
            messagesPerSecond: 5,
            totalMessages: 50,
            intervalSeconds: 5,
            status: 'running',
            statusMessage: 'Running',
            remoteTaskId: 'remote-1',
            sentCount: 123,
            _loading: true,
          },
        ],
      },
    })).resolves.toEqual({
      id: 'plan-1',
      name: 'Nightly Smoke',
      brokerEnv: 'CAP',
      topic: 'sim-topic',
      rows: [expect.objectContaining({ messageFormat: 'json' })],
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/simulator/kafka/task-plans',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-user-ID': 'user-123',
        },
      }),
    )

    const [, requestInit] = fetchMock.mock.calls[0]
    expect(JSON.parse(requestInit.body)).toEqual({
      id: 'plan-1',
      name: 'Nightly Smoke',
      brokerEnv: 'CAP',
      topic: 'sim-topic',
      rows: [
        {
          id: 'row-1',
          messageFormat: 'json',
          sampleMessage: '{"id":"1"}',
          messagesPerSecond: 5,
          totalMessages: 50,
          intervalSeconds: 5,
        },
      ],
    })
  })

  it('lists all saved task plans by normalized id/name', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      plans: [
        { planId: 'plan-2', planName: 'Burst Load' },
        { id: 'plan-1', name: 'Nightly Smoke' },
      ],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(getSimulationPlans()).resolves.toEqual([
      { id: 'plan-2', name: 'Burst Load' },
      { id: 'plan-1', name: 'Nightly Smoke' },
    ])

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/simulator/kafka/task-plans',
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-user-ID': 'user-123',
        },
      },
    )
  })

  it('loads a task plan by id/name and clears runtime-only row state', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      plan: {
        planId: 'plan-2',
        planName: 'Burst Load',
        simulator: {
          environment: 'HOME',
          topic: 'burst-topic',
          tasks: [
            {
              id: 'row-2',
              messageFormat: 'csv',
              sampleMessage: 'a,b,c',
              messagesPerSecond: 3,
              totalMessages: 25,
              intervalSeconds: 10,
              status: 'running',
              statusMessage: 'Running',
              remoteTaskId: 'remote-2',
              sentCount: 77,
              _loading: true,
            },
          ],
        },
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(getSimulationPlan({ id: 'plan-2', name: 'Burst Load' })).resolves.toEqual({
      id: 'plan-2',
      name: 'Burst Load',
      brokerEnv: 'HOME',
      topic: 'burst-topic',
      rows: [
        expect.objectContaining({
          id: 'row-2',
          messageFormat: 'csv',
          sampleMessage: 'a,b,c',
          messagesPerSecond: 3,
          totalMessages: 25,
          intervalSeconds: 10,
          status: 'idle',
          statusMessage: '',
          remoteTaskId: null,
          sentCount: 0,
          _loading: false,
        }),
      ],
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/simulator/kafka/task-plans/resolve?id=plan-2&name=Burst+Load',
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-user-ID': 'user-123',
        },
      },
    )
  })

  it('deletes a saved task plan by id/name', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(deleteSimulationPlan({ id: 'plan-4', name: 'Cleanup Plan' })).resolves.toEqual({
      success: true,
      payload: { success: true },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/simulator/kafka/task-plans/resolve?id=plan-4&name=Cleanup+Plan',
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          'X-user-ID': 'user-123',
        },
      },
    )
  })
})

