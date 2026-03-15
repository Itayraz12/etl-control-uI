# Deploy Progress Modal - Architecture & Data Flow

## Component Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   Parent Component                          │
│  (e.g., SummaryStep, EtlManagementScreen, WizardFooter)    │
│                                                              │
│  • Renders Deploy button                                    │
│  • Owns deployment state via useDeploymentProgress hook    │
│  • Handles deploy button click                             │
│                                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │         useDeploymentProgress Hook                │   │
│  │  ┌──────────────────────────────────────────────┐ │   │
│  │  │ State                                        │ │   │
│  │  │ • isOpen: boolean                            │ │   │
│  │  │ • steps: Step[]                              │ │   │
│  │  │ • currentStepIndex: number                   │ │   │
│  │  │ • isComplete: boolean                        │ │   │
│  │  │ • isError: boolean                           │ │   │
│  │  │ • errorMessage: string                       │ │   │
│  │  └──────────────────────────────────────────────┘ │   │
│  │                                                    │   │
│  │  ┌──────────────────────────────────────────────┐ │   │
│  │  │ Actions                                      │ │   │
│  │  │ • startDeployment(steps)                     │ │   │
│  │  │ • completeStep()                             │ │   │
│  │  │ • failStep(error)                            │ │   │
│  │  │ • reset()                                    │ │   │
│  │  │ • updateStep(index, updates)                 │ │   │
│  │  └──────────────────────────────────────────────┘ │   │
│  │                                                    │   │
│  │  ┌──────────────────────────────────────────────┐ │   │
│  │  │ Callbacks (Optional)                         │ │   │
│  │  │ • onStepComplete(stepIndex)                  │ │   │
│  │  │ • onDeploymentComplete()                     │ │   │
│  │  │ • onDeploymentError(stepIndex, error)        │ │   │
│  │  └──────────────────────────────────────────────┘ │   │
│  └────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │        DeployProgressModal Component              │   │
│  │  Renders: Modal UI, Spinner, Steps, Buttons       │   │
│  │  Props: All state from hook + callbacks           │   │
│  │  Styling: Animations, Colors, Layout             │   │
│  └────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Initialization Flow

```
User clicks Deploy Button
           ↓
┌─────────────────────────────────────┐
│ handleDeploy()                      │
│ • Define deployment steps           │
│ • Call deployment.startDeployment() │
└─────────────────────────────────────┘
           ↓
┌──────────────────────────────────────────────┐
│ useDeploymentProgress Hook                  │
│ • Set isOpen = true                          │
│ • Initialize steps with status = pending    │
│ • Set currentStepIndex = 0, first step active
│ • Clear complete/error flags                │
└──────────────────────────────────────────────┘
           ↓
┌────────────────────────────────────────┐
│ Hook Options Check                    │
├────────────────────────────────────────┤
│ autoAdvance = true?                   │
│ ├─ YES: Start auto-advance timer      │
│ └─ NO: Wait for manual advance/backend │
└────────────────────────────────────────┘
           ↓
┌──────────────────────────────┐
│ Component Re-renders         │
│ Props updated, modal appears│
└──────────────────────────────┘
```

### Step Progression Flow

```
[Auto-Advance Timer] OR [Backend Event] OR [Manual Call]
           ↓
┌────────────────────────────────────┐
│ deployment.completeStep()          │
├────────────────────────────────────┤
│ Actions:                            │
│ 1. Mark current step status = done│
│ 2. Call onStepComplete callback    │
│ 3. Check if all steps complete    │
│    ├─ YES: Set isComplete = true  │
│    └─ NO: Advance to next step    │
│        └ Mark next step active    │
└────────────────────────────────────┘
           ↓
┌──────────────────────────────┐
│ Re-render with new state    │
│ Update step visuals         │
│ Advance spinner if more steps
└──────────────────────────────┘
```

### Success Flow

