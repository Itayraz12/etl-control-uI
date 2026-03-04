# ETL Pipeline Studio

A production-grade React UI for configuring ETL (Extract–Transform–Load) data pipelines. Built as a 7-step wizard following feature-sliced architecture.

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## 🏗️ Architecture

```
src/
├── app/                          # App shell & providers
│   └── App.jsx
│
├── features/                     # Feature modules
│   ├── etl-wizard/               # Wizard orchestration
│   │   ├── TopNav.jsx
│   │   ├── StepBar.jsx
│   │   ├── WizardShell.jsx
│   │   └── WizardFooter.jsx
│   │
│   ├── file-upload/              # Step 1 – Metadata
│   │   └── MetadataStep.jsx
│   │
│   ├── source-config/            # Step 2 & 3 – Source
│   │   ├── SourceConfigStep.jsx
│   │   └── SourceUploadStep.jsx
│   │
│   ├── field-mapping/            # Step 4 – Field Mapping
│   │   └── FieldMappingStep.jsx
│   │
│   ├── filters/                  # Step 5 – Filters
│   │   └── FiltersStep.jsx
│   │
│   ├── sink-config/              # Step 6 – Sink
│   │   └── SinkConfigStep.jsx
│   │
│   └── summary/                  # Step 7 – Summary
│       └── SummaryStep.jsx
│
└── shared/
    ├── components/               # Design system atoms
    │   └── index.jsx             # Chip, Btn, Card, FormGroup, SidePanel…
    ├── store/
    │   └── wizardStore.jsx       # useReducer + Context
    └── types/
        └── index.js              # JSDoc types & shared constants
```

## 🎯 Features per Step

| Step | Name            | Key Features |
|------|-----------------|---|
| 1    | Metadata        | Entity selector, environment, team, custom tags |
| 2    | Source Config   | 6 source type cards (Kafka/RMQ/File/DB/HTTP/S3), live config panels |
| 3    | Source Upload   | Drag-and-drop zone, simulated Web Worker parsing, schema tree |
| 4    | Field Mapping   | 3-panel DnD canvas, auto-map, type-mismatch warnings |
| 5    | Filters         | Recursive AND/OR rule builder, SQL expression preview |
| 6    | Sink Config     | 4 sink types with context-sensitive forms |
| 7    | Summary         | Flink flow diagram, validation checklist, YAML preview |

## 🎨 Design System

- **Dark theme** — enterprise `#0f1117` base
- **Light theme** — alternate `#ffffff` base (toggle available in top nav)

- **Accent** — `#4f6ef7` blue, `#7c3aed` purple
- **Fonts** — DM Sans + JetBrains Mono
- **Components** — `Chip`, `Btn` (5 variants), `Card`, `FormGroup`, `SidePanel`, `CfgPanel`, `ValidationItem`
- **Animations** — `fadeIn`, `slideIn`, `spin`

## 🔧 Tech Stack

- React 18 (hooks only — no class components)
- Vite 5
- Zero UI library dependencies
- Inline styles + CSS custom properties
- Context + useReducer for global state

## 📦 Build

```bash
npm run build     # Production build → dist/
npm run preview   # Preview production build
```
