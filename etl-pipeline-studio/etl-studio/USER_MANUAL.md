# ETL Studio User Manual

This manual describes the current ETL Studio user interface as implemented in the app today.

It explains:

- the main screens
- all major tabs and step tabs
- the purpose of the main buttons
- what each screen is used for
- what changes in **view-only** mode

---

## 1. Application Overview

ETL Studio has two main working areas:

1. **Deployments** — the management screen for existing pipelines
2. **ETL Configuration Wizard** — the step-by-step flow for creating or editing a pipeline

### Main navigation flow

Current runtime behavior:

- If you are not logged in, you see the **Login** screen.
- After login, the app opens the **Deployments** screen.
- From Deployments, you can:
  - create a new pipeline
  - edit an existing pipeline
  - deploy, stop, upgrade, delete, restore, or preview pipelines
- When you open a saved or deployed version preview, the wizard opens in **view-only** mode.

---

## 2. Login Screen

The login screen is the first screen shown when no user session exists.

### Controls

#### `User ID`
Text input for the user name / login ID.

#### `Password`
Password input.

#### `Team Name`
Dropdown that loads available team names from the backend.

- Disabled while team names are loading
- Required before login is enabled

#### `Retry loading teams`
Shown only when loading team names failed.

Use this button to request the team list again.

#### `Use Mock Data`
Checkbox that switches the application between backend-driven mode and mock-data mode.

Use this when:

- backend services are not available
- you want to demo the UI without live APIs

#### `Login`
Submits the login form.

Enabled only when:

- User ID is filled
- Password is filled
- Team Name is selected
- team names finished loading

---

## 3. Top Navigation Bar

The top bar appears on the management screen and on the wizard.

### Controls

#### `ETLManagement` brand button
Behavior:

- in normal mode: returns to the **Deployments** screen
- in view-only mode: non-navigating label only

#### `ENTERPRISE`
Visual product badge.

#### Version label
Displays the current app version.

#### `👁 VIEW ONLY`
Shown only when a configuration is opened as a preview.

#### `🌞 Light` / `🌙 Dark`
Theme toggle.

Use it to switch between dark and light themes.

#### `Logout`
Ends the current user session.

Hidden in view-only preview mode.

---

## 4. Deployments Screen

The **Deployments** screen is the operational dashboard for existing pipelines.

It lets you:

- search pipelines
- filter pipelines by tab
- sort columns
- preview saved/deployed versions
- deploy, stop, delete, upgrade, edit, restore, and permanently delete pipelines
- create a new configuration

---

## 5. Deployments Screen Header and Toolbar

### Title area

#### `Deployments`
Main page title.

#### Team / counters / status chips
The subtitle area shows:

- current team name
- total pipeline count in the active tab
- running count
- stopped count
- draft count
- failed count

These are informational only.

### Toolbar controls

#### `Filter deployments...`
Search box for the table.

Behavior:

- searches by separate words
- words can match across different columns in the same row
- also searches the formatted **Last Status Change** value

Example:

- typing `erp running prod`
  can match source, status, and environment across the row

#### `+ New Configuration`
Creates a brand-new wizard session and opens the wizard on **Step 1 — Metadata**.

Use this when starting a new ETL pipeline.

---

## 6. Deployments Screen Tabs

Tabs appear above the table in a bordered tab bar.

### Tabs

#### `All`
Shows all deployments.

#### `Prod`
Shows production deployments.

#### `Stage`
Shows staging deployments.

#### `Dev`
Shows development deployments.

#### `Deleted`
Shows deleted pipelines only.

### Tab behavior

- each tab shows a count badge
- the active tab has the highlighted active style
- deleted pipelines move into the `Deleted` tab after delete

---

## 7. Deployments Screen Notifications Row

Below the toolbar is a reserved notification row.

It shows temporary feedback messages such as:

- deployment completed successfully
- pipeline deleted
- pipeline restored
- backend/load errors

These messages auto-clear after a delay.

---

## 8. Deployments Table

### Columns

