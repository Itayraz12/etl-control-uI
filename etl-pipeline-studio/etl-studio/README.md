# ETL Pipeline Studio

React + Vite frontend for configuring and managing ETL pipelines.

The application combines a login flow, a management screen for existing deployments, and a 7-step ETL wizard with a visual source-to-target field-mapping canvas.

## Current highlights

- Persisted login session with refresh-safe user restoration
- Per-user wizard draft persistence in local storage
- Idle logout with configurable grace-based draft reset
- Mock/live backend switching for configuration data and deployments
- Searchable transformer modal with runtime-generated property forms
- Visual field mapping with single-target enforcement, multi-input transformers, and chained transformers per connection
- Required transformer-property validation that highlights invalid transformer nodes in red
- Target metadata editing for Saknay and expression values
- Deployment edit flow that hydrates wizard state from backend YAML
- Real-time deployment progress modal driven by Server-Sent Events (SSE) from the backend
- Consistent deploy UX across both the Summary wizard tab and the Management screen:
  - Progress modal with per-step status (pending → active → done / failed)
  - Error popup on any failure (pre-flight or SSE), matching the Summary tab's style
  - Full-screen success page with pipeline info and Grafana dashboard link after successful deployment

## Quick start

### Prerequisites

- Node.js 18+ recommended
- npm 9+ recommended
- Optional backend at `http://localhost:8080`

### Install and run

```bash
cd etl-pipeline-studio/etl-studio
npm install
npm run dev
```

Open `http://localhost:5173`.

For local development, the Vite dev server can proxy `/api` requests to `http://localhost:8080`.
This avoids cross-origin browser restrictions on custom response headers such as `user-role`.

## Build-time application configuration

The UI reads these Vite environment variables at build time:

| Variable | Default | Description |
|---|---:|---|
| `VITE_API_BASE` | `http://localhost:8080/api` | Base URL for all live backend API calls |
| `VITE_AUTH_AES_KEY` | `MDEyMzQ1Njc4OWFiY2RlZg==` | Base64-encoded shared AES key used to AES-GCM encrypt the live-login `username` and `password` payload fields |
| `VITE_APP_VERSION` | `package.json` version | UI version label override shown in the app chrome |
| `VITE_PRODUCT_CODE_LABEL` | `Product Code` | Display label used for the metadata product code field |
| `VITE_SHADOW_LABEL` | `SHADOW` | Display label used for the data-catalog shadow option in sink configuration |
| `VITE_ASG_LABEL` | `ASG` | Display label used for the data-catalog ASG option in sink configuration |
| `VITE_SAKNAY_LABEL` | `Saknay` | Display label used for Saknay routing controls in field mapping and sink configuration |
| `VITE_IDLE_LOGOUT_MINUTES` | `15` | Logs out the active user after this many minutes of inactivity |
| `VITE_SCOPE_RESET_GRACE_MINUTES` | `10` | Clears a timed-out user's saved wizard scope after this many additional minutes |

Example `.env` values:

```bash
VITE_API_BASE=http://localhost:8080/api
VITE_AUTH_AES_KEY=MDEyMzQ1Njc4OWFiY2RlZg==
VITE_APP_VERSION=1.2.3-build.7
VITE_PRODUCT_CODE_LABEL=External Param
VITE_SHADOW_LABEL=Shadow
VITE_ASG_LABEL=Asgard
VITE_SAKNAY_LABEL=Saknay
VITE_IDLE_LOGOUT_MINUTES=20
VITE_SCOPE_RESET_GRACE_MINUTES=15
```

Example `.env.development` values for local proxy-based development:

```bash
VITE_API_BASE=/api
VITE_AUTH_AES_KEY=MDEyMzQ1Njc4OWFiY2RlZg==
VITE_APP_VERSION=
VITE_PRODUCT_CODE_LABEL=Product Code
VITE_SHADOW_LABEL=SHADOW
VITE_ASG_LABEL=ASG
VITE_SAKNAY_LABEL=Saknay
VITE_IDLE_LOGOUT_MINUTES=15
VITE_SCOPE_RESET_GRACE_MINUTES=10
```

