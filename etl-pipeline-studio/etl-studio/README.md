# ETL Pipeline Studio

A production-grade React UI for configuring ETL (Extract–Transform–Load) data pipelines.  
Built as a **7-step wizard** with a visual field-mapping canvas, live/mock backend switching, and transformer property editing.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v16+
- **npm** v7+
- **Backend** (optional) — `etl-control-bff` running on `http://localhost:8080`

### Install & run

```bash
cd etl-pipeline-studio/etl-studio
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

### Session timeout configuration

The UI supports build-time session timeout properties via Vite environment variables:

| Property | Default | Description |
|----------|---------|-------------|
| `VITE_IDLE_LOGOUT_MINUTES` | `15` | Logs out the current user after this many minutes of inactivity |
| `VITE_SCOPE_RESET_GRACE_MINUTES` | `10` | Clears the timed-out user's saved ETL scope if they do not log back in within this many minutes |

Example `.env` values:

```bash
VITE_IDLE_LOGOUT_MINUTES=20
VITE_SCOPE_RESET_GRACE_MINUTES=15
```

---

## 🏗️ Project Architecture

```
src/
├── main.jsx                          # Entry point — provider tree
├── index.css                         # Global styles & CSS variables
│
├── app/
│   └── App.jsx                       # Navigation router (login / management / wizard)
│
├── features/
│   ├── etl-wizard/
│   │   ├── LoginPage.jsx             # Login + mock-mode toggle
│   │   ├── MainMenu.jsx              # Side navigation + logout
│   │   ├── TopNav.jsx                # Top bar
│   │   ├── StepBar.jsx               # Step progress indicator
│   │   ├── WizardShell.jsx           # Step router + pre-fetch spinner
│   │   ├── WizardFooter.jsx          # Next / Back buttons
│   │   └── ETLManagementScreen.jsx   # Deployments table + actions
│   │
│   ├── file-upload/
│   │   └── MetadataStep.jsx          # Step 0 — entity, team, environment
│   ├── source-config/
│   │   ├── SourceConfigStep.jsx      # Step 1 — Kafka / RabbitMQ config
│   │   └── SourceUploadStep.jsx      # Step 2 — schema upload / preview
│   ├── field-mapping/
│   │   ├── FieldMappingStep.jsx      # Step 3 wrapper
│   │   └── FieldMappingStepCanvas.jsx# Visual node-canvas with transformers
│   ├── filters/
│   │   └── FiltersStep.jsx           # Step 4 — filter rule builder
│   ├── sink-config/
│   │   └── SinkConfigStep.jsx        # Step 5 — sink configuration
│   └── summary/
│       └── SummaryStep.jsx           # Step 6 — review & create pipeline
│
└── shared/
    ├── components/
    │   └── index.jsx                 # Card, Btn, FormGroup, TypeBadge, Spinner…
    ├── services/
    │   ├── configService.js          # Transformer / filter / entity API + mock data
    │   └── deploymentsService.js     # Deployments API + mock data
    ├── store/
    │   ├── wizardStore.jsx           # Global wizard state (Context + useReducer)
    │   ├── configContext.jsx         # Pre-fetched config data + loading flags
    │   ├── mockModeContext.jsx       # Global mock / live toggle
    │   └── userContext.jsx           # Logged-in user state
    └── types/
        └── index.js                  # MOCK_SCHEMA, TARGET_FIELDS, type helpers
```

---

## 🔌 Backend API Endpoints

All live calls go to `http://localhost:8080`.  
When **mock mode is ON** the frontend uses its own built-in data — no backend required.

| Data | Method | URL |
|------|--------|-----|
| Transformers | GET | `http://localhost:8080/api/config/transformers` |
| Filters | GET | `http://localhost:8080/api/config/filters` |
| Entities | GET | `http://localhost:8080/api/backbone/entities` |
| Deployments | GET | `http://localhost:8080/api/config/deployments` |

---

## ⚙️ Config Service (`configService.js`)

