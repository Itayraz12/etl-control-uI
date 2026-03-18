import { useEffect, useState } from 'react';
import { CircleArrowUp, Rocket, SquarePen, Trash2 } from 'lucide-react';
import { Btn, Chip } from '../../shared/components/index.jsx';
import * as deploymentsService from '../../shared/services/deploymentsService.js';
import { fetchDraftConfiguration } from '../../shared/services/configService.js';
import { hydrateWizardStateFromYaml } from '../../shared/services/configurationHydrator.js';
import { useWizard } from '../../shared/store/wizardStore.jsx';
import { useMockMode } from '../../shared/store/mockModeContext.jsx';
import { useUser } from '../../shared/store/userContext.jsx';

const STATUS_COLORS = {
  draft: 'amber',
  running: 'green',
  stopped: 'red',
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

export default function ETLManagementScreen() {
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [sortKey, setSortKey] = useState('productType');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterText, setFilterText] = useState("");
  const [screenError, setScreenError] = useState('');
  const { actions, state } = useWizard();
  const { useMock, setUseMock } = useMockMode();
  const { user } = useUser();

  // Use team name from user context
  const teamName = user?.teamName || 'default';

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
    setLoading(true);
    deploymentsService.fetchDeployments(teamName, useMock).then(data => {
      setDeployments(data);
      setLoading(false);
    });
  }, [teamName, useMock]);

  const handleSort = (columnKey) => {
    if (sortKey === columnKey) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(columnKey);
      setSortOrder('asc');
    }
  };

  // Filter deployments by filterText (case-insensitive, any column)
  const filteredDeployments = deployments.filter(dep => {
    if (!filterText.trim()) return true;
    const search = filterText.trim().toLowerCase();
    return COLUMNS.some(col => {
      const val = dep[col.key];
      if (val == null) return false;
      return String(val).toLowerCase().includes(search);
    });
  });

  const sortedDeployments = [...filteredDeployments].sort((a, b) => {
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
  });

  const handleDeploy = async (id) => {
    setActionLoading(a => ({ ...a, [id]: 'deploy' }));
    console.log('[ETLManagementScreen] handleDeploy, useMock:', useMock);
    await deploymentsService.deployService(id, useMock);
    setActionLoading(a => ({ ...a, [id]: null }));
    // Optionally refresh deployments
  };

  const handleDelete = async (id) => {
    setActionLoading(a => ({ ...a, [id]: 'delete' }));
    console.log('[ETLManagementScreen] handleDelete, useMock:', useMock);
    const result = await deploymentsService.deleteDeployment(id, useMock);

    if (result?.success !== false) {
      setDeployments(current => current.filter(dep => dep.id !== id));
    }

    setActionLoading(a => ({ ...a, [id]: null }));
  };

  const handleUpgrade = async (id) => {
    setActionLoading(a => ({ ...a, [id]: 'upgrade' }));
    console.log('[ETLManagementScreen] handleUpgrade, useMock:', useMock);
    await deploymentsService.deployService(id, useMock);
    setActionLoading(a => ({ ...a, [id]: null }));
  };

  const handleEdit = async (dep) => {
    setActionLoading(a => ({ ...a, [dep.id]: 'edit' }));
    setScreenError('');
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
        completedSteps: [0, 1, 2, 3, 4, 5, 6],
      });
    } catch (error) {
      console.error('[ETLManagementScreen] failed to edit deployment:', error);
      setScreenError(error?.message || 'Failed to load deployment configuration.');
    } finally {
      setActionLoading(a => ({ ...a, [dep.id]: null }));
    }
  };

  // Handler for creating new configuration
  function handleCreateNewConfig() {
    actions.loadState({
      navigationMode: 'etl-config',
      currentStep: 0,
      completedSteps: new Set(),
      metadata: {
        team: teamName,
        productSource: '',
        productType: '',
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

                  return (
                    <tr 
                      key={dep.id} 
                      style={{ 
                        borderTop: '1px solid var(--border)',
                        borderLeft: hasVersionMismatch ? '4px solid var(--warning)' : '4px solid transparent',
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
                      <td style={{ padding: 8, fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--accent)' }}>{dep.savedVersion}</td>
                      <td style={{
                        padding: 8,
                        fontFamily: 'var(--mono)',
                        fontSize: 13,
                        color: hasVersionMismatch ? 'var(--warning)' : 'var(--accent)',
                        fontWeight: hasVersionMismatch ? 600 : 400,
                      }}>
                        {dep.deployedVersion || '—'}
                      </td>
                      <td style={{ padding: 8 }}>{formatDateShort(dep.lastStatusChange)}</td>
                      <td style={{ padding: 8, textAlign: 'center', display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center' }}>
                        {/* Deploy/Play Button */}
                        <button
                          onClick={() => handleDeploy(dep.id)}
                          disabled={dep.deploymentStatus === 'running'}
                          title={dep.deploymentStatus === 'running' ? 'Already running' : 'Deploy pipeline'}
                          style={{
                            ...ICON_BUTTON_STYLE,
                            borderColor: '#22c55e',
                            color: '#22c55e',
                            opacity: dep.deploymentStatus === 'running' ? 0.4 : 1,
                            cursor: dep.deploymentStatus === 'running' ? 'not-allowed' : 'pointer',
                          }}
                          onMouseEnter={e => {
                            if (dep.deploymentStatus !== 'running') {
                              e.currentTarget.style.background = 'rgba(34,197,94,0.15)';
                            }
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'var(--bg)';
                          }}
                        >
                          <Rocket size={16} strokeWidth={2.1} />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(dep.id)}
                          disabled={dep.deploymentStatus === 'running'}
                          title={dep.deploymentStatus === 'running' ? 'Cannot delete a running pipeline' : 'Delete pipeline'}
                          style={{
                            ...ICON_BUTTON_STYLE,
                            borderColor: '#ef4444',
                            color: '#ef4444',
                            opacity: dep.deploymentStatus === 'running' ? 0.4 : 1,
                            cursor: dep.deploymentStatus === 'running' ? 'not-allowed' : 'pointer',
                          }}
                          onMouseEnter={e => {
                            if (dep.deploymentStatus !== 'running') {
                              e.currentTarget.style.background = 'rgba(239,68,68,0.15)';
                            }
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'var(--bg)';
                          }}
                        >
                          <Trash2 size={16} strokeWidth={2.1} />
                        </button>

                        {/* Upgrade Button */}
                        <button
                          onClick={() => handleUpgrade(dep.id)}
                          disabled={!canUpgrade}
                          title={!canUpgrade && hasVersionMismatch ? 'Pipeline must be running' : !canUpgrade ? 'No update available' : 'Upgrade to latest version'}
                          style={{
                            ...ICON_BUTTON_STYLE,
                            borderColor: 'var(--warning)',
                            color: 'var(--warning)',
                            opacity: !canUpgrade ? 0.4 : 1,
                            cursor: !canUpgrade ? 'not-allowed' : 'pointer',
                          }}
                          onMouseEnter={e => {
                            if (canUpgrade) {
                              e.currentTarget.style.background = 'rgba(245,158,11,0.15)';
                            }
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'var(--bg)';
                          }}
                        >
                          <CircleArrowUp size={15} strokeWidth={2.1} />
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => handleEdit(dep)}
                          title="Edit configuration"
                          style={ICON_BUTTON_STYLE}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(79,110,247,0.15)';
                            e.currentTarget.style.borderColor = 'var(--accent)';
                            e.currentTarget.style.color = 'var(--accent)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'var(--bg)';
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.color = 'var(--text)';
                          }}
                        >
                          <SquarePen size={15} strokeWidth={2.1} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
