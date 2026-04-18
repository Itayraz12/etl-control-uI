import { API_BASE } from './appConfig.js'
import { fetchWithUserId } from './requestHeaders.js'
import { normalizeEnvironmentValue } from '../types/index.js'

// Backend service for deployments data

// ── Local-draft store (localStorage) ─────────────────────────────────────
// Deployments that have been saved locally (via the wizard's Save action) but
// may not yet exist on the backend are persisted here so the management table
// can always show them.

const LOCAL_DRAFTS_KEY = 'etl-local-drafts'
const DEPLOYMENT_STATUS_OVERRIDES_KEY = 'etl-deployment-status-overrides'
const deploymentsListRequestCache = new Map()

function buildDeploymentsListRequestKey({ teamName = 'default', useMock = false, includeAllTeams = false }) {
  return JSON.stringify({
    teamName: String(teamName || 'default').trim(),
    useMock: Boolean(useMock),
    includeAllTeams: Boolean(includeAllTeams),
  })
}

function loadInFlightDeploymentsRequest(requestKey, loader, { forceRefresh = false } = {}) {
  if (!forceRefresh && deploymentsListRequestCache.has(requestKey)) {
    return deploymentsListRequestCache.get(requestKey)
  }

  const request = Promise.resolve()
    .then(loader)
    .finally(() => {
      if (deploymentsListRequestCache.get(requestKey) === request) {
        deploymentsListRequestCache.delete(requestKey)
      }
    })

  deploymentsListRequestCache.set(requestKey, request)
  return request
}

export function resetDeploymentsServiceRequestCache() {
  deploymentsListRequestCache.clear()
}

function buildLocalDraftId({ teamName, productSource, productType, environment }) {
  const normalizedEnvironment = normalizeEnvironmentValue(environment, String(environment || '').trim())
  return `local-draft:${teamName}::${(productSource || '').toLowerCase()}::${(productType || '').toLowerCase()}::${normalizedEnvironment}`
}

function buildDeploymentStatusOverrideKey({ teamName, productSource, productType, environment }) {
  const normalizedEnvironment = normalizeEnvironmentValue(environment, String(environment || '').trim())
  return `${teamName}::${(productSource || '').toLowerCase()}::${(productType || '').toLowerCase()}::${normalizedEnvironment}`
}

function readLocalDrafts() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_DRAFTS_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeLocalDrafts(drafts) {
  try {
    localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(drafts))
  } catch {}
}