```
Last Step Complete
           ↓
┌──────────────────────────────────┐
│ deployment.completeStep()        │
│ • Detects all steps done        │
│ • Sets isComplete = true        │
│ • Calls onDeploymentComplete()  │
└──────────────────────────────────┘
           ↓
┌─────────────────────────────┐
│ Component Re-renders         │
│ • Spinner → Success icon    │
│ • Title → Success message   │
│ • Show close button          │
└─────────────────────────────┘
           ↓
User Clicks Close
           ↓
deployment.reset()
           ↓
Modal Closes, State Cleared
```

### Error Flow

```
Step Fails (via backend or manual call)
           ↓
┌──────────────────────────────────────┐
│ deployment.failStep(errorMsg)       │
├──────────────────────────────────────┤
│ Actions:                              │
│ 1. Mark current step status = failed|
│ 2. Set step.error = errorMsg        │
│ 3. Set isError = true                │
│ 4. Set errorMessage = display text  │
│ 5. Call onDeploymentError callback  │
└──────────────────────────────────────┘
           ↓
┌─────────────────────────────┐
│ Component Re-renders         │
│ • Spinner → Error icon      │
│ • Title → Failure message   │
│ • Failed step highlighted   │
│ • Error message displayed   │
│ • Other steps freeze        │
│ • Show close button          │
└─────────────────────────────┘
           ↓
User Clicks Close
           ↓
deployment.reset()
```

## Step State Machine

```
┌─────────────────────────────────────────────┐
│                 INITIAL STATE               │
│         (Before deployment starts)          │
│    All steps: status = "pending"            │
│    Modal: closed                            │
└──────────────┬────────────────────────────┘
               │
               │ user clicks Deploy
               │
               ↓
┌──────────────────────────────────────────────┐
│            DEPLOYMENT STARTED                │
│  ┌───────┐  ┌───────┐  ┌───────┐           │
│  │pending│  │pending│  │pending│  ...      │
│  └───────┘  └───────┘  └───────┘           │
│  ┌───────┐                                  │
│  │♻ active│  (Step 1)                      │
│  └───────┘                                  │
└──────────────┬───────────────────────────┘
               │
               │ timer / backend / manual
               │
               ↓
┌──────────────────────────────────────────────┐
│           STEP PROGRESSING                   │
│  ┌─────┐  ┌───────┐  ┌───────┐             │
│  │✓done│  │♻ active│  │pending│  ...      │
│  └─────┘  └───────┘  └───────┘             │
└──────────────┬───────────────────────────┘
               │
        ┌──────┴──────┐
        │             │
   more steps?    last step?
        │             │
        ↓             ↓
   PROGRESSING    COMPLETE
        │
        │ (loop back to STEP PROGRESSING)
        │
        └─────────────┬──────────────┐
                      │              │
                   SUCCESS        FAILED
                      │              │
                      ↓              ↓
        ┌─────────────────┐  ┌──────────────┐
        │  ✓ SUCCESS      │  │  ✕ FAILED    │
        │  Icon updated   │  │  Alert icon  │
        │  Close button   │  │  Error shown │
        └─────────────────┘  └──────────────┘
                      │              │
                      └──────┬───────┘
                             │
                      User clicks Close
                             │
                             ↓
                    deployment.reset()
                             │
                             ↓
                     Back to INITIAL STATE
```

## Auto-Advance Logic

```
Hook Initialization
           ↓
autoAdvance = true?
├─ YES: Set up timer
└─ NO: Skip timer logic
           ↓
┌────────────────────────────────────────┐
│ useEffect Hook (runs when state changes)│
├────────────────────────────────────────┤
│ if (isOpen && !isComplete && !isError) │
│   Clear old timeout                     │
│   setTimeout(completeStep, stepDuration│
│ else                                    │
│   Clear timeout                         │
│   Stop progression                      │
└────────────────────────────────────────┘
           ↓
┌────────────────────────────────────┐
│ stepDuration milliseconds pass     │
├────────────────────────────────────┤
│ completeStep() called              │
│ State updates, currentStepIndex++  │
│ Re-render, timer resets            │
└────────────────────────────────────┘
           ↓
┌────────────────────────────────────┐
│ Next step now active               │
│ useEffect runs again               │
│ New timer set                       │
└────────────────────────────────────┘
           ↓
[Loop continues until isComplete or isError]
```

## Backend Integration Architecture