## Verified scripts

```bash
npm run dev
npm run test
npm run build
npm run preview
```

## Application flow

`App.jsx` switches between four primary UI states:

1. `LoginPage` — log in and choose mock/live mode
2. `menu` — landing screen after login
3. `etl-config` — the 7-step configuration wizard
4. `etl-management` — deployment list and actions

## Wizard steps

| Step | Key | Component |
|---|---|---|
| 0 | `metadata` | `features/file-upload/MetadataStep.jsx` |
| 1 | `source-config` | `features/source-config/SourceConfigStep.jsx` |
| 2 | `source-upload` | `features/source-config/SourceUploadStep.jsx` |
| 3 | `filters` | `features/filters/FiltersStep.jsx` |
| 4 | `field-mapping` | `features/field-mapping/FieldMappingStep.jsx` |
| 5 | `sink-config` | `features/sink-config/SinkConfigStep.jsx` |
| 6 | `summary` | `features/summary/SummaryStep.jsx` |

## Project structure

```text
src/
├── main.jsx
├── index.css
├── app/
│   └── App.jsx
├── features/
│   ├── etl-wizard/
│   │   ├── ETLManagementScreen.jsx
│   │   ├── LoginPage.jsx
│   │   ├── MainMenu.jsx
│   │   ├── StepBar.jsx
│   │   ├── TopNav.jsx
│   │   ├── WizardFooter.jsx
│   │   └── WizardShell.jsx
│   ├── field-mapping/
│   │   ├── FieldMappingStep.jsx
│   │   └── FieldMappingStepCanvas.jsx
│   ├── file-upload/
│   │   └── MetadataStep.jsx
│   ├── filters/
│   │   └── FiltersStep.jsx
│   ├── sink-config/
│   │   └── SinkConfigStep.jsx
│   ├── source-config/
│   │   ├── SourceConfigStep.jsx
│   │   └── SourceUploadStep.jsx
│   └── summary/
│       └── SummaryStep.jsx
└── shared/
    ├── components/
    ├── hooks/
    │   └── useDeploymentProgress.js
    ├── services/
    │   ├── configService.js
    │   ├── deploymentsService.js
    │   └── ...
    ├── store/
    └── types/
```

## Provider and state architecture

Provider tree from `src/main.jsx` and `src/app/App.jsx`:

```jsx
<UserProvider>
  <MockModeProvider>
    <ConfigProvider>
      <App>
        <WizardProvider user={user}>
          <AppContent />
        </WizardProvider>
      </App>
    </ConfigProvider>
  </MockModeProvider>
</UserProvider>
```

State responsibilities:

- `userContext.jsx` — login/logout, activity tracking, idle timeout, active-user hydration
- `userSessionPersistence.js` — persisted user key and pending scope reset bookkeeping
- `mockModeContext.jsx` — global mock/live toggle (defaults to mock mode on first load)
- `configContext.jsx` — pre-fetched entities, filter operators, and transformers
- `wizardStore.jsx` — wizard state, navigation mode, theme, mappings, filters, and sink settings
- `wizardPersistence.js` — per-user draft serialization/hydration

## Config prefetching

`WizardShell.jsx` prefetches only the step-specific config that needs remote data before rendering the step component:

| Step index | Data | Loading flag |
|---:|---|---|
| `0` | entities | `loadingEntities` |
| `3` | filter operators | `loadingFilters` |
| `4` | transformers | `loadingTransformers` |
| `6` | transformers (summary name resolution) | `loadingTransformers` |

While those requests are in flight, the shell shows a centered loading spinner instead of mounting the target step.

## Backend endpoints

All live calls use the configured `VITE_API_BASE` value. By default, this is `http://localhost:8080/api`.