#### `Product Source`
The source system or product source name.

#### `Product Type`
The product/entity type for the pipeline.

#### `Environment`
Deployment environment.

#### `Status`
Current pipeline state.

Possible common values:

- `draft`
- `running`
- `stopped`
- `failed`
- `deleted`

#### `Saved Version`
Latest saved draft version.

This value is clickable when present.

Clicking it opens a **read-only preview** of the saved configuration.

#### `Deployed Version`
Current deployed version.

This value is clickable when present.

Clicking it opens a **read-only preview** of the deployed configuration.

If the deployed version differs from the saved version, the value is highlighted to show a version mismatch.

#### `Last Status Change`
Shows the last update timestamp.

### Sorting

Each column header is clickable.

Click a header to:

- sort ascending
- click again to sort descending

Special behavior:

- status sorting keeps `running` rows prioritized

---

## 9. Deployments Table Row Actions

Normal rows and deleted rows show different action sets.

### 9.1 Normal pipeline row actions

#### `Deploy` button
Rocket icon.

Use it to deploy a draft pipeline.

Disabled when:

- the pipeline is already running
- a deploy action is already in progress

#### `Stop` button
Hand icon.

Use it to stop a running pipeline.

Disabled when:

- the pipeline is not running
- a stop action is already in progress

#### `Delete` button
Trash icon.

Moves the pipeline into the `Deleted` tab.

Disabled when:

- the pipeline is running
- a delete action is already in progress

#### `Upgrade` button
Up-arrow icon.

Use it to deploy the latest saved version over the currently running deployment.

Enabled only when:

- the pipeline is currently running
- `Saved Version` and `Deployed Version` are different

Disabled when:

- no newer saved version exists
- the pipeline is not running
- an upgrade is already in progress

#### `Edit` button
Pen icon.

Opens the selected pipeline in the wizard for editing.

This loads the saved draft YAML into the wizard and marks all steps as already completed.

---

### 9.2 Deleted pipeline row actions

Deleted rows use icon-only actions.

#### `Delete permanently`
Trash icon.

Completely removes the deleted pipeline.

#### `Restore pipeline`
Rotate-arrow icon.

Restores the pipeline from the Deleted tab back into active management.

---

## 10. Deployments Screen Dialogs and Overlays

### Confirm dialogs
The management screen opens confirmation dialogs for:

- delete
- permanent delete
- restore
- edit/open for editing

Typical buttons:

- `Cancel`
- action-specific confirm button such as `Delete`, `Delete permanently`, `Yes`, or `Continue`

### Progress modal
Shown during:

- deploy
- upgrade

What it shows:

- current backend step list
- active step
- progress counter
- success or failure state

Buttons:

- while running: no close button, only progress display
- on success: `Done`
- on failure: `Close`

### Success overlay
Shown after a successful deployment or upgrade.

Contents:

- pipeline ID
- product type
- product source
- environment
- Grafana dashboard link

Buttons:

#### `📋 Copy`
Copies the Grafana link.

#### `🔗 Open in Grafana`
Opens the dashboard in a new browser tab.

#### `Back to Deployments`
Returns to the management table and closes the success overlay.

---

## 11. Wizard Overview

The ETL Configuration Wizard has 7 step tabs:

1. `Metadata`
2. `Source Config`
3. `Source Upload`
4. `Filters`
5. `Field Mapping`
6. `Sink Config`
7. `Summary`

### Step bar behavior

- completed steps show a check mark
- current step is highlighted
- accessible previous/completed steps can be clicked directly
- invalid field mapping can be highlighted as incomplete

### Footer behavior

Normal mode footer buttons:

#### `← Back`
Moves to the previous step.

Shown from step 2 onward.

#### `Continue →`
Moves to the next step.

Disabled when the current step does not satisfy validation, except the field mapping special case below.

### Field Mapping validation modal
If Field Mapping is incomplete and you press Continue, a warning modal can appear.

Buttons:

#### `Back`
Closes the modal and returns to the current step.

