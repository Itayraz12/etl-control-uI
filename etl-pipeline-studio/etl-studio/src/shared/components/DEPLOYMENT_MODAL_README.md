# Deploy Progress Modal - Implementation Guide

## Overview

The Deploy Progress Modal is a production-quality component for displaying deployment progress in your ETL UI. It provides a modern, informative experience with smooth animations, step-based progress tracking, and support for both success and failure scenarios.

## Component Structure

```
shared/
├── components/
│   ├── DeployProgressModal.jsx       # Main modal component
│   ├── DeployProgressModal.css       # Styling and animations
│   ├── DeploymentExample.jsx         # Example usage component
│   └── index.jsx                     # Exports
└── hooks/
    └── useDeploymentProgress.js      # State management hook
```

## Features

✅ **Modern Design**
- Polished, professional appearance
- Smooth animations and transitions
- Clean visual hierarchy

✅ **Complete Progress Tracking**
- Step-based progression model
- Visual status indicators (pending, active, done, failed)
- Rotating spinner for active steps
- Animated icons for completed/failed steps

✅ **Flexible State Management**
- Auto-advance mode (mock/demo)
- Manual control (backend-driven)
- Backend integration ready (polling, WebSocket, SSE)

✅ **User Experience**
- Disables deploy button during deployment
- Prevents body scroll when modal is open
- Success and failure states with appropriate messaging
- Responsive design for mobile and desktop

✅ **Reusable & Clean**
- Separated UI logic from state management
- Custom hook for easy integration
- Production-ready code

## Components

### DeployProgressModal Component

Main modal component that displays deployment progress with visual feedback.

**Location:** `src/shared/components/DeployProgressModal.jsx`

**Props:**

```typescript
interface DeployProgressModalProps {
  isOpen: boolean              // Whether modal is visible
  steps: Step[]                // Array of deployment steps
  currentStepIndex: number     // Index of currently executing step
  isComplete: boolean          // Whether deployment succeeded
  isError: boolean             // Whether deployment failed
  errorMessage: string         // Error message to display
  onClose: () => void          // Called when modal should close
  title: string                // Modal title during deployment
  successTitle: string         // Title when deployment succeeds
  failureTitle: string         // Title when deployment fails
}

interface Step {
  id: string                   // Unique step identifier
  label: string                // Display label
  status: 'pending' | 'active' | 'done' | 'failed'
  error?: string               // Optional error message
}
```

**Example:**

```jsx
import DeployProgressModal from '@/shared/components/DeployProgressModal'

function MyComponent() {
  return (
    <DeployProgressModal
      isOpen={isOpen}
      steps={steps}
      currentStepIndex={0}
      isComplete={false}
      isError={false}
      onClose={() => setIsOpen(false)}
      title="Deploying..."
      successTitle="Deployment completed successfully"
      failureTitle="Deployment failed"
    />
  )
}
```

### useDeploymentProgress Hook

Custom hook managing deployment state and step progression.

**Location:** `src/shared/hooks/useDeploymentProgress.js`

**Returns:**

```typescript
interface UseDeploymentProgressReturn {
  // State
  isOpen: boolean
  steps: Step[]
  currentStepIndex: number
  isComplete: boolean
  isError: boolean
  errorMessage: string

  // Actions
  startDeployment(steps: Step[]): void
  completeStep(): void
  advanceToNextStep(): void
  failStep(errorMsg: string): void
  updateStep(stepIndex: number, updates: Partial<Step>): void
  reset(): void
  setIsOpen(open: boolean): void
}
```

**Options:**

```typescript
interface UseDeploymentProgressOptions {
  autoAdvance?: boolean         // Auto-progress through steps (default: true)
  stepDuration?: number         // Duration each step shows in ms (default: 2000)
  onStepComplete?: (stepIndex: number) => void
  onDeploymentComplete?: () => void
  onDeploymentError?: (stepIndex: number, error: string) => void
}
```

## Usage Examples

