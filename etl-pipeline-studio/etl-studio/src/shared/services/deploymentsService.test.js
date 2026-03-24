import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDeployment, deployFromYaml, fetchDeployments, setDeploymentStatus, upsertSavedDraftDeployment } from './deploymentsService.js'

describe('deploymentsService', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    localStorage.clear()
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

  it('includes a newly saved local draft in the management deployments list', async () => {
    upsertSavedDraftDeployment({
      teamName: 'data-platform',
      productSource: 'ERP',
      productType: 'Catalog',
      environment: 'production',
      savedVersion: '1.0',
    })

    fetchMock.mockResolvedValue(new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(fetchDeployments('data-platform', false)).resolves.toEqual([
      expect.objectContaining({
        id: 'local-draft:data-platform::erp::catalog::production',
        productSource: 'ERP',
        productType: 'Catalog',
        environment: 'production',
        deploymentStatus: 'draft',
        savedVersion: '1.0',
        isLocalDraft: true,
      }),
    ])
  })

  it('deletes a local-only draft row without calling the backend', async () => {
    upsertSavedDraftDeployment({
      teamName: 'data-platform',
      productSource: 'ERP',
      productType: 'Catalog',
      environment: 'production',
    })

    await expect(deleteDeployment('local-draft:data-platform::erp::catalog::production', false)).resolves.toEqual({
      success: true,
      id: 'local-draft:data-platform::erp::catalog::production',
    })

    expect(fetchMock).not.toHaveBeenCalled()

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(fetchDeployments('data-platform', false)).resolves.toEqual([])
  })

  it('applies persisted failed status overrides to matching backend rows', async () => {
    setDeploymentStatus({
      teamName: 'data-platform',
      productSource: 'ERP',
      productType: 'Catalog',
      environment: 'production',
      deploymentStatus: 'failed',
    })

    fetchMock.mockResolvedValue(new Response(JSON.stringify([
      {
        id: 'dep-1',
        teamName: 'data-platform',
        productSource: 'ERP',
        productType: 'Catalog',
        environment: 'production',
        deploymentStatus: 'running',
        savedVersion: '1.0',
        deployedVersion: '1.0',
        lastStatusChange: 100,
      },
    ]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(fetchDeployments('data-platform', false)).resolves.toEqual([
      expect.objectContaining({
        id: 'dep-1',
        deploymentStatus: 'failed',
      }),
    ])
  })
})