# ETL Pipeline Studio Application

A production-grade React UI for configuring ETL (Extract–Transform–Load) data pipelines. Built as a 7-step wizard with visual field mapping canvas, comprehensive validation, and Grafana integration.

## 🚀 Quick Start

### Prerequisites
- **Node.js** v16 or higher
- **npm** v7 or higher

### Installation & Run

```bash
# 1. Navigate to project directory (from etl-control-uI root)
cd etl-pipeline-studio/etl-studio

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Open **http://localhost:5173** in your browser (or the next available port shown in terminal)

## 📦 Dependencies

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^18.3.1 | React UI library |
| react-dom | ^18.3.1 | React DOM rendering engine |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| vite | ^5.4.0 | Build tool and dev server |
| @vitejs/plugin-react | ^4.3.1 | React JSX support for Vite |
| @types/react | ^18.3.1 | TypeScript type definitions |
| @types/react-dom | ^18.3.1 | TypeScript type definitions |

All dependencies are automatically installed when you run `npm install`.

## 🛠️ Available Scripts

```bash
# Development server with hot reload (HMR)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

## 🏗️ Project Architecture

```
src/
├── index.css                     # Global styles & CSS variables
├── main.jsx                      # React entry point
│
├── app/
│   └── App.jsx                   # Main app container & provider
│
├── features/                     # Feature modules (Step-by-step wizard)
│   ├── etl-wizard/               # Wizard orchestration & navigation
│   │   ├── StepBar.jsx          # Step indicator bar
│   │   ├── TopNav.jsx           # Top navigation
│   │   ├── WizardShell.jsx      # Main wizard container
│   │   └── WizardFooter.jsx     # Navigation buttons
│   │   ├── MainMenu.jsx         # Side menu with logout and user info
│   │   ├── LoginPage.jsx        # Login page with mock mode toggle
│   │   ├── ETLManagementScreen.jsx # Management table, create new deployment config
│   │
│   ├── file-upload/              # Step 0 – Metadata Input
│   │   └── MetadataStep.jsx
│   │
│   ├── source-config/            # Steps 1-2 – Source Configuration
│   │   ├── SourceConfigStep.jsx
│   │   └── SourceUploadStep.jsx
│   │
│   ├── field-mapping/            # Step 3 – Visual Field Mapping
│   │   └── FieldMappingStepCanvas.jsx (1055 lines)
│   │
│   ├── filters/                  # Step 4 – Filter Rules
│   │   └── FiltersStep.jsx
│   │
│   ├── sink-config/              # Step 5 – Sink Configuration
│   │   └── SinkConfigStep.jsx
│   │
│   └── summary/                  # Step 6 – Pipeline Review & Creation
│       └── SummaryStep.jsx
│
└── shared/
    ├── components/               # Reusable UI components
    │   └── index.jsx             # Card, Btn, FormGroup, ValidationItem, etc.
    ├── store/
    │   └── wizardStore.jsx       # State management (Context + useReducer)
    │   └── mockModeContext.jsx   # Global mock/real mode toggle
    │   └── userContext.jsx       # User login state
    ├── services/
    │   └── deploymentsService.js # Central service for backend & mock deployment logic
    └── types/
        └── index.js              # Mock data & type definitions
```

## 🆕 Recent Feature Updates

### Login Page & User Context
- **Login page** added: user enters ID, password, and team name
- **Mock mode toggle**: checkbox on login page to switch between mock and real backend
- **User context**: user ID and team name are stored and shown in the side menu

### Side Menu Improvements
- **Logout button**: at the bottom of the side menu, clears user and returns to login
- **Logged-in user display**: below "Pipeline Builder" in side menu

### ETL Management Table Enhancements
- **Create New Deployment Configuration**: button at top-right, redirects to configuration wizard with team name and all fields empty (environment is set to null)
- **Table columns**: now include saved version, deployed version, sortable by header click
- **Action buttons**:
  - Deploy: disabled if status is running
  - Delete (was Stop): disabled if status is stopped or draft, trash icon
  - Upgrade: enabled if deployed and saved version differ and status is running
  - Edit: edit icon
- **Horizontal scrollbar**: appears if table width exceeds page
- **Sticky headers**: table headers remain above rows when scrolling
- **Filter input**: filter deployments by any column

### Backend Integration
- **Switch between mock and real REST API**: global flag, controlled from login page
- **Team name**: always taken from login context and used in backend requests
- **Debug print**: response object is logged for troubleshooting

