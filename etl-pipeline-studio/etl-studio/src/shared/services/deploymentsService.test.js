import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDeployment, deployFromYaml, fetchDeployments, permanentlyDeleteDeployment, resetDeploymentsServiceRequestCache, setDeploymentStatus, stopDeployment, upsertSavedDraftDeployment } from './deploymentsService.js'
import { writePersistedActiveUser } from '../store/userSessionPersistence.js'

describe('deploymentsService', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    localStorage.clear()
    resetDeploymentsServiceRequestCache()
    writePersistedActiveUser({ userId: 'user-123', teamName: 'data-platform' })
  })

  it('returns the backend payload when deployment starts successfully', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, deploymentId: 'run-123' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(deployFromYaml({
      productType: 'Catalog',
      source: 'ERP',
      team: 'data-platform',
      environment: 'production',
      isDeploy: true,
      isSavedVersion: true,
      configurationYaml: 'pipeline: test',
    })).resolves.toEqual({
      success: true,
      deploymentId: 'run-123',
    })

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/api/backend/deployments/deploy?productType=Catalog&source=ERP&team=data-platform&environment=production&isDeploy=true&isSavedVersion=true', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'X-user-ID': 'user-123' },
      body: 'pipeline: test',
    })
  })

  it('uses the shared deploy endpoint with isDeploy=false for upgrade calls', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, deploymentId: 'run-upgrade-1' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(deployFromYaml({
      productType: 'Inventory',
      source: 'CRM',
      team: 'data-platform',
      environment: 'staging',
      isDeploy: false,
      isSavedVersion: false,
      configurationYaml: 'pipeline: upgrade',
    })).resolves.toEqual({
      success: true,
      deploymentId: 'run-upgrade-1',
    })

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/api/backend/deployments/deploy?productType=Inventory&source=CRM&team=data-platform&environment=staging&isDeploy=false&isSavedVersion=false', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'X-user-ID': 'user-123' },
      body: 'pipeline: upgrade',
    })
  })

  it('returns a user-friendly 404 failure with backend detail', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'No static resource api/backend/deployments/deploy.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(deployFromYaml({
      productType: 'Catalog',
      source: 'ERP',
      team: 'data-platform',
      environment: 'production',
      isDeploy: true,
      isSavedVersion: true,
      configurationYaml: 'pipeline: test',
    })).resolves.toEqual({
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

    await expect(fetchDeployments('data-platform', false)).resolves.toEqual([
      expect.objectContaining({
        id: 'local-draft:data-platform::erp::catalog::production',
        deploymentStatus: 'deleted',
        previousDeploymentStatus: 'draft',
        isLocalDraft: true,
      }),
    ])
  })

  it('calls the backend delete endpoint with request params for soft delete', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(deleteDeployment({
      id: 'dep-2',
      productType: 'Catalog',
      productSource: 'CRM',
      teamName: 'data-platform',
      environment: 'staging',
    }, false)).resolves.toEqual({ success: true })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/backend/deployments/delete?productType=Catalog&source=CRM&team=data-platform&environment=staging&isPermanent=false',
      { method: 'DELETE', headers: { 'X-user-ID': 'user-123' } },
    )
  })

  it('calls the backend delete endpoint with request params for permanent delete', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(permanentlyDeleteDeployment({
      id: 'dep-4',
      productType: 'Legacy',
      productSource: 'Archive',
      teamName: 'data-platform',
      environment: 'production',
    }, false)).resolves.toEqual({ success: true })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/backend/deployments/delete?productType=Legacy&source=Archive&team=data-platform&environment=production&isPermanent=true',
      { method: 'DELETE', headers: { 'X-user-ID': 'user-123' } },
    )
  })

  it('calls the backend stop endpoint with request params', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(stopDeployment({
      id: 'dep-1',
      productType: 'Inventory',
      productSource: 'ERP',
      teamName: 'data-platform',
      environment: 'production',
    }, false)).resolves.toEqual({ success: true })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/backend/deployments/stop?productType=Inventory&source=ERP&team=data-platform&environment=production',
      { method: 'POST', headers: { 'X-user-ID': 'user-123' } },
    )
  })

  it('includes X-user-ID when fetching deployments from the backend', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await fetchDeployments('data-platform', false)

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/backend/deployments?teamName=data-platform',
      { headers: { 'X-user-ID': 'user-123' } },
    )
  })

  it('omits the team query param when fetching deployments across all teams for admins', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await fetchDeployments('data-platform', false, { includeAllTeams: true })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/backend/deployments',
      { headers: { 'X-user-ID': 'user-123' } },
    )
  })

  it('deduplicates concurrent deployments fetches for the same management entry', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))

    const [first, second] = await Promise.all([
      fetchDeployments('data-platform', false),
      fetchDeployments('data-platform', false),
    ])

    expect(first).toEqual(second)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refetches deployments after the initial request settles when forceRefresh is requested', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))

    await fetchDeployments('data-platform', false)
    await fetchDeployments('data-platform', false, { forceRefresh: true })

    expect(fetchMock).toHaveBeenCalledTimes(2)
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