### Basic Usage with Auto-Advance (Demo Mode)

```jsx
import { useDeploymentProgress } from '@/shared/hooks/useDeploymentProgress'
import DeployProgressModal from '@/shared/components/DeployProgressModal'

function DeployButton() {
  const [isDisabled, setIsDisabled] = useState(false)
  const deployment = useDeploymentProgress({
    autoAdvance: true,
    stepDuration: 2000,
    onDeploymentComplete: () => {
      setIsDisabled(false)
      console.log('Deployment succeeded!')
    },
    onDeploymentError: (stepIndex, error) => {
      setIsDisabled(false)
      console.error(`Failed at step ${stepIndex}: ${error}`)
    },
  })

  const handleDeploy = () => {
    setIsDisabled(true)
    const steps = [
      { id: 'validate', label: 'Validating configuration' },
      { id: 'prepare', label: 'Preparing resources' },
      { id: 'upload', label: 'Uploading artifacts' },
      { id: 'deploy', label: 'Deploying service' },
      { id: 'health', label: 'Running health checks' },
    ]
    deployment.startDeployment(steps)
  }

  return (
    <>
      <button onClick={handleDeploy} disabled={isDisabled}>
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
          setIsDisabled(false)
        }}
      />
    </>
  )
}
```

### Backend Integration with Server-Sent Events (SSE)

```jsx
function DeployButtonWithBackend() {
  const deployment = useDeploymentProgress({
    autoAdvance: false,  // Disable auto-advance
    onDeploymentComplete: () => console.log('Deployment succeeded!'),
  })

  const handleDeploy = async () => {
    const steps = [
      { id: 'validate', label: 'Validating configuration' },
      { id: 'prepare', label: 'Preparing resources' },
      { id: 'upload', label: 'Uploading artifacts' },
      { id: 'deploy', label: 'Deploying service' },
      { id: 'health', label: 'Running health checks' },
    ]
    
    deployment.startDeployment(steps)

    try {
      const response = await fetch('/api/deployment/start', { method: 'POST' })
      const deploymentId = await response.json()

      // Listen for server-sent events
      const eventSource = new EventSource(`/api/deployment/${deploymentId}/progress`)
      
      eventSource.onmessage = (event) => {
        const update = JSON.parse(event.data)
        
        switch (update.type) {
          case 'step-complete':
            deployment.completeStep()
            break
          case 'step-failed':
            deployment.failStep(update.error)
            eventSource.close()
            break
          case 'deployment-complete':
            eventSource.close()
            break
        }
      }

      eventSource.onerror = () => {
        deployment.failStep('Connection to server lost')
        eventSource.close()
      }
    } catch (error) {
      deployment.failStep(error.message)
    }
  }

  return (
    <>
      <button onClick={handleDeploy}>
        Deploy
      </button>
      <DeployProgressModal
        isOpen={deployment.isOpen}
        steps={deployment.steps}
        currentStepIndex={deployment.currentStepIndex}
        isComplete={deployment.isComplete}
        isError={deployment.isError}
        errorMessage={deployment.errorMessage}
        onClose={() => deployment.reset()}
      />
    </>
  )
}
```

### Backend Integration with Polling

