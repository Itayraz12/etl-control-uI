// Backend service for deployments data
const API_BASE = 'http://localhost:8080/api'
const SAVED_DRAFTS_STORAGE_KEY = 'etl-studio-management-drafts'

function normalizeDraftKeyPart(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
}

function getDraftIdentity({ teamName = '', productSource = '', productType = '', environment = '' } = {}) {
  return [teamName, productSource, productType, environment]
    .map(normalizeDraftKeyPart)
    .join('::')
}

function readSavedDraftRows() {
  try {
    const raw = localStorage.getItem(SAVED_DRAFTS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeSavedDraftRows(rows) {
  try {
    localStorage.setItem(SAVED_DRAFTS_STORAGE_KEY, JSON.stringify(rows))
  } catch {}
}

function normalizeSavedDraftRow(row = {}) {
  const identity = getDraftIdentity(row)
  const createdAt = row.createdAt || Date.now()
  const lastStatusChange = row.lastStatusChange || createdAt

  return {
    id: row.id || `local-draft:${identity}`,
    identity,
    teamName: row.teamName || 'default',
    productSource: row.productSource || '',
    productType: row.productType || '',
    environment: row.environment || 'production',
    deploymentStatus: row.deploymentStatus || 'draft',
    savedVersion: row.savedVersion || '1.0',
    deployedVersion: row.deployedVersion ?? null,
    lastStatusChange,
    createdAt,
    isLocalDraft: true,
  }
}

function mergeSavedDraftRows(deployments = [], teamName = 'default') {
  const normalizedTeamName = String(teamName ?? '').trim()
  const backendRows = Array.isArray(deployments) ? deployments : []
  const backendIdentities = new Set(
    backendRows.map(row => getDraftIdentity({
      teamName: normalizedTeamName,
      productSource: row?.productSource,
      productType: row?.productType,
      environment: row?.environment,
    }))
  )

  const localDraftRows = readSavedDraftRows()
    .map(normalizeSavedDraftRow)
    .filter(row => row.teamName === normalizedTeamName)
    .filter(row => !backendIdentities.has(row.identity))

  return [...localDraftRows, ...backendRows]
}

export function upsertSavedDraftDeployment({ teamName = 'default', productSource = '', productType = '', environment = 'production', savedVersion = '1.0', deploymentStatus = 'draft', deployedVersion = null, lastStatusChange } = {}) {
  const normalizedRow = normalizeSavedDraftRow({
    teamName: String(teamName ?? '').trim() || 'default',
    productSource,
    productType,
    environment,
    savedVersion,
    deploymentStatus,
    deployedVersion,
    lastStatusChange,
  })

  const nextRows = readSavedDraftRows().filter(row => normalizeSavedDraftRow(row).identity !== normalizedRow.identity)
  nextRows.unshift(normalizedRow)
  writeSavedDraftRows(nextRows)

  return normalizedRow
}

export function removeSavedDraftDeployment(identifier) {
  const currentRows = readSavedDraftRows()
  const nextRows = currentRows.filter(row => {
    const normalizedRow = normalizeSavedDraftRow(row)
    return normalizedRow.id !== identifier && normalizedRow.identity !== identifier
  })

  if (nextRows.length !== currentRows.length) {
    writeSavedDraftRows(nextRows)
    return true
  }

  return false
}

function getDeployHttpErrorPrefix(status) {
  switch (status) {
    case 400:
      return 'The deployment request was rejected by the backend.'
    case 401:
    case 403:
      return 'You are not authorized to deploy this pipeline.'
    case 404:
      return 'The deployment API endpoint was not found.'
    case 409:
      return 'The deployment could not start because of a backend conflict.'
    case 500:
    case 502:
    case 503:
    case 504:
      return 'The deployment backend is currently unavailable.'
    default:
      return 'The deployment request failed.'
  }
}

async function buildDeployHttpError(response) {
  let backendDetail = ''

  try {
    const contentType = response.headers.get('Content-Type') || ''
    if (contentType.includes('application/json')) {
      const payload = await response.json()
      backendDetail = payload?.error || payload?.message || payload?.detail || payload?.details || ''
    } else {
      backendDetail = (await response.text()).trim()
    }
  } catch {
    backendDetail = ''
  }

  const prefix = getDeployHttpErrorPrefix(response.status)
  const statusSuffix = response.status === 404
    ? ' Verify that the backend server is running and that POST /api/backend/deployments/deploy is available.'
    : ` HTTP ${response.status}.`

  const detailSuffix = backendDetail
    ? ` Backend response: ${backendDetail}`
    : ''

  return `${prefix}${statusSuffix}${detailSuffix}`.trim()
}

// ── Create + deploy from wizard YAML ─────────────────────────────────────

/**
 * POSTs the generated YAML to the backend to create and immediately start a
 * new deployment.  Used by the Summary wizard step.
 *
 * Backend endpoint: POST /api/backend/deployments/deploy
 * Content-Type: text/plain (raw YAML)
 *
 * Expected response: { success: true, deploymentId: "run-uuid-..." }
 *
 * @returns {{ success: boolean, deploymentId?: string, error?: string }}
 */
export async function deployFromYaml(yamlContent) {
  try {
    const url = `${API_BASE}/backend/deployments/deploy`
    console.log('[deploymentsService] deployFromYaml →', url)
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: yamlContent,
    })
    if (!response.ok) {
      throw new Error(await buildDeployHttpError(response))
    }
    const data = await response.json()
    console.log('[deploymentsService] deployFromYaml result:', data)
    return data
  } catch (err) {
    console.error('[deploymentsService] deployFromYaml error:', err.message)
    return { success: false, error: err.message }
  }
}

// ── Deployments list ─────────────────────────────────────────────────────

/**
 * Fallback steps shown when the backend /steps endpoint is unavailable.
 * The real list always comes from the backend; this is only a safety net.
 */
const FALLBACK_DEPLOYMENT_STEPS = [
  { id: 'validate-config',   label: 'Validating pipeline configuration' },
  { id: 'prepare-resources', label: 'Preparing Kafka topics'            },
  { id: 'validate-mappings', label: 'Validating field mappings'         },
  { id: 'prepare-flink',     label: 'Preparing Flink job'               },
  { id: 'upload-artifacts',  label: 'Uploading pipeline artifacts'      },
  { id: 'register-pipeline', label: 'Registering pipeline'              },
  { id: 'deploy-job',        label: 'Deploying Flink job'               },
  { id: 'health-checks',     label: 'Running health checks'             },
]

/**
 * Fetches the ordered list of deployment steps to display in the progress modal.
 * Always tries the backend first; falls back to FALLBACK_DEPLOYMENT_STEPS on
 * any error or empty response.
 * Expected response: Array<{ id: string, label: string }>
 */
export async function fetchDeploymentSteps(useMock = false) {
  try {
    const response = await fetch(`${API_BASE}/backend/deployments/steps`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    if (Array.isArray(data) && data.length > 0) {
      console.log('[deploymentsService] fetchDeploymentSteps: received', data.length, 'steps from backend')
      return data
    }
    console.warn('[deploymentsService] fetchDeploymentSteps: empty response, using fallback')
    return FALLBACK_DEPLOYMENT_STEPS
  } catch (err) {
    console.warn('[deploymentsService] fetchDeploymentSteps fallback:', err.message)
    if (useMock) await new Promise(r => setTimeout(r, 80))
    return FALLBACK_DEPLOYMENT_STEPS
  }
}

// ── Real-time deployment progress via Server-Sent Events ─────────────────

/**
 * Opens an SSE connection to receive real-time deployment progress events
 * from the Java backend.
 *
 * Backend endpoint:
 *   GET /api/backend/deployments/:deploymentId/progress
 *   Content-Type: text/event-stream
 *
 * Expected SSE event types:
 *   event: step-start       data: { stepIndex, stepId, label }
 *   event: step-complete    data: { stepIndex }
 *   event: step-failed      data: { stepIndex, error }
 *   event: deployment-complete  data: { success: true }
 *   event: deployment-failed    data: { error }
 *
 * @returns {Function} cleanup — call to close the connection early
 */
export function subscribeToDeploymentProgress(deploymentId, {
  onStepStart       = () => {},
  onStepComplete    = () => {},
  onStepFailed      = () => {},
  onComplete        = () => {},
  onConnectionError = () => {},
} = {}) {
  if (!deploymentId || deploymentId === 'undefined') {
    console.error('[deploymentsService] subscribeToDeploymentProgress called with invalid deploymentId:', deploymentId)
    onConnectionError('No deployment ID returned by the server. Cannot track progress.')
    return () => {}
  }

  const url = `${API_BASE}/backend/deployments/${encodeURIComponent(deploymentId)}/progress`
  console.log('[deploymentsService] Opening SSE connection →', url)

  const source = new EventSource(url)

  // Track whether we already received a terminal event so that the browser's
  // automatic reconnect attempt (which fires onerror) is not treated as a failure.
  let terminalEventReceived = false

  source.onopen = () => console.log('[deploymentsService] SSE open for deployment', deploymentId)

  source.onerror = (e) => {
    if (terminalEventReceived) {
      // onerror fires when the server closes the connection after sending the
      // terminal event — this is normal; ignore it.
      console.log('[deploymentsService] SSE closed after terminal event (expected), ignoring onerror')
      source.close()
      return
    }
    console.error('[deploymentsService] SSE error for deployment', deploymentId, e)
    source.close()
    onConnectionError('Lost connection to server during deployment.')
  }

  // ── Helper: dispatch a parsed SSE payload to the right callback ──────────
  function dispatch(type, data) {
    console.log('[deploymentsService] SSE event:', type, data)
    switch (type) {
      case 'step-start':
        onStepStart(data)
        break
      case 'step-complete':
        onStepComplete(data)
        break
      case 'step-failed':
        terminalEventReceived = true
        source.close()
        onStepFailed(data)
        break
      case 'deployment-complete':
        terminalEventReceived = true
        source.close()
        onComplete()
        break
      case 'deployment-failed':
        terminalEventReceived = true
        source.close()
        onStepFailed({ error: data?.error || 'Deployment failed.' })
        break
      default:
        console.warn('[deploymentsService] SSE unknown event type:', type, data)
    }
  }

  // ── Named event listeners (standard SSE with "event:" field) ─────────────
  source.addEventListener('step-start', e => {
    try { dispatch('step-start', JSON.parse(e.data)) }
    catch (err) { console.error('[deploymentsService] SSE step-start parse error:', err, e.data) }
  })
  source.addEventListener('step-complete', e => {
    try { dispatch('step-complete', JSON.parse(e.data)) }
    catch (err) { console.error('[deploymentsService] SSE step-complete parse error:', err, e.data) }
  })
  source.addEventListener('step-failed', e => {
    try { dispatch('step-failed', JSON.parse(e.data)) }
    catch (err) { console.error('[deploymentsService] SSE step-failed parse error:', err, e.data) }
  })
  source.addEventListener('deployment-complete', e => {
    try { dispatch('deployment-complete', e.data ? JSON.parse(e.data) : {}) }
    catch { dispatch('deployment-complete', {}) }
  })
  source.addEventListener('deployment-failed', e => {
    try { dispatch('deployment-failed', JSON.parse(e.data)) }
    catch (err) { console.error('[deploymentsService] SSE deployment-failed parse error:', err, e.data) }
  })

  // ── Fallback: unnamed "message" events ────────────────────────────────────
  // Some backends emit plain data events without an "event:" type line.
  // In that case EventSource fires the generic "message" event.
  // We inspect the JSON payload for a "type" or "event" discriminator field.
  source.onmessage = (e) => {
    try {
      const d = JSON.parse(e.data)
      const type = d?.type || d?.event || d?.eventType
      if (!type) {
        console.warn('[deploymentsService] SSE unnamed message with no type field:', d)
        return
      }
      dispatch(type, d)
    } catch (err) {
      console.error('[deploymentsService] SSE unnamed message parse error:', err, e.data)
    }
  }

  return () => {
    console.log('[deploymentsService] Closing SSE connection for deployment', deploymentId)
    source.close()
  }
}

// ── Mock SSE simulation (same callback contract, no network) ─────────────

/**
 * Simulates SSE progress events using timers in mock mode.
 * Uses the identical callback signature as subscribeToDeploymentProgress.
 * @returns {Function} cleanup — call to cancel the simulation
 */
export function simulateDeploymentProgress(steps, {
  onStepStart       = () => {},
  onStepComplete    = () => {},
  onStepFailed      = () => {},
  onComplete        = () => {},
  onConnectionError = () => {},
} = {}, stepDurationMs = 700) {
  let cancelled = false
  const timers = []

  steps.forEach((step, i) => {
    timers.push(setTimeout(() => {
      if (!cancelled) onStepStart({ stepIndex: i, stepId: step.id, label: step.label })
    }, i * stepDurationMs * 2))

    timers.push(setTimeout(() => {
      if (!cancelled) {
        onStepComplete({ stepIndex: i })
        if (i === steps.length - 1) onComplete()
      }
    }, i * stepDurationMs * 2 + stepDurationMs))
  })

  return () => { cancelled = true; timers.forEach(clearTimeout) }
}

// Mock data for deployments
function buildMockDeployments() {
  return [
    {
      id: '1',
      productType: 'Data Pipeline',
      productSource: 'GitHub',
      environment: 'production',
      deploymentStatus: 'draft',
      savedVersion: '1.0.0',
      deployedVersion: '1.0.0',
      lastStatusChange: Date.now() - 3600 * 1000,
      createdAt: Date.now() - 86400 * 1000,
    },
    {
      id: '2',
      productType: 'ETL Job',
      productSource: 'Bitbucket',
      environment: 'staging',
      deploymentStatus: 'running',
      savedVersion: '2.1.3',
      deployedVersion: '2.0.5',
      lastStatusChange: Date.now() - 1800 * 1000,
      createdAt: Date.now() - 172800 * 1000,
    },
    {
      id: '3',
      productType: 'Analytics',
      productSource: 'GitLab',
      environment: 'development',
      deploymentStatus: 'stopped',
      savedVersion: '1.5.2',
      deployedVersion: '1.5.2',
      lastStatusChange: Date.now() - 7200 * 1000,
      createdAt: Date.now() - 259200 * 1000,
    },
    {
      id: '4',
      productType: 'Analytics4',
      productSource: 'GitLab',
      environment: 'production',
      deploymentStatus: 'running',
      savedVersion: '3.0.1',
      deployedVersion: '2.9.0',
      lastStatusChange: Date.now() - 7200 * 1000,
      createdAt: Date.now() - 259200 * 1000,
    },
    {
      id: '5',
      productType: 'Analytics5',
      productSource: 'GitLab',
      environment: 'staging',
      deploymentStatus: 'stopped',
      savedVersion: '1.2.0',
      deployedVersion: '1.2.0',
      lastStatusChange: Date.now() - 7200 * 1000,
      createdAt: Date.now() - 259200 * 1000,
    },
    {
      id: '6',
      productType: 'Analytics6',
      productSource: 'GitLab',
      environment: 'development',
      deploymentStatus: 'draft',
      savedVersion: '2.0.0',
      deployedVersion: null,
      lastStatusChange: Date.now() - 7200 * 1000,
      createdAt: Date.now() - 259200 * 1000,
    },
    {
      id: '7',
      productType: 'Analytics7',
      productSource: 'GitLab',
      environment: 'production',
      deploymentStatus: 'draft',
      savedVersion: '1.3.5',
      deployedVersion: null,
      lastStatusChange: Date.now() - 7200 * 1000,
      createdAt: Date.now() - 259200 * 1000,
    },
    {
      id: '8',
      productType: 'Analytics8',
      productSource: 'GitLab',
      environment: 'staging',
      deploymentStatus: 'draft',
      savedVersion: '2.2.1',
      deployedVersion: null,
      lastStatusChange: Date.now() - 7200 * 1000,
      createdAt: Date.now() - 259200 * 1000,
    },
    {
      id: '9',
      productType: 'Analytics9',
      productSource: 'GitLab',
      environment: 'development',
      deploymentStatus: 'draft',
      savedVersion: '1.1.0',
      deployedVersion: null,
      lastStatusChange: Date.now() - 7200 * 1000,
      createdAt: Date.now() - 259200 * 1000,
    },
    {
      id: '10',
      productType: 'Analytics10',
      productSource: 'GitLab',
      environment: 'production',
      deploymentStatus: 'draft',
      savedVersion: '1.7.2',
      deployedVersion: null,
      lastStatusChange: Date.now() - 7200 * 1000,
      createdAt: Date.now() - 259200 * 1000,
    },
    {
      id: '11',
      productType: 'Analytics11',
      productSource: 'GitLab',
      environment: 'staging',
      deploymentStatus: 'draft',
      savedVersion: '2.3.0',
      deployedVersion: null,
      lastStatusChange: Date.now() - 7200 * 1000,
      createdAt: Date.now() - 259200 * 1000,
    },
    {
      id: '12',
      productType: 'Analytics12',
      productSource: 'GitLab',
      environment: 'development',
      deploymentStatus: 'draft',
      savedVersion: '1.4.8',
      deployedVersion: null,
      lastStatusChange: Date.now() - 7200 * 1000,
      createdAt: Date.now() - 259200 * 1000,
    },
  ]
}

let mockDeploymentsStore = buildMockDeployments()

function cloneMockDeployments() {
  return mockDeploymentsStore.map(item => ({ ...item }))
}

export async function fetchDeployments(teamName = 'default', useMock = false) {
  if (useMock) {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 300));
    return mergeSavedDraftRows(cloneMockDeployments(), teamName);
  } else {
    try {
      const url = `${API_BASE}/backend/deployments?teamName=${encodeURIComponent(teamName)}`;
      console.log('🔵 Fetching deployments from:', url);

      const response = await fetch(url);
      console.log('🟢 Response received:', response);
      console.log('   Status:', response.status);
      console.log('   OK:', response.ok);
      console.log('   Headers:', {
        'content-type': response.headers.get('content-type'),
        'content-length': response.headers.get('content-length'),
      });

      if (!response.ok) {
        console.error(`❌ HTTP error! status: ${response.status}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📊 Deployments data received:', data);
      console.log('   Type:', typeof data);
      console.log('   Is Array:', Array.isArray(data));
      console.log('   Length:', Array.isArray(data) ? data.length : 'N/A');
      console.log('   Full response object:', JSON.stringify(data, null, 2));

      // Ensure data is an array
      if (!Array.isArray(data)) {
        console.warn('⚠️ Response is not an array, wrapping it:', data);
        return mergeSavedDraftRows(Array.isArray(data) ? data : [], teamName);
      }

      console.log('✅ Deployments fetched successfully!');
      return mergeSavedDraftRows(data, teamName);
    } catch (error) {
      console.error('❌ Failed to fetch deployments:', error);
      console.error('   Error message:', error.message);
      console.error('   Error stack:', error.stack);
      // Return local draft rows on error so recently saved drafts remain visible
      return mergeSavedDraftRows([], teamName);
    }
  }
}

export async function deployService(id, useMock = false) {
  if (useMock) {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 200));
    mockDeploymentsStore = mockDeploymentsStore.map(item => (
      item.id === id
        ? {
            ...item,
            deploymentStatus: 'running',
            deployedVersion: item.savedVersion,
            lastStatusChange: Date.now(),
          }
        : item
    ))
    return { success: true, id };
  } else {
    try {
      const url = `${API_BASE}/backend/deployments/${id}/deploy`;
      console.log('🔵 Deploying service:', id);
      console.log('   URL:', url);

      const response = await fetch(url, { method: 'POST' });
      console.log('🟢 Deploy response received:', response);
      console.log('   Status:', response.status);
      console.log('   OK:', response.ok);

      if (!response.ok) {
        throw new Error(`Deploy failed with status: ${response.status}`);
      }

      const result = await response.json();
      console.log('📊 Deploy result:', result);
      console.log('   Full response object:', JSON.stringify(result, null, 2));
      console.log('✅ Deploy successful!');
      return result;
    } catch (error) {
      console.error('❌ Deploy failed:', error);
      console.error('   Error message:', error.message);
      return { success: false, error: error.message };
    }
  }
}

export async function stopDeployment(id, useMock = false) {
  if (useMock) {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 200));
    return { success: true };
  } else {
    try {
      const url = `${API_BASE}/backend/deployments/${id}/stop`;
      console.log('🔵 Stopping deployment:', id);
      console.log('   URL:', url);

      const response = await fetch(url, { method: 'POST' });
      console.log('🟢 Stop response received:', response);
      console.log('   Status:', response.status);
      console.log('   OK:', response.ok);

      if (!response.ok) {
        throw new Error(`Stop failed with status: ${response.status}`);
      }

      const result = await response.json();
      console.log('📊 Stop result:', result);
      console.log('   Full response object:', JSON.stringify(result, null, 2));
      console.log('✅ Stop successful!');
      return result;
    } catch (error) {
      console.error('❌ Stop failed:', error);
      console.error('   Error message:', error.message);
      return { success: false, error: error.message };
    }
  }
}

export async function deleteDeployment(id, useMock = false) {
  if (removeSavedDraftDeployment(id)) {
    return { success: true, id }
  }

  if (useMock) {
    await new Promise(r => setTimeout(r, 200));
    mockDeploymentsStore = mockDeploymentsStore.filter(item => item.id !== id)
    return { success: true, id };
  } else {
    try {
      const url = `${API_BASE}/backend/deployments/${id}`;
      console.log('🔵 Deleting deployment:', id);
      console.log('   URL:', url);

      const response = await fetch(url, { method: 'DELETE' });
      console.log('🟢 Delete response received:', response);
      console.log('   Status:', response.status);
      console.log('   OK:', response.ok);

      if (!response.ok) {
        throw new Error(`Delete failed with status: ${response.status}`);
      }

      const result = await response.json().catch(() => ({ success: true, id }));
      console.log('📊 Delete result:', result);
      console.log('✅ Delete successful!');
      return result;
    } catch (error) {
      console.error('❌ Delete failed:', error);
      console.error('   Error message:', error.message);
      return { success: false, error: error.message };
    }
  }
}

export async function fetchDeploymentConfig(id, useMock = false) {
  if (useMock) {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 200));
    return { config: { id, name: 'Sample Config', settings: {} } };
  } else {
    try {
      const url = `${API_BASE}/backend/deployments/${id}/config`;
      console.log('🔵 Fetching deployment config:', id);
      console.log('   URL:', url);

      const response = await fetch(url);
      console.log('🟢 Config response received:', response);
      console.log('   Status:', response.status);
      console.log('   OK:', response.ok);

      if (!response.ok) {
        throw new Error(`Fetch config failed with status: ${response.status}`);
      }

      const config = await response.json();
      console.log('📊 Config data received:', config);
      console.log('   Full response object:', JSON.stringify(config, null, 2));
      console.log('✅ Config fetched successfully!');
      return { config };
    } catch (error) {
      console.error('❌ Fetch config failed:', error);
      console.error('   Error message:', error.message);
      return { config: null, error: error.message };
    }
  }
}