#### `Continue anyway`
Moves forward even though field mapping is incomplete.

---

## 12. View-Only Wizard Mode

View-only mode is used when opening saved/deployed version previews from the management table.

### Visible indicators

- top bar `👁 VIEW ONLY`
- wizard banner `View mode — configuration is read-only.`

### View-only footer buttons

#### `← Previous`
Moves to the previous step.

#### `Next →`
Moves to the next step.

#### `Close`
Shown on the last step.

Closes the preview window.

### General behavior in view-only mode

Inputs and action buttons are locked across the wizard.

Examples of disabled actions in preview mode:

- upload sample
- source connection testing
- filter editing
- mapping editing
- transformer changes
- sink changes
- save/deploy actions

Some close/cancel controls remain available so you can dismiss dialogs safely.

---

# Wizard Steps

---

## 13. Step 1 — Metadata

The Metadata step defines the pipeline identity and stream profile.

### Section: `Pipeline Metadata`

#### `Product Source`
Required text field.

Defines the upstream business/system source.

#### `Product Type`
Required text field.

Defines the type of product/entity/payload.

#### `Product Code`
Optional numeric-only input.

Only digits are accepted.

#### `Team`
Read-only field.

Filled from the logged-in user team.

#### `Environment`
Required dropdown.

Options:

- `dev`
- `staging`
- `production`

#### `Entity Name`
Required dropdown.

Loaded from backend entities.

Selecting an entity loads the target schema.

### Section: `Data Stream Info`

#### `Streaming Continuity`
Required dropdown.

Options include:

- `Once`
- `Every Hour`
- `Every Few Hours`
- `Once a Day`
- `Continuous`

#### `Avg Records Per Day`
Required dropdown.

Options range from `Hundreds` up to `Hundreds of Millions`.

---

## 14. Step 2 — Source Config

This step defines where the source data comes from and how it should be read.

### Section: `Source Config`

The source type cards appear first.

### Source type cards

#### `Kafka`
Enabled.

#### `RabbitMQ`
Enabled.

#### `File / Object`
Visible but currently marked for a future release.

#### `Database`
Visible but currently marked for a future release.

#### `HTTP API`
Visible but currently marked for a future release.

#### `S3 / Blob`
Visible but currently marked for a future release.

### Kafka source panel

#### `Environment`
Environment dropdown for Kafka.

#### `Topic`
Kafka topic name.

#### `🔌 Test Connection`
Runs a backend connectivity check.

Possible states:

- loading
- success
- error

#### `▶ / ▼ Key Filter`
Expands or collapses the Kafka key filter area.

#### `Kafka key filter input`
Comma-separated key list.

Use this to restrict the consumed records by key.

### RabbitMQ source panel

Fields:

- `IP`
- `PORT`
- `Username`
- `Password`
- `Queue`
- `VHOST`

#### `🔌 Test Connection`
Currently shown for consistency with the source panel pattern.

### Other source panels
If enabled in the future, these panels contain:

- file path
- database connection/query
- HTTP method/auth
- S3 bucket/prefix
- `🔌 Test Connection`

### Section: `Source Format`

#### `Message / File Format`
Dropdown.

Options:

- `JSON`
- `CSV`

#### `Split Key (optional)`
Shown only when format is `JSON`.

Use it to point to the array/object root inside the payload.

#### `Column Delimiter`
Shown only when format is `CSV`.

Use it to define the separator character.

---

## 15. Step 3 — Source Upload

This step uploads a sample file so the app can infer the source schema.

### Controls

#### `Upload sample`
Opens the file picker.

Accepted file types:

- JSON
- CSV

### Drop zone behavior

The drop zone supports:

- click to browse
- drag and drop a file

### Drop zone states

#### Idle state
Shows:

- `Drop a sample file here`
- `or click to browse`
- JSON / CSV badges

#### Parsing state
Shows:

- spinner
- `Inferring schema from sample…`
- `Uploading file content to the backend…`

#### Done state
Shows:

- success icon
- `Sample uploaded`
- number of detected fields

