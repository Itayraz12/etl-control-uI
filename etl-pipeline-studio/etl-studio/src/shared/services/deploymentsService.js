// Backend service for deployments data
// Using full backend URL since CORS is enabled
const API_BASE_URL = 'http://localhost:8080/api/backend/deployments';

export async function fetchDeployments(teamName = 'default', useMock = false) {
  if (useMock) {
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
  } else {
    try {
      const url = `${API_BASE_URL}?teamName=${encodeURIComponent(teamName)}`;
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
        return Array.isArray(data) ? data : [];
      }

      console.log('✅ Deployments fetched successfully!');
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch deployments:', error);
      console.error('   Error message:', error.message);
      console.error('   Error stack:', error.stack);
      // Return empty array on error
      return [];
    }
  }
}

export async function deployService(id, useMock = false) {
  if (useMock) {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 200));
    return { success: true };
  } else {
    try {
      const url = `${API_BASE_URL}/${id}/deploy`;
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
      const url = `${API_BASE_URL}/${id}/stop`;
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

export async function fetchDeploymentConfig(id, useMock = false) {
  if (useMock) {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 200));
    return { config: { id, name: 'Sample Config', settings: {} } };
  } else {
    try {
      const url = `${API_BASE_URL}/${id}/config`;
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
