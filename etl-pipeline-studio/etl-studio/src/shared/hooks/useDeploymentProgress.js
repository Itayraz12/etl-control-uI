import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * useDeploymentProgress Hook
 * 
 * Manages deployment state and step progression
 * 
 * Features:
 * - Step-based progress tracking
 * - Auto-advance with configurable timing
 * - Support for real backend integration (polling, WebSocket, SSE)
 * - Success and failure handling
 * - Clean state management
 */
export const useDeploymentProgress = (options = {}) => {
  const {
    autoAdvance = true,
    stepDuration = 2000, // ms
    onStepComplete = null,
    onDeploymentComplete = null,
    onDeploymentError = null,
  } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [steps, setSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const autoAdvanceTimeoutRef = useRef(null);
  const deploymentAbortedRef = useRef(false);

  /**
   * Initialize deployment with steps
   */
  const startDeployment = useCallback((deploymentSteps) => {
    deploymentAbortedRef.current = false;
    setIsOpen(true);
    setIsComplete(false);
    setIsError(false);
    setErrorMessage('');
    setCurrentStepIndex(0);

    const initialSteps = deploymentSteps.map((step, index) => ({
      id: step.id || `step-${index}`,
      label: step.label,
      status: index === 0 ? 'active' : 'pending',
      error: '',
    }));

    setSteps(initialSteps);
  }, []);

  /**
   * Complete current step and advance to next
   */
  const completeStep = useCallback(() => {
    setSteps((prevSteps) => {
      const newSteps = [...prevSteps];
      newSteps[currentStepIndex].status = 'done';
      return newSteps;
    });

    if (onStepComplete) {
      onStepComplete(currentStepIndex);
    }

    // Check if all steps are complete
    if (currentStepIndex === steps.length - 1) {
      setIsComplete(true);
      if (onDeploymentComplete) {
        onDeploymentComplete();
      }
      return;
    }

    // Advance to next step
    const nextIndex = currentStepIndex + 1;
    setCurrentStepIndex(nextIndex);

    setSteps((prevSteps) => {
      const newSteps = [...prevSteps];
      newSteps[nextIndex].status = 'active';
      return newSteps;
    });
  }, [currentStepIndex, steps.length, onStepComplete, onDeploymentComplete]);

  /**
   * Mark current step as failed with error message
   */
  const failStep = useCallback(
    (errorMsg = 'Step failed') => {
      deploymentAbortedRef.current = true;
      setSteps((prevSteps) => {
        const newSteps = [...prevSteps];
        newSteps[currentStepIndex].status = 'failed';
        newSteps[currentStepIndex].error = errorMsg;
        return newSteps;
      });

      setIsError(true);
      setErrorMessage(`Failed at "${steps[currentStepIndex]?.label}"`);

      if (onDeploymentError) {
        onDeploymentError(currentStepIndex, errorMsg);
      }
    },
    [currentStepIndex, steps, onDeploymentError]
  );

  /**
   * Reset deployment state
   */
  const reset = useCallback(() => {
    deploymentAbortedRef.current = true;
    setIsOpen(false);
    setSteps([]);
    setCurrentStepIndex(0);
    setIsComplete(false);
    setIsError(false);
    setErrorMessage('');

    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
    }
  }, []);

  /**
   * Manually advance to next step (for external control)
   */
  const advanceToNextStep = useCallback(() => {
    completeStep();
  }, [completeStep]);

  /**
   * Update a specific step's status or properties
   */
  const updateStep = useCallback((stepIndex, updates) => {
    setSteps((prevSteps) => {
      const newSteps = [...prevSteps];
      newSteps[stepIndex] = { ...newSteps[stepIndex], ...updates };
      return newSteps;
    });
  }, []);

  /**
   * Auto-advance logic for demo/mock mode
   */
  useEffect(() => {
    if (!autoAdvance || isComplete || isError || !isOpen) {
      return;
    }

    // Clear any existing timeout
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
    }

    // Set new timeout to advance step
    autoAdvanceTimeoutRef.current = setTimeout(() => {
      if (!deploymentAbortedRef.current) {
        completeStep();
      }
    }, stepDuration);

    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
    };
  }, [isOpen, currentStepIndex, isComplete, isError, autoAdvance, stepDuration, completeStep]);

  return {
    // State
    isOpen,
    steps,
    currentStepIndex,
    isComplete,
    isError,
    errorMessage,

    // Actions
    startDeployment,
    completeStep,
    advanceToNextStep,
    failStep,
    updateStep,
    reset,

    // Utilities
    setIsOpen,
  };
};

/**
 * Hook for simulating deployment progress
 * Useful for demos and testing before backend integration
 */
export const useMockDeploymentSimulation = () => {
  const deployment = useDeploymentProgress({
    autoAdvance: true,
    stepDuration: 2000,
  });

  const startMockDeployment = useCallback(() => {
    const mockSteps = [
      { id: 'validate', label: 'Validating configuration' },
      { id: 'prepare', label: 'Preparing resources' },
      { id: 'upload', label: 'Uploading artifacts' },
      { id: 'deploy', label: 'Deploying service' },
      { id: 'health', label: 'Running health checks' },
    ];

    deployment.startDeployment(mockSteps);
  }, [deployment]);

  return {
    ...deployment,
    startMockDeployment,
  };
};