Central service that switches between **mock** and **live** data for the three config types, and also handles loading/saving ETL draft YAML.

### Mock / live switch

```js
fetchTransformers(useMock)  // true → mock, false → GET /api/config/transformers
fetchFilters(useMock)       // true → mock, false → GET /api/config/filters
fetchEntities(useMock)      // true → mock, false → GET /api/backbone/entities
fetchDraftConfiguration({ productType, source, team, environment }, useMock)
saveDraftConfiguration({ productType, source, team, environment, yaml })
```

### Transformer shape (backend contract)

```json
{
  "_id": "00000000-0000-0000-0000-000000000001",
  "name": "ToTimestamp",
  "description": "convert TZ",
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

### `buildPropsSchema(additionalProperties)`

Converts `additionalProperties` into an array of editable UI rows:

- Keys in `_required` → marked `required: true`, **never rendered as a row**
- `string` value → `text` input
- `number` value → `number` input
- `boolean` value → `select` with `[true, false]`
- Label auto-generated from key: `output_format` → **Output Format**

```json
[
  { "key": "format",        "label": "Format",        "type": "text", "default": "dd/MM/yyyy",  "required": true  },
  { "key": "zone",          "label": "Zone",          "type": "text", "default": "Asia/Jerusalem","required": true  },
  { "key": "output_format", "label": "Output Format", "type": "text", "default": "...",          "required": false }
]
```

> **Note:** Both spellings are supported — `additionalProperties` (correct) and `additionalProperites` (legacy backend typo).

### Entity shape (backend contract)

```json
{ "id": "ent-1", "name": "CustomerEntity", "type": "Customer", "description": "..." }
```

### Filter shape (backend contract)

```json
{ "id": "f-1", "name": "Filter 1", "rule": "severity >= warning", "isInclude": true }
```

---

## 🔄 Config Context & Pre-fetching (`configContext.jsx`)

`ConfigProvider` holds the three config lists and their loading flags.  
`WizardShell` calls `prefetchForStep(step, useMock)` every time the user navigates to a new step — **data is always refreshed** before the step renders.

| Step | Data fetched | Loading flag |
|------|-------------|--------------|
| 0 — Metadata | `entities` | `loadingEntities` |
| 3 — Filters | `filters` (operators) | `loadingFilters` |
| 4 — Field Mapping | `transformers` | `loadingTransformers` |

While loading, `WizardShell` renders a full-height spinner instead of the step component — the step never mounts until its data is ready.

In-flight deduplication is handled via `useRef` flags (not state) to avoid infinite render loops.

```jsx
// Consuming data in a step component
const { entities }     = useConfig()   // MetadataStep
const { filters }      = useConfig()   // FiltersStep   (operator list)
const { transformers } = useConfig()   // FieldMappingStepCanvas
```

---

## 🪄 Wizard Steps

| # | Step | Component | Data source |
|---|------|-----------|-------------|
| 0 | Metadata | `MetadataStep` | `entities` from config context |
| 1 | Source Config | `SourceConfigStep` | Static |
| 2 | Source Upload | `SourceUploadStep` | Static / schema upload |
| 3 | Filters | `FiltersStep` | `filters` (operators) from config context |
| 4 | Field Mapping | `FieldMappingStepCanvas` | `transformers` from config context |
| 5 | Sink Config | `SinkConfigStep` | Static |
| 6 | Summary | `SummaryStep` | Wizard state |

---

## 🗺️ Field Mapping Canvas

- **Node-based** drag-and-drop interface — source fields (left) → target fields (right)
- **SVG Bezier edges** connect source to target nodes
- **Right-click** on an edge → assign/replace transformer
- **Transformer modal** — searchable list; selecting a transformer opens a **properties panel** with editable rows derived from `additionalProperties`
- Required properties show a red **req** badge
- `isMultipleInput` flag shown as **multi** badge in the transformer list
- **Map All Fields** — auto-connects fields by name similarity and type
- **Align** — re-arranges nodes into two clean columns

---

## 🎛️ Mock Mode

Toggle on the **Login page** (checkbox) or in the **ETL Management** header.

| Mode | Transformers | Filters | Entities | Deployments |
|------|-------------|---------|----------|-------------|
| Mock ON | Built-in list | Built-in operators | 3 sample entities | Mock deployments |
| Mock OFF | `GET /api/config/transformers` | `GET /api/config/filters` | `GET /api/backbone/entities` | `GET /api/config/deployments` |

---

## 🧰 State Management

### Provider tree (`main.jsx`)

```jsx
<UserProvider>
  <MockModeProvider>
    <ConfigProvider>       ← transformer / filter / entity lists
      <WizardProvider>     ← wizard step state (inside App.jsx)
        <App />
      </WizardProvider>
    </ConfigProvider>
  </MockModeProvider>