### Section: `Detected Schema`

Displayed after successful schema inference.

Each row shows:

- field name/path
- detected type
- array badge when relevant
- required badge when relevant

---

## 16. Step 4 — Filters

This step lets you build rule groups that filter records before mapping/output.

### Header controls

#### `+ Add Group`
Adds a new top-level filter group.

#### Active rules badge
Shows how many filter rules are currently active.

### Inside each group

#### `AND` / `OR`
Controls how the group combines its rules.

- `AND` = all rules must match
- `OR` = any rule may match

#### `include` / `exclude`
Available on the root group.

- `include` keeps matching records
- `exclude` removes matching records

#### `+ Add Condition`
Adds a rule row to the current group.

#### `+ Add Group`
Adds a nested subgroup.

#### `×` on a rule row
Removes that rule.

#### `×` on a subgroup/root block
Removes that group when available.

### Rule row fields

Each rule row contains:

#### Field dropdown
Selects the source field.

#### Operator dropdown
Selects the filter operator.

#### Value input / dropdown
Depends on the selected operator.

Some operators show:

- plain text input
- select list
- multiple structured property inputs

### Section: `Generated Filter Expression`

Shows a live textual representation of the current filter logic.

If no filters are defined, it shows that all records will pass.

---

## 17. Step 5 — Field Mapping

This is the most interactive screen in the wizard.

It maps source fields to target fields and supports transformer chains, expressions, and Saknay routing.

The screen has 3 areas:

- left source field panel
- center canvas
- right target field panel

---

## 18. Field Mapping — Left Source Panel

### Controls

#### Source search box
Filters the source field list.

#### Bulk add/remove button
The button text changes:

- `>>>` adds all source fields to the canvas
- `<<<` removes them when they are already on the canvas

### Source field list behavior

Each source field supports:

- drag to canvas
- double-click to add to canvas

Already-added fields are dimmed and cannot be added again.

---

## 19. Field Mapping — Right Target Panel

### Controls

#### Target search box
Filters the target field list.

#### Bulk add/remove button
The button text changes:

- `<<<` adds all target fields to the canvas
- `>>>` removes them when already on the canvas

### Target field list behavior

Each target field supports:

- drag to canvas
- double-click to add to canvas

Required target fields show an asterisk `*`.

Already-added target fields are dimmed and cannot be added again.

---

## 20. Field Mapping — Canvas Toolbar

### `Zoom out`
Reduces canvas zoom.

### Zoom percentage button
Center zoom control.

Clicking it resets zoom to `100%`.

### `Zoom in`
Increases canvas zoom.

### `Align`
Repositions nodes into a cleaner layout.

Use this after manually moving nodes or building a larger graph.

### `⚡ Map All Fields`
Automatically maps matching fields.

Use this for a quick first-pass mapping.

### `Clear Canvas`
Opens a confirmation dialog to remove:

- all source nodes
- all target nodes
- all connections
- all transformers

---

## 21. Field Mapping — Canvas Basics

### Adding nodes
You can add nodes by:

- dragging from side panels
- double-clicking a field in the side panel
- using bulk add/remove buttons

### Connecting nodes
Connect a source field to a target field by dragging from the source port to the target port.

Rules:

- source to target only
- one incoming connection per target field
- duplicate connections are blocked

### Node actions

#### Node delete `×`
Appears on hover.

Removes the node from the canvas.

#### Move node
Click and drag a node to reposition it.

### Required target warning
If a required target field has no incoming connection, it is visually highlighted and labeled:

- `Required mapping missing`

---

## 22. Field Mapping — Target Node Controls

Target nodes expose extra controls.

### `Saknay` toggle
Small badge button on target nodes.

Use it to decide whether this target field should also be sent to Saknay.

### `exp` badge
Shown when a target expression exists.

### Target context menu
Right-clicking a target node opens a menu with:

#### `Saknay`
Checkbox version of the same target-level routing flag.

#### `Expression`
Textarea for a target expression.

