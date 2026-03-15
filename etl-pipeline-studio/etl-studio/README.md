# ETL Pipeline Studio

React + Vite frontend for configuring and managing ETL pipelines.

The application combines a login flow, a management screen for existing deployments, and a 7-step ETL wizard with a visual source-to-target field-mapping canvas.

## Current highlights

- Persisted login session with refresh-safe user restoration
- Per-user wizard draft persistence in local storage
- Idle logout with configurable grace-based draft reset
- Mock/live backend switching for configuration data and deployments
- Searchable transformer modal with runtime-generated property forms
- Visual field mapping with single-target enforcement and multi-input transformers
- Target metadata editing for Saknay and expression values
- Deployment edit flow that hydrates wizard state from backend YAML

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

## Verified scripts

The following commands were run successfully in this workspace on March 14, 2026:

```bash
npm run test
npm run build
```

Project scripts:

```bash
npm run dev
npm run test
npm run build
npm run preview
```

## Session timeout configuration

The UI reads these Vite environment variables at build time:

| Variable | Default | Description |
|---|---:|---|
| `VITE_IDLE_LOGOUT_MINUTES` | `15` | Logs out the active user after this many minutes of inactivity |
| `VITE_SCOPE_RESET_GRACE_MINUTES` | `10` | Clears a timed-out user's saved wizard scope after this many additional minutes |

Example `.env` values:

```bash
VITE_IDLE_LOGOUT_MINUTES=20
VITE_SCOPE_RESET_GRACE_MINUTES=15
```

## Application flow

`App.jsx` switches between four primary UI states:

1. `LoginPage` — sign in and choose mock/live mode
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
    ├── services/
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

While those requests are in flight, the shell shows a centered loading spinner instead of mounting the target step.

## Backend endpoints

All live calls use `http://localhost:8080/api`.

| Area | Method | Endpoint |
|---|---|---|
| Transformers | GET | `/config/transformers` |
| Filter operators | GET | `/config/filters` |
| Entities | GET | `/backbone/entities` |
| Deployments list | GET | `/backend/deployments?teamName=<team>` |
| Deploy deployment | POST | `/backend/deployments/{id}/deploy` |
| Stop deployment | POST | `/backend/deployments/{id}/stop` |
| Draft YAML | GET | `/backend/configuration/yaml?productType=...&source=...&team=...&environment=...` |
| Save draft YAML | POST | `/backend/configuration/yaml?productType=...&source=...&team=...&environment=...` |

When mock mode is enabled, these calls are replaced with in-memory sample data and simulated responses.

## Backend data contracts

### Transformer contract

```json
{
  "_id": "00000000-0000-0000-0000-000000000001",
  "name": "ToTimestamp",
  "description": "Convert a date string to a canonical timestamp",
  "format": "string",
  "canonize": false,
  "isMultipleInput": false,
  "additionalProperties": {
    "_required": ["format", "zone"],
    "format": "dd/MM/yyyy",
    "zone": "Asia/Jerusalem",
    "output_format": "yyyy-MM-dd'T'HH:mm:ss"
  }
}
```

`configService.js` derives a `propsSchema` array from `additionalProperties` so the UI can render editable transformer fields without hardcoding each transformer type.

Notes:

- `_required` marks required keys and is not rendered as its own field
- Primitive values are mapped to text, number, or boolean-style controls
- Both `additionalProperties` and legacy `additionalProperites` are accepted

### Entity contract

```json
{ "id": "ent-1", "name": "CustomerEntity", "type": "Customer", "description": "..." }
```

### Filter operator contract

```json
{ "id": "eq", "name": "Equals", "rule": "=", "isInclude": true }
```

## Field mapping canvas behavior

`FieldMappingStepCanvas.jsx` provides the richest interaction surface in the app.

Key behaviors:

- Source and target fields can be added to the canvas without duplicates
- Connections are source-to-target only
- A target field allows only one incoming connection
- Right-click on a connection or transformer opens add / replace / edit / remove actions
- Transformer properties come from the selected transformer's generated `propsSchema`
- Multi-input transformers can accept extra source nodes on the same mapping
- Switching from multi-input to single-input removes extra inputs automatically
- Right-click on a target node opens metadata editing for `sendToSaknay` and `expression`
- Target cards surface inline badges/toggles derived from that metadata
- Alignment helpers keep connected rows visually grouped

## Mock mode

Mock mode is enabled by default on a fresh load.

You can toggle it from:

- `LoginPage.jsx`
- `ETLManagementScreen.jsx`

Mock mode affects:

- transformers
- filter operators
- entities
- deployments
- draft YAML retrieval for edit flows

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
| Transformer properties do not appear | Verify the backend returns `additionalProperties` (or legacy `additionalProperites`) |
| Metadata step has no entities | Check `/api/backbone/entities` or enable mock mode |
| Deployments screen is empty in live mode | Verify `/api/backend/deployments?teamName=...` returns an array |
| Refresh returns to login | Check whether `etl-studio-active-user` exists in local storage |
| Step spinner never clears | Inspect the relevant request in `configContext.jsx` and browser network logs |

## Version

- App version: `1.0.0`
- React: `18.3.1`
- Vite: `5.4.x`
- Last updated: March 2026
