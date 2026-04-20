import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleArrowUp, Hand, Rocket, RotateCcw, SquarePen, Trash2 } from 'lucide-react';
import { Btn, Card, Chip, DeployProgressModal, FilterTabs, ModalDialog, Tooltip } from '../../shared/components/index.jsx';
import * as deploymentsService from '../../shared/services/deploymentsService.js';
import { fetchDeploymentSteps, subscribeToDeploymentProgress, deployFromYaml }
  from '../../shared/services/deploymentsService.js';
import { fetchDraftConfiguration, fetchSavedDraftYaml } from '../../shared/services/configService.js';
import { copyTextToClipboard } from '../../shared/services/clipboard.js';
import { hydrateWizardStateFromYaml } from '../../shared/services/configurationHydrator.js';
import { buildPipelineChangeSignature } from '../../shared/services/pipelineChangeDetection.js';
import { useDeploymentProgress } from '../../shared/hooks/useDeploymentProgress.js';
import { formatEnvironmentLabel, normalizeEnvironmentValue } from '../../shared/types/index.js'
import { useWizard } from '../../shared/store/wizardStore.jsx';
import { useMockMode } from '../../shared/store/mockModeContext.jsx';
import { useUser } from '../../shared/store/userContext.jsx';

const STATUS_COLORS = {
  draft: 'amber',
  running: 'green',
  stopped: 'red',
  failed: 'red',
};

// Add CSS for icon buttons and pulse animation
const ICON_BUTTON_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  padding: 0,
  border: '1px solid var(--border)',
  borderRadius: '6px',
  background: 'var(--bg)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: '16px',
  fontWeight: 'bold',
  transition: 'all 0.15s',
  userSelect: 'none',
  position: 'relative',
};

const PULSE_ANIMATION = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

