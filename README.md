# ETL Pipeline Studio

Enterprise ETL Pipeline Configuration Wizard - A modern, interactive web application for designing and managing data transformation pipelines with visual field mapping, validation, and Grafana integration.

## Features

- **Visual Field Mapping Canvas**: Interactive node-based interface for mapping source fields to target fields
- **Data Transformation**: Support for 10+ transformation types (uppercase, lowercase, trim, concat, replace, substring, split, round, hash, and more)
- **Configuration Wizard**: Step-by-step pipeline setup including metadata, source config, field mapping, filters, and sink configuration
- **Validation System**: Comprehensive validation with styled error modals and helpful navigation
- **Grafana Integration**: Auto-generated dashboard links with dynamic parameters for monitoring pipelines
- **State Persistence**: All user work is saved across wizard steps without data loss
- **Dark/Light Mode Support**: Theme switcher with CSS variables for consistent styling

## Prerequisites

Before running the project, ensure you have the following installed on your system:

### Required Dependencies

- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **npm** (v7 or higher) - Comes with Node.js

### Verify Installation

```bash
node --version
npm --version
```

## Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd etl-control-uI
```

### 2. Navigate to Project Directory
```bash
cd etl-pipeline-studio/etl-studio
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:5173/` (or the next available port)

## Installation Guide

### Step-by-Step Setup

#### Step 1: Install Node.js
Download and install Node.js from [nodejs.org](https://nodejs.org/). Choose the LTS (Long Term Support) version for stability.

**Windows Users:**
- Download the .msi installer
- Run the installer and follow the setup wizard
- Accept default settings
- Restart your computer after installation

**macOS Users:**
```bash
# Using Homebrew
brew install node
```

**Linux Users:**
```bash
# Ubuntu/Debian
sudo apt-get install nodejs npm

# Fedora
sudo dnf install nodejs
```

#### Step 2: Verify Node.js Installation
```bash
node --version  # Should output v16.0.0 or higher
npm --version   # Should output 7.0.0 or higher
```

#### Step 3: Clone Repository
```bash
git clone <repository-url>
cd etl-control-uI
```

#### Step 4: Navigate to Project
```bash
cd etl-pipeline-studio/etl-studio
```

#### Step 5: Install Project Dependencies
```bash
npm install
```

This command reads `package.json` and installs all required packages into the `node_modules` directory.

**Optional: Verify Installation**
```bash
npm list
```

#### Step 6: Start Development Server
```bash
npm run dev
```

## Project Dependencies

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^18.3.1 | UI component library |
| react-dom | ^18.3.1 | React DOM rendering |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| vite | ^5.4.0 | Build tool & dev server |
| @vitejs/plugin-react | ^4.3.1 | React support for Vite |
| @types/react | ^18.3.1 | TypeScript definitions |
| @types/react-dom | ^18.3.1 | TypeScript definitions |

All dependencies are automatically installed via `npm install`.

## Available Scripts

Run these commands from the `etl-studio` directory:

### Development
```bash
npm run dev
```
Starts the development server with hot module replacement (HMR).
- Server runs on `http://localhost:5173/` by default
- Changes reflect immediately in browser

### Build for Production
```bash
npm run build
```
Creates an optimized production build.
- Output files in `dist/` directory
- Ready for deployment

### Preview Production Build
```bash
npm run preview
```
Serves the production build locally to test before deployment.

## Project Structure

```
etl-control-uI/
├── README.md
├── docs/
│   ├── prompts/
│   └── ui_windows/
└── etl-pipeline-studio/
    └── etl-studio/
        ├── src/
        │   ├── index.css           # Global styles & CSS variables
        │   ├── main.jsx            # React entry point
        │   ├── app/
        │   │   └── App.jsx         # Main app container
        │   ├── features/
        │   │   ├── etl-wizard/     # Wizard shell & navigation
        │   │   ├── file-upload/    # Metadata & schema review
        │   │   ├── source-config/  # Source type & connection config
        │   │   ├── field-mapping/  # Visual node-based canvas
        │   │   ├── filters/        # Filter rules configuration
        │   │   ├── sink-config/    # Sink type & connection config
        │   │   └── summary/        # Pipeline review & creation
        │   └── shared/
        │       ├── components/     # Reusable UI components
        │       ├── store/          # State management (Context API)
        │       └── types/          # TypeScript types & constants
        ├── index.html              # HTML entry point
        ├── package.json            # Dependencies & scripts
        ├── vite.config.js          # Vite configuration
        └── README.md               # Project documentation
```

## Usage Guide

### Creating a New Pipeline

1. **Metadata Step**: Enter entity name, schema version, team name, and product information
2. **Source Configuration**: Select source type (Kafka, RabbitMQ, File, Database) and configure connection parameters
3. **Field Upload**: Review source schema and confirm available fields
4. **Field Mapping**:
   - Drag source fields from left panel to create nodes on canvas
   - Drag target fields from right panel to create receiving nodes
   - Connect source to target nodes by clicking ports
   - Use right-click on connection `+` to open **Add Transformer** menu and configure transformer properties
   - Use **Align** to snap sources left, targets right, and align connected 1:1 source/target pairs on the same row when possible
   - Mappings are persisted automatically while editing
5. **Filters** (Optional): Add data filtering rules if needed
6. **Sink Configuration**: Configure destination system (Kafka, RabbitMQ, File, Database)
7. **Summary & Validation**: Review entire pipeline configuration
8. **Create**: Generate pipeline and receive Grafana dashboard link

### Saving Your Work

- **Auto-save**: Field mappings (including transformer selections/properties) are automatically saved to wizard state during canvas edits
- **No manual save required**: The Field Mapping toolbar no longer has a "Save Mappings" button
- **Between steps**: Navigate freely between steps - all data persists
- **Validation**: Required fields marked with `*` must be filled before creation

### Accessing Dashboards

- Pipeline creation generates unique Grafana dashboard link
- Link includes pipeline ID, product source, and product type
- Click "Open in Grafana" or copy link to monitor pipeline execution
- Dashboard auto-refreshes every 30 seconds

## System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Node.js | v16 LTS | v18 LTS+ |
| npm | v7 | v9+ |
| RAM | 2GB | 4GB+ |
| Disk Space | 500MB | 1GB+ |
| Browser | Modern | Chrome/Firefox latest |

## Browser Compatibility

Tested and supported on:
- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Microsoft Edge 90+

## Common Issues & Troubleshooting

### Issue: "npm command not found"
**Solution**: Node.js/npm not properly installed
```bash
# Verify installation
which npm  # macOS/Linux
where npm  # Windows

# Reinstall Node.js from nodejs.org
```

### Issue: "Port 5173 already in use"
**Solution**: Vite will automatically use next available port (5174, 5175, etc.). Or manually specify:
```bash
npm run dev -- --port 3000
```

### Issue: "Dependencies installation fails"
**Solution**: Clear npm cache and reinstall
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Build command fails"
**Solution**: Ensure correct Node.js version
```bash
node --version  # Must be v16+
npm run build
```

### Issue: "Styles not appearing correctly"
**Solution**:
1. Clear browser cache: `Ctrl+Shift+Delete` (or `Cmd+Shift+Delete` on macOS)
2. Restart dev server: `npm run dev`
3. Check browser DevTools console for CSS errors

### Issue: "State not persisting between steps"
**Solution**:
1. Check browser console for errors: `F12 → Console`
2. Verify localStorage is enabled in browser
3. Clear corrupted data: `localStorage.clear()` in console

## Development Tips

- **Hot Module Replacement**: Changes in code automatically reflect in browser without refresh
- **DevTools**: Press `F12` to open browser developer tools for debugging
- **Console Logs**: Use `console.log()` to debug component behavior
- **CSS Debugging**: Use CSS variables throughout for consistent theming
- **Performance**: Test with browser DevTools Performance tab (`F12 → Performance`)

## Environment Configuration

Currently, the application uses hardcoded configuration:
- Grafana URL: `https://grafana.etl-studio.io/`
- Mock data for schema and fields

For production deployment, update these values in source files.

## Building for Production

```bash
# Create optimized build
npm run build

# Check output
ls dist/

# Preview production build locally
npm run preview
```

The `dist/` folder contains all files ready for deployment to a web server.

## Performance Optimization

- Lazy loading for wizard steps
- SVG rendering optimized for canvas connections
- CSS variables for theme switching (no full re-render)
- Efficient state management with Context API
- Vite optimizations for fast bundling

## Security Notes

- All data validation done client-side for immediate feedback
- No sensitive data stored in localStorage
- Grafana links use non-sensitive pipeline identifiers
- CORS headers required for actual backend API calls

## Support & Contribution

For issues, feature requests, or improvements:
1. Check existing documentation
2. Review browser console for error messages
3. Verify all system requirements are met

## Version & Tech Stack

- **Version**: 1.0.0
- **Built with**: React 18.3 + Vite 5.4
- **Package Manager**: npm
- **Node.js Requirement**: v16 or higher
- **Last Updated**: March 2026

---

**Quick Command Reference**

```bash
# Clone and setup
git clone <repo>
cd etl-control-uI/etl-pipeline-studio/etl-studio

# Install and run
npm install
npm run dev

# Build for production
npm run build
```

For detailed usage, visit the application interface after running `npm run dev`.
