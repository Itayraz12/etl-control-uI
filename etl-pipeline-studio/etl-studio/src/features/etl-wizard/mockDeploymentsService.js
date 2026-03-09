// Mock service for deployments data
export async function fetchDeployments() {
  // Simulate network delay
  await new Promise(r => setTimeout(r, 300));
  return [
    {
      id: '1',
      productType: 'Data Pipeline',
      productSource: 'GitHub',
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
      deploymentStatus: 'draft',
      savedVersion: '1.4.8',
      deployedVersion: null,
      lastStatusChange: Date.now() - 7200 * 1000,
      createdAt: Date.now() - 259200 * 1000,
    }
  ];
}

export async function deployService(id) {
  await new Promise(r => setTimeout(r, 200));
  return { success: true };
}

export async function stopDeployment(id) {
  await new Promise(r => setTimeout(r, 200));
  return { success: true };
}

export async function fetchDeploymentConfig(id) {
  await new Promise(r => setTimeout(r, 200));
  return { config: { id, name: 'Sample Config', settings: {} } };
}
