import React, { useState } from 'react';
import DeployProgressModal from './DeployProgressModal';
import { useDeploymentProgress } from '../hooks/useDeploymentProgress';

/**
 * Example: DeploymentExample Component
 * 
 * This demonstrates how to use the DeployProgressModal with the useDeploymentProgress hook
 * in a parent component with a Deploy button.
 * 
 * Features demonstrated:
 * - Opening/closing modal
 * - Starting deployment with custom steps
 * - Handling success and error scenarios
 * - Integrating real backend progress updates
 */
export const DeploymentExample = () => {
  const [deployButtonDisabled, setDeployButtonDisabled] = useState(false);

  // Initialize the deployment progress hook
  const deployment = useDeploymentProgress({
    autoAdvance: true, // Set to false if you'll manually control step progression
    stepDuration: 2500, // Duration each step is shown (in mock mode)
    onStepComplete: (stepIndex) => {
      console.log(`Step ${stepIndex} completed`);
      // You could emit analytics, update parent state, etc.
    },
    onDeploymentComplete: () => {
      console.log('Deployment completed successfully');
      setDeployButtonDisabled(false);
    },
    onDeploymentError: (stepIndex, errorMsg) => {
      console.error(`Deployment failed at step ${stepIndex}: ${errorMsg}`);
      setDeployButtonDisabled(false);
    },
  });

  /**
   * Handle Click of Deploy Button
   * This starts the deployment process
   */
  const handleDeploy = () => {
    setDeployButtonDisabled(true);

    // Define your deployment steps
    const deploymentSteps = [
      {
        id: 'validate-config',
        label: 'Validating configuration',
      },
      {
        id: 'prepare-resources',
        label: 'Preparing resources',
      },
      {
        id: 'upload-artifacts',
        label: 'Uploading artifacts',
      },
      {
        id: 'deploy-service',
        label: 'Deploying service',
      },
      {
        id: 'health-checks',
        label: 'Running health checks',
      },
    ];

    // Start the deployment
    deployment.startDeployment(deploymentSteps);

    // OPTION A: Auto-advance mode (mock/demo)
    // The hook will automatically progress through steps based on stepDuration
    // Perfect for demos or testing UI before backend integration

    // OPTION B: Backend-driven mode (real deployment)
    // Disable autoAdvance: false in the hook options
    // Then use websocket, polling, or SSE to listen for backend updates
    // Example:
    /*
    const eventSource = new EventSource('/api/deployment/progress');
    eventSource.onmessage = (event) => {
      const update = JSON.parse(event.data);
      
      if (update.type === 'step-complete') {
        deployment.completeStep();
      } else if (update.type === 'step-failed') {
        deployment.failStep(update.error);
      }
    };

    return () => {
      eventSource.close();
    };
    */

    // OPTION C: Polling mode
    // Example:
    /*
    const pollInterval = setInterval(async () => {
      const response = await fetch('/api/deployment/status');
      const data = await response.json();
      
      if (data.status === 'failed') {
        deployment.failStep(data.error);
        clearInterval(pollInterval);
      } else if (data.completedSteps > deployment.currentStepIndex) {
        deployment.completeStep();
      }
      
      if (data.isComplete) {
        clearInterval(pollInterval);
      }
    }, 1000);

    return () => {
      clearInterval(pollInterval);
    };
    */
  };

  /**
   * Simulate an error during deployment
   * This is useful for testing the error state
   */
  const handleDeployWithError = () => {
    setDeployButtonDisabled(true);

    const deploymentSteps = [
      { id: 'validate-config', label: 'Validating configuration' },
      { id: 'prepare-resources', label: 'Preparing resources' },
      { id: 'upload-artifacts', label: 'Uploading artifacts (this will fail)' },
      { id: 'deploy-service', label: 'Deploying service' },
      { id: 'health-checks', label: 'Running health checks' },
    ];

    deployment.startDeployment(deploymentSteps);

    // Simulate completing first 2 steps
    setTimeout(() => {
      deployment.completeStep();
    }, 2500);

    setTimeout(() => {
      deployment.completeStep();
    }, 5000);

    // Simulate failure on 3rd step
    setTimeout(() => {
      deployment.failStep('Failed to upload artifacts: Insufficient disk space');
    }, 7500);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Deployment Examples</h1>
        <p style={styles.description}>
          Click "Deploy" to see the progress modal in action.
        </p>

        <div style={styles.buttonGroup}>
          <button
            style={{
              ...styles.button,
              ...styles.successButton,
              opacity: deployButtonDisabled ? 0.6 : 1,
              cursor: deployButtonDisabled ? 'not-allowed' : 'pointer',
            }}
            onClick={handleDeploy}
            disabled={deployButtonDisabled}
          >
            Deploy (Success)
          </button>

          <button
            style={{
              ...styles.button,
              ...styles.errorButton,
              opacity: deployButtonDisabled ? 0.6 : 1,
              cursor: deployButtonDisabled ? 'not-allowed' : 'pointer',
            }}
            onClick={handleDeployWithError}
            disabled={deployButtonDisabled}
          >
            Deploy (Simulate Error)
          </button>

          <button
            style={{
              ...styles.button,
              ...styles.resetButton,
            }}
            onClick={() => {
              deployment.reset();
              setDeployButtonDisabled(false);
            }}
          >
            Close Modal
          </button>
        </div>
      </div>

      {/* The Deployment Modal */}
      <DeployProgressModal
        isOpen={deployment.isOpen}
        steps={deployment.steps}
        currentStepIndex={deployment.currentStepIndex}
        isComplete={deployment.isComplete}
        isError={deployment.isError}
        errorMessage={deployment.errorMessage}
        onClose={() => {
          deployment.reset();
          setDeployButtonDisabled(false);
        }}
        title="Deploying your ETL pipeline..."
        successTitle="Pipeline deployed successfully!"
        failureTitle="Deployment failed"
      />
    </div>
  );
};

// Styles for the example component
const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
    padding: '20px',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '40px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
    maxWidth: '500px',
    width: '100%',
  },
  title: {
    margin: '0 0 16px 0',
    fontSize: '28px',
    fontWeight: '700',
    color: '#1f2937',
  },
  description: {
    margin: '0 0 32px 0',
    fontSize: '16px',
    color: '#6b7280',
    lineHeight: '1.6',
  },
  buttonGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  button: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: 'inherit',
  },
  successButton: {
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    color: 'white',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
  },
  errorButton: {
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    color: 'white',
    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
  },
  resetButton: {
    background: '#e5e7eb',
    color: '#374151',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
};

export default DeploymentExample;