```
┌──────────────────────────────────────────────────────┐
│              PARENT COMPONENT                        │
│                                                      │
│  const handleDeploy = async () => {                │
│    deployment.startDeployment(steps)               │
│                                                      │
│    // Backend Integration Pattern                   │
│    const deploymentId = await fetch(...).json()   │
│                                                      │
│    // Listen for updates                           │
│    setupProgressListener(deploymentId, deployment) │
│  }                                                   │
└──────────────┬─────────────────────────────────────┘
               │
        ┌──────┴──────┬──────────┐
        │             │          │
        ↓             ↓          ↓
    ┌────────┐  ┌──────────┐  ┌────────────┐
    │  SSE   │  │ Polling  │  │ WebSocket  │
    │(Events)│  │(REST)    │  │            │
    └────────┘  └──────────┘  └────────────┘
        │             │          │
        ↓             ↓          ↓
┌──────────────────────────────────────┐
│   Progress Update Event Handler      │
│ • Extract step status from backend   │
│ • Call appropriate hook method:      │
│   - deployment.completeStep()        │
│   - deployment.failStep(error)       │
│ • Hook handles state update & re-render
└──────────────────────────────────────┘
        │
        └────────────┬──────────────┐
                     │              │
                  SUCCESS        FAILURE
                     │              │
                     ↓              ↓
         ┌──────────────┐  ┌─────────────┐
         │ Modal shows  │  │ Modal shows │
         │ completion   │  │ error       │
         └──────────────┘  └─────────────┘
```

## File Dependencies

```
src/shared/

components/
├── DeployProgressModal.jsx
│   └─ imports: lucide-react icons
│   └─ imports: ./DeployProgressModal.css
│
├── DeployProgressModal.css
│   └─ no imports
│
├── DeploymentExample.jsx
│   ├─ imports: DeployProgressModal
│   └─ imports: useDeploymentProgress
│
├── index.jsx
│   └─ exports: DeployProgressModal
│   └─ exports: DeploymentExample
│
├── INTEGRATION_EXAMPLES.jsx
│   ├─ imports: DeployProgressModal
│   └─ imports: useDeploymentProgress
│
├── QUICK_START.md
├── DEPLOYMENT_MODAL_README.md
├── IMPLEMENTATION_SUMMARY.md
└─ ARCHITECTURE.md (this file)

hooks/
└── useDeploymentProgress.js
    ├─ no external imports
    └─ pure React hooks only
```

## Rendering Performance

```
Parent Component State Update
           ↓
Hook updates state via setState()
           ↓
┌─────────────────────────────────────┐
│  DeployProgressModal Re-renders      │
├─────────────────────────────────────┤
│  Fast because:                       │
│  • Only props changed                │
│  • No expensive calculations         │
│  • CSS handles animations            │
│  • Step list efficiently renders     │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  CSS Animations Continue             │
│  (60fps, no JavaScript blocks)      │
├─────────────────────────────────────┤
│  • Spinner rotation                  │
│  • Step pulse                        │
│  • Icon animations                   │
│  • Backdop effects                   │
└─────────────────────────────────────┘
           ↓
Next state update (auto-advance or backend event)
```

## Memory Lifecycle

```
Component Mounts
  ↓
useDeploymentProgress Hook Initializes
  • Refs: timeoutRef, abortedRef
  • State: isOpen, steps, etc.
  ↓
User Clicks Deploy
  • startDeployment() called
  • Timer starts (if autoAdvance)
  ↓
Steps Progress
  • completeStep() updates state
  • Timer resets
  ↓
Deployment Complete / Error
  • isComplete or isError = true
  • Timer cleared
  ↓
User Closes Modal
  • reset() called
  • State cleared
  • Refs cleared
  • Timer cleared
  ↓
Component Unmounts
  ↓
Cleanup (useEffect return functions)
  • Timeout cleared
  • Listeners removed
  • Memory freed
```

---

This comprehensive architecture enables:
- ✅ Clean separation of concerns
- ✅ Reusable components & hooks
- ✅ Multiple backend integration patterns
- ✅ Efficient rendering & performance
- ✅ Proper memory management
- ✅ Easy testing & debugging
