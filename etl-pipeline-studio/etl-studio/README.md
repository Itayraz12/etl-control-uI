# ETL Pipeline Studio

A React + Vite UI for configuring ETL pipelines through a **7-step wizard** with a visual field-mapping canvas, live/mock backend switching, and transformer property editing.

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

All live calls use the API base below:

- `http://localhost:8080/api`

When **mock mode is ON** the frontend uses built-in sample data — no backend required.

| Data | Method | URL |
|------|--------|-----|
| Transformers | GET | `http://localhost:8080/api/config/transformers` |
| Filters | GET | `http://localhost:8080/api/config/filters` |
| Entities | GET | `http://localhost:8080/api/backbone/entities` |
| Deployments | GET | `http://localhost:8080/api/config/deployments` |

---

## ⚙️ Config Service (`configService.js`)

Central service that switches between **mock** and **live** data for transformers, filters, and entities.

### Mock / live switch

```js
fetchTransformers(useMock)  // true → mock, false → GET /api/config/transformers
fetchFilters(useMock)       // true → mock, false → GET /api/config/filters
fetchEntities(useMock)      // true → mock, false → GET /api/backbone/entities
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

Converts `additionalProperties` into editable UI rows:

- keys listed in `_required` are marked required and **are not rendered as rows**
- `string` → text input
- `number` → number input
- `boolean` → select input
- labels are generated from keys: `output_format` → **Output Format**

```json
[
  { "key": "format",        "label": "Format",        "type": "text", "default": "dd/MM/yyyy",           "required": true  },
  { "key": "zone",          "label": "Zone",          "type": "text", "default": "Asia/Jerusalem",      "required": true  },
  { "key": "output_format", "label": "Output Format", "type": "text", "default": "yyyy-MM-dd'T'HH:mm:ss","required": false }
]
```

> **Note:** both `additionalProperties` and legacy `additionalProperites` are supported.

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

`ConfigProvider` holds the three config lists and loading flags.
`WizardShell` refreshes the required list **before** rendering the relevant step, so each step opens with fresh data.

| Step | Data fetched | Loading flag |
|------|-------------|--------------|
| 0 — Metadata | `entities` | `loadingEntities` |
| 3 — Filters | `filters` | `loadingFilters` |
| 4 — Field Mapping | `transformers` | `loadingTransformers` |

While loading, `WizardShell` shows a full-height spinner instead of mounting the step.

---

## 🪄 Wizard Steps

| # | Step | Component | Data source |
|---|------|-----------|-------------|
| 0 | Metadata | `MetadataStep` | `entities` from config context |
| 1 | Source Config | `SourceConfigStep` | Static |
| 2 | Source Upload | `SourceUploadStep` | Static / schema upload |
| 3 | Filters | `FiltersStep` | `filters` from config context |
| 4 | Field Mapping | `FieldMappingStepCanvas` | `transformers` from config context |
| 5 | Sink Config | `SinkConfigStep` | Static |
| 6 | Summary | `SummaryStep` | Wizard state |

---

## 🗺️ Field Mapping Canvas

- **Node-based** drag-and-drop interface — source fields on the left, target fields on the right
- **Single incoming connection per target** — a target field cannot accept multiple connections
- **SVG Bezier edges** connect source and target nodes
- **Transformer node in the middle of an edge** when a transformer is assigned
- **Shared transformer modal** for add, replace, and edit
- **Right-click on `+` or transformer node** to add, replace, edit, or remove the transformer
- **Transformer edit uses the same searchable modal** used for adding/replacing, including property editing
- **Runtime property form** built from backend `additionalProperties`
- Required properties show a red **req** badge
- **Multi-input transformers** display a **multi** badge in the list
- Additional source fields can connect directly to an existing multi-input transformer without creating another target
- If a transformer changes from multi-input to single-input, extra source connections are removed automatically
- Extra input lines are rendered in the same style as the main source connection
- **Map All Fields** auto-connects fields by name similarity and type
- **Align** re-arranges nodes into two clean columns
- Mapping edits persist automatically in wizard state

---

## 🎛️ Mock Mode

Toggle mock mode on the **Login page**.

| Mode | Transformers | Filters | Entities | Deployments |
|------|-------------|---------|----------|-------------|
| Mock ON | Built-in list | Built-in list | Sample entities | Mock deployments |
| Mock OFF | `GET /api/config/transformers` | `GET /api/config/filters` | `GET /api/backbone/entities` | `GET /api/config/deployments` |

---

## 🧰 State Management

### Provider tree (`main.jsx`)

```jsx
<UserProvider>
  <MockModeProvider>
    <ConfigProvider>
      <WizardProvider>
        <App />
      </WizardProvider>
    </ConfigProvider>
  </MockModeProvider>
</UserProvider>
```

### Wizard store shape

Typical wizard state includes:

- `navigationMode`: menu vs ETL configuration vs management view
- `currentStep`: active wizard step index
- `completedSteps`: completed-step tracking
- `theme`: `dark` or `light`
- `metadata`: entity, team, environment, and related metadata fields
- `source`: source connection configuration
- `upload`: upload status
- `mappings`: source/target mappings, transformers, properties, and `extraInputs`
- `filters`: nested filter groups and rules
- `sink`: sink connection and deployment options

---

## 🎨 Styling

All colors use CSS variables defined in `index.css`:

```css
--accent:  #4f6ef7;
--success: #22c55e;
--danger:  #ef4444;
--warning: #f59e0b;
--bg:      #0f172a;
--surf:    #1e293b;
--surf2:   #334155;
--border:  #475569;
--text:    #f1f5f9;
--muted:   #94a3b8;
```

Dark mode is the default. Light mode is toggled from the top navigation and persisted in `localStorage`.

---

## 🛠️ Scripts

```bash
npm run dev      # dev server with HMR — http://localhost:5173
npm run build    # production build → dist/
npm run preview  # preview production build locally
```

---

## 🚨 Troubleshooting

| Symptom | Fix |
|---------|-----|
| Blank transformer properties panel | Ensure backend returns `additionalProperties` (legacy typo also supported) |
| Required transformer properties missing | Check `_required` inside `additionalProperties`; keys are marked required but hidden from the UI rows |
| No entities in Metadata | Confirm `GET /api/backbone/entities` returns `[{ id, name, type, description }]` |
| No filters in Filters step | Confirm `GET /api/config/filters` returns filter items and mock mode is off |
| No transformers in Field Mapping | Confirm `GET /api/config/transformers` returns items with `_id` |
| Styles not applying | Hard refresh (`Ctrl+Shift+R`) or restart the dev server |

---

## 📝 Version

- **App version**: 1.0.0
- **React**: 18.3 · **Vite**: 5.4
- **Node.js required**: v16+
- **Last updated**: March 2026