## 📄 Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `FieldMappingStepCanvas.jsx` | 1055 | Interactive node-based canvas with SVG connections |
| `SummaryStep.jsx` | 439 | Pipeline review, validation, and creation |
| `wizardStore.jsx` | - | Central state management via Context API |
| `App.jsx` | - | Main app wrapper and provider setup |
| `index.css` | - | Global styles and CSS variables |
| `index.html` | - | HTML entry point |
| `vite.config.js` | - | Build configuration |
| `package.json` | - | Dependencies and npm scripts |
| `mockModeContext.jsx` | - | Global mock/real mode toggle |
| `userContext.jsx` | - | User login state |
| `deploymentsService.js` | - | Handles all deployment API and mock logic, controlled by global mock flag |

## 🎨 Key Features

### 1. Visual Field Mapping Canvas
- **Node-based interface** for mapping source to target fields
- **Drag-and-drop** support for field nodes
- **SVG connections** with Bezier curves
- **Transformer selection** via right-click context menu
- **Position persistence** - node positions saved across navigation
- **Grid background** with visual indicators
- **Scrollable canvas** with unlimited node positioning
- **10+ transformers**: uppercase, lowercase, trim, concat, replace, substring, split, round, hash, and more

### 2. Validation System
- **Real-time validation** on field changes
- **Required field checking** (name, unitPrice marked with *)
- **Styled error modals** (not browser alerts) with:
  - Error context and helpful messages
  - Navigation button to problematic step
  - Visual distinction with danger/warning colors
- **Validation checklist** in summary step
- **Multi-field validation** before pipeline creation

### 3. State Persistence
- **Context API** for global state management
- **useReducer pattern** for predictable state updates
- **Auto-restore** mappings when returning to field mapping step
- **Position coordinates** saved with mapping data (srcPos, tgtPos)
- **Cross-step navigation** without data loss

### 4. Configuration Wizard (6 Steps)

| Step | Component | Config |
|------|-----------|--------|
| 0 | MetadataStep | Entity, schema, team, product info |
| 1 | SourceConfigStep | Source type (Kafka, RabbitMQ, etc.), connection params |
| 2 | SourceUploadStep | Schema review and confirmation |
| 3 | FieldMappingStepCanvas | Visual field mapping with canvas |
| 4 | FiltersStep | Optional filter rules |
| 5 | SinkConfigStep | Sink type and configuration |
| 6 | SummaryStep | Review, validate, create pipeline |

### 5. Grafana Integration
- **Auto-generated dashboard links** upon pipeline creation
- **Query parameters**: pipeline ID, source, type
- **Link format**: `https://grafana.etl-studio.io/d/pipeline-${id}?source=${productSource}&type=${productType}&refresh=30s`
- **Copy-to-clipboard** button with "✓ Copied" feedback
- **Direct link** opens in new browser tab
- **30-second auto-refresh** for real-time monitoring

## 🎯 State Management

### Wizard Store Structure
```javascript
{
  step: 0,                    // Current wizard step
  metadata: {                 // Step 0
    entityName: '',
    schemaVersion: '',
    team: '',
    productSource: '',
    productType: '',
    environment: ''
  },
  source: {                   // Steps 1-2
    sourceType: 'kafka',
    format: 'avro',
    kafkaBootstrap: '',
    kafkaTopic: ''
  },
  mappings: [                 // Step 3
    {
      src: 'fieldName',
      tgt: 'fieldName',
      srcNodeId: 'node-1',
      tgtNodeId: 'node-2',
      srcPos: { x: 100, y: 50 },
      tgtPos: { x: 400, y: 50 },
      transformer: 'uppercase'
    }
  ],
  filters: [],                // Step 4 (optional)
  sink: {                     // Step 5
    sinkType: 'rabbitmq',
    sinkHost: '',
    sinkPort: 5672
  }
}
```

### Key Actions
- `setMappings(mappings)` - Save field mappings with positions
- `goTo(stepNumber)` - Navigate to specific step
- `goNext(currentStep)` - Move to next step
- `goBack(currentStep)` - Move to previous step

## 🎨 Styling

