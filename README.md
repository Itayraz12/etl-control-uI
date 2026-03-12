# ETL Control UI

React/Vite workspace for configuring ETL pipelines through a step-based wizard and a visual field-mapping canvas.

## What’s in this repo

- `etl-pipeline-studio/etl-studio/` — main React application
- `docs/` — prompts, prototypes, and supporting design assets
- `canvas.html` / prototype files — standalone UI experiments

## Main capabilities

- Wizard flow for metadata, source config, upload, filters, field mapping, sink config, and summary
- Visual source → target mapping canvas
- Transformer selection with a shared **add / replace / edit** modal
- Multi-input transformers that can accept extra source fields without creating another target
- Single incoming connection per target field
- Mock mode and live backend mode
- Runtime-derived transformer property forms from backend `additionalProperties`

## Quick start

```bash
cd etl-pipeline-studio/etl-studio
npm install
npm run dev
```

Open `http://localhost:5173`.

## Build

```bash
cd etl-pipeline-studio/etl-studio
npm run build
npm run preview
```

## Live backend endpoints

The frontend uses a single API base:

- `http://localhost:8080/api`

Resolved endpoints:

| Data | URL |
|---|---|
| Transformers | `http://localhost:8080/api/config/transformers` |
| Filters | `http://localhost:8080/api/config/filters` |
| Entities | `http://localhost:8080/api/backbone/entities` |
| Deployments | `http://localhost:8080/api/config/deployments` |

When mock mode is enabled, the app uses built-in sample data instead of these calls.

## Field mapping notes

- Source fields connect to target fields through SVG edges
- Right-click an edge or transformer to add, replace, edit, or remove a transformer
- Editing a transformer uses the same searchable transformer modal as adding one
- If a transformer supports `isMultipleInput`, extra source fields can connect directly into the same transformer
- If a transformer is switched from multi-input to single-input, extra input connections are removed automatically
- Target fields allow only one connection
- `_required` inside transformer `additionalProperties` marks required fields and is hidden from the UI

## Repository structure

```text
etl-control-uI/
├── README.md
├── docs/
├── canvas.html
└── etl-pipeline-studio/
    └── etl-studio/
        ├── README.md
        ├── package.json
        ├── vite.config.js
        └── src/
```

## More detailed app docs

See the application-level guide here:

- `etl-pipeline-studio/etl-studio/README.md`
