import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deployFromYaml } from './deploymentsService.js'

describe('deploymentsService', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('returns the backend payload when deployment starts successfully', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, deploymentId: 'run-123' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(deployFromYaml('pipeline: test')).resolves.toEqual({
      success: true,
      deploymentId: 'run-123',
    })

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/api/backend/deployments/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'pipeline: test',
    })
  })

  it('returns a user-friendly 404 failure with backend detail', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'No static resource api/backend/deployments/deploy.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(deployFromYaml('pipeline: test')).resolves.toEqual({
      success: false,
      error: 'The deployment API endpoint was not found. Verify that the backend server is running and that POST /api/backend/deployments/deploy is available. Backend response: No static resource api/backend/deployments/deploy.',
    })
  })
})