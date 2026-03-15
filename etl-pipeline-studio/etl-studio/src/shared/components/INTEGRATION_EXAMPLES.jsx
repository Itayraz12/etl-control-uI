/**
 * Integration Example: Deploy Progress Modal with ETL Wizard
 * 
 * This file shows how to integrate the DeployProgressModal component
 * into your existing ETL wizard flow, particularly at the summary/final step.
 * 
 * You can copy and adapt these patterns to your own components.
 */

import React, { useState } from 'react'
import DeployProgressModal from '@/shared/components/DeployProgressModal'
import { useDeploymentProgress } from '@/shared/hooks/useDeploymentProgress'

/**
 * Enhanced Summary Step with Deploy Button
 * 
 * Add this to your SummaryStep.jsx or WizardFooter.jsx
 */
export const SummaryStepWithDeploy = () => {
  const [deployDisabled, setDeployDisabled] = useState(false)
  const deployment = useDeploymentProgress({
    autoAdvance: true,
    stepDuration: 2500,
    onDeploymentComplete: () => {
      console.log('ETL pipeline deployed successfully!')
      setDeployDisabled(false)
      // You could redirect, show success message, etc.
    },
    onDeploymentError: (stepIndex, error) => {
      console.error(`Deployment failed at step ${stepIndex}: ${error}`)
      setDeployDisabled(false)
    },
  })

  const handleDeployClick = async () => {
    setDeployDisabled(true)

    // Define your ETL deployment steps
    const etlDeploymentSteps = [
      {
        id: 'validate-etl-config',
        label: 'Validating ETL pipeline configuration',
      },
      {
        id: 'prepare-sources',
        label: 'Preparing data sources',
      },
      {
        id: 'prepare-sinks',
        label: 'Preparing data sinks',
      },
      {
        id: 'validate-mappings',
        label: 'Validating field mappings',
      },
      {
        id: 'test-connectivity',
        label: 'Testing source/sink connectivity',
      },
      {
        id: 'create-pipeline',
        label: 'Creating pipeline infrastructure',
      },
      {
        id: 'deploy-processors',
        label: 'Deploying data processors',
      },
      {
        id: 'enable-monitoring',
        label: 'Enabling monitoring',
      },
      {
        id: 'run-health-checks',
        label: 'Running health checks',
      },
    ]

    deployment.startDeployment(etlDeploymentSteps)

    // Option A: Mock/Demo Mode - auto-advance
    // (Already enabled with autoAdvance: true above)

    // Option B: Backend Integration - Real Deployment
    // Uncomment and adapt this to your API:
    /*
    try {
      const response = await fetch('/api/etl-pipelines/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipelineId: currentPipeline.id,
          configuration: pipelineConfig,
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      const { deploymentId } = await response.json()

      // Use Server-Sent Events for real-time progress
      const eventSource = new EventSource(
        `/api/etl-pipelines/deployments/${deploymentId}/progress`
      )

      eventSource.onmessage = (event) => {
        const update = JSON.parse(event.data)

        if (update.type === 'step-complete') {
          deployment.completeStep()
        } else if (update.type === 'step-failed') {
          deployment.failStep(update.error)
          eventSource.close()
        } else if (update.type === 'completed') {
          eventSource.close()
        }
      }

      eventSource.onerror = () => {
        deployment.failStep('Connection to server lost')
        eventSource.close()
      }
    } catch (error) {
      deployment.failStep(error.message)
      setDeployDisabled(false)
    }
    */
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Your summary content */}
      <div style={{ marginBottom: '30px' }}>
        <h2>Deployment Summary</h2>
        <p>Review your ETL pipeline configuration and click Deploy to start.</p>
      </div>

      {/* Deploy Button */}
      <button
        onClick={handleDeployClick}
        disabled={deployDisabled}
        style={{
          padding: '12px 32px',
          background: deployDisabled
            ? '#ccc'
            : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: deployDisabled ? 'not-allowed' : 'pointer',
          boxShadow: deployDisabled ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)',
          transition: 'all 0.3s ease',
        }}
      >
        {deployDisabled ? 'Deploying...' : 'Deploy Pipeline'}
      </button>

      {/* Deployment Modal */}
      <DeployProgressModal
        isOpen={deployment.isOpen}
        steps={deployment.steps}
        currentStepIndex={deployment.currentStepIndex}
        isComplete={deployment.isComplete}
        isError={deployment.isError}
        errorMessage={deployment.errorMessage}
        onClose={() => {
          deployment.reset()
          setDeployDisabled(false)
        }}
        title="Deploying your ETL pipeline..."
        successTitle="Pipeline deployed successfully!"
        failureTitle="Deployment failed"
      />
    </div>
  )
}

/**
 * Alternative: Deployment Context for Global State
 * 
 * Use this if you want to manage deployment state globally
 * across multiple wizard screens.
 */
import { createContext, useContext } from 'react'

const DeploymentContext = createContext(null)