### CSS Variables (in `index.css`)
```css
--accent: #4f6ef7;          /* Primary blue */
--success: #22c55e;         /* Success green */
--danger: #ef4444;          /* Error red */
--bg: #0f172a;              /* Dark background */
--surf: #1e293b;            /* Surface/card background */
--surf2: #334155;           /* Secondary surface */
--border: #475569;          /* Border color */
--text: #f1f5f9;            /* Text color */
--muted: #cbd5e1;           /* Muted text */
--mono: 'Courier New', mono; /* Monospace font */
```

### Theme Support
- Dark mode (default)
- Light mode available via toggle
- All colors use CSS variables for consistency

## 📊 Data Structures

### Node Object
```javascript
{
  id: 'node-1',              // Unique identifier
  name: 'email',             // Field name
  emoji: '📄',               // Visual indicator
  type: 'source' | 'target', // Node type
  fieldId: 'email',          // Original field id
  isRequired: false,         // Required field flag
  x: 100,                    // X position on canvas
  y: 50                      // Y position on canvas
}
```

### Edge Object
```javascript
{
  from: 'node-1',            // Source node id
  to: 'node-2',              // Target node id
  fromType: 'source',        // Source type
  toType: 'target',          // Target type
  transformer: 'uppercase'   // Applied transformation
}
```

### Mapping Object
```javascript
{
  src: 'fieldName',          // Source field
  tgt: 'fieldName',          // Target field
  srcNodeId: 'node-1',       // Source node id
  tgtNodeId: 'node-2',       // Target node id
  srcPos: { x, y },          // Source position
  tgtPos: { x, y }           // Target position
}
```

## 🔧 Development Workflow

1. **Start dev server**
   ```bash
   npm run dev
   ```

2. **Make changes** - files auto-saved, browser auto-refreshes (HMR)

3. **Test in browser** - http://localhost:5173

4. **Check console** - F12 → Console for errors

5. **Build when ready**
   ```bash
   npm run build
   ```

## 🐛 Debugging

### Browser DevTools
- **Open**: F12 (Windows/Linux) or Cmd+Option+I (macOS)
- **Console**: View errors and add `console.log()` statements
- **Elements**: Inspect DOM and CSS
- **Network**: Monitor API calls
- **React DevTools**: Install extension for component inspection

### Common Debugging Commands
```javascript
// In browser console (F12)
console.log(document) // Access DOM
console.log(localStorage) // Check stored data
localStorage.clear() // Clear corrupted data
```

## ⚡ Performance Considerations

- **Lazy loading** of wizard steps
- **SVG rendering** optimized for canvas
- **CSS variables** for instant theme switching (no re-render)
- **Context API** for efficient state updates
- **Vite** HMR for instant feedback during development

## 📦 Building for Production

```bash
# Create optimized build
npm run build

# Output location: dist/
# Check with: ls dist/

# Preview production build
npm run preview
```

Files ready for:
- Static hosting (GitHub Pages, Netlify, Vercel)
- CDN distribution
- Docker containerization

## ⚠️ System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Node.js | v16 LTS | v18 LTS+ |
| npm | v7 | v9+ |
| RAM | 2GB | 4GB+ |
| Disk | 500MB | 1GB+ |
| Browser | Modern | Chrome/Firefox latest |

## 🌐 Browser Support

Tested on:
- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Microsoft Edge 90+

## 🚨 Troubleshooting

### Dev Server Won't Start
```bash
# Check port usage
lsof -i :5173  # macOS/Linux

# Use different port
npm run dev -- --port 3000
```

### Dependencies Won't Install
```bash
# Clear cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Styles Not Applying
```bash
# 1. Clear browser cache (Ctrl+Shift+Delete)
# 2. Restart dev server
npm run dev
# 3. Hard refresh browser (Ctrl+Shift+R)
```

### State Not Persisting
```bash
# Clear corrupted data
localStorage.clear()

# Restart server
npm run dev
```

### Build Fails
```bash
# Verify Node version
node --version  # Must be v16+

# Try rebuilding
npm run build
```

## 📚 Resources

- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [Node.js Downloads](https://nodejs.org/)

## 📝 Version Info

- **Version**: 1.0.0
- **Built with**: React 18.3 + Vite 5.4
- **Node.js Requirement**: v16+
- **Last Updated**: March 2026

## 🤝 Contributing

When adding features:
1. Follow existing component structure
2. Use CSS variables for colors
3. Test with both themes
4. Run `npm run build` to verify

## 📄 Main README

For complete setup and project overview, see [../README.md](../README.md)

---

**To start development:**
```bash
npm install && npm run dev
```
