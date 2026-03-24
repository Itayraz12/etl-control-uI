import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleArrowUp, Hand, Rocket, SquarePen, Trash2 } from 'lucide-react';
import { Btn, Card, Chip, DeployProgressModal, FilterTabs, ModalDialog, Tooltip } from '../../shared/components/index.jsx';
import * as deploymentsService from '../../shared/services/deploymentsService.js';
import { fetchDeploymentSteps, subscribeToDeploymentProgress, deployFromYaml }
  from '../../shared/services/deploymentsService.js';
import { fetchDraftConfiguration, fetchSavedDraftYaml } from '../../shared/services/configService.js';
import { hydrateWizardStateFromYaml } from '../../shared/services/configurationHydrator.js';
import { buildPipelineChangeSignature } from '../../shared/services/pipelineChangeDetection.js';
import { serializeWizardState } from '../../shared/store/wizardPersistence.js';
import { useDeploymentProgress } from '../../shared/hooks/useDeploymentProgress.js';
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
  const d = new Date(ts);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:${mins}`;
}

const COLUMNS = [
  { key: 'productSource', label: 'Product Source' },
  { key: 'productType', label: 'Product Type' },
  { key: 'environment', label: 'Environment' },
  { key: 'deploymentStatus', label: 'Status' },
  { key: 'savedVersion', label: 'Saved Version' },
  { key: 'deployedVersion', label: 'Deployed Version' },
  { key: 'lastStatusChange', label: 'Last Status Change' },
];

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
  { id: 'prod', label: 'Prod' },
  { id: 'stage', label: 'Stage' },
  { id: 'dev', label: 'Dev' },
  { id: 'deleted', label: 'Deleted' },
];

function matchesManagementTab(deployment, tabId) {
  const environment = String(deployment?.environment || '').toLowerCase();
  const status = String(deployment?.deploymentStatus || '').toLowerCase();

  switch (tabId) {
    case 'prod':
      return environment === 'production' || environment === 'prod';
    case 'stage':
      return environment === 'staging' || environment === 'stage';
    case 'dev':
      return environment === 'development' || environment === 'dev';
    case 'deleted':
      return status === 'deleted';
    case 'all':
    default:
      return true;
  }
}

function buildPreviewUrl(deploymentId, previewSource) {
  const params = new URLSearchParams({
    preview: 'true',
    deploymentId,
    previewSource,
  });

  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

export default function ETLManagementScreen() {
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [sortKey, setSortKey] = useState('productType');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterText, setFilterText] = useState("");
  const [activeTab, setActiveTab] = useState('all');
  const [screenError, setScreenError] = useState('');
  const [screenNotice, setScreenNotice] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [errorModal, setErrorModal] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);   // success overlay data
  const [savedVersionHover, setSavedVersionHover] = useState(null); // dep.id with tooltip open
  const [deployedVersionHover, setDeployedVersionHover] = useState(null); // dep.id with tooltip open
  const [successCopied, setSuccessCopied] = useState(false);
  const [activeDeployId, setActiveDeployId] = useState(null);
  const { actions, state } = useWizard();
  const { useMock, setUseMock } = useMockMode();
  const { user } = useUser();

  // Use team name from user context
  const teamName = user?.teamName || 'default';

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
      const data = await deploymentsService.fetchDeployments(teamName, useMock);
      setDeployments(data);
      return data;
    } finally {
      setLoading(false);
    }
  }

  // Expose the toggle to the service
  function handleMockToggle(e) {
    setUseMock(e.target.checked);
    setLoading(true);
    deploymentsService.fetchDeployments(teamName, e.target.checked).then(data => {
      setDeployments(data);
      setLoading(false);
    });
  }

  useEffect(() => {
    refreshDeployments();
  }, [teamName, useMock]);

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

  const visibleDeployments = useMemo(() => {
    const search = filterText.trim().toLowerCase();

    return deployments.filter(dep => {
      if (!matchesManagementTab(dep, activeTab)) return false;
      if (!search) return true;

      return COLUMNS.some(col => {
        const val = dep[col.key];
        if (val == null) return false;
        return String(val).toLowerCase().includes(search);
      });
    });
  }, [activeTab, deployments, filterText]);

  const sortedDeployments = useMemo(() => [...visibleDeployments].sort((a, b) => {
    let aVal = a[sortKey];
    let bVal = b[sortKey];

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
    deploymentsService.setDeploymentStatus({
      teamName,
      productSource: deploymentRow.productSource,
      productType: deploymentRow.productType,
      environment: deploymentRow.environment || 'production',
      deploymentStatus,
      savedVersion: extraFields.savedVersion ?? deploymentRow.savedVersion,
      deployedVersion: extraFields.deployedVersion ?? deploymentRow.deployedVersion,
    });

    setDeployments(current => current.map(item => (
      item.id === deploymentRow.id
        ? {
            ...item,
            deploymentStatus,
            lastStatusChange: Date.now(),
            ...extraFields,
          }
        : item
    )));
  };

  const handleDeploy = async (deploymentRow) => {
    const id = deploymentRow.id;
    if (actionLoading[id]) return;

    setScreenError('');
    setScreenNotice(null);
    setActiveDeployId(id);
    setActionLoading(a => ({ ...a, [id]: 'deploy' }));

    console.log('[handleDeploy] ── start ──────────────────────');
    console.log('[handleDeploy] pipeline id:', id);

    // Helper: close the progress modal and show the error popup,
    // mirroring the exact behaviour of SummaryStep's handleFailure.
    const showDeployError = (msg) => {
      updateDeploymentRowStatus(deploymentRow, 'failed');
      deployment.reset();                       // close progress modal
      setErrorModal({ icon: '❌', title: 'Deployment Failed', message: msg });
      setActionLoading(a => ({ ...a, [id]: null }));
      setActiveDeployId(null);
    };

    // 1. Fetch the ordered step list from the backend (falls back to built-in list)
    const steps = await fetchDeploymentSteps(false);
    console.log('[handleDeploy] steps:', steps.length, steps.map(s => s.id));

    // 2. Open the progress modal immediately — all steps shown as 'pending'
    deployment.startDeployment(steps);

    // 3. Fetch the saved YAML for this pipeline, then POST it to the same
    //    deploy endpoint used by the Summary wizard tab.
    const environment = deploymentRow.environment || 'production';
    let yamlText;
    try {
      console.log('[handleDeploy] fetching YAML for', deploymentRow.productType, '/', deploymentRow.productSource);
      yamlText = await fetchDraftConfiguration({
        productType: deploymentRow.productType,
        source: deploymentRow.productSource,
        team: teamName,
        environment,
      }, false);
    } catch (fetchErr) {
      const msg = fetchErr?.message || 'Failed to fetch pipeline configuration.';
      console.error('[handleDeploy] fetchDraftConfiguration failed:', msg);
      showDeployError(msg);
      return;
    }

    if (!yamlText) {
      showDeployError('No saved YAML configuration found for this pipeline.');
      return;
    }

    console.log('[handleDeploy] posting YAML to deploy endpoint...');
    const result = await deployFromYaml(yamlText);
    console.log('[handleDeploy] deployFromYaml result:', JSON.stringify(result));

    if (!result || result.success === false) {
      showDeployError(result?.error || 'Unable to start deployment.');
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
    console.log('[handleDeploy] full result:', JSON.stringify(result));
    console.log('[handleDeploy] opening SSE stream for deploymentId:', deploymentId);

    if (!deploymentId) {
      showDeployError('Server did not return a deployment ID. Cannot track progress.');
      return;
    }

    // ── Shared SSE failure handler ────────────────────────────────────────
    const handleFailure = (stepIndex, error) => {
      const msg = error || 'Deployment step failed.';
      const idx = typeof stepIndex === 'number' ? stepIndex : 0;
      console.warn('[handleDeploy] failure at step', idx, ':', msg);
      showDeployError(msg);
    };

    // ── Progress callbacks driven by SSE events ───────────────────────────
    const progressCallbacks = {
      onStepStart: ({ stepIndex, label } = {}) => {
        console.log('[handleDeploy] → step-start', stepIndex, label);
        if (typeof stepIndex !== 'number') {
          console.warn('[handleDeploy] step-start missing stepIndex:', { stepIndex, label });
          return;
        }
        deployment.setCurrentStepIndex(stepIndex);
        deployment.updateStep(stepIndex, {
          status: 'active',
          ...(label ? { label } : {}),
        });
      },
      onStepComplete: ({ stepIndex, label } = {}) => {
        console.log('[handleDeploy] → step-complete', stepIndex);
        if (typeof stepIndex !== 'number') {
          console.warn('[handleDeploy] step-complete missing stepIndex:', { stepIndex });
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
        console.log('[handleDeploy] → deployment-complete');
        deployment.updateStep(steps.length - 1, { status: 'done' });
        deployment.setIsComplete(true);
        updateDeploymentRowStatus(deploymentRow, 'running', {
          deployedVersion: deploymentRow.savedVersion ?? deploymentRow.deployedVersion,
        });
        try { await refreshDeployments(); } catch (e) {
          console.warn('[handleDeploy] refresh failed:', e);
        }
        setActionLoading(a => ({ ...a, [id]: null }));
        setActiveDeployId(null);
        // Auto-transition to success page after a short delay — mirrors SummaryStep
        setTimeout(() => {
          deployment.reset();
          const pipelineId = `ETL-${Date.now().toString(36).toUpperCase()}`;
          const grafanaLink = `https://grafana.etl-studio.io/d/pipeline-${pipelineId.toLowerCase()}` +
            `?source=${encodeURIComponent(deploymentRow.productSource || '')}` +
            `&type=${encodeURIComponent(deploymentRow.productType || '')}` +
            `&refresh=30s`;
          setSuccessInfo({
            productType:   deploymentRow.productType,
            productSource: deploymentRow.productSource,
            environment,
            pipelineId,
            grafanaLink,
          });
        }, 500);
      },
      onConnectionError: (msg) => {
        console.warn('[handleDeploy] → SSE connection error:', msg);
        handleFailure(undefined, msg);
      },
    };

    sseCleanupRef.current = subscribeToDeploymentProgress(deploymentId, progressCallbacks);
    console.log('[handleDeploy] SSE stream opened');
  };

  const handleDelete = async (id) => {
    setScreenError('');
    setScreenNotice(null);
    setActionLoading(a => ({ ...a, [id]: 'delete' }));
    console.log('[ETLManagementScreen] handleDelete, useMock:', useMock);
    const result = await deploymentsService.deleteDeployment(id, useMock);

    if (result?.success !== false) {
      await refreshDeployments();
      setScreenNotice({
        tone: 'success',
        message: 'Pipeline deleted. You can find it under the Deleted tab.',
      });
    } else {
      setScreenError(result?.error || 'Failed to delete the selected deployment.');
    }

    setActionLoading(a => ({ ...a, [id]: null }));
  };

  const handlePermanentDelete = async (id) => {
    setScreenError('');
    setScreenNotice(null);
    setActionLoading(a => ({ ...a, [id]: 'delete-permanent' }));
    console.log('[ETLManagementScreen] handlePermanentDelete, useMock:', useMock);
    const result = await deploymentsService.permanentlyDeleteDeployment(id, useMock);

    if (result?.success !== false) {
      await refreshDeployments();
      setScreenNotice({
        tone: 'success',
        message: 'Pipeline permanently deleted.',
      });
    } else {
      setScreenError(result?.error || 'Failed to permanently delete the selected pipeline.');
    }

    setActionLoading(a => ({ ...a, [id]: null }));
  };

  const handleRestore = async (id) => {
    setScreenError('');
    setScreenNotice(null);
    setActionLoading(a => ({ ...a, [id]: 'restore' }));
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

    setActionLoading(a => ({ ...a, [id]: null }));
  };

  const handleStop = async (deploymentRow) => {
    const id = deploymentRow.id;
    setScreenError('');
    setScreenNotice(null);
    setActionLoading(a => ({ ...a, [id]: 'stop' }));

    const result = await deploymentsService.stopDeployment(id, useMock);

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

    setActionLoading(a => ({ ...a, [id]: null }));
  };

  const handleUpgrade = async (id) => {
    setScreenError('');
    setScreenNotice(null);
    setActionLoading(a => ({ ...a, [id]: 'upgrade' }));
    console.log('[ETLManagementScreen] handleUpgrade, useMock:', useMock);
    const result = await deploymentsService.deployService(id, useMock);
    if (result?.success === false) {
      setScreenError(result.error || 'Upgrade failed.');
    } else {
      await refreshDeployments();
      setScreenNotice({ tone: 'success', message: 'Deployment upgraded to the latest saved version.' });
    }
    setActionLoading(a => ({ ...a, [id]: null }));
  };

  const handleEdit = async (dep) => {
    setActionLoading(a => ({ ...a, [dep.id]: 'edit' }));
    setScreenError('');
    setScreenNotice(null);
    console.log('[ETLManagementScreen] handleEdit, useMock:', useMock);

    try {
      const environment = dep.environment || state.metadata.environment || 'production';
      const yamlText = await fetchDraftConfiguration({
        productType: dep.productType,
        source: dep.productSource,
        team: teamName,
        environment,
      }, useMock);

      const loadedState = hydrateWizardStateFromYaml(yamlText, {
        productType: dep.productType,
        source: dep.productSource,
        teamName,
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
      setActionLoading(a => ({ ...a, [dep.id]: null }));
    }
  };

  /**
   * Fetches the saved-draft YAML from /api/backend/configuration/draft/yaml and
   * opens a new browser window pre-loaded with all the configuration tabs
   * filled in from that YAML as a read-only preview for this deployment.
   */
  const handleViewSavedVersion = async (dep) => {
    setActionLoading(a => ({ ...a, [`${dep.id}_savedVersion`]: true }));
    setScreenError('');
    setScreenNotice(null);

    try {
      const environment = dep.environment || state.metadata.environment || 'production';

      const yamlText = await fetchSavedDraftYaml({
        productType: dep.productType,
        source: dep.productSource,
        team: teamName,
        environment,
      }, useMock);

      if (!yamlText) {
        setScreenError('No saved YAML configuration found for this pipeline version.');
        return;
      }

      const loadedState = hydrateWizardStateFromYaml(yamlText, {
        productType: dep.productType,
        source: dep.productSource,
        teamName,
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
      setActionLoading(a => ({ ...a, [`${dep.id}_savedVersion`]: false }));
    }
  };

  /**
   * Fetches the deployed YAML from /api/backend/configuration/yaml and
   * opens a new read-only window with all configuration tabs pre-filled.
   */
  const handleViewDeployedVersion = async (dep) => {
    setActionLoading(a => ({ ...a, [`${dep.id}_deployedVersion`]: true }));
    setScreenError('');
    setScreenNotice(null);

    try {
      const environment = dep.environment || state.metadata.environment || 'production';

      const yamlText = await fetchDraftConfiguration({
        productType: dep.productType,
        source: dep.productSource,
        team: teamName,
        environment,
      }, useMock);

      if (!yamlText) {
        setScreenError('No deployed YAML configuration found for this pipeline version.');
        return;
      }

      const loadedState = hydrateWizardStateFromYaml(yamlText, {
        productType: dep.productType,
        source: dep.productSource,
        teamName,
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
      setActionLoading(a => ({ ...a, [`${dep.id}_deployedVersion`]: false }));
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
      message: `Delete ${dep.productSource} / ${dep.productType}? This will move the pipeline to the Deleted tab.`,
      tone: 'danger',
      icon: '🗑️',
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        await handleDelete(dep.id);
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
        await handlePermanentDelete(dep.id);
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
        await handleRestore(dep.id);
      },
    });
  }

  function requestEdit(dep) {
    setConfirmDialog({
      title: 'Open deployment for editing?',
      message: `You are about to open ${dep.productSource} / ${dep.productType} in the wizard. Continue to the editable configuration flow?`,
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
          <span>{teamName || 'default'}</span>
          <span>·</span>
          <span>{deployments.length} {deployments.length === 1 ? 'pipeline' : 'pipelines'}</span>
          <span>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s ease-in-out infinite' }}></span>
            <span style={{ color: '#22c55e' }}>{deployments.filter(d => d.deploymentStatus === 'running').length} running</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }}></span>
            <span style={{ color: '#ef4444' }}>{deployments.filter(d => d.deploymentStatus === 'stopped').length} stopped</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }}></span>
            <span style={{ color: '#f59e0b' }}>{deployments.filter(d => d.deploymentStatus === 'draft').length} draft</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }}></span>
            <span style={{ color: '#dc2626' }}>{deployments.filter(d => d.deploymentStatus === 'failed').length} failed</span>
          </span>
        </div>

        {/* Toolbar: Search + Create Button on Same Row */}
        <div style={{ 
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
          <Btn v="accent" onClick={handleCreateNewConfig} style={{ whiteSpace: 'nowrap' }}>
            + New Configuration
          </Btn>
        </div>
        <FilterTabs
          tabs={MANAGEMENT_TABS.map(tab => ({ ...tab, count: tabCounts[tab.id] || 0 }))}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
        {screenNotice && (
          <div style={{
            width: '100%',
            marginBottom: 16,
            padding: '10px 12px',
            borderRadius: 8,
            background: screenNotice.tone === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(79,110,247,0.12)',
            border: screenNotice.tone === 'success' ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(79,110,247,0.35)',
            color: screenNotice.tone === 'success' ? 'var(--success)' : 'var(--accent)',
            fontSize: 13,
          }}>
            {screenNotice.message}
          </div>
        )}
        {screenError && (
          <div style={{
            width: '100%',
            marginBottom: 16,
            padding: '10px 12px',
            borderRadius: 8,
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.35)',
            color: 'var(--danger)',
            fontSize: 13,
          }}>
            {screenError}
          </div>
        )}
        {loading ? (
          <div>Loading deployments...</div>
        ) : sortedDeployments.length === 0 && filterText ? (
          /* Empty State */
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
          <div data-testid="etl-management-table-card" style={{ width: '100%', background: 'var(--surf)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', minHeight: '260px', flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: '900px' }}>
              <thead>
                <tr>
                  {COLUMNS.map(col => (
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
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--surf)', padding: 8, textAlign: 'center', borderBottom: '2px solid var(--border)', backgroundClip: 'padding-box' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedDeployments.map(dep => {
                  const hasVersionMismatch = dep.deployedVersion && dep.savedVersion && dep.deployedVersion !== dep.savedVersion;
                  const canUpgrade = hasVersionMismatch && dep.deploymentStatus === 'running';
                  const isRunning = dep.deploymentStatus === 'running';
                  const isDeletedRow = dep.deploymentStatus === 'deleted' && activeTab === 'deleted';

                  return (
                    <tr 
                      key={dep.id} 
                      style={{ 
                        borderTop: '1px solid var(--border)',
                        height: 44,
                      }}
                    >
                      <td style={{ padding: 8 }}>{dep.productSource}</td>
                      <td style={{ padding: 8 }}>{dep.productType}</td>
                      <td style={{ padding: 8 }}>{dep.environment || 'production'}</td>
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
                      <td style={{ padding: 8, fontFamily: 'var(--mono)', fontSize: 13 }}>
                        {dep.savedVersion ? (
                          <span style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              onClick={() => handleViewSavedVersion(dep)}
                              disabled={!!actionLoading[`${dep.id}_savedVersion`]}
                              onMouseEnter={e => { e.currentTarget.style.opacity = '0.75'; setSavedVersionHover(dep.id); }}
                              onMouseLeave={e => { e.currentTarget.style.opacity = actionLoading[`${dep.id}_savedVersion`] ? '0.5' : '1'; setSavedVersionHover(null); }}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: actionLoading[`${dep.id}_savedVersion`] ? 'wait' : 'pointer',
                                fontFamily: 'var(--mono)',
                                fontSize: 13,
                                color: 'var(--accent)',
                                textDecoration: 'underline',
                                textDecorationStyle: 'dashed',
                                textUnderlineOffset: '3px',
                                opacity: actionLoading[`${dep.id}_savedVersion`] ? 0.5 : 1,
                                transition: 'opacity 0.15s',
                              }}
                            >
                              {actionLoading[`${dep.id}_savedVersion`] ? '…' : dep.savedVersion}
                            </button>
                            {savedVersionHover === dep.id && (
                              <div style={{
                                position: 'absolute',
                                top: 'calc(100% + 7px)',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: 'var(--surf)',
                                border: '1px solid var(--border)',
                                borderRadius: 7,
                                padding: '6px 11px',
                                fontSize: 12,
                                color: 'var(--text)',
                                whiteSpace: 'nowrap',
                                zIndex: 200,
                                boxShadow: '0 6px 20px rgba(0,0,0,0.22)',
                                pointerEvents: 'none',
                              }}>
                                {/* Arrow pointing up */}
                                <div style={{
                                  position: 'absolute', top: -5, left: '50%',
                                  transform: 'translateX(-50%) rotate(45deg)',
                                  width: 8, height: 8,
                                  background: 'var(--surf)',
                                  borderTop: '1px solid var(--border)',
                                  borderLeft: '1px solid var(--border)',
                                }} />
                                {actionLoading[`${dep.id}_savedVersion`]
                                  ? '⏳ Loading configuration…'
                                  : '👁 Open saved version preview'}
                              </div>
                            )}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: 8, fontFamily: 'var(--mono)', fontSize: 13 }}>
                        {dep.deployedVersion ? (
                          <span style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              onClick={() => handleViewDeployedVersion(dep)}
                              disabled={!!actionLoading[`${dep.id}_deployedVersion`]}
                              onMouseEnter={e => { e.currentTarget.style.opacity = '0.75'; setDeployedVersionHover(dep.id); }}
                              onMouseLeave={e => { e.currentTarget.style.opacity = actionLoading[`${dep.id}_deployedVersion`] ? '0.5' : '1'; setDeployedVersionHover(null); }}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: actionLoading[`${dep.id}_deployedVersion`] ? 'wait' : 'pointer',
                                fontFamily: 'var(--mono)',
                                fontSize: 13,
                                color: hasVersionMismatch ? 'var(--warning)' : 'var(--accent)',
                                fontWeight: hasVersionMismatch ? 600 : 400,
                                textDecoration: 'underline',
                                textDecorationStyle: 'dashed',
                                textUnderlineOffset: '3px',
                                opacity: actionLoading[`${dep.id}_deployedVersion`] ? 0.5 : 1,
                                transition: 'opacity 0.15s',
                              }}
                            >
                              {actionLoading[`${dep.id}_deployedVersion`] ? '…' : dep.deployedVersion}
                            </button>
                            {deployedVersionHover === dep.id && (
                              <div style={{
                                position: 'absolute',
                                top: 'calc(100% + 7px)',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: 'var(--surf)',
                                border: '1px solid var(--border)',
                                borderRadius: 7,
                                padding: '6px 11px',
                                fontSize: 12,
                                color: 'var(--text)',
                                whiteSpace: 'nowrap',
                                zIndex: 200,
                                boxShadow: '0 6px 20px rgba(0,0,0,0.22)',
                                pointerEvents: 'none',
                              }}>
                                <div style={{
                                  position: 'absolute', top: -5, left: '50%',
                                  transform: 'translateX(-50%) rotate(45deg)',
                                  width: 8, height: 8,
                                  background: 'var(--surf)',
                                  borderTop: '1px solid var(--border)',
                                  borderLeft: '1px solid var(--border)',
                                }} />
                                {actionLoading[`${dep.id}_deployedVersion`]
                                  ? '⏳ Loading configuration…'
                                  : '👁 Open deployed version preview'}
                              </div>
                            )}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: 8 }}>{formatDateShort(dep.lastStatusChange)}</td>
                      <td style={{ padding: 8, textAlign: 'center', display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center' }}>
                        {isDeletedRow ? (
                          <>
                            <Tooltip content={actionLoading[dep.id] === 'delete-permanent' ? 'Deleting permanently' : 'Delete permanently'}>
                              <span style={{ display: 'inline-flex' }}>
                                <button
                                  type="button"
                                  aria-label="Delete permanently"
                                  onClick={() => requestPermanentDelete(dep)}
                                  disabled={actionLoading[dep.id] === 'delete-permanent' || actionLoading[dep.id] === 'restore'}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: 8,
                                    border: '1px solid #ef4444',
                                    background: 'rgba(239,68,68,0.1)',
                                    color: '#dc2626',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: (actionLoading[dep.id] === 'delete-permanent' || actionLoading[dep.id] === 'restore') ? 'not-allowed' : 'pointer',
                                    opacity: (actionLoading[dep.id] === 'delete-permanent' || actionLoading[dep.id] === 'restore') ? 0.5 : 1,
                                    transition: 'all .15s ease',
                                  }}
                                >
                                  Delete permanently
                                </button>
                              </span>
                            </Tooltip>

                            <Tooltip content={actionLoading[dep.id] === 'restore' ? 'Restoring pipeline' : 'Restore pipeline'}>
                              <span style={{ display: 'inline-flex' }}>
                                <button
                                  type="button"
                                  aria-label="Restore pipeline"
                                  onClick={() => requestRestore(dep)}
                                  disabled={actionLoading[dep.id] === 'restore' || actionLoading[dep.id] === 'delete-permanent'}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: 8,
                                    border: '1px solid var(--accent)',
                                    background: 'rgba(79,110,247,0.1)',
                                    color: 'var(--accent)',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: (actionLoading[dep.id] === 'restore' || actionLoading[dep.id] === 'delete-permanent') ? 'not-allowed' : 'pointer',
                                    opacity: (actionLoading[dep.id] === 'restore' || actionLoading[dep.id] === 'delete-permanent') ? 0.5 : 1,
                                    transition: 'all .15s ease',
                                  }}
                                >
                                  Restore
                                </button>
                              </span>
                            </Tooltip>
                          </>
                        ) : (
                          <>
                            {/* Deploy/Play Button */}
                            <Tooltip content={dep.deploymentStatus === 'running' ? 'Already running' : actionLoading[dep.id] === 'deploy' ? 'Deploying pipeline' : 'Deploy pipeline'}>
                              <span style={{ display: 'inline-flex' }}>
                                <button
                                  aria-label="Deploy pipeline"
                                  onClick={() => handleDeploy(dep)}
                                  disabled={dep.deploymentStatus === 'running' || actionLoading[dep.id] === 'deploy'}
                                  style={{
                                    ...ICON_BUTTON_STYLE,
                                    borderColor: '#22c55e',
                                    color: '#22c55e',
                                    opacity: (dep.deploymentStatus === 'running' || actionLoading[dep.id] === 'deploy') ? 0.4 : 1,
                                    cursor: (dep.deploymentStatus === 'running' || actionLoading[dep.id] === 'deploy') ? 'not-allowed' : 'pointer',
                                  }}
                                  onMouseEnter={e => {
                                    if (dep.deploymentStatus !== 'running' && actionLoading[dep.id] !== 'deploy') {
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

                            {/* Stop Button */}
                            <Tooltip content={!isRunning ? 'Pipeline is not running' : actionLoading[dep.id] === 'stop' ? 'Stopping pipeline' : 'Stop pipeline'}>
                              <span style={{ display: 'inline-flex' }}>
                                <button
                                  aria-label="Stop pipeline"
                                  onClick={() => handleStop(dep)}
                                  disabled={!isRunning || actionLoading[dep.id] === 'stop'}
                                  style={{
                                    ...ICON_BUTTON_STYLE,
                                    borderColor: '#ef4444',
                                    color: '#ef4444',
                                    opacity: (!isRunning || actionLoading[dep.id] === 'stop') ? 0.4 : 1,
                                    cursor: (!isRunning || actionLoading[dep.id] === 'stop') ? 'not-allowed' : 'pointer',
                                  }}
                                  onMouseEnter={e => {
                                    if (isRunning && actionLoading[dep.id] !== 'stop') {
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

                            {/* Delete Button */}
                            <Tooltip content={dep.deploymentStatus === 'running' ? 'Cannot delete a running pipeline' : actionLoading[dep.id] === 'delete' ? 'Deleting pipeline' : 'Delete pipeline'}>
                              <span style={{ display: 'inline-flex' }}>
                                <button
                                  aria-label="Delete pipeline"
                                  onClick={() => requestDelete(dep)}
                                  disabled={dep.deploymentStatus === 'running' || actionLoading[dep.id] === 'delete'}
                                  style={{
                                    ...ICON_BUTTON_STYLE,
                                    borderColor: '#ef4444',
                                    color: '#ef4444',
                                    opacity: (dep.deploymentStatus === 'running' || actionLoading[dep.id] === 'delete') ? 0.4 : 1,
                                    cursor: (dep.deploymentStatus === 'running' || actionLoading[dep.id] === 'delete') ? 'not-allowed' : 'pointer',
                                  }}
                                  onMouseEnter={e => {
                                    if (dep.deploymentStatus !== 'running' && actionLoading[dep.id] !== 'delete') {
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

                            {/* Upgrade Button */}
                            <Tooltip content={!canUpgrade && hasVersionMismatch ? 'Pipeline must be running' : !canUpgrade ? 'No update available' : actionLoading[dep.id] === 'upgrade' ? 'Upgrading deployment' : 'Upgrade to latest version'}>
                              <span style={{ display: 'inline-flex' }}>
                                <button
                                  aria-label="Upgrade deployment"
                                  onClick={() => handleUpgrade(dep.id)}
                                  disabled={!canUpgrade || actionLoading[dep.id] === 'upgrade'}
                                  style={{
                                    ...ICON_BUTTON_STYLE,
                                    borderColor: 'var(--warning)',
                                    color: 'var(--warning)',
                                    opacity: (!canUpgrade || actionLoading[dep.id] === 'upgrade') ? 0.4 : 1,
                                    cursor: (!canUpgrade || actionLoading[dep.id] === 'upgrade') ? 'not-allowed' : 'pointer',
                                  }}
                                  onMouseEnter={e => {
                                    if (canUpgrade && actionLoading[dep.id] !== 'upgrade') {
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

                            {/* Edit Button */}
                            <Tooltip content={actionLoading[dep.id] === 'edit' ? 'Opening deployment editor' : 'Edit configuration'}>
                              <span style={{ display: 'inline-flex' }}>
                                <button
                                  aria-label="Edit configuration"
                                  onClick={() => requestEdit(dep)}
                                  disabled={actionLoading[dep.id] === 'edit'}
                                  style={{
                                    ...ICON_BUTTON_STYLE,
                                    opacity: actionLoading[dep.id] === 'edit' ? 0.4 : 1,
                                    cursor: actionLoading[dep.id] === 'edit' ? 'not-allowed' : 'pointer',
                                  }}
                                  onMouseEnter={e => {
                                    if (actionLoading[dep.id] !== 'edit') {
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
          </div>
        )}
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
          }}
          title="Deploying pipeline from management..."
          successTitle="Deployment completed successfully"
          failureTitle="Deployment failed"
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
              Pipeline Deployed!
            </h2>
          </div>

          {/* Subtitle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80, marginBottom: 20 }}>
            <p style={{ color: 'var(--muted)', maxWidth: 440, textAlign: 'center' }}>
              Your ETL pipeline has been deployed and is now running.
            </p>
          </div>

          {/* Info card */}
          <Card style={{ width: '100%', maxWidth: 460, textAlign: 'left', marginBottom: 20 }} p="18px 22px">
            {[
              ['Pipeline ID',     successInfo.pipelineId],
              ['Product Type',    successInfo.productType],
              ['Product Source',  successInfo.productSource],
              ['Environment',     successInfo.environment],
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
                onClick={() => {
                  navigator.clipboard.writeText(successInfo.grafanaLink);
                  setSuccessCopied(true);
                  setTimeout(() => setSuccessCopied(false), 2000);
                }}
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
            <Btn v="primary" onClick={() => { setSuccessInfo(null); setSuccessCopied(false); }}>
              Back to Deployments
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