function readDeploymentStatusOverrides() {
  try {
    return JSON.parse(localStorage.getItem(DEPLOYMENT_STATUS_OVERRIDES_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeDeploymentStatusOverrides(overrides) {
  try {
    localStorage.setItem(DEPLOYMENT_STATUS_OVERRIDES_KEY, JSON.stringify(overrides))
  } catch {}
}

/**
 * Creates or updates a local-only draft deployment entry that is merged into
 * the management table until the backend returns a matching record.
 *
 * Called by configService.saveDraftConfiguration after a successful save.
 */
export function upsertSavedDraftDeployment({ teamName, productSource, productType, environment, savedVersion, deployedVersion, deploymentStatus }) {
  const normalizedEnvironment = normalizeEnvironmentValue(environment, String(environment || '').trim())
  const id     = buildLocalDraftId({ teamName, productSource, productType, environment: normalizedEnvironment })
  const drafts = readLocalDrafts()
  drafts[id] = {
    ...drafts[id],
    id,
    teamName,
    productSource,
    productType,
    environment: normalizedEnvironment,
    deploymentStatus: deploymentStatus ?? drafts[id]?.deploymentStatus ?? 'draft',
    savedVersion:     savedVersion ?? drafts[id]?.savedVersion ?? null,
    deployedVersion:  deployedVersion ?? drafts[id]?.deployedVersion ?? null,
    lastStatusChange: Date.now(),
    createdAt:        drafts[id]?.createdAt ?? Date.now(),
    isLocalDraft:     true,
  }
  writeLocalDrafts(drafts)
}

export function setDeploymentStatus({ teamName, productSource, productType, environment, deploymentStatus, savedVersion, deployedVersion, clearOverride = false }) {
  const normalizedEnvironment = normalizeEnvironmentValue(environment, String(environment || '').trim())
  const overrideKey = buildDeploymentStatusOverrideKey({ teamName, productSource, productType, environment: normalizedEnvironment })
  const overrides = readDeploymentStatusOverrides()

  if (clearOverride) {
    delete overrides[overrideKey]
    writeDeploymentStatusOverrides(overrides)
  } else {
    overrides[overrideKey] = {
      deploymentStatus,
      savedVersion: savedVersion ?? null,
      deployedVersion: deployedVersion ?? null,
      lastStatusChange: Date.now(),
    }
    writeDeploymentStatusOverrides(overrides)
  }

  const drafts = readLocalDrafts()
  const draftId = buildLocalDraftId({ teamName, productSource, productType, environment: normalizedEnvironment })
  if (drafts[draftId]) {
    drafts[draftId] = {
      ...drafts[draftId],
      environment: normalizedEnvironment,
      deploymentStatus: clearOverride ? (drafts[draftId].deploymentStatus || 'draft') : deploymentStatus,
      savedVersion: savedVersion ?? drafts[draftId].savedVersion ?? null,
      deployedVersion: deployedVersion ?? drafts[draftId].deployedVersion ?? null,
      lastStatusChange: Date.now(),
    }
    writeLocalDrafts(drafts)
  }
}

function applyDeploymentStatusOverrides(rows, teamName) {
  const overrides = readDeploymentStatusOverrides()

  return rows.map(row => {
    const overrideKey = buildDeploymentStatusOverrideKey({
      teamName: row.teamName || teamName,
      productSource: row.productSource,
      productType: row.productType,
      environment: row.environment,
    })
    const override = overrides[overrideKey]

    if (!override) return row

    return {
      ...row,
      deploymentStatus: override.deploymentStatus ?? row.deploymentStatus,
      savedVersion: override.savedVersion ?? row.savedVersion,
      deployedVersion: override.deployedVersion ?? row.deployedVersion,
      lastStatusChange: override.lastStatusChange ?? row.lastStatusChange,
    }
  })
}



/**
 * POSTs the generated YAML to the backend to create and immediately start a
 * new deployment, or re-deploy an upgrade, using deployment identity request params.
 *
 * Backend endpoint: POST /api/backend/deployments/deploy
 * Content-Type: text/plain (raw YAML)
 *
 * Expected response: { success: true, deploymentId: "run-uuid-..." }
 *
 * @returns {{ success: boolean, deploymentId?: string, error?: string }}
 */
export async function deployFromYaml({
  productType,
  source,
  team,
  environment = 'PROD',
  isDeploy = true,
  isSavedVersion = true,
  configurationYaml,
}) {
  try {
    const params = buildDeploymentIdentityParams({
      productType,
      source,
      team,
      environment,
    }, {
      isDeploy: Boolean(isDeploy),
      isSavedVersion: Boolean(isSavedVersion),
    })
    const url = `${API_BASE}/backend/deployments/deploy?${params.toString()}`
    console.log('[deploymentsService] deployFromYaml →', url)
    const response = await fetchWithUserId(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: configurationYaml,
    })

    if (!response.ok) {
      let backendMessage = ''
      try {
        const contentType = response.headers.get('Content-Type') || ''
        if (contentType.includes('application/json')) {
          const payload = await response.json()
          backendMessage = payload?.message || payload?.error || payload?.detail || ''
        } else {
          backendMessage = await response.text()
        }
      } catch {}

      if (response.status === 404) {
        throw new Error(
          'The deployment API endpoint was not found. Verify that the backend server is running and that POST /api/backend/deployments/deploy is available.'
          + (backendMessage ? ` Backend response: ${backendMessage}` : '')
        )
      }

      throw new Error(
        `Deploy failed with status: ${response.status}`
        + (backendMessage ? `. Backend response: ${backendMessage}` : '')
      )
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
    const response = await fetchWithUserId(`${API_BASE}/backend/deployments/steps`)
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
      teamName: 'Team A',
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
      teamName: 'Team B',
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
      teamName: 'Team C',
      productType: 'Analytics',
      productSource: 'GitLab',
      environment: 'staging',
      deploymentStatus: 'stopped',
      savedVersion: '1.5.2',
      deployedVersion: '1.5.2',
      lastStatusChange: Date.now() - 7200 * 1000,
      createdAt: Date.now() - 259200 * 1000,
    },
    {
      id: '4',
      teamName: 'Yarden',
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
      teamName: 'Team A',
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
      teamName: 'Team B',
      productType: 'Analytics6',
      productSource: 'GitLab',
      environment: 'staging',
      deploymentStatus: 'draft',
      savedVersion: '2.0.0',
      deployedVersion: null,
      lastStatusChange: Date.now() - 7200 * 1000,
      createdAt: Date.now() - 259200 * 1000,
    },
    {
      id: '7',
      teamName: 'Team C',
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
      teamName: 'Yarden',
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
      teamName: 'Team A',
      productType: 'Analytics9',
      productSource: 'GitLab',
      environment: 'staging',
      deploymentStatus: 'draft',
      savedVersion: '1.1.0',
      deployedVersion: null,
      lastStatusChange: Date.now() - 7200 * 1000,
      createdAt: Date.now() - 259200 * 1000,
    },
    {
      id: '10',
      teamName: 'Team B',
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
      teamName: 'Team C',
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
      teamName: 'Yarden',
      productType: 'Analytics12',
      productSource: 'GitLab',
      environment: 'staging',
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

export async function fetchDeployments(teamName = 'default', useMock = false, { includeAllTeams = false, forceRefresh = false } = {}) {
  // Helper: merge local drafts with the backend / mock list.
  // A local draft is suppressed when the backend already has a row whose
  // productSource + productType + environment matches (backend is source of truth).
  function mergeWithLocalDrafts(backendRows) {
    const drafts = readLocalDrafts()
    const dominated = new Set(
      backendRows.map(r =>
        buildLocalDraftId({
          teamName: r.teamName || teamName,
          productSource: r.productSource,
          productType:   r.productType,
          environment:   r.environment,
        })
      )
    )
      const extra = Object.values(drafts).filter(d => (
        !dominated.has(d.id) && (includeAllTeams || d.teamName === teamName)
      ))
    return applyDeploymentStatusOverrides([...backendRows, ...extra], teamName)
  }

  const requestKey = buildDeploymentsListRequestKey({ teamName, useMock, includeAllTeams })

  return loadInFlightDeploymentsRequest(requestKey, async () => {
    if (useMock) {
      // Simulate network delay
      await new Promise(r => setTimeout(r, 300));
      return mergeWithLocalDrafts(cloneMockDeployments());
    }

    try {
      const url = includeAllTeams
        ? `${API_BASE}/backend/deployments`
        : `${API_BASE}/backend/deployments?teamName=${encodeURIComponent(teamName)}`;
      console.log('🔵 Fetching deployments from:', url);

      const response = await fetchWithUserId(url);
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
        return mergeWithLocalDrafts([]);
      }

      console.log('✅ Deployments fetched successfully!');
      return mergeWithLocalDrafts(data);
    } catch (error) {
      console.error('❌ Failed to fetch deployments:', error);
      console.error('   Error message:', error.message);
      console.error('   Error stack:', error.stack);
      // Return empty array on error
      return mergeWithLocalDrafts([]);
    }
  }, { forceRefresh })
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
      if (!id || typeof id !== 'object' || !id.configurationYaml) {
        throw new Error('Upgrade failed: configurationYaml is required to call the shared deploy endpoint.')
      }

      return await deployFromYaml({
        ...id,
        isDeploy: false,
      })
    } catch (error) {
      console.error('❌ Deploy failed:', error);
      console.error('   Error message:', error.message);
      return { success: false, error: error.message };
    }
  }
}

function normalizeDeploymentTarget(target) {
  if (typeof target === 'string') {
    return { id: target }
  }

  return target || {}
}

function buildDeploymentIdentityParams(target, extraParams = {}) {
  const deployment = normalizeDeploymentTarget(target)
  const normalizedEnvironment = normalizeEnvironmentValue(deployment.environment, 'PROD')
  const params = new URLSearchParams({
    productType: String(deployment.productType || ''),
    source: String(deployment.productSource || deployment.source || ''),
    team: String(deployment.teamName || deployment.team || ''),
    environment: normalizedEnvironment,
    ...Object.fromEntries(Object.entries(extraParams).map(([key, value]) => [key, String(value)])),
  })

  const missingFields = [
    ['productType', params.get('productType')],
    ['source', params.get('source')],
    ['team', params.get('team')],
    ['environment', params.get('environment')],
  ].filter(([, value]) => !value)

  if (missingFields.length > 0) {
    throw new Error(`Request failed: missing required deployment fields (${missingFields.map(([key]) => key).join(', ')}).`)
  }

  return params
}

export async function stopDeployment(target, useMock = false) {
  const deployment = normalizeDeploymentTarget(target)
  const id = deployment.id

  if (String(id).startsWith('local-draft:')) {
    const drafts = readLocalDrafts()
    if (drafts[id]) {
      drafts[id] = {
        ...drafts[id],
        deploymentStatus: 'stopped',
        lastStatusChange: Date.now(),
      }
      writeLocalDrafts(drafts)
    }
    return { success: true, id }
  }

  if (useMock) {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 200));
    mockDeploymentsStore = mockDeploymentsStore.map(item => (
      item.id === id
        ? {
            ...item,
            deploymentStatus: 'stopped',
            lastStatusChange: Date.now(),
          }
        : item
    ))
    return { success: true };
  } else {
    try {
      const params = buildDeploymentIdentityParams(deployment)
      const url = `${API_BASE}/backend/deployments/stop?${params.toString()}`;
      console.log('🔵 Stopping deployment:', id || `${deployment.productSource}/${deployment.productType}`);
      console.log('   URL:', url);

      const response = await fetchWithUserId(url, { method: 'POST' });
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

function buildDeleteRequestParams(target, isPermanent) {
  return buildDeploymentIdentityParams(target, { isPermanent: Boolean(isPermanent) })
}

export async function deleteDeployment(target, useMock = false, isPermanent = false) {
  const deployment = normalizeDeploymentTarget(target)
  const id = deployment.id

  // Local-only draft rows are never on the backend — just remove from localStorage.
  if (String(id).startsWith('local-draft:')) {
    const drafts = readLocalDrafts()
    if (drafts[id]) {
      drafts[id] = {
        ...drafts[id],
        previousDeploymentStatus: drafts[id].deploymentStatus === 'deleted'
          ? (drafts[id].previousDeploymentStatus || inferRestoredStatus(drafts[id]))
          : (drafts[id].deploymentStatus || inferRestoredStatus(drafts[id])),
        deploymentStatus: 'deleted',
        lastStatusChange: Date.now(),
      }
    }
    writeLocalDrafts(drafts)
    return { success: true, id }
  }

  if (useMock) {
    await new Promise(r => setTimeout(r, 200));
    mockDeploymentsStore = mockDeploymentsStore.map(item => (
      item.id === id
        ? {
            ...item,
            previousDeploymentStatus: item.deploymentStatus === 'deleted'
              ? (item.previousDeploymentStatus || inferRestoredStatus(item))
              : (item.deploymentStatus || inferRestoredStatus(item)),
            deploymentStatus: 'deleted',
            lastStatusChange: Date.now(),
          }
        : item
    ))
    return { success: true, id };
  } else {
    try {
      const params = buildDeleteRequestParams(deployment, isPermanent)
      const url = `${API_BASE}/backend/deployments/delete?${params.toString()}`;
      console.log('🔵 Deleting deployment:', id || `${deployment.productSource}/${deployment.productType}`);
      console.log('   URL:', url);

      const response = await fetchWithUserId(url, { method: 'DELETE' });
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

function inferRestoredStatus(item) {
  if (item?.previousDeploymentStatus && item.previousDeploymentStatus !== 'deleted') {
    return item.previousDeploymentStatus
  }

  if (item?.deployedVersion) return 'running'
  return 'draft'
}

export async function restoreDeployment(id, useMock = false) {
  if (String(id).startsWith('local-draft:')) {
    const drafts = readLocalDrafts()
    if (drafts[id]) {
      const restoredStatus = inferRestoredStatus(drafts[id])
      drafts[id] = {
        ...drafts[id],
        deploymentStatus: restoredStatus,
        previousDeploymentStatus: restoredStatus,
        lastStatusChange: Date.now(),
      }
      writeLocalDrafts(drafts)
    }
    return { success: true, id }
  }

  if (useMock) {
    await new Promise(r => setTimeout(r, 200))
    mockDeploymentsStore = mockDeploymentsStore.map(item => (
      item.id === id
        ? {
            ...item,
            deploymentStatus: inferRestoredStatus(item),
            previousDeploymentStatus: inferRestoredStatus(item),
            lastStatusChange: Date.now(),
          }
        : item
    ))
    return { success: true, id }
  }

  try {
    const url = `${API_BASE}/backend/deployments/${id}/restore`
    const response = await fetchWithUserId(url, { method: 'POST' })

    if (!response.ok) {
      throw new Error(`Restore failed with status: ${response.status}`)
    }

    return await response.json().catch(() => ({ success: true, id }))
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function permanentlyDeleteDeployment(target, useMock = false) {
  const deployment = normalizeDeploymentTarget(target)
  const id = deployment.id

  if (String(id).startsWith('local-draft:')) {
    return deleteDeployment(deployment, useMock, true)
  }

  if (useMock) {
    await new Promise(r => setTimeout(r, 200))
    mockDeploymentsStore = mockDeploymentsStore.filter(item => item.id !== id)
    return { success: true, id }
  }

  return deleteDeployment(deployment, useMock, true)
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

      const response = await fetchWithUserId(url);
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