#### `Add Transformer`
Shown when the target has no connection and NONE-input transformers are available.

This lets you attach a transformer that does not require a source field.

---

## 23. Field Mapping — Transformers

Transformers sit on connections between source and target nodes.

### Add transformer buttons
You can add transformers from:

- the `+` symbol on a connection
- the `+` insertion points before/after existing transformers
- target context menu for NONE-input transformers

### Transformer node click actions
Click a transformer to edit it.

### Transformer right-click menu
A transformer or connection menu can show:

- `Add Transformer`
- `Add Transformer Before`
- `Add Transformer After`
- `Edit Transformer`
- `Remove Transformer`
- `Delete Connection`
- `Remove "<extra input>"`

### Multi-input transformer hints
Multi-input transformers can accept extra source fields.

You may see:

- `+ drop src here`
- an input count badge such as `2 inputs`

### Invalid transformer warning
If a required transformer property is missing, the transformer is highlighted and a hover warning explains which required fields are missing.

---

## 24. Field Mapping — Transformer Modal

This modal is used to add, edit, insert, or replace a transformer.

### Modal controls

#### Search box
Filters the transformer list.

#### Transformer list
Shows available transformers.

Transformer rows may show badges:

- `multi`
- `no input`

#### `← Back`
Returns from the property editor to the transformer list.

#### `×`
Closes the modal.

#### `Cancel`
Closes the modal without applying changes.

#### `✓ Apply <Transformer>`
Adds or inserts a transformer.

#### `✓ Save <Transformer>`
Saves edits to an existing transformer.

#### `✕ Remove Transformer`
Deletes the current transformer from the connection.

### Property table
The right side of the modal shows:

- property name
- editable value
- backend-supplied description

Required properties are marked `req`.

---

## 25. Field Mapping — Clear Canvas Dialog

When you press `Clear Canvas`, a confirmation dialog opens.

### Buttons

#### `Cancel`
Closes the dialog and keeps the canvas unchanged.

#### `Clear Canvas`
Deletes all nodes, connections, and transformer assignments.

---

## 26. Step 6 — Sink Config

This step defines where the transformed output should be written.

### Sink type cards

#### `Kafka`
Enabled.

#### `File`
Visible but currently planned for a future release.

#### `Database`
Visible but currently planned for a future release.

#### `RabbitMQ`
Visible but currently planned for a future release.

---

## 27. Sink Config — Kafka Sink Panel

### `Output Topic`
Optional text field.

Overrides the auto-generated topic name.

### `Bootstrap Environment`
Required environment dropdown.

### `Add APSS properties (optional)`
Checkbox.

Enables the additional key/value property editor.

### Additional Properties area

When enabled:

#### `＋ Add property`
Adds a new key/value row.

#### `Key`
Property name.

#### `Value`
Property value.

#### `Remove`
Deletes the row.

### `🦆 SAKNAY` section
Shown when at least one target field is configured to send to Saknay.

#### `Saknay Topic`
Optional topic override.

### `🏷️ Data Catalog Options`

#### `🌬️ SHADOW`
Checkbox.

When enabled, an optional topic input appears.

#### `📊 ASG`
Checkbox.

Turns on ASG metadata/governance output.

Both SHADOW and ASG have hint icons that explain their purpose.

---

## 28. Step 7 — Summary

The Summary step is the final review and deployment screen.

It combines:

- summary stats
- visual flow
- validation checklist
- YAML preview
- save and deploy actions

---

## 29. Summary — Main Sections

### Stats row
Shows summary cards for:

- Entity
- Source
- Mappings
- Filters
- Sink

### `⚡ Flink Pipeline Flow`
Visual flow of source → filters → mapping → sink.

### `✅ Validation Checklist`
Shows whether the pipeline is ready to proceed.

### `📄 YAML Preview`
Shows the generated YAML.

#### `📋 Copy YAML`
Copies the generated YAML to the clipboard.

Changes to `✓ Copied` after success.

---

## 30. Summary — Action Buttons

The sticky summary footer is hidden in view-only mode.