function formatDateShort(ts) {
  const d = parseManagementTimestamp(ts)
  if (!d) return String(ts ?? '')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:${mins}`;
}

function parseManagementTimestamp(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const rawValue = String(value ?? '').trim()
  if (!rawValue) return null

  const bareIsoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/)
  if (bareIsoMatch) {
    const [, year, month, day, hours, minutes, seconds = '0', milliseconds = '0'] = bareIsoMatch
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds),
      Number(milliseconds.padEnd(3, '0')),
    )

    return Number.isNaN(date.getTime()) ? null : date
  }

  const date = new Date(rawValue)
  return Number.isNaN(date.getTime()) ? null : date
}

const BASE_COLUMNS = [
  { key: 'productSource', label: 'Product Source' },
  { key: 'productType', label: 'Product Type' },
  { key: 'environment', label: 'Environment' },
  { key: 'deploymentStatus', label: 'Status' },
  { key: 'savedVersion', label: 'Saved Version' },
  { key: 'deployedVersion', label: 'Deployed Version' },
  { key: 'lastStatusChange', label: 'Last Status Change' },
];

function getManagementColumns(isAdminUser = false) {
  if (!isAdminUser) return BASE_COLUMNS

  return [
    BASE_COLUMNS[0],
    BASE_COLUMNS[1],
    BASE_COLUMNS[2],
    BASE_COLUMNS[3],
    { key: 'teamName', label: 'Team Name' },
    ...BASE_COLUMNS.slice(4),
  ]
}

const SORT_INDICATOR_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '12px',
  minWidth: '12px',
  fontSize: '10px',
  lineHeight: 1,
};

function buildPreviewStorageKey(deploymentId, previewSource) {
  return `etl-deployment-preview:${deploymentId}:${previewSource}`;
}

const MANAGEMENT_TABS = [
  { id: 'all', label: 'All' },
  { id: 'prod', label: 'PROD' },
  { id: 'stage', label: 'CAP' },
  { id: 'deleted', label: 'Deleted' },
];

const MANAGEMENT_DEPLOYMENT_COPY = {
  deploy: {
    loadingKey: 'deploy',
    modalTitle: 'Deploying pipeline from management...',
    modalSuccessTitle: 'Deployment completed successfully',
    modalFailureTitle: 'Deployment failed',
    failureDialogTitle: 'Deployment Failed',
    successOverlayTitle: 'Pipeline Deployed!',
    successOverlayDescription: 'Your ETL pipeline has been deployed and is now running.',
  },
  upgrade: {
    loadingKey: 'upgrade',
    modalTitle: 'Upgrading pipeline from management...',
    modalSuccessTitle: 'Upgrade completed successfully',
    modalFailureTitle: 'Upgrade failed',
    failureDialogTitle: 'Upgrade Failed',
    successOverlayTitle: 'Pipeline Upgraded!',
    successOverlayDescription: 'Your ETL pipeline has been upgraded and is now running the latest saved version.',
  },
};

function matchesManagementTab(deployment, tabId) {
  const environment = normalizeEnvironmentValue(deployment?.environment);
  const status = String(deployment?.deploymentStatus || '').toLowerCase();

  switch (tabId) {
    case 'prod':
      return environment === 'PROD';
    case 'stage':
      return environment === 'CAP';
    case 'deleted':
      return status === 'deleted';
    case 'all':
    default:
      return true;
  }
}

export function getManagementSearchTerms(filterText = '') {
  return String(filterText || '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function getManagementSearchValue(deployment, columnKey) {
  const value = deployment?.[columnKey]

  if (value == null) return ''

  if (columnKey === 'lastStatusChange') {
    const date = parseManagementTimestamp(value)
    const formattedValue = date ? formatDateShort(value) : ''

    return [String(value), formattedValue]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
  }

  if (columnKey === 'environment') {
    const normalizedEnvironment = normalizeEnvironmentValue(value)
    return [String(value), normalizedEnvironment, formatEnvironmentLabel(value)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
  }

  return String(value).toLowerCase()
}

export function matchesManagementSearch(deployment, filterText, columns = BASE_COLUMNS) {
  const terms = Array.isArray(filterText) ? filterText : getManagementSearchTerms(filterText)

  if (terms.length === 0) return true

  return terms.every(term => columns.some(col => {
    const searchValue = getManagementSearchValue(deployment, col.key)
    return searchValue.includes(term)
  }))
}

function buildPreviewUrl(deploymentId, previewSource) {
  const params = new URLSearchParams({
    preview: 'true',
    deploymentId,
    previewSource,
  });

  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

function tokenizeVersion(value) {
  return String(value || '')
    .trim()
    .match(/[A-Za-z]+|\d+/g) || []
}

export function compareDeploymentVersions(leftVersion, rightVersion) {
  const leftTokens = tokenizeVersion(leftVersion)
  const rightTokens = tokenizeVersion(rightVersion)
  const maxLength = Math.max(leftTokens.length, rightTokens.length)

  for (let index = 0; index < maxLength; index += 1) {
    const leftToken = leftTokens[index]
    const rightToken = rightTokens[index]

    if (leftToken === undefined && rightToken === undefined) return 0
    if (leftToken === undefined) return -1
    if (rightToken === undefined) return 1

    const leftIsNumber = /^\d+$/.test(leftToken)
    const rightIsNumber = /^\d+$/.test(rightToken)

    if (leftIsNumber && rightIsNumber) {
      const leftNumber = Number(leftToken)
      const rightNumber = Number(rightToken)
      if (leftNumber !== rightNumber) return leftNumber > rightNumber ? 1 : -1
      continue
    }

    const comparison = leftToken.localeCompare(rightToken, undefined, { sensitivity: 'base' })
    if (comparison !== 0) return comparison > 0 ? 1 : -1
  }

  return 0
}

function isSavedVersionNewer(savedVersion, deployedVersion) {
  if (!savedVersion || !deployedVersion) return false
  return compareDeploymentVersions(savedVersion, deployedVersion) > 0
}

function buildDeploymentRowKey(deploymentRow, fallbackTeamName = 'default') {
  const backendId = String(deploymentRow?.id || '').trim() || 'no-id'
  const team = String(deploymentRow?.teamName || fallbackTeamName || '').trim().toLowerCase() || 'default'
  const source = String(deploymentRow?.productSource || deploymentRow?.source || '').trim().toLowerCase()
  const productType = String(deploymentRow?.productType || '').trim().toLowerCase()
  const environment = normalizeEnvironmentValue(deploymentRow?.environment, 'PROD').trim().toLowerCase()

  return [backendId, team, source, productType, environment].join('::')
}

function getDeploymentSourceValue(deploymentRow) {
  return String(deploymentRow?.productSource || deploymentRow?.source || '').trim()
}

export default function ETLManagementScreen() {
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [sortKey, setSortKey] = useState('productType');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterText, setFilterText] = useState("");
  const [teamFilter, setTeamFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
  const [screenError, setScreenError] = useState('');
  const [screenNotice, setScreenNotice] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [deployVersionDialog, setDeployVersionDialog] = useState(null);
  const [errorModal, setErrorModal] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);   // success overlay data
  const [successCopied, setSuccessCopied] = useState(false);
  const [activeDeployId, setActiveDeployId] = useState(null);
  const [activeDeploymentAction, setActiveDeploymentAction] = useState('deploy');
  const { actions, state } = useWizard();
  const { useMock } = useMockMode();
  const { user } = useUser();

  // Use team name from user context
  const teamName = user?.teamName || 'default';
  const isAdminUser = user?.role === 'admin'
  const managementColumns = useMemo(() => getManagementColumns(isAdminUser), [isAdminUser])
  const activeDeploymentCopy = MANAGEMENT_DEPLOYMENT_COPY[activeDeploymentAction] || MANAGEMENT_DEPLOYMENT_COPY.deploy;
  const adminTeamOptions = useMemo(() => Array.from(new Set(
    deployments
      .map(dep => String(dep?.teamName || '').trim())
      .filter(Boolean)
  )).sort((left, right) => left.localeCompare(right)), [deployments])

  const getDeploymentTeamName = (deploymentRow) => String(deploymentRow?.teamName || teamName || '').trim() || 'default'
  const getDeploymentRowKey = (deploymentRow) => buildDeploymentRowKey(deploymentRow, teamName)

  useEffect(() => {
    if (!isAdminUser) {
      setTeamFilter('all')
      return
    }

    if (teamFilter !== 'all' && !adminTeamOptions.includes(teamFilter)) {
      setTeamFilter('all')
    }
  }, [adminTeamOptions, isAdminUser, teamFilter])

  const handleSuccessOverlayCopy = async (text) => {
    try {
      await copyTextToClipboard(text);
      setSuccessCopied(true);
      setTimeout(() => setSuccessCopied(false), 2000);
    } catch {
      setErrorModal({
        icon: '⚠️',
        title: 'Copy Failed',
        message: 'Clipboard access is blocked in this environment. Please copy the Grafana dashboard link manually.',
      });
    }
  };

  const deployment = useDeploymentProgress({
    autoAdvance: false,  // steps are driven by SSE events (or mock simulation)
    stepDuration: 700,
    onDeploymentComplete: async () => {
      if (activeDeployId) {
        await refreshDeployments();
        setActionLoading(a => ({ ...a, [activeDeployId]: null }));
        setScreenNotice({
          tone: 'success',
          message: 'Deployment completed successfully. The table has been refreshed.',
        });
        setActiveDeployId(null);
      }
    },
    onDeploymentError: (_stepIndex, error) => {
      if (activeDeployId) {
        setActionLoading(a => ({ ...a, [activeDeployId]: null }));
        setActiveDeployId(null);
      }
      setScreenError(error || 'Deployment failed.');
      setScreenNotice(null);
    },
  });

  // Holds the SSE / simulation cleanup function for the active deployment
  const sseCleanupRef = useRef(null);

  // Close the SSE stream when the user closes the modal early
  useEffect(() => {
    if (!deployment.isOpen && sseCleanupRef.current) {
      sseCleanupRef.current();
      sseCleanupRef.current = null;
    }
  }, [deployment.isOpen]);

  // Always clean up on unmount
  useEffect(() => () => { sseCleanupRef.current?.() }, []);

  async function refreshDeployments() {
    setLoading(true);
    try {
      const data = await deploymentsService.fetchDeployments(teamName, useMock, { includeAllTeams: isAdminUser });
      setDeployments(data);
      return data;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshDeployments();
  }, [teamName, useMock, isAdminUser]);

  // Clear screenNotice after 10 seconds
  useEffect(() => {
    if (screenNotice) {
      const timer = setTimeout(() => {
        setScreenNotice(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [screenNotice]);

  // Clear screenError after 10 seconds
  useEffect(() => {
    if (screenError) {
      const timer = setTimeout(() => {
        setScreenError('');
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [screenError]);

  const handleSort = (columnKey) => {
    if (sortKey === columnKey) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(columnKey);
      setSortOrder('asc');
    }
  };

  const tabCounts = useMemo(() => Object.fromEntries(
    MANAGEMENT_TABS.map(tab => [tab.id, deployments.filter(dep => matchesManagementTab(dep, tab.id)).length])
  ), [deployments]);

  const tabDeployments = useMemo(() => (
    deployments.filter(dep => matchesManagementTab(dep, activeTab))
  ), [activeTab, deployments]);

  const visibleDeployments = useMemo(() => {
    const searchTerms = getManagementSearchTerms(filterText)

    return deployments.filter(dep => {
      if (!matchesManagementTab(dep, activeTab)) return false;
      if (isAdminUser && teamFilter !== 'all' && String(dep?.teamName || '').trim() !== teamFilter) return false
      return matchesManagementSearch(dep, searchTerms, managementColumns)
    });
  }, [activeTab, deployments, filterText, isAdminUser, managementColumns, teamFilter]);

  const sortedDeployments = useMemo(() => [...visibleDeployments].sort((a, b) => {
    let aVal = a[sortKey];
    let bVal = b[sortKey];

    if (sortKey === 'lastStatusChange') {
      aVal = parseManagementTimestamp(aVal)?.getTime() ?? null
      bVal = parseManagementTimestamp(bVal)?.getTime() ?? null
    }

    // Special sorting for status: 'running' always comes first
    if (sortKey === 'deploymentStatus') {
      if (aVal === 'running' && bVal !== 'running') return -1;
      if (aVal !== 'running' && bVal === 'running') return 1;
    }

    // Handle null values
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return sortOrder === 'asc' ? 1 : -1;
    if (bVal == null) return sortOrder === 'asc' ? -1 : 1;

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  }), [sortKey, sortOrder, visibleDeployments]);

  const updateDeploymentRowStatus = (deploymentRow, deploymentStatus, extraFields = {}) => {
    const targetRowKey = getDeploymentRowKey(deploymentRow)

    deploymentsService.setDeploymentStatus({
      teamName: getDeploymentTeamName(deploymentRow),
      productSource: deploymentRow.productSource,
      productType: deploymentRow.productType,
      environment: deploymentRow.environment || 'PROD',
      deploymentStatus,
      savedVersion: extraFields.savedVersion ?? deploymentRow.savedVersion,
      deployedVersion: extraFields.deployedVersion ?? deploymentRow.deployedVersion,
    });

    setDeployments(current => current.map(item => (
      getDeploymentRowKey(item) === targetRowKey
        ? {
            ...item,
            deploymentStatus,
            lastStatusChange: Date.now(),
            ...extraFields,
          }
        : item
    )));
  };

  const runManagementDeploymentAction = async (deploymentRow, mode, { isSavedVersion = false } = {}) => {
    const actionCopy = MANAGEMENT_DEPLOYMENT_COPY[mode] || MANAGEMENT_DEPLOYMENT_COPY.deploy;
    const isDeploy = mode !== 'upgrade';
    const rowKey = getDeploymentRowKey(deploymentRow);
    if (actionLoading[rowKey]) return;

    setScreenError('');
    setScreenNotice(null);
    setActiveDeployId(rowKey);
    setActiveDeploymentAction(mode);
    setActionLoading(a => ({ ...a, [rowKey]: actionCopy.loadingKey }));

    console.log(`[handle${mode === 'upgrade' ? 'Upgrade' : 'Deploy'}] ── start ──────────────────────`);
    console.log(`[handle${mode === 'upgrade' ? 'Upgrade' : 'Deploy'}] pipeline id:`, deploymentRow.id);

    const showActionError = (msg) => {
      updateDeploymentRowStatus(deploymentRow, 'failed');
      deployment.reset();
      setErrorModal({ icon: '❌', title: actionCopy.failureDialogTitle, message: msg });
      setActionLoading(a => ({ ...a, [rowKey]: null }));
      setActiveDeployId(null);
      setActiveDeploymentAction('deploy');
    };

    // 1. Fetch the ordered step list from the backend (falls back to built-in list)
    const steps = await fetchDeploymentSteps(false);
    console.log(`[handle${mode === 'upgrade' ? 'Upgrade' : 'Deploy'}] steps:`, steps.length, steps.map(s => s.id));

    // 2. Open the progress modal immediately — all steps shown as 'pending'
    deployment.startDeployment(steps);

    // 3. Fetch the saved YAML for this pipeline, then POST it to the same
    //    deploy endpoint used by the Summary wizard tab.
    const environment = deploymentRow.environment || 'PROD';
      const deploymentTeamName = getDeploymentTeamName(deploymentRow)
    let yamlText;
    try {
      console.log(`[handle${mode === 'upgrade' ? 'Upgrade' : 'Deploy'}] fetching ${isSavedVersion ? 'saved' : 'deployed'} YAML for`, deploymentRow.productType, '/', deploymentRow.productSource);
      const fetchYaml = isSavedVersion ? fetchSavedDraftYaml : fetchDraftConfiguration
      yamlText = await fetchYaml({
        productType: deploymentRow.productType,
        source: deploymentRow.productSource,
          team: deploymentTeamName,
        environment,
      }, false);
    } catch (fetchErr) {
      const msg = fetchErr?.message || 'Failed to fetch pipeline configuration.';
      console.error(`[handle${mode === 'upgrade' ? 'Upgrade' : 'Deploy'}] fetchDraftConfiguration failed:`, msg);
      showActionError(msg);
      return;
    }

    if (!yamlText) {
      showActionError('No saved YAML configuration found for this pipeline.');
      return;
    }

    console.log(`[handle${mode === 'upgrade' ? 'Upgrade' : 'Deploy'}] posting YAML to deploy endpoint...`);
    const result = await deployFromYaml({
      productType: deploymentRow.productType,
      source: deploymentRow.productSource,
      team: deploymentTeamName,
      environment,
      isDeploy,
      isSavedVersion,
      configurationYaml: yamlText,
    });
    console.log(`[handle${mode === 'upgrade' ? 'Upgrade' : 'Deploy'}] deployFromYaml result:`, JSON.stringify(result));

    if (!result || result.success === false) {
      showActionError(result?.error || `Unable to start ${mode === 'upgrade' ? 'upgrade' : 'deployment'}.`);
      return;
    }

    // The backend may use any of these field names for the run ID.
    const deploymentId =
      result?.deploymentId ??
      result?.id           ??
      result?.runId        ??
      result?.run_id       ??
      result?.jobId        ??
      result?.job_id;
    console.log(`[handle${mode === 'upgrade' ? 'Upgrade' : 'Deploy'}] full result:`, JSON.stringify(result));
    console.log(`[handle${mode === 'upgrade' ? 'Upgrade' : 'Deploy'}] opening SSE stream for deploymentId:`, deploymentId);

    if (!deploymentId) {
      showActionError('Server did not return a deployment ID. Cannot track progress.');
      return;
    }

    // ── Shared SSE failure handler ────────────────────────────────────────
    const handleFailure = (stepIndex, error) => {
      const msg = error || 'Deployment step failed.';
      const idx = typeof stepIndex === 'number' ? stepIndex : 0;
      console.warn(`[handle${mode === 'upgrade' ? 'Upgrade' : 'Deploy'}] failure at step`, idx, ':', msg);
      showActionError(msg);
    };

    // ── Progress callbacks driven by SSE events ───────────────────────────
    const progressCallbacks = {
      onStepStart: ({ stepIndex, label } = {}) => {
        console.log(`[handle${mode === 'upgrade' ? 'Upgrade' : 'Deploy'}] → step-start`, stepIndex, label);
        if (typeof stepIndex !== 'number') {
          console.warn(`[handle${mode === 'upgrade' ? 'Upgrade' : 'Deploy'}] step-start missing stepIndex:`, { stepIndex, label });
          return;
        }
        deployment.setCurrentStepIndex(stepIndex);
        deployment.updateStep(stepIndex, {
          status: 'active',
          ...(label ? { label } : {}),
        });
      },
      onStepComplete: ({ stepIndex, label } = {}) => {
        console.log(`[handle${mode === 'upgrade' ? 'Upgrade' : 'Deploy'}] → step-complete`, stepIndex);
        if (typeof stepIndex !== 'number') {
          console.warn(`[handle${mode === 'upgrade' ? 'Upgrade' : 'Deploy'}] step-complete missing stepIndex:`, { stepIndex });
          return;
        }
        deployment.updateStep(stepIndex, {
          status: 'done',
          ...(label ? { label } : {}),
        });
        if (stepIndex < steps.length - 1) {
          deployment.setCurrentStepIndex(stepIndex + 1);
          deployment.updateStep(stepIndex + 1, { status: 'active' });
        }
      },
      onStepFailed: ({ stepIndex, error } = {}) => handleFailure(stepIndex, error),
      onComplete: async () => {
        console.log(`[handle${mode === 'upgrade' ? 'Upgrade' : 'Deploy'}] → deployment-complete`);
        deployment.updateStep(steps.length - 1, { status: 'done' });
        deployment.setIsComplete(true);
        updateDeploymentRowStatus(deploymentRow, 'running', {
          deployedVersion: isSavedVersion
            ? (deploymentRow.savedVersion ?? deploymentRow.deployedVersion)
            : deploymentRow.deployedVersion,
        });
        try { await refreshDeployments(); } catch (e) {
          console.warn(`[handle${mode === 'upgrade' ? 'Upgrade' : 'Deploy'}] refresh failed:`, e);
        }
        setActionLoading(a => ({ ...a, [rowKey]: null }));
        setActiveDeployId(null);
        setTimeout(() => {
          deployment.reset();
          const pipelineId = `ETL-${Date.now().toString(36).toUpperCase()}`;
          const grafanaLink = `https://grafana.etl-studio.io/d/pipeline-${pipelineId.toLowerCase()}` +
            `?source=${encodeURIComponent(deploymentRow.productSource || '')}` +
            `&type=${encodeURIComponent(deploymentRow.productType || '')}` +
            `&refresh=30s`;
          setSuccessInfo({
            mode,
            title: actionCopy.successOverlayTitle,
            description: actionCopy.successOverlayDescription,
            productType:   deploymentRow.productType,
            productSource: deploymentRow.productSource,
            environment,
            pipelineId,
            grafanaLink,
          });
          setActiveDeploymentAction('deploy');
        }, 500);
      },
      onConnectionError: (msg) => {
        console.warn(`[handle${mode === 'upgrade' ? 'Upgrade' : 'Deploy'}] → SSE connection error:`, msg);
        handleFailure(undefined, msg);
      },
    };

    sseCleanupRef.current = subscribeToDeploymentProgress(deploymentId, progressCallbacks);
    console.log(`[handle${mode === 'upgrade' ? 'Upgrade' : 'Deploy'}] SSE stream opened`);
  };

  const handleDeploy = async (deploymentRow) => {
    const hasDeployedVersion = String(deploymentRow?.deployedVersion ?? '').trim() !== ''

    if (!hasDeployedVersion) {
      await runManagementDeploymentAction(deploymentRow, 'deploy', { isSavedVersion: true });
      return;
    }

    if (isSavedVersionNewer(deploymentRow.savedVersion, deploymentRow.deployedVersion)) {
      setDeployVersionDialog({
        deploymentRow,
        title: 'Choose version to deploy',
        message: `Select which version to deploy for ${deploymentRow.productSource} / ${deploymentRow.productType}.`,
      });
      return;
    }

    await runManagementDeploymentAction(deploymentRow, 'deploy', { isSavedVersion: false });
  };

  const handleDelete = async (deploymentRow) => {
    const rowKey = getDeploymentRowKey(deploymentRow);
    setScreenError('');
    setScreenNotice(null);
    setActionLoading(a => ({ ...a, [rowKey]: 'delete' }));
    console.log('[ETLManagementScreen] handleDelete, useMock:', useMock);
    const result = await deploymentsService.deleteDeployment({
      ...deploymentRow,
      teamName: getDeploymentTeamName(deploymentRow),
      environment: deploymentRow.environment || 'PROD',
    }, useMock);

    if (result?.success !== false) {
      await refreshDeployments();
      setScreenNotice({
        tone: 'success',
        message: 'Pipeline deleted. You can find it under the Deleted tab.',
      });
    } else {
      setScreenError(result?.error || 'Failed to delete the selected deployment.');
    }

    setActionLoading(a => ({ ...a, [rowKey]: null }));
  };

  const handlePermanentDelete = async (deploymentRow) => {
    const rowKey = getDeploymentRowKey(deploymentRow);
    setScreenError('');
    setScreenNotice(null);
    setActionLoading(a => ({ ...a, [rowKey]: 'delete-permanent' }));
    console.log('[ETLManagementScreen] handlePermanentDelete, useMock:', useMock);
    const result = await deploymentsService.permanentlyDeleteDeployment({
      ...deploymentRow,
      teamName: getDeploymentTeamName(deploymentRow),
      environment: deploymentRow.environment || 'PROD',
    }, useMock);

    if (result?.success !== false) {
      await refreshDeployments();
      setScreenNotice({
        tone: 'success',
        message: 'Pipeline permanently deleted.',
      });
    } else {
      setScreenError(result?.error || 'Failed to permanently delete the selected pipeline.');
    }

    setActionLoading(a => ({ ...a, [rowKey]: null }));
  };

  const handleRestore = async (id, rowKey = id) => {
    setScreenError('');
    setScreenNotice(null);
    setActionLoading(a => ({ ...a, [rowKey]: 'restore' }));
    const result = await deploymentsService.restoreDeployment(id, useMock);

    if (result?.success !== false) {
      await refreshDeployments();
      setScreenNotice({
        tone: 'success',
        message: 'Pipeline restored successfully.',
      });
    } else {
      setScreenError(result?.error || 'Failed to restore the selected pipeline.');
    }

    setActionLoading(a => ({ ...a, [rowKey]: null }));
  };

  const handleStop = async (deploymentRow) => {
    const rowKey = getDeploymentRowKey(deploymentRow);
    setScreenError('');
    setScreenNotice(null);
    setActionLoading(a => ({ ...a, [rowKey]: 'stop' }));

    const result = await deploymentsService.stopDeployment({
      ...deploymentRow,
      teamName: getDeploymentTeamName(deploymentRow),
      environment: deploymentRow.environment || 'PROD',
    }, useMock);

    if (result?.success !== false) {
      updateDeploymentRowStatus(deploymentRow, 'stopped');
      await refreshDeployments();
      setScreenNotice({
        tone: 'success',
        message: 'Pipeline stopped successfully.',
      });
    } else {
      setScreenError(result?.error || 'Failed to stop the selected pipeline.');
    }

    setActionLoading(a => ({ ...a, [rowKey]: null }));
  };

  const handleUpgrade = async (deploymentRow) => {
    console.log('[ETLManagementScreen] handleUpgrade, useMock:', useMock);
    await runManagementDeploymentAction(deploymentRow, 'upgrade');
  };

  const handleEdit = async (dep) => {
    const rowKey = getDeploymentRowKey(dep)
    const deploymentSource = getDeploymentSourceValue(dep)
    setActionLoading(a => ({ ...a, [rowKey]: 'edit' }));
    setScreenError('');
    setScreenNotice(null);
    console.log('[ETLManagementScreen] handleEdit, useMock:', useMock);

    try {
      const environment = dep.environment || state.metadata.environment || 'PROD';
      const deploymentTeamName = getDeploymentTeamName(dep)
      const yamlText = await fetchDraftConfiguration({
        productType: dep.productType,
        source: deploymentSource,
        team: deploymentTeamName,
        environment,
      }, useMock);

      const loadedState = hydrateWizardStateFromYaml(yamlText, {
        productType: dep.productType,
        source: deploymentSource,
        teamName: deploymentTeamName,
        environment,
      });

      actions.loadState({
        ...loadedState,
        navigationMode: 'etl-config',
        currentStep: 0,
        originalDraftYaml: yamlText,
        originalDraftSignature: buildPipelineChangeSignature(loadedState),
        completedSteps: [0, 1, 2, 3, 4, 5, 6],
      });
    } catch (error) {
      console.error('[ETLManagementScreen] failed to edit deployment:', error);
      setScreenError(error?.message || 'Failed to load deployment configuration.');
    } finally {
      setActionLoading(a => ({ ...a, [rowKey]: null }));
    }
  };

  /**
   * Fetches the saved-draft YAML from /api/backend/configuration/draft/yaml and
   * opens a new browser window pre-loaded with all the configuration tabs
   * filled in from that YAML as a read-only preview for this deployment.
   */
  const handleViewSavedVersion = async (dep) => {
    const savedVersionActionKey = `${getDeploymentRowKey(dep)}_savedVersion`
    const deploymentSource = getDeploymentSourceValue(dep)
    setActionLoading(a => ({ ...a, [savedVersionActionKey]: true }));
    setScreenError('');
    setScreenNotice(null);

    try {
      const environment = dep.environment || state.metadata.environment || 'PROD';
      const deploymentTeamName = getDeploymentTeamName(dep)

      const yamlText = await fetchSavedDraftYaml({
        productType: dep.productType,
        source: deploymentSource,
        team: deploymentTeamName,
        environment,
      }, useMock);

      if (!yamlText) {
        setScreenError('No saved YAML configuration found for this pipeline version.');
        return;
      }

      const loadedState = hydrateWizardStateFromYaml(yamlText, {
        productType: dep.productType,
        source: deploymentSource,
        teamName: deploymentTeamName,
        environment,
      });

      const draftKey = buildPreviewStorageKey(dep.id, 'saved');
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          wizardState: {
            ...loadedState,
            navigationMode: 'etl-config',
            readOnly: true,
            currentStep: 0,
            completedSteps: [0, 1, 2, 3, 4, 5, 6],
          },
        }),
      );

      window.open(
        buildPreviewUrl(dep.id, 'saved'),
        '_blank',
      );
    } catch (error) {
      console.error('[ETLManagementScreen] handleViewSavedVersion failed:', error);
      setScreenError(error?.message || 'Failed to load saved draft configuration.');
    } finally {
      setActionLoading(a => ({ ...a, [savedVersionActionKey]: false }));
    }
  };

  /**
   * Fetches the deployed YAML from /api/backend/configuration/yaml and
   * opens a new read-only window with all configuration tabs pre-filled.
   */
  const handleViewDeployedVersion = async (dep) => {
    const deployedVersionActionKey = `${getDeploymentRowKey(dep)}_deployedVersion`
    const deploymentSource = getDeploymentSourceValue(dep)
    setActionLoading(a => ({ ...a, [deployedVersionActionKey]: true }));
    setScreenError('');
    setScreenNotice(null);

    try {
      const environment = dep.environment || state.metadata.environment || 'PROD';
      const deploymentTeamName = getDeploymentTeamName(dep)

      const yamlText = await fetchDraftConfiguration({
        productType: dep.productType,
        source: deploymentSource,
        team: deploymentTeamName,
        environment,
      }, useMock);

      if (!yamlText) {
        setScreenError('No deployed YAML configuration found for this pipeline version.');
        return;
      }

      const loadedState = hydrateWizardStateFromYaml(yamlText, {
        productType: dep.productType,
        source: deploymentSource,
        teamName: deploymentTeamName,
        environment,
      });

      const draftKey = buildPreviewStorageKey(dep.id, 'deployed');
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          wizardState: {
            ...loadedState,
            navigationMode: 'etl-config',
            readOnly: true,
            currentStep: 0,
            completedSteps: [0, 1, 2, 3, 4, 5, 6],
          },
        }),
      );

      window.open(
        buildPreviewUrl(dep.id, 'deployed'),
        '_blank',
      );
    } catch (error) {
      console.error('[ETLManagementScreen] handleViewDeployedVersion failed:', error);
      setScreenError(error?.message || 'Failed to load deployed configuration.');
    } finally {
      setActionLoading(a => ({ ...a, [deployedVersionActionKey]: false }));
    }
  };

  // Handler for creating new configuration
  function handleCreateNewConfig() {
    actions.loadState({
      navigationMode: 'etl-config',
      currentStep: 0,
      originalDraftYaml: '',
      originalDraftSignature: '',
      completedSteps: new Set(),
      metadata: {
        team: teamName,
        productSource: '',
        productType: '',
        productCode: '',
        location: '',
        environment: '',
        entityName: '',
        tags: '',
      },
      source: {},
      upload: {
        done: false,
        schema: [],
        fileName: '',
        fileType: '',
        fileSize: 0,
      },
      targetSchema: [],
      mappings: [],
      filters: [],
      sink: {},
    });
  }

  function requestDelete(dep) {
    setConfirmDialog({
      title: 'Delete deployment?',
      message: `Delete ${getDeploymentSourceValue(dep)} / ${dep.productType}? This will move the pipeline to the Deleted tab.`,
      tone: 'danger',
      icon: '🗑️',
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        await handleDelete(dep);
      },
    });
  }

  function requestPermanentDelete(dep) {
    setConfirmDialog({
      title: 'Delete permanently?',
      message: 'This will delete this pipeline permantly , are you sure you want to continue?',
      tone: 'danger',
      icon: '🗑️',
      confirmLabel: 'Delete permanently',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        await handlePermanentDelete(dep);
      },
    });
  }

  function requestRestore(dep) {
    setConfirmDialog({
      title: 'Restore pipeline?',
      message: 'Are you sure you want to restore this pipline ?',
      tone: 'accent',
      icon: '↩️',
      confirmLabel: 'Yes',
      cancelLabel: 'No',
      confirmVariant: 'primary',
      onConfirm: async () => {
        setConfirmDialog(null);
        await handleRestore(dep.id, getDeploymentRowKey(dep));
      },
    });
  }

  function requestEdit(dep) {
    setConfirmDialog({
      title: 'Open deployment for editing?',
      message: `You are about to open ${getDeploymentSourceValue(dep)} / ${dep.productType} in the wizard. Continue to the editable configuration flow?`,
      tone: 'accent',
      icon: '✏️',
      confirmLabel: 'Continue',
      confirmVariant: 'primary',
      onConfirm: async () => {
        setConfirmDialog(null);
        await handleEdit(dep);
      },
    });
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      flex: 1,
      minHeight: 0,
      padding: '24px 40px',
      background: 'var(--bg)',
      overflow: 'auto',
      boxSizing: 'border-box',
    }}>
      <style>{PULSE_ANIMATION}</style>
      <div style={{ width: '100%', maxWidth: 1300, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* Page Title and Subtitle */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text)' }}>
            Deployments
          </div>
        </div>
        <div style={{ 
          fontSize: '13px', 
          color: 'var(--muted)', 
          marginBottom: 16,
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <span>{isAdminUser ? (teamFilter === 'all' ? 'All teams' : teamFilter) : (teamName || 'default')}</span>
          <span>·</span>
          <span>{tabDeployments.length} {tabDeployments.length === 1 ? 'pipeline' : 'pipelines'}</span>
          <span>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s ease-in-out infinite' }}></span>
            <span style={{ color: '#22c55e' }}>{tabDeployments.filter(d => d.deploymentStatus === 'running').length} running</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }}></span>
            <span style={{ color: '#ef4444' }}>{tabDeployments.filter(d => d.deploymentStatus === 'stopped').length} stopped</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }}></span>
            <span style={{ color: '#f59e0b' }}>{tabDeployments.filter(d => d.deploymentStatus === 'draft').length} draft</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }}></span>
            <span style={{ color: '#dc2626' }}>{tabDeployments.filter(d => d.deploymentStatus === 'failed').length} failed</span>
          </span>
        </div>

        {/* Toolbar: Search + Create Button on Same Row */}
        <div
          data-testid="etl-management-toolbar"
          style={{ 
          display: 'flex', 
          gap: 12, 
          width: '100%', 
          marginBottom: 16, 
          alignItems: 'center'
        }}>
          <input
            type="text"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="🔍 Filter deployments..."
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              fontSize: 14,
              background: 'var(--bg)',
              color: 'var(--text)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {isAdminUser && (
            <select
              aria-label="Team filter"
              value={teamFilter}
              onChange={e => setTeamFilter(e.target.value)}
              style={{
                width: 180,
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                fontSize: 14,
                background: 'var(--bg)',
                color: 'var(--text)',
                boxSizing: 'border-box',
              }}
            >
              <option value="all">All Teams</option>
              {adminTeamOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          )}
          <Btn v="accent" onClick={handleCreateNewConfig} style={{ whiteSpace: 'nowrap' }}>
            + New Configuration
          </Btn>
        </div>
        <div
          data-testid="etl-management-notifications-row"
          style={{
            width: '100%',
            minHeight: 52,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'flex-start',
          }}
        >
          {(screenNotice || screenError) ? (
            <div style={{ width: '100%', display: 'grid', gap: 10 }}>
              {screenNotice && (
                <div
                  data-testid="etl-management-notice"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: screenNotice.tone === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(79,110,247,0.12)',
                    border: screenNotice.tone === 'success' ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(79,110,247,0.35)',
                    color: screenNotice.tone === 'success' ? 'var(--success)' : 'var(--accent)',
                    fontSize: 13,
                  }}
                >
                  {screenNotice.message}
                </div>
              )}
              {screenError && (
                <div
                  data-testid="etl-management-error"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.35)',
                    color: 'var(--danger)',
                    fontSize: 13,
                  }}
                >
                  {screenError}
                </div>
              )}
            </div>
          ) : null}
        </div>
        <div
          data-testid="etl-management-table-stack"
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            flex: '1 1 auto',
          }}
        >
          <div
            data-testid="etl-management-tabs-frame"
            style={{
              width: 'fit-content',
              maxWidth: '100%',
              background: 'transparent',
              padding: 0,
              marginBottom: -1,
              alignSelf: 'flex-start',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div data-testid="etl-management-tabs" style={{ width: '100%', flexShrink: 0 }}>
            <FilterTabs
              tabs={MANAGEMENT_TABS.map(tab => ({ ...tab, count: tabCounts[tab.id] || 0 }))}
              activeTab={activeTab}
              onChange={setActiveTab}
              style={{ marginBottom: 0, overflowX: 'visible' }}
              rowStyle={{
                minWidth: 'fit-content',
                background: 'var(--surf)',
                gap: 0,
                borderBottom: '1px solid var(--border)',
                borderTopLeftRadius: 10,
                borderTopRightRadius: 10,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                overflow: 'hidden',
                boxShadow: 'inset 0 0 0 1px var(--border)',
              }}
              tabStyle={{
                background: 'transparent',
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
                padding: '12px 14px 13px',
              }}
              activeTabStyle={{
                background: 'transparent',
                color: 'var(--text)',
              }}
              getTabStyle={(_tab, { isLast }) => ({
                borderRight: isLast ? 'none' : '1px solid var(--border)',
              })}
            />
          </div>
          </div>
          <div
            data-testid="etl-management-table-card"
            style={{
              width: '100%',
              background: 'var(--surf)',
              border: '1px solid var(--border)',
              borderTopLeftRadius: 10,
              borderTopRightRadius: 10,
              borderBottomLeftRadius: 10,
              borderBottomRightRadius: 10,
              overflow: 'hidden',
              minHeight: '260px',
              flex: '1 1 auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
          {loading ? (
            <div style={{ padding: '20px 24px', color: 'var(--muted)', fontSize: 14 }}>Loading deployments...</div>
          ) : sortedDeployments.length === 0 && filterText ? (
            <div style={{
              width: '100%',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              color: 'var(--muted)',
              minHeight: 260,
            }}>
              <div style={{ fontSize: 32 }}>🔍</div>
              <div style={{ fontSize: 14 }}>No deployments match "{filterText}"</div>
              <Btn v="secondary" sm onClick={() => setFilterText('')}>
                Clear filter
              </Btn>
            </div>
          ) : sortedDeployments.length === 0 ? (
            <div style={{
              width: '100%',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              color: 'var(--muted)',
              minHeight: 260,
            }}>
              <div style={{ fontSize: 30 }}>📑</div>
              <div style={{ fontSize: 14 }}>No pipelines in the {MANAGEMENT_TABS.find(tab => tab.id === activeTab)?.label || 'selected'} tab.</div>
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: '900px' }}>
                <thead>
                  <tr>
                    {managementColumns.map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        style={{
                          position: 'sticky',
                          top: 0,
                          zIndex: 2,
                          background: 'var(--surf)',
                          padding: 8,
                          cursor: 'pointer',
                          userSelect: 'none',
                          borderBottom: '2px solid var(--border)',
                          backgroundClip: 'padding-box',
                          transition: 'background .15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,110,247,.15)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--surf)'}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                          {col.label}
                          <span
                            data-testid={`sort-indicator-${col.key}`}
                            style={{
                              ...SORT_INDICATOR_STYLE,
                              visibility: sortKey === col.key ? 'visible' : 'hidden',
                            }}
                            aria-hidden="true"
                          >
                            {sortOrder === 'asc' ? '▲' : '▼'}
                          </span>
                        </span>
                      </th>
                    ))}
                    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--surf)', padding: 8, textAlign: 'center', borderBottom: '2px solid var(--border)', backgroundClip: 'padding-box' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDeployments.map(dep => {
                    const rowKey = getDeploymentRowKey(dep);
                    const savedVersionActionKey = `${rowKey}_savedVersion`;
                    const deployedVersionActionKey = `${rowKey}_deployedVersion`;
                    const hasVersionMismatch = dep.deployedVersion && dep.savedVersion && dep.deployedVersion !== dep.savedVersion;
                    const canUpgrade = hasVersionMismatch && dep.deploymentStatus === 'running';
                    const isRunning = dep.deploymentStatus === 'running';
                    const isDeletedRow = dep.deploymentStatus === 'deleted' && activeTab === 'deleted';
                    const deployTooltip = dep.deploymentStatus === 'running'
                      ? 'Already running'
                      : actionLoading[rowKey] === 'deploy'
                        ? 'Deploying pipeline'
                        : 'Deploy pipeline';
                    const stopTooltip = !isRunning
                      ? 'Pipeline is not running'
                      : actionLoading[rowKey] === 'stop'
                        ? 'Stopping pipeline'
                        : 'Stop pipeline';
                    const deleteTooltip = dep.deploymentStatus === 'running'
                      ? 'Cannot delete a running pipeline'
                      : actionLoading[rowKey] === 'delete'
                        ? 'Deleting pipeline'
                        : 'Delete pipeline';
                    const isPermanentDeleteDisabled = actionLoading[rowKey] === 'delete-permanent' || actionLoading[rowKey] === 'restore';
                    const isRestoreDisabled = actionLoading[rowKey] === 'restore' || actionLoading[rowKey] === 'delete-permanent';
                    const upgradeTooltip = !canUpgrade && hasVersionMismatch
                      ? 'Pipeline must be running'
                      : !canUpgrade
                        ? 'No update available'
                        : actionLoading[rowKey] === 'upgrade'
                          ? 'Upgrading deployment'
                          : 'Upgrade to latest version';
                    const editTooltip = actionLoading[rowKey] === 'edit'
                      ? 'Opening deployment editor'
                      : 'Edit configuration';

                    return (
                      <tr
                        key={rowKey}
                        style={{
                          borderTop: '1px solid var(--border)',
                          height: 44,
                        }}
                      >
                        <td style={{ padding: 8 }}>{getDeploymentSourceValue(dep)}</td>
                        <td style={{ padding: 8 }}>{dep.productType}</td>
                        <td style={{ padding: 8 }}>{formatEnvironmentLabel(dep.environment || 'PROD', dep.environment || 'PROD')}</td>
                        <td style={{ padding: 8 }}>
                          <Chip
                            c={STATUS_COLORS[dep.deploymentStatus] || 'muted'}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              minWidth: 80,
                              position: 'relative',
                            }}
                          >
                            <span style={{
                              display: 'inline-block',
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: 'currentColor',
                              animation: isRunning ? 'pulse 2s ease-in-out infinite' : 'none',
                            }}></span>
                            {dep.deploymentStatus}
                          </Chip>
                        </td>
                        {isAdminUser && <td style={{ padding: 8 }}>{dep.teamName || '—'}</td>}
                        <td style={{ padding: 8, fontFamily: 'var(--mono)', fontSize: 13 }}>
                          {dep.savedVersion ? (
                            <Tooltip
                              content={actionLoading[savedVersionActionKey]
                                ? '⏳ Loading configuration…'
                                : '👁 Open saved version preview'}
                              placement="top"
                              maxWidth={220}
                              bubbleStyle={{ whiteSpace: 'nowrap' }}
                            >
                              <button
                                onClick={() => handleViewSavedVersion(dep)}
                                disabled={!!actionLoading[savedVersionActionKey]}
                                onMouseEnter={e => { e.currentTarget.style.opacity = '0.75'; }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = actionLoading[savedVersionActionKey] ? '0.5' : '1'; }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: actionLoading[savedVersionActionKey] ? 'wait' : 'pointer',
                                  fontFamily: 'var(--mono)',
                                  fontSize: 13,
                                  color: 'var(--accent)',
                                  textDecoration: 'underline',
                                  textDecorationStyle: 'dashed',
                                  textUnderlineOffset: '3px',
                                  opacity: actionLoading[savedVersionActionKey] ? 0.5 : 1,
                                  transition: 'opacity 0.15s',
                                }}
                              >
                                {actionLoading[savedVersionActionKey] ? '…' : dep.savedVersion}
                              </button>
                            </Tooltip>
                          ) : (
                            <span style={{ color: 'var(--muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: 8, fontFamily: 'var(--mono)', fontSize: 13 }}>
                          {dep.deployedVersion ? (
                            <Tooltip
                              content={actionLoading[deployedVersionActionKey]
                                ? '⏳ Loading configuration…'
                                : '👁 Open deployed version preview'}
                              placement="top"
                              maxWidth={240}
                              bubbleStyle={{ whiteSpace: 'nowrap' }}
                            >
                              <button
                                onClick={() => handleViewDeployedVersion(dep)}
                                disabled={!!actionLoading[deployedVersionActionKey]}
                                onMouseEnter={e => { e.currentTarget.style.opacity = '0.75'; }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = actionLoading[deployedVersionActionKey] ? '0.5' : '1'; }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: actionLoading[deployedVersionActionKey] ? 'wait' : 'pointer',
                                  fontFamily: 'var(--mono)',
                                  fontSize: 13,
                                  color: hasVersionMismatch ? 'var(--warning)' : 'var(--accent)',
                                  fontWeight: hasVersionMismatch ? 600 : 400,
                                  textDecoration: 'underline',
                                  textDecorationStyle: 'dashed',
                                  textUnderlineOffset: '3px',
                                  opacity: actionLoading[deployedVersionActionKey] ? 0.5 : 1,
                                  transition: 'opacity 0.15s',
                                }}
                              >
                                {actionLoading[deployedVersionActionKey] ? '…' : dep.deployedVersion}
                              </button>
                            </Tooltip>
                          ) : (
                            <span style={{ color: 'var(--muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: 8 }}>{formatDateShort(dep.lastStatusChange)}</td>
                        <td style={{ padding: 8, textAlign: 'center', display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center' }}>
                          {isDeletedRow ? (
                            <>
                              <Tooltip content={actionLoading[rowKey] === 'delete-permanent' ? 'Deleting permanently' : 'Delete permanently'}>
                                <span style={{ display: 'inline-flex' }}>
                                  <button
                                    type="button"
                                    aria-label="Delete permanently"
                                    onClick={() => requestPermanentDelete(dep)}
                                    disabled={isPermanentDeleteDisabled}
                                    style={{
                                      ...ICON_BUTTON_STYLE,
                                      borderColor: '#ef4444',
                                      color: '#dc2626',
                                      opacity: isPermanentDeleteDisabled ? 0.4 : 1,
                                      cursor: isPermanentDeleteDisabled ? 'not-allowed' : 'pointer',
                                    }}
                                    onMouseEnter={e => {
                                      if (!isPermanentDeleteDisabled) {
                                        e.currentTarget.style.background = 'rgba(239,68,68,0.15)';
                                      }
                                    }}
                                    onMouseLeave={e => {
                                      e.currentTarget.style.background = 'var(--bg)';
                                    }}
                                  >
                                    <Trash2 size={16} strokeWidth={2.1} />
                                  </button>
                                </span>
                              </Tooltip>

                              <Tooltip content={actionLoading[rowKey] === 'restore' ? 'Restoring pipeline' : 'Restore pipeline'}>
                                <span style={{ display: 'inline-flex' }}>
                                  <button
                                    type="button"
                                    aria-label="Restore pipeline"
                                    onClick={() => requestRestore(dep)}
                                    disabled={isRestoreDisabled}
                                    style={{
                                      ...ICON_BUTTON_STYLE,
                                      borderColor: 'var(--accent)',
                                      color: 'var(--accent)',
                                      opacity: isRestoreDisabled ? 0.4 : 1,
                                      cursor: isRestoreDisabled ? 'not-allowed' : 'pointer',
                                    }}
                                    onMouseEnter={e => {
                                      if (!isRestoreDisabled) {
                                        e.currentTarget.style.background = 'rgba(79,110,247,0.15)';
                                      }
                                    }}
                                    onMouseLeave={e => {
                                      e.currentTarget.style.background = 'var(--bg)';
                                    }}
                                  >
                                    <RotateCcw size={15} strokeWidth={2.1} />
                                  </button>
                                </span>
                              </Tooltip>
                            </>
                          ) : (
                            <>
                              <Tooltip content={deployTooltip}>
                                <span style={{ display: 'inline-flex' }}>
                                  <button
                                    aria-label="Deploy pipeline"
                                    onClick={() => handleDeploy(dep)}
                                    disabled={dep.deploymentStatus === 'running' || actionLoading[rowKey] === 'deploy'}
                                    style={{
                                      ...ICON_BUTTON_STYLE,
                                      borderColor: '#22c55e',
                                      color: '#22c55e',
                                      opacity: (dep.deploymentStatus === 'running' || actionLoading[rowKey] === 'deploy') ? 0.4 : 1,
                                      cursor: (dep.deploymentStatus === 'running' || actionLoading[rowKey] === 'deploy') ? 'not-allowed' : 'pointer',
                                    }}
                                    onMouseEnter={e => {
                                      if (dep.deploymentStatus !== 'running' && actionLoading[rowKey] !== 'deploy') {
                                        e.currentTarget.style.background = 'rgba(34,197,94,0.15)';
                                      }
                                    }}
                                    onMouseLeave={e => {
                                      e.currentTarget.style.background = 'var(--bg)';
                                    }}
                                  >
                                    <Rocket size={16} strokeWidth={2.1} />
                                  </button>
                                </span>
                              </Tooltip>

                              <Tooltip content={stopTooltip}>
                                <span style={{ display: 'inline-flex' }}>
                                  <button
                                    aria-label="Stop pipeline"
                                    onClick={() => handleStop(dep)}
                                    disabled={!isRunning || actionLoading[rowKey] === 'stop'}
                                    style={{
                                      ...ICON_BUTTON_STYLE,
                                      borderColor: '#ef4444',
                                      color: '#ef4444',
                                      opacity: (!isRunning || actionLoading[rowKey] === 'stop') ? 0.4 : 1,
                                      cursor: (!isRunning || actionLoading[rowKey] === 'stop') ? 'not-allowed' : 'pointer',
                                    }}
                                    onMouseEnter={e => {
                                      if (isRunning && actionLoading[rowKey] !== 'stop') {
                                        e.currentTarget.style.background = 'rgba(239,68,68,0.15)';
                                      }
                                    }}
                                    onMouseLeave={e => {
                                      e.currentTarget.style.background = 'var(--bg)';
                                    }}
                                  >
                                    <Hand size={15} strokeWidth={2.1} />
                                  </button>
                                </span>
                              </Tooltip>

                              <Tooltip content={deleteTooltip}>
                                <span style={{ display: 'inline-flex' }}>
                                  <button
                                    aria-label="Delete pipeline"
                                    onClick={() => requestDelete(dep)}
                                    disabled={dep.deploymentStatus === 'running' || actionLoading[rowKey] === 'delete'}
                                    style={{
                                      ...ICON_BUTTON_STYLE,
                                      borderColor: '#ef4444',
                                      color: '#ef4444',
                                      opacity: (dep.deploymentStatus === 'running' || actionLoading[rowKey] === 'delete') ? 0.4 : 1,
                                      cursor: (dep.deploymentStatus === 'running' || actionLoading[rowKey] === 'delete') ? 'not-allowed' : 'pointer',
                                    }}
                                    onMouseEnter={e => {
                                      if (dep.deploymentStatus !== 'running' && actionLoading[rowKey] !== 'delete') {
                                        e.currentTarget.style.background = 'rgba(239,68,68,0.15)';
                                      }
                                    }}
                                    onMouseLeave={e => {
                                      e.currentTarget.style.background = 'var(--bg)';
                                    }}
                                  >
                                    <Trash2 size={16} strokeWidth={2.1} />
                                  </button>
                                </span>
                              </Tooltip>

                              <Tooltip content={upgradeTooltip}>
                                <span style={{ display: 'inline-flex' }}>
                                  <button
                                    aria-label="Upgrade deployment"
                                    onClick={() => handleUpgrade(dep)}
                                    disabled={!canUpgrade || actionLoading[rowKey] === 'upgrade'}
                                    style={{
                                      ...ICON_BUTTON_STYLE,
                                      borderColor: 'var(--warning)',
                                      color: 'var(--warning)',
                                      opacity: (!canUpgrade || actionLoading[rowKey] === 'upgrade') ? 0.4 : 1,
                                      cursor: (!canUpgrade || actionLoading[rowKey] === 'upgrade') ? 'not-allowed' : 'pointer',
                                    }}
                                    onMouseEnter={e => {
                                      if (canUpgrade && actionLoading[rowKey] !== 'upgrade') {
                                        e.currentTarget.style.background = 'rgba(245,158,11,0.15)';
                                      }
                                    }}
                                    onMouseLeave={e => {
                                      e.currentTarget.style.background = 'var(--bg)';
                                    }}
                                  >
                                    <CircleArrowUp size={15} strokeWidth={2.1} />
                                  </button>
                                </span>
                              </Tooltip>

                              <Tooltip content={editTooltip}>
                                <span style={{ display: 'inline-flex' }}>
                                  <button
                                    aria-label="Edit configuration"
                                    onClick={() => requestEdit(dep)}
                                    disabled={actionLoading[rowKey] === 'edit'}
                                    style={{
                                      ...ICON_BUTTON_STYLE,
                                      opacity: actionLoading[rowKey] === 'edit' ? 0.4 : 1,
                                      cursor: actionLoading[rowKey] === 'edit' ? 'not-allowed' : 'pointer',
                                    }}
                                    onMouseEnter={e => {
                                      if (actionLoading[rowKey] !== 'edit') {
                                        e.currentTarget.style.background = 'rgba(79,110,247,0.15)';
                                        e.currentTarget.style.borderColor = 'var(--accent)';
                                        e.currentTarget.style.color = 'var(--accent)';
                                      }
                                    }}
                                    onMouseLeave={e => {
                                      e.currentTarget.style.background = 'var(--bg)';
                                      e.currentTarget.style.borderColor = 'var(--border)';
                                      e.currentTarget.style.color = 'var(--text)';
                                    }}
                                  >
                                    <SquarePen size={15} strokeWidth={2.1} />
                                  </button>
                                </span>
                              </Tooltip>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </div>
        <ModalDialog
          isOpen={Boolean(confirmDialog)}
          title={confirmDialog?.title}
          message={confirmDialog?.message}
          icon={confirmDialog?.icon}
          tone={confirmDialog?.tone}
          confirmLabel={confirmDialog?.confirmLabel}
          confirmVariant={confirmDialog?.confirmVariant}
          onConfirm={confirmDialog?.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />

        <ModalDialog
          isOpen={Boolean(deployVersionDialog)}
          title={deployVersionDialog?.title}
          message={deployVersionDialog?.message}
          icon="🚀"
          tone="accent"
          cancelLabel="Cancel"
          onCancel={() => setDeployVersionDialog(null)}
          footer={<Btn v="ghost" onClick={() => setDeployVersionDialog(null)}>Cancel</Btn>}
        >
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            <button
              type="button"
              aria-label="Deploy saved version"
              onClick={async () => {
                const target = deployVersionDialog?.deploymentRow
                setDeployVersionDialog(null)
                if (target) {
                  await runManagementDeploymentAction(target, 'deploy', { isSavedVersion: true })
                }
              }}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                gap: 16,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid rgba(79,110,247,0.45)',
                background: 'rgba(79,110,247,0.08)',
                fontSize: 13,
                color: 'var(--text)',
                cursor: 'pointer',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(79,110,247,0.14)'
                e.currentTarget.style.borderColor = 'var(--accent)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(79,110,247,0.08)'
                e.currentTarget.style.borderColor = 'rgba(79,110,247,0.45)'
              }}
            >
              <span style={{ color: 'var(--muted)' }}>Saved version</span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 600 }}>
                {deployVersionDialog?.deploymentRow?.savedVersion || '—'}
              </span>
            </button>
            <button
              type="button"
              aria-label="Deploy deployed version"
              onClick={async () => {
                const target = deployVersionDialog?.deploymentRow
                setDeployVersionDialog(null)
                if (target) {
                  await runManagementDeploymentAction(target, 'deploy', { isSavedVersion: false })
                }
              }}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                gap: 16,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                fontSize: 13,
                color: 'var(--text)',
                cursor: 'pointer',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                e.currentTarget.style.borderColor = 'var(--accent)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--bg)'
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              <span style={{ color: 'var(--muted)' }}>Deployed version</span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)', fontWeight: 600 }}>
                {deployVersionDialog?.deploymentRow?.deployedVersion || '—'}
              </span>
            </button>
          </div>
        </ModalDialog>

        {/* Deployment error popup — mirrors SummaryStep behaviour */}
        <ModalDialog
          isOpen={Boolean(errorModal)}
          title={errorModal?.title}
          message={errorModal?.message}
          icon={errorModal?.icon}
          tone="danger"
          cancelLabel="Got it"
          onCancel={() => setErrorModal(null)}
          disableBackdropClose={false}
        />

        <DeployProgressModal
          isOpen={deployment.isOpen}
          steps={deployment.steps}
          currentStepIndex={deployment.currentStepIndex}
          isComplete={deployment.isComplete}
          isError={deployment.isError}
          errorMessage={deployment.errorMessage}
          onClose={() => {
            deployment.reset();
            if (activeDeployId) {
              setActionLoading(a => ({ ...a, [activeDeployId]: null }));
              setActiveDeployId(null);
            }
            setActiveDeploymentAction('deploy');
          }}
          title={activeDeploymentCopy.modalTitle}
          successTitle={activeDeploymentCopy.modalSuccessTitle}
          failureTitle={activeDeploymentCopy.modalFailureTitle}
        />
      </div>

      {/* ── Success overlay — mirrors SummaryStep's submitted page ─────────── */}
      {successInfo && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'var(--bg)',
          zIndex: 1500,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          overflow: 'auto',
          padding: '40px 20px',
          animation: 'fadeIn .25s ease',
        }}>
          {/* Header */}
          <div style={{ padding: '10px 20px 10px', textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 64, marginBottom: 10 }}>🎉</div>
            <h2 style={{
              fontSize: 26, fontWeight: 800, marginBottom: 8,
              background: 'linear-gradient(135deg,#4f6ef7,#7c3aed)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              {successInfo.title || 'Pipeline Deployed!'}
            </h2>
          </div>

          {/* Subtitle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80, marginBottom: 20 }}>
            <p style={{ color: 'var(--muted)', maxWidth: 440, textAlign: 'center' }}>
              {successInfo.description || 'Your ETL pipeline has been deployed and is now running.'}
            </p>
          </div>

          {/* Info card */}
          <Card style={{ width: '100%', maxWidth: 460, textAlign: 'left', marginBottom: 20 }} p="18px 22px">
            {[
              ['Pipeline ID',     successInfo.pipelineId],
              ['Product Type',    successInfo.productType],
              ['Product Source',  successInfo.productSource],
              ['Environment',     formatEnvironmentLabel(successInfo.environment, successInfo.environment)],
            ].map(([k, v]) => (
              <div key={k} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13,
              }}>
                <span style={{ color: 'var(--muted)' }}>{k}</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{v}</span>
              </div>
            ))}
          </Card>

          {/* Grafana dashboard card */}
          <Card style={{ width: '100%', maxWidth: 460, textAlign: 'left', marginBottom: 24 }} p="18px 22px">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--accent)' }}>
              📊 Grafana Dashboard
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Dashboard Link</div>
                <div style={{
                  fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text)',
                  wordBreak: 'break-all', background: 'var(--surf2)',
                  padding: '8px', borderRadius: '6px', border: '1px solid var(--border)',
                }}>
                  {successInfo.grafanaLink}
                </div>
              </div>
              <button
                onClick={() => handleSuccessOverlayCopy(successInfo.grafanaLink)}
                style={{
                  padding: '8px 12px',
                  background: successCopied ? 'var(--success)' : 'var(--accent)',
                  color: 'white', border: 'none', borderRadius: '6px',
                  cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                  transition: 'all 0.2s', whiteSpace: 'nowrap',
                }}
              >
                {successCopied ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
            <a
              href={successInfo.grafanaLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block', padding: '8px 16px',
                background: 'transparent', border: '1px solid var(--accent)',
                color: 'var(--accent)', borderRadius: '6px',
                textDecoration: 'none', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'white'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent)'; }}
            >
              🔗 Open in Grafana
            </a>
          </Card>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <Btn v="primary" onClick={() => { setSuccessInfo(null); setSuccessCopied(false); setActiveDeploymentAction('deploy'); }}>
              Back to Deployments
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