| Area | Method | Endpoint | Notes |
|---|---|---|---|
| Transformers | GET | `/config/transformers` | |
| Filter operators | GET | `/config/filters?environment=<CAP\|PROD>` | Environment is forwarded from wizard metadata when selected |
| Entities | GET | `/backbone/entities` | |
| Deployments list | GET | `/deployment/deployments?teamName=<team>` | |
| Deployment steps | GET | `/backend/deployments/steps` | Returns `[{ id, label }]`; falls back to built-in list on error |
| Deploy from YAML / Upgrade | POST | `/backend/deployments/deploy?isDeploy=<true|false>` | `Content-Type: text/plain`; raw YAML body; `isDeploy=true` for deploy, `false` for upgrade |
| Deployment progress | GET | `/backend/deployments/:deploymentId/progress` | SSE stream — see event contract below |
| Stop deployment | POST | `/backend/stop?productType=&source=&team=&environment=` | |
| Draft YAML (read) | GET | `/backend/configuration/yaml?productType=&source=&team=&environment=` | |
| Draft YAML (save) | POST | `/backend/configuration/yaml?productType=&source=&team=&environment=` | |

> **Note:** Both the Summary wizard tab and the Management screen use the same
> `POST /backend/deployments/deploy?isDeploy=true` endpoint. The management deploy flow fetches
> the saved YAML via the draft endpoint first, then posts it — exactly like the wizard.
> Management upgrade uses the same endpoint with `isDeploy=false`.

When mock mode is enabled, network calls are replaced with in-memory sample data and simulated responses.

## Deployment flow

Both the Summary tab and the Management screen share the same four-phase deploy flow:

```
1. GET  /backend/deployments/steps           → ordered step list for the modal
2. Open DeployProgressModal (steps visible)
3. POST /backend/deployments/deploy?isDeploy=true → returns { success, deploymentId }
4. GET  /backend/deployments/:id/progress    → SSE stream drives step progress
```

### SSE event contract

The frontend listens for these **named** SSE events:

| Event name | Data shape | Action |
|---|---|---|
| `step-start` | `{ stepIndex, stepId?, label? }` | Mark step active; optionally update label |
| `step-complete` | `{ stepIndex, label? }` | Mark step done; activate next step |
| `step-failed` | `{ stepIndex?, error? }` | Show error popup; close progress modal |
| `deployment-complete` | _(none)_ | Transition to success page |
| `deployment-failed` | `{ error? }` | Show error popup; close progress modal |

**Fallback for unnamed events:** If the backend sends plain `data:` lines without an
`event:` type header, the `onmessage` handler inspects the JSON payload for a `type`,
`event`, or `eventType` field and dispatches to the same handler.

**`onerror` guard:** `onerror` is silently ignored after any terminal event
(`deployment-complete`, `step-failed`, `deployment-failed`) to prevent a false failure
when the server closes the connection normally.

### `deploymentId` resolution

The response from `POST /backend/deployments/deploy?isDeploy=true|false` is checked for the run ID in this
priority order, making the client resilient to different backend field-naming conventions:

```
result.deploymentId ?? result.id ?? result.runId ?? result.run_id ?? result.jobId ?? result.job_id
```

If none of those fields are present, the progress modal shows an error immediately.

## Deploy UX — Summary tab vs Management screen

Both screens have identical UX behaviour:

| Phase | Behaviour |
|---|---|
| In progress | `DeployProgressModal` open; steps advance via SSE events |
| Any failure | Progress modal closes; `ModalDialog` error popup opens (`tone="danger"`, "Got it" button) |
| Success | Progress modal closes after 500 ms; full-screen **success overlay** appears |

### Success overlay

The success overlay (`🎉 Pipeline Deployed!`) displays:

- **Info card** — Pipeline ID (generated client-side), Product Type, Product Source, Environment
- **Grafana dashboard card** — generated link, copy-to-clipboard button, and direct link
- **"View in Management"** button (Summary tab) / **"Back to Deployments"** button (Management screen)

