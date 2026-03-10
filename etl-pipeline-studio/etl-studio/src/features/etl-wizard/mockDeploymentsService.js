// Backend service for deployments data
// Using relative path so Vite proxy forwards to http://localhost:8080
const API_BASE_URL = '/api/backend/deployments';

export async function fetchDeployments(teamName = 'default') {
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

export async function deployService(id) {
  try {
    const url = `/api/backend/deployments/${id}/deploy`;
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

export async function stopDeployment(id) {
  try {
    const url = `/api/backend/deployments/${id}/stop`;
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

export async function fetchDeploymentConfig(id) {
  try {
    const url = `/api/backend/deployments/${id}/config`;
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
