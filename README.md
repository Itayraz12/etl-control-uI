# ETL Control UI

Workspace for the ETL Pipeline Studio frontend and its supporting design/prototype assets.

The main application is a React + Vite UI for creating and managing ETL configurations through a 7-step wizard, a visual field-mapping canvas, and a deployment management screen.

## Repository layout

- `etl-pipeline-studio/etl-studio/` — main React application
- `docs/` — prompts, prototype references, and design artifacts
- `canvas.html` — standalone canvas experiment
- `etl-pipeline-studio.zip` — packaged snapshot of the studio project

## Main app capabilities

- Login flow with persisted active user and idle logout handling
- Menu-driven navigation between ETL configuration and ETL management
- 7-step ETL wizard:
  1. Metadata
  2. Source Config
  3. Source Upload
  4. Filters
  5. Field Mapping
  6. Sink Config
  7. Summary
- Visual source-to-target field mapping canvas with SVG connections
- Transformer add / replace / edit flow with properties derived at runtime from backend `additionalProperties`
- Support for multi-input transformers via extra source connections
- Target metadata editing for Saknay, GP, and expression values
- Mock mode for local UI work without backend services
- Deployment list screen with load/edit/deploy/stop actions

## Quick start

```bash
cd etl-pipeline-studio/etl-studio
npm install
npm run dev
```

Open `http://localhost:5173`.

## Verified scripts

The following commands were verified in this workspace:

```bash
cd etl-pipeline-studio/etl-studio
npm run test
npm run build
```

Available app scripts:

- `npm run dev` — start the Vite dev server
- `npm run test` — run the Vitest suite
- `npm run build` — create a production build in `dist/`
- `npm run preview` — preview the production build locally

## Live backend endpoints used by the frontend

When mock mode is disabled, the app calls `http://localhost:8080/api` endpoints such as:

| Purpose | Method | URL |
|---|---|---|
| Transformers | GET | `http://localhost:8080/api/config/transformers` |
| Filter operators | GET | `http://localhost:8080/api/config/filters` |
| Entities | GET | `http://localhost:8080/api/backbone/entities` |
| Deployments | GET | `http://localhost:8080/api/backend/deployments?teamName=<team>` |
| Draft YAML | GET | `http://localhost:8080/api/backend/configuration/yaml?...` |
| Save draft YAML | POST | `http://localhost:8080/api/backend/configuration/yaml?...` |

With mock mode enabled, the UI uses built-in sample data instead of those calls.

## Documentation

For the detailed application guide, see:

- `etl-pipeline-studio/etl-studio/README.md`

That document covers architecture, provider layout, wizard steps, backend contracts, Docker usage, and troubleshooting notes.

