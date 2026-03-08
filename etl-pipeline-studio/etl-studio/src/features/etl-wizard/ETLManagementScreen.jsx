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

export default function ETLManagementScreen() {
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const { actions } = useWizard();

  useEffect(() => {
    fetchDeployments().then(data => {
      setDeployments(data);
      setLoading(false);
    });
  }, []);

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

  const { state } = useWizard();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, padding: '40px', background: 'var(--bg)',
    }}>
      <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text)', marginBottom: 24 }}>
        Deployments{state?.metadata?.team ? ` — ${state.metadata.team}` : ''}
      </div>
      {loading ? (
        <div>Loading deployments...</div>
      ) : (
        <div style={{ width: '100%', maxWidth: 900, background: 'var(--surf)', border: '1px solid var(--border)', borderRadius: 8, padding: 24, height: '60vh', overflowY: 'scroll', minHeight: '200px', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--surf)', zIndex: 2 }}>
              <tr style={{ color: 'var(--muted)', textAlign: 'left' }}>
                <th style={{ padding: 8, borderBottom: '2px solid var(--border)' }}>Product Type</th>
                <th style={{ padding: 8 }}>Product Source</th>
                <th style={{ padding: 8 }}>Status</th>
                <th style={{ padding: 8 }}>Last Status Change</th>
                <th style={{ padding: 8 }}>Created</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map(dep => (
                <tr key={dep.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: 8 }}>{dep.productType}</td>
                  <td style={{ padding: 8 }}>{dep.productSource}</td>
                  <td style={{ padding: 8 }}>
                    <Chip c={STATUS_COLORS[dep.deploymentStatus] || 'muted'}>{dep.deploymentStatus}</Chip>
                  </td>
                  <td style={{ padding: 8 }}>{formatDate(dep.lastStatusChange)}</td>
                  <td style={{ padding: 8 }}>{formatDate(dep.createdAt)}</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>
                    <Btn v="success" sm onClick={() => handleDeploy(dep.id)} disabled={actionLoading[dep.id] === 'deploy'}>Deploy</Btn>{' '}
                    <Btn v="danger" sm onClick={() => handleStop(dep.id)} disabled={actionLoading[dep.id] === 'stop'}>Stop</Btn>{' '}
                    <Btn v="secondary" sm onClick={() => handleEdit(dep.id)} disabled={actionLoading[dep.id] === 'edit'}>Edit</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

