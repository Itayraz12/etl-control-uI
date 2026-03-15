import React, { useEffect } from 'react';
import './DeployProgressModal.css';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';

/**
 * DeployProgressModal Component
 * 
 * A modern, reusable modal that displays deployment progress with:
 * - Rotating spinner loader
 * - Step-based progress tracking
 * - Visual status indicators (pending, active, done, failed)
 * - Success and failure states
 * - Smooth animations
 */
const DeployProgressModal = ({
  isOpen,
  steps = [],
  currentStepIndex = 0,
  isComplete = false,
  isError = false,
  errorMessage = '',
  onClose = () => {},
  title = 'Deploying...',
  successTitle = 'Deployment completed successfully',
  failureTitle = 'Deployment failed'
}) => {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const renderStepIcon = (step, index) => {
    switch (step.status) {
      case 'done':
        return <CheckCircle className="step-icon done" size={20} />;
      case 'failed':
        return <AlertCircle className="step-icon failed" size={20} />;
      case 'active':
        return <div className="step-spinner" />;
      case 'pending':
      default:
        return <Clock className="step-icon pending" size={20} />;
    }
  };

  const renderMainSpinner = () => {
    if (isError) {
      return (
        <div className="modal-spinner-container error-state">
          <AlertCircle size={48} className="error-icon" />
        </div>
      );
    }
    
    if (isComplete) {
      return (
        <div className="modal-spinner-container success-state">
          <CheckCircle size={48} className="success-icon" />
        </div>
      );
    }

    return (
      <div className="modal-spinner-container">
        <div className="modal-spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
      </div>
    );
  };

  const allStepsComplete = steps.every(step => step.status === 'done');
  const hasFailedStep = steps.some(step => step.status === 'failed');

  return (
    <div className="deploy-modal-overlay">
      <div className="deploy-modal">
        {/* Header */}
        <div className="modal-header">
          {renderMainSpinner()}
          
          <div className="modal-title-section">
            {isError ? (
              <h2 className="modal-title error-title">{failureTitle}</h2>
            ) : isComplete ? (
              <h2 className="modal-title success-title">{successTitle}</h2>
            ) : (
              <h2 className="modal-title">{title}</h2>
            )}
            
            {errorMessage && (
              <p className="error-message">{errorMessage}</p>
            )}
          </div>
        </div>

        {/* Steps Container */}
        <div className="modal-content">
          <div className="steps-container">
            {steps.map((step, index) => (
              <div
                key={step.id || index}
                className={`step ${step.status} ${
                  step.status === 'active' ? 'pulse' : ''
                }`}
              >
                <div className="step-icon-wrapper">
                  {renderStepIcon(step, index)}
                </div>
                <div className="step-content">
                  <span className="step-label">{step.label}</span>
                  {step.error && (
                    <span className="step-error">{step.error}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        {(isComplete || isError) && (
          <div className="modal-footer">
            <button
              className="close-button"
              onClick={onClose}
              aria-label="Close deployment modal"
            >
              {isError ? 'Close' : 'Done'}
            </button>
          </div>
        )}

        {!isComplete && !isError && (
          <div className="modal-footer">
            <div className="progress-info">
              <span className="progress-text">
                {currentStepIndex + 1} of {steps.length}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeployProgressModal;
