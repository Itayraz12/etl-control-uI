import { useEffect, useState } from 'react';
import { Btn, Chip } from '../../shared/components/index.jsx';
import { fetchDeployments, deployService, stopDeployment, fetchDeploymentConfig } from './mockDeploymentsService.js';
import { useWizard } from '../../shared/store/wizardStore.jsx';

const STATUS_COLORS = {
  draft: 'amber',
  running: 'green',
  stopped: 'red',
};

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleString();
}

const COLUMNS = [
  { key: 'productType', label: 'Product Type' },
  { key: 'productSource', label: 'Product Source' },
  { key: 'deploymentStatus', label: 'Status' },
  { key: 'savedVersion', label: 'Saved Version' },
  { key: 'deployedVersion', label: 'Deployed Version' },
  { key: 'lastStatusChange', label: 'Last Status Change' },
  { key: 'createdAt', label: 'Created' },
];

export default function ETLManagementScreen() {
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [sortKey, setSortKey] = useState('productType');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterText, setFilterText] = useState("");
  const { actions, state } = useWizard();

  useEffect(() => {
    const teamName = state?.metadata?.team || 'default';
    fetchDeployments(teamName).then(data => {
      setDeployments(data);
      setLoading(false);
    });
  }, [state?.metadata?.team]);

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
    await deployService(id);
    setActionLoading(a => ({ ...a, [id]: null }));
    // Optionally refresh deployments
  };

  const handleStop = async (id) => {
    setActionLoading(a => ({ ...a, [id]: 'stop' }));
    await stopDeployment(id);
    setActionLoading(a => ({ ...a, [id]: null }));
    // Optionally refresh deployments
  };

  const handleUpgrade = async (id) => {
    setActionLoading(a => ({ ...a, [id]: 'upgrade' }));
    await deployService(id);
    setActionLoading(a => ({ ...a, [id]: null }));
  };

  const handleEdit = async (id) => {
    setActionLoading(a => ({ ...a, [id]: 'edit' }));
    const { config } = await fetchDeploymentConfig(id);
    setActionLoading(a => ({ ...a, [id]: null }));
    // Load config into ETL configuration page
    if (config && config.name) {
      actions.setNavigationMode('etl-config');
      actions.setStep(0);
      actions.updateMetadata({ productType: config.name }); // Example: update metadata, adjust as needed
      // You can update more fields here based on config structure
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, padding: '40px', background: 'var(--bg)',
    }}>
      <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text)', marginBottom: 24 }}>
        Deployments{state?.metadata?.team ? ` — ${state.metadata.team}` : ''}
      </div>
      <div style={{ marginBottom: 16, width: '100%', maxWidth: 400 }}>
        <input
          type="text"
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          placeholder="Filter deployments..."
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            fontSize: 15,
            background: 'var(--bg)',
            color: 'var(--text)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>
      {loading ? (
        <div>Loading deployments...</div>
      ) : (
        <div style={{ width: '100%', maxWidth: 1300, background: 'var(--surf)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', minHeight: '200px', height: '60vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
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
                      onMouseEnter={e => e.target.style.background = 'rgba(79,110,247,.15)'}
                      onMouseLeave={e => e.target.style.background = 'var(--surf)'}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {col.label}
                        {sortKey === col.key && (
                          <span style={{ fontSize: '10px' }}>
                            {sortOrder === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
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

                  return (
                    <tr key={dep.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: 8 }}>{dep.productType}</td>
                      <td style={{ padding: 8 }}>{dep.productSource}</td>
                      <td style={{ padding: 8 }}>
                        <Chip c={STATUS_COLORS[dep.deploymentStatus] || 'muted'}>{dep.deploymentStatus}</Chip>
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
                        {hasVersionMismatch && <span style={{ marginLeft: 6, fontSize: 10 }}>⚠</span>}
                      </td>
                      <td style={{ padding: 8 }}>{formatDate(dep.lastStatusChange)}</td>
                      <td style={{ padding: 8 }}>{formatDate(dep.createdAt)}</td>
                      <td style={{ padding: 8, textAlign: 'center', display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Btn
                          v="success"
                          sm
                          onClick={() => handleDeploy(dep.id)}
                          disabled={actionLoading[dep.id] === 'deploy' || dep.deploymentStatus === 'running'}
                          title={dep.deploymentStatus === 'running' ? 'Disable: Pipeline is already running' : ''}
                        >
                          Deploy
                        </Btn>
                        <Btn
                          v="danger"
                          sm
                          onClick={() => handleStop(dep.id)}
                          disabled={actionLoading[dep.id] === 'stop' || dep.deploymentStatus === 'stopped' || dep.deploymentStatus === 'draft'}
                          title={dep.deploymentStatus === 'stopped' ? 'Disable: Pipeline is already stopped' : dep.deploymentStatus === 'draft' ? 'Disable: Pipeline is in draft status' : ''}
                        >
                          Stop
                        </Btn>
                        <Btn
                          v="accent2"
                          sm
                          onClick={() => handleUpgrade(dep.id)}
                          disabled={!canUpgrade || actionLoading[dep.id] === 'upgrade'}
                          title={!canUpgrade && hasVersionMismatch ? 'Enable: Pipeline must be running' : !canUpgrade ? 'Enable: Versions must differ' : ''}
                        >
                          ⬆ Upgrade
                        </Btn>
                        <Btn v="secondary" sm onClick={() => handleEdit(dep.id)} disabled={actionLoading[dep.id] === 'edit'}>
                          Edit
                        </Btn>
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
  );
}