export function DeploymentProvider({ children }) {
  const deployment = useDeploymentProgress({
    autoAdvance: true,
    stepDuration: 2500,
  })

  return (
    <DeploymentContext.Provider value={deployment}>
      {children}
      <DeployProgressModal
        isOpen={deployment.isOpen}
        steps={deployment.steps}
        currentStepIndex={deployment.currentStepIndex}
        isComplete={deployment.isComplete}
        isError={deployment.isError}
        errorMessage={deployment.errorMessage}
        onClose={() => deployment.reset()}
      />
    </DeploymentContext.Provider>
  )
}

export function useDeployment() {
  const context = useContext(DeploymentContext)
  if (!context) {
    throw new Error('useDeployment must be used within DeploymentProvider')
  }
  return context
}

// Usage in your app:
// <DeploymentProvider>
//   <YourWizardComponent />
// </DeploymentProvider>

/**
 * Integration Helper: Deployment Service
 * 
 * Structured service for handling ETL deployment with your backend API
 */
export class EtlDeploymentService {
  constructor(apiBaseUrl = '/api') {
    this.apiBaseUrl = apiBaseUrl
  }

  /**
   * Start ETL deployment via API
   */
  async startDeployment(pipelineConfig) {
    const response = await fetch(`${this.apiBaseUrl}/etl-pipelines/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pipelineConfig),
    })

    if (!response.ok) {
      throw new Error(`Failed to start deployment: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Get deployment status (for polling)
   */
  async getDeploymentStatus(deploymentId) {
    const response = await fetch(
      `${this.apiBaseUrl}/etl-pipelines/deployments/${deploymentId}/status`
    )

    if (!response.ok) {
      throw new Error(`Failed to get deployment status: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Listen to deployment progress via Server-Sent Events
   */
  listenToDeploymentProgress(deploymentId, callbacks) {
    const eventSource = new EventSource(
      `${this.apiBaseUrl}/etl-pipelines/deployments/${deploymentId}/progress`
    )

    eventSource.onmessage = (event) => {
      const update = JSON.parse(event.data)
      if (callbacks.onProgress) {
        callbacks.onProgress(update)
      }
    }

    eventSource.onerror = () => {
      if (callbacks.onError) {
        callbacks.onError(new Error('SSE connection failed'))
      }
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }

  /**
   * Poll deployment status repeatedly
   */
  pollDeploymentStatus(deploymentId, callbacks, intervalMs = 1000) {
    const interval = setInterval(async () => {
      try {
        const status = await this.getDeploymentStatus(deploymentId)
        if (callbacks.onStatusUpdate) {
          callbacks.onStatusUpdate(status)
        }

        if (status.isComplete || status.failed) {
          clearInterval(interval)
          if (status.failed && callbacks.onError) {
            callbacks.onError(new Error(status.errorMessage))
          }
        }
      } catch (error) {
        if (callbacks.onError) {
          callbacks.onError(error)
        }
        clearInterval(interval)
      }
    }, intervalMs)

    return () => {
      clearInterval(interval)
    }
  }
}

/**
 * Example: Using EtlDeploymentService with useDeploymentProgress
 */
export function AdvancedDeployExample() {
  const [deployDisabled, setDeployDisabled] = useState(false)
  const deploymentService = new EtlDeploymentService()
  const deployment = useDeploymentProgress({ autoAdvance: false })

  const handleDeploy = async () => {
    setDeployDisabled(true)

    const etlSteps = [
      { id: 'validate', label: 'Validating configuration' },
      { id: 'prepare', label: 'Preparing resources' },
      { id: 'test', label: 'Testing connectivity' },
      { id: 'create', label: 'Creating pipeline' },
      { id: 'deploy', label: 'Deploying processors' },
      { id: 'monitor', label: 'Enabling monitoring' },
      { id: 'health', label: 'Running health checks' },
    ]

    deployment.startDeployment(etlSteps)

    try {
      // Start deployment on backend
      const { deploymentId } = await deploymentService.startDeployment({
        /* your pipeline config */
      })

      // Listen to real-time progress via SSE
      const unsubscribe = deploymentService.listenToDeploymentProgress(
        deploymentId,
        {
          onProgress: (update) => {
            if (update.type === 'step-complete') {
              deployment.completeStep()
            } else if (update.type === 'step-failed') {
              deployment.failStep(update.error)
              unsubscribe()
            }
          },
          onError: (error) => {
            deployment.failStep(error.message)
            unsubscribe()
          },
        }
      )
    } catch (error) {
      deployment.failStep(error.message)
      setDeployDisabled(false)
    }
  }

  return (
    <>
      <button onClick={handleDeploy} disabled={deployDisabled}>
        Deploy
      </button>
      <DeployProgressModal
        isOpen={deployment.isOpen}
        steps={deployment.steps}
        currentStepIndex={deployment.currentStepIndex}
        isComplete={deployment.isComplete}
        isError={deployment.isError}
        errorMessage={deployment.errorMessage}
        onClose={() => {
          deployment.reset()
          setDeployDisabled(false)
        }}
      />
    </>
  )
}