## `useDeploymentProgress` hook

`src/shared/hooks/useDeploymentProgress.js` manages all deploy modal state.

Key options:

| Option | Default | Description |
|---|---|---|
| `autoAdvance` | `true` | Set `false` when SSE drives progress (both deploy flows) |
| `stepDuration` | `2000` | Auto-advance interval in ms (unused when `autoAdvance: false`) |
| `onDeploymentComplete` | — | Called when `isComplete` transitions to `true` via `completeStep` |
| `onDeploymentError` | — | Called when `failStep` is invoked |

External-control methods returned by the hook (used by SSE callbacks):

- `startDeployment(steps)` — initialises the modal with the step list
- `updateStep(index, updates)` — patches a single step's status/label/error
- `setCurrentStepIndex(i)` — moves the active-step cursor
- `setIsComplete(true)` — signals overall success
- `setIsError(true)` / `setErrorMessage(msg)` — signals overall failure
- `reset()` — closes and clears all state

## Backend data contracts

### Transformer contract

```json
{
  "_id": "00000000-0000-0000-0000-000000000001",
  "name": "ToTimestamp",
  "description": "Convert a date string to a canonical timestamp",
  "format": "string",
  "canonize": false,
  "inputType": "SINGLE",
  "additionalProperties": {
    "_required": ["format", "zone"],
    "format": "dd/MM/yyyy",
    "zone": "Asia/Jerusalem",
    "output_format": "yyyy-MM-dd'T'HH:mm:ss"
  }
}
```

`inputType` enum values:

| Value | Meaning |
|---|---|
| `NONE` | Transformer takes **no** input field (rare — e.g. constant-value producers). Canvas shows a red **no input** badge. |
| `SINGLE` | Transformer takes exactly **one** input field. Default for most transformers. |
| `MULTI` | Transformer takes **multiple** input fields (e.g. Concatenate). Canvas shows a green **multi** badge and allows dropping extra source fields onto the node. |

`configService.js` derives a `propsSchema` array from `additionalProperties` so the UI can render editable transformer fields without hardcoding each transformer type.

Notes:

- `_required` marks required keys and is not rendered as its own field
- Each key is the **property name**; its value is the **property description / hint** shown as a placeholder in the input — it is not a pre-filled default value
- The user must supply the actual value when configuring the transformer
- Primitive values determine the control type: string → text input, number → number input, boolean → true/false select
- Both `additionalProperties` and legacy `additionalProperites` are accepted

### Entity contract

```json
{ "id": "ent-1", "name": "CustomerEntity", "type": "Customer", "description": "..." }
```

### Filter operator contract

```json
{ "id": "eq", "name": "Equals", "rule": "=", "isInclude": true }
```

### Deployment list item contract

```json
{
  "id": "pipeline-uuid",
  "productType": "Product Catalog",
  "productSource": "Salesforce",
  "environment": "production",
  "deploymentStatus": "running",
  "savedVersion": "2.1.0",
  "deployedVersion": "2.0.5",
  "lastStatusChange": 1700000000000,
  "createdAt": 1699000000000
}
```

## Field mapping canvas behavior

`FieldMappingStepCanvas.jsx` provides the richest interaction surface in the app.

Key behaviors:

- Source and target fields can be added to the canvas without duplicates
- Connections are source-to-target only
- A target field allows only one incoming connection
- A single connection can hold a transformer chain (multiple transformers in sequence)
- Chain layout keeps up to 2 transformers per row and wraps to a new row when the chain grows
- Right-click on a connection or transformer opens add / replace / edit / remove actions
- Transformers can be inserted before or after an existing transformer in the same connection
- Transformer properties come from the selected transformer's generated `propsSchema`
- Each chained transformer card shows its effective input caption (source for first hop, previous transformer output for later hops)
- Multi-input transformers can accept extra source nodes on the same mapping
- Extra sources can be connected to a specific multi-input transformer inside a chain
- Switching from multi-input to single-input removes extra inputs automatically
- Removing a transformer, connection, source field, or target field triggers auto-align
- Transformer nodes turn red when required properties are empty and revert after all required properties are filled
- Right-click on a target node opens metadata editing for `sendToSaknay` and `expression`
- Target cards surface inline badges/toggles derived from that metadata
- Alignment helpers keep connected rows visually grouped