</UserProvider>
```

### Wizard store shape

```js
{
  navigationMode: 'menu' | 'etl-config' | 'etl-management',
  currentStep: 0,
  completedSteps: Set,
  theme: 'dark' | 'light',
  metadata: { productSource, productType, team, environment, entityName, tags },
  source:   { sourceType, kafkaTopic, format, ... },
  upload:   { done: false },
  mappings: [ { src, tgt, transformer, transformerProps, transformerChain, ... } ],
  filters:  [ { id, logic, rules: [...], subgroups: [...] } ],
  sink:     { sinkType, sinkKafkaTopic, shadow, saknay, asg }
}
```

---

## 🎨 Styling

All colors use CSS variables defined in `index.css`:

```css
--accent:  #4f6ef7;   /* primary blue      */
--success: #22c55e;   /* green             */
--danger:  #ef4444;   /* red               */
--warning: #f59e0b;   /* amber             */
--bg:      #0f172a;   /* page background   */
--surf:    #1e293b;   /* card background   */
--surf2:   #334155;   /* secondary surface */
--border:  #475569;   /* borders           */
--text:    #f1f5f9;   /* primary text      */
--muted:   #94a3b8;   /* secondary text    */
```

Dark mode is the default. Light mode is toggled via the theme button in the top nav and persisted in `localStorage`.

---

## 🛠️ Scripts

```bash
npm run dev      # dev server with HMR — http://localhost:5173
npm run build    # production build → dist/
npm run preview  # preview production build locally
```

---

## 🐳 Docker

Build the production image from `etl-pipeline-studio/etl-studio`:

```bash
docker build -t etl-pipeline-studio .
```

Run it on port `8081`:

```bash
docker run --rm -p 8081:80 etl-pipeline-studio
```

Then open `http://localhost:8081`.

### Docker build-time configuration

The app uses Vite build-time variables, so pass them as build args when you need non-default session timeout values:

```bash
docker build \
  --build-arg VITE_IDLE_LOGOUT_MINUTES=20 \
  --build-arg VITE_SCOPE_RESET_GRACE_MINUTES=15 \
  -t etl-pipeline-studio .
```

### Docker files

- `Dockerfile` — multi-stage Node + Nginx production image
- `nginx.conf` — SPA fallback (`/index.html`) for client-side navigation
- `.dockerignore` — trims local build context

---

## 🚨 Troubleshooting

| Symptom | Fix |
|---------|-----|
| Blank properties panel for transformers | Ensure backend sends `additionalProperties` key; both spellings are supported |
| Infinite loading spinner on step | Check `configContext.jsx` — refs guard against duplicate in-flight requests |
| `actions.setKafkaFilters is not a function` | Remove stale call; action does not exist in `wizardStore` |
| Missing key warning in transformer list | Transformer items use `key={t._id}` — ensure backend returns `_id` |
| No entities in Metadata dropdown | Confirm `GET /api/backbone/entities` returns `[{ id, name, type, description }]` |
| Styles not applying | Hard refresh (`Ctrl+Shift+R`) or restart dev server |

---

## 📝 Version

- **App version**: 1.0.0
- **React**: 18.3 · **Vite**: 5.4
- **Node.js required**: v16+
- **Last updated**: March 2026