### `💾 Save Draft`
Saves the generated YAML as a draft.

Use this when you are not ready to deploy yet.

### `🚀 Save & Deploy`
Saves and deploys the pipeline.

Use this to launch a new deployment.

While running, the label changes to:

- `🚀 Saving & Deploying...`

---

## 31. Summary — Result Dialogs and Pages

### Draft result dialog
After saving a draft:

- success title: `Draft Saved`
- error title: `Save Draft Failed`

#### `Close`
Closes the draft dialog.

On success, this returns you to the management screen.

### No-changes dialog
Shown when the generated YAML has no changes compared to the original draft.

#### `OK`
Closes the dialog and returns to management.

### Error dialog
Shown when deployment fails.

Possible buttons:

#### `↔ Go to Field Mapping`
Shown when the error supports direct correction in field mapping.

#### `Got it, I'll fix it`
Closes the error dialog.

### Deployment progress modal
Shown during deployment.

See progress step-by-step until the backend completes or fails.

### Success page
Shown after a successful deployment.

Contents:

- generated pipeline ID
- entity
- mappings count
- environment
- Grafana link

Buttons:

#### `📋 Copy`
Copies the Grafana link.

#### `🔗 Open in Grafana`
Opens the dashboard.

#### `View in Management`
Returns to the Deployments screen.

---

## 32. Read-Only / Preview Workflow

Saved and deployed previews are opened from the management table by clicking:

- `Saved Version`
- `Deployed Version`

This opens a new browser window with the wizard preloaded in read-only mode.

### What you can still do in preview mode

- move between wizard steps
- read all fields and summaries
- close dialogs
- close the preview window on the last step

### What you cannot do in preview mode

- edit fields
- upload samples
- test source connections
- change filters
- map fields
- add/remove transformers
- toggle Saknay/Shadow/ASG values
- save drafts
- deploy or upgrade

---

## 33. Quick Reference: Main Tabs and Buttons

## Management tabs

- `All`
- `Prod`
- `Stage`
- `Dev`
- `Deleted`

## Wizard step tabs

- `Metadata`
- `Source Config`
- `Source Upload`
- `Filters`
- `Field Mapping`
- `Sink Config`
- `Summary`

## Most important action buttons

### Management

- `+ New Configuration`
- `Deploy`
- `Stop`
- `Delete`
- `Upgrade`
- `Edit`
- `Restore`
- `Delete permanently`
- `Clear filter`
- `Back to Deployments`

### Wizard global

- `← Back`
- `Continue →`
- `← Previous`
- `Next →`
- `Close`

### Summary

- `💾 Save Draft`
- `🚀 Save & Deploy`
- `📋 Copy YAML`
- `📋 Copy`
- `🔗 Open in Grafana`
- `View in Management`

### Field Mapping

- `Align`
- `⚡ Map All Fields`
- `Clear Canvas`
- `Add Transformer`
- `Add Transformer Before`
- `Add Transformer After`
- `Edit Transformer`
- `Remove Transformer`
- `Delete Connection`

---

## 34. Practical Recommended Flow

For a normal new pipeline:

1. Log in
2. Open **Deployments**
3. Click `+ New Configuration`
4. Fill **Metadata**
5. Configure the **Source Config**
6. Upload a sample in **Source Upload**
7. Add optional filters in **Filters**
8. Build mappings in **Field Mapping**
9. Configure Kafka sink in **Sink Config**
10. Review YAML in **Summary**
11. Click `💾 Save Draft` or `🚀 Save & Deploy`
12. Track deployment in the progress modal
13. Return to **Deployments** and monitor versions/status

---

## 35. Notes About Current UI Scope

Current UI behavior visible in the app today:

- login goes directly to **Deployments** after success
- source type cards show several planned options, but only some are active
- sink type cards also show planned options, but Kafka is the active path
- saved/deployed version previews open the wizard in read-only mode
- deploy and upgrade both use the same live progress modal

If the UI grows later, this manual should be updated alongside the corresponding screen components.