```jsx
function DeployButtonWithPolling() {
  const deployment = useDeploymentProgress({ autoAdvance: false })

  const handleDeploy = async () => {
    const steps = [/* ... */]
    deployment.startDeployment(steps)

    try {
      const response = await fetch('/api/deployment/start', { method: 'POST' })
      const deploymentId = await response.json()

      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/deployment/${deploymentId}/status`)
          const status = await statusResponse.json()

          if (status.completedSteps > deployment.currentStepIndex) {
            deployment.completeStep()
          }

          if (status.failed) {
            deployment.failStep(status.errorMessage)
            clearInterval(pollInterval)
          }

          if (status.isComplete) {
            clearInterval(pollInterval)
          }
        } catch (error) {
          deployment.failStep('Polling error: ' + error.message)
          clearInterval(pollInterval)
        }
      }, 1000)
    } catch (error) {
      deployment.failStep(error.message)
    }
  }

  return (/* ... */)
}
```

### Programmatic Control

```jsx
function AdvancedDeployment() {
  const deployment = useDeploymentProgress({ autoAdvance: false })

  const handleDeploy = async () => {
    const steps = [/* ... */]
    deployment.startDeployment(steps)

    // Manually control step progression
    try {
      await validateConfig()
      deployment.completeStep()

      await prepareResources()
      deployment.completeStep()

      await uploadArtifacts()
      deployment.completeStep()

      // ... continue through all steps
    } catch (error) {
      deployment.failStep(error.message)
    }
  }

  return (/* ... */)
}
```

## Styling

The component includes comprehensive styling with:

- **Modern Color Scheme:** Blues, greens, reds for different states
- **Smooth Animations:** Fade-in, scale-in, spin, pulse effects
- **Responsive Design:** Adapts to mobile and desktop screens
- **Professional Typography:** Clear hierarchy and readable fonts
- **Visual Feedback:** Hover states, transitions, icon animations

### Customization

To customize colors, update the CSS variables in `DeployProgressModal.css`:

```css
/* Change primary blue */
.modal-spinner-container.success-state .success-icon {
  color: #your-green;
}

.step.active {
  background-color: #your-light-blue;
}

.close-button {
  background: linear-gradient(135deg, #your-blue 0%, #your-darker-blue 100%);
}
```

## API Reference

### Step Status Values

- **`pending`** - Step hasn't started yet
- **`active`** - Step is currently running
- **`done`** - Step completed successfully
- **`failed`** - Step encountered an error

### Modal States

| State | Visual Feedback |
|-------|-----------------|
| *Loading* | Rotating spinner, active step highlighted |
| *Success* | Green success icon, success title, done message |
| *Failed* | Red error icon, failed step highlighted with error, failure title |

## Best Practices

1. **Disable Deploy Button:** Always disable the deploy button during deployment to prevent multiple deployments

```jsx
<button disabled={deployment.isOpen}>Deploy</button>
```

2. **Handle Cleanup:** Reset deployment state when modal closes

```jsx
onClose={() => {
  deployment.reset()
  setIsDisabled(false)
}}
```

3. **Backend Ready:** Design your modal prop passing so you can easily switch between demo and real modes

4. **Error Messages:** Provide clear, user-friendly error messages

```jsx
deployment.failStep('Failed to upload artifacts: Check disk space')
```

5. **Step Duration:** For real deployments, remove `stepDuration` or set `autoAdvance: false`

## Performance Considerations

- Modal renders efficiently with minimal re-renders
- Animations use CSS for smooth 60fps performance
- Backdrop blur is subtle to avoid performance issues
- Scrollable step list prevents layout shift

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Mobile 90+)

## Dependencies

- React 16.8+ (for hooks)
- lucide-react (for icons: CheckCircle, AlertCircle, Clock)

If you don't want to use lucide-react icons, you can replace them with:
- SVG icons
- Unicode symbols
- Emoji
- CSS-only icons

## Troubleshooting

**Modal not appearing:**
- Check that `isOpen={true}`
- Verify `steps` array is not empty

**Steps not advancing:**
- Ensure `autoAdvance={true}` in hook options
- Or manually call `completeStep()`
- Check no errors are blocking progression

**Styling looks off:**
- Import CSS file: `import './DeployProgressModal.css'`
- Check CSS module path if using CSS modules
- Verify no conflicting global styles

**Performance issues:**
- Reduce animation complexity if on low-end devices
- Use `autoAdvance: false` with backend polling
- Limit step list height with CSS scrolling

## Future Enhancements

Potential additions:
- Estimated time remaining
- Retry failed steps
- Step dependencies visualization
- Real-time log/output display
- Pause/resume functionality
- Dark mode support
- Accessibility improvements (ARIA labels)

## License

See parent project license.