YAML preview/save formatting for mappings mirrors the canvas behavior:

- Transformer chains are separated with `-->`
- Transformer properties are rendered with square brackets, for example `ConvertMulti[logic: a:b:c]`
- Chained transformer inputs are explicit per hop (first hop uses source tuples, later hops use `$<sourceField><hopIndex>` tokens), for example: `ToTimestamp[format: a](number, stockQty) --> ToTimestamp[format: b](number, $stockQty1) -> (string, lastName)`

## Mock mode

Mock mode is enabled by default on a fresh load.

You can toggle it from:

- `LoginPage.jsx`
- `ETLManagementScreen.jsx`

Mock mode affects:

- transformers
- filter operators
- entities
- deployments list
- draft YAML retrieval for edit flows

> **Deploy flow is always live.** `fetchDeploymentSteps`, `deployFromYaml`, and
> `subscribeToDeploymentProgress` always hit the real backend regardless of the
> mock-mode toggle.

## Persistence behavior

- Active user is stored under `etl-studio-active-user`
- Wizard drafts are stored per user via keys derived from the current `userId`
- Manual logout clears the persisted active user immediately
- Idle logout schedules a grace window before clearing the timed-out user's saved draft
- Theme is persisted in local storage via `wizardStore.jsx`

## Docker

Build from `etl-pipeline-studio/etl-studio`:

```bash
docker build -t etl-pipeline-studio .
docker run --rm -p 8081:80 etl-pipeline-studio
```

Then open `http://localhost:8081`.

Optional build-time overrides:

```bash
docker build \
  --build-arg VITE_IDLE_LOGOUT_MINUTES=20 \
  --build-arg VITE_SCOPE_RESET_GRACE_MINUTES=15 \
  -t etl-pipeline-studio .
```

Relevant files:

- `Dockerfile`
- `nginx.conf`
- `.dockerignore`

## Troubleshooting

| Symptom | Check |
|---|---|
| Deploy modal shows fallback step labels | Verify `GET /backend/deployments/steps` is reachable and returns `[{ id, label }]` |
| Deploy modal stuck at step 0 with no progress | Check browser console for `[deploymentsService] SSE …` logs; verify the backend sends named SSE events (`event: step-start` etc.) or unnamed events with a `type` field in the JSON body |
| Deploy error: "No deployment ID returned" | Verify `POST /backend/deployments/deploy?isDeploy=true|false` response includes a run ID under one of: `deploymentId`, `id`, `runId`, `run_id`, `jobId`, `job_id` |
| Deploy error: "Failed to fetch pipeline configuration" | Verify `GET /backend/configuration/yaml` is reachable for the deployment's `productType`, `source`, `team`, and `environment` |
| Transformer properties do not appear | Verify the backend returns `additionalProperties` (or legacy `additionalProperites`) |
| Summary shows transformer `_id` values after refresh | Verify step `6` prefetches `/api/config/transformers` and wait for `loadingTransformers` to complete |
| Metadata step has no entities | Check `/api/backbone/entities` or enable mock mode |
| Deployments screen is empty in live mode | Verify `/api/backend/deployments?teamName=...` returns an array |
| Refresh returns to login | Check whether `etl-studio-active-user` exists in local storage |
| Step spinner never clears | Inspect the relevant request in `configContext.jsx` and browser network logs |

## Version

- App version: `1.0.0`
- React: `18.3.1`
- Vite: `5.4.x`
- Last updated: March 2026
