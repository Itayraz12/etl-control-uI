import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDeployment, deployFromYaml, fetchDeploymentSteps, fetchDeployments, permanentlyDeleteDeployment, resetDeploymentsServiceRequestCache, setDeploymentStatus, stopDeployment, upsertSavedDraftDeployment } from './deploymentsService.js'
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
      environment: 'PROD',
      isDeploy: true,
      isSavedVersion: true,
      configurationYaml: 'pipeline: test',
    })).resolves.toEqual({
      success: true,
      deploymentId: 'run-123',
    })

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/api/deployment/action/deploy?productType=Catalog&source=ERP&team=data-platform&environment=PROD&isDeployVersion=false', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'X-user-ID': 'user-123' },
      body: 'pipeline: test',
    })
  })

  it('uses the upgrade endpoint without legacy upgrade query flags', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, deploymentId: 'run-upgrade-1' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(deployFromYaml({
      productType: 'Inventory',
      source: 'CRM',
      team: 'data-platform',
      environment: 'CAP',
      isDeploy: false,
      isSavedVersion: false,
      configurationYaml: 'pipeline: upgrade',
    })).resolves.toEqual({
      success: true,
      deploymentId: 'run-upgrade-1',
    })

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/api/deployment/action/upgrade?productType=Inventory&source=CRM&team=data-platform&environment=CAP', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'X-user-ID': 'user-123' },
      body: 'pipeline: upgrade',
    })
  })

  it('can trigger a deploy action with an explicit empty yaml body', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, deploymentId: 'run-direct-1' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(deployFromYaml({
      productType: 'Analytics',
      source: 'GitLab',
      team: 'Team A',
      environment: 'PROD',
      isDeploy: true,
      isSavedVersion: true,
      configurationYaml: '',
    })).resolves.toEqual({
      success: true,
      deploymentId: 'run-direct-1',
    })

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/api/deployment/action/deploy?productType=Analytics&source=GitLab&team=Team+A&environment=PROD&isDeployVersion=false', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'X-user-ID': 'user-123' },
      body: '',
    })
  })

  it('can trigger a deploy action with isDeployVersion=true when requested', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, deploymentId: 'run-direct-version-1' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(deployFromYaml({
      productType: 'Analytics',
      source: 'GitLab',
      team: 'Team A',
      environment: 'PROD',
      isDeploy: true,
      isSavedVersion: false,
      isDeployVersion: true,
      configurationYaml: '',
    })).resolves.toEqual({
      success: true,
      deploymentId: 'run-direct-version-1',
    })

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/api/deployment/action/deploy?productType=Analytics&source=GitLab&team=Team+A&environment=PROD&isDeployVersion=true', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'X-user-ID': 'user-123' },
      body: '',
    })
  })

  it('returns a user-friendly 404 failure with backend detail', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'No static resource api/deployment/action/deploy.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(deployFromYaml({
      productType: 'Catalog',
      source: 'ERP',
      team: 'data-platform',
      environment: 'PROD',
      isDeploy: true,
      isSavedVersion: true,
      configurationYaml: 'pipeline: test',
    })).resolves.toEqual({
      success: false,
      error: 'The deployment API endpoint was not found. Verify that the backend server is running and that POST /api/deployment/action/deploy is available. Backend response: No static resource api/deployment/action/deploy.',
    })
  })


  it('includes a newly saved local draft in the management deployments list', async () => {
    upsertSavedDraftDeployment({
      teamName: 'data-platform',
      productSource: 'ERP',
      productType: 'Catalog',
      environment: 'PROD',
      savedVersion: '1.0',
    })

    fetchMock.mockResolvedValue(new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(fetchDeployments('data-platform', false)).resolves.toEqual([
      expect.objectContaining({
        id: 'local-draft:data-platform::erp::catalog::PROD',
        productSource: 'ERP',
        productType: 'Catalog',
        environment: 'PROD',
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
      environment: 'PROD',
    })

    await expect(deleteDeployment('local-draft:data-platform::erp::catalog::PROD', false)).resolves.toEqual({
      success: true,
      id: 'local-draft:data-platform::erp::catalog::PROD',
    })

    expect(fetchMock).not.toHaveBeenCalled()

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(fetchDeployments('data-platform', false)).resolves.toEqual([
      expect.objectContaining({
        id: 'local-draft:data-platform::erp::catalog::PROD',
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
      environment: 'CAP',
    }, false)).resolves.toEqual({ success: true })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/deployments/delete?productType=Catalog&source=CRM&team=data-platform&environment=CAP&isPermanent=false',
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
      environment: 'PROD',
    }, false)).resolves.toEqual({ success: true })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/deployments/delete?productType=Legacy&source=Archive&team=data-platform&environment=PROD&isPermanent=true',
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
      'http://localhost:8080/api/deployment/action/stop?productType=Inventory&source=ERP&team=data-platform&environment=PROD',
      { method: 'POST', headers: { 'X-user-ID': 'user-123' } },
    )
  })

  it('fetches deployment steps from the deployment action steps endpoint', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([
      { id: 'validate', label: 'Validate' },
      { id: 'deploy', label: 'Deploy' },
    ]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(fetchDeploymentSteps(false)).resolves.toEqual([
      { id: 'validate', label: 'Validate' },
      { id: 'deploy', label: 'Deploy' },
    ])

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/deployment/action/steps',
      { headers: { 'X-user-ID': 'user-123' } },
    )
  })

  it('includes X-user-ID when fetching deployments from the backend', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await fetchDeployments('data-platform', false)

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/deployment/deployments?teamName=data-platform',
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
      'http://localhost:8080/api/deployment/deployments',
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

  it('clears a stale local override when the backend reports the deployment as running again', async () => {
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
        lastStatusChange: Date.now() + 10_000,
      },
    ]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(fetchDeployments('data-platform', false)).resolves.toEqual([
      expect.objectContaining({
        id: 'dep-1',
        deploymentStatus: 'running',
      }),
    ])

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
        lastStatusChange: Date.now() + 20_000,
      },
    ]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(fetchDeployments('data-platform', false, { forceRefresh: true })).resolves.toEqual([
      expect.objectContaining({
        id: 'dep-1',
        deploymentStatus: 'running',
      }),
    ])
  })
})