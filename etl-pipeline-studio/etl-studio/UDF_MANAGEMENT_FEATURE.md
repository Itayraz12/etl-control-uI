# UDF Management Feature Implementation

## Overview
Added a new **UDF (User-Defined Function) Management** as a separate page in the admin navigation. This feature allows administrators to manage User-Defined Functions (both Transformers and Filters) through a dedicated management table.

## Changes Made

### 1. Backend Service Updates
**File**: `src/shared/services/adminService.js`

#### Added:
- **Constant**: `ADMIN_UDFS_PATH` - API endpoint for UDF operations
- **Mock Data**: `INITIAL_MOCK_UDFS` - Three sample UDFs for testing
- **Normalize Function**: `normalizeAdminUdf()` - Normalizes UDF data from backend responses
- **Helper Function**: `normalizeAdminUdfs()` - Normalizes collection of UDFs
- **CRUD Operations**:
  - `fetchAdminUdfs(type, useMock)` - Fetch UDFs, optionally filtered by type (transformer/filter)
  - `createAdminUdf(udf, useMock)` - Create new UDF
  - `updateAdminUdf(udfId, udf, useMock)` - Update existing UDF
  - `deleteAdminUdf(udfId, useMock)` - Delete UDF

#### Mock Store:
- `mockUdfsStore` - In-memory store for mock UDF data
- Updated `resetAdminServiceMockData()` to reset UDF store

### 2. New React Components
**File**: `src/features/admin/UDFScreen.jsx`

A new page component for UDF Management with:
- Header card with description
- UDFManagementTable component

**File**: `src/features/admin/UDFManagementTable.jsx`

A fully-featured management table component with:

#### Features:
- **Type Selection Buttons**: Toggle between "Transformer" and "Filter" UDFs
- **Table Columns**:
  - ID (auto-generated, read-only)
  - Name
  - Type (Transformer/Filter)
  - Team
  - Path
  - Version
  - Approved (checkbox)
  - Date Approved (formatted date)
  - Actions (Edit/Delete)

#### CRUD Operations:
- **Add UDF**: Create new UDFs with all required fields
- **Edit UDF**: Modify existing UDF details
- **Delete UDF**: Remove UDFs with confirmation dialog
- **Type-based Filtering**: View Transformers or Filters separately

#### User Feedback:
- Success/error/warning notifications
- Form validation with error messages
- Loading states and spinners
- Confirmation dialogs for delete operations

### 3. Admin Navigation Updates
**File**: `src/features/admin/AdminSideMenu.jsx`

#### Changes:
- Added new menu item "UDF Management" (id: 'udf-admin')
- Icon: ⚙️
- Description: "Manage transformers and filters"

### 4. Admin Workspace Updates
**File**: `src/features/admin/AdminWorkspace.jsx`

#### Changes:
- Imported `UDFScreen` component
- Updated `activeMode` logic to handle 'udf-admin' mode
- Updated render logic to display UDFScreen when 'udf-admin' is active

### 5. Admin Screen Updates
**File**: `src/features/admin/AdminScreen.jsx`

#### Changes:
- Removed UDF Management tab from admin page
- Kept only User Management and Team Management tabs
- Removed UDFManagementTable import

## Navigation Structure

After login as admin user, the admin navigation now shows:
1. **Management Page** - Deployments and runtime operations
2. **Admin Page** - User and Team management
3. **UDF Management** - User-Defined Functions management (NEW)

## API Endpoints

### Required Backend Endpoints

```
GET    /api/backend/admin/udfs
GET    /api/backend/admin/udfs?type=transformer
GET    /api/backend/admin/udfs?type=filter
POST   /api/backend/admin/udfs
PUT    /api/backend/admin/udfs/{id}
DELETE /api/backend/admin/udfs/{id}
```

### Expected Request/Response Format

#### Create/Update Request:
```json
{
  "name": "normalize_email",
  "type": "transformer",
  "team": "data-platform",
  "path": "/udfs/transformers/normalize_email.jar",
  "version": "1.2.0"
}
```

#### Response:
```json
{
  "id": "udf-transform-001",
  "name": "normalize_email",
  "type": "transformer",
  "team": "data-platform",
  "path": "/udfs/transformers/normalize_email.jar",
  "version": "1.2.0",
  "isApproved": true,
  "approvedAt": "2026-02-15T10:30:00.000Z"
}
```

## Mock Data

Three sample UDFs are included for testing:

1. **normalize_email** (Transformer)
   - Team: data-platform
   - Version: 1.2.0
   - Status: Approved

2. **filter_invalid_records** (Filter)
   - Team: analytics
   - Version: 2.0.1
   - Status: Approved

3. **parse_json** (Transformer)
   - Team: data-platform
   - Version: 1.0.0
   - Status: Pending Approval

## UI/UX Features

- **Dedicated Page**: Full-page layout with header and description
- **Type Selector**: Toggle buttons to switch between Transformer and Filter views
- **Inline Editing**: Edit UDF details directly in table rows
- **Responsive Table**: Horizontal scrolling for mobile devices
- **Visual Feedback**: Color-coded success/error/warning messages
- **Accessibility**: Proper ARIA labels and semantic HTML
- **Dark/Light Mode**: Fully compatible with theme switching

## Testing

The feature includes:
- Mock data for offline testing
- Form validation
- Error handling
- Loading states
- Confirmation dialogs

## Styling

All components use existing design system variables:
- `var(--text)` for primary text
- `var(--muted)` for secondary text
- `var(--accent)` for active states
- `var(--border)` for borders
- `var(--bg)` for backgrounds
- `var(--success)`, `var(--danger)`, `var(--warning)` for status colors

## Integration Notes

- All headers include `X-user-ID` header via `fetchWithUserId()`
- Supports both mock mode and real backend API calls
- Consistent error handling with existing admin components
- Date formatting utility matches Team and User management tables
- Navigation state managed through wizardStore

## Files Modified/Created

### Created:
- `src/features/admin/UDFScreen.jsx` - New
- `src/features/admin/UDFManagementTable.jsx` - New

### Modified:
- `src/shared/services/adminService.js` - Added UDF CRUD functions
- `src/features/admin/AdminScreen.jsx` - Removed UDF tab
- `src/features/admin/AdminWorkspace.jsx` - Added UDF navigation support
- `src/features/admin/AdminSideMenu.jsx` - Added UDF menu item

