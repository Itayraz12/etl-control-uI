# REST API Summary

This document lists the backend API URLs currently used by the ETL Studio frontend.

## Base URL

The frontend builds backend URLs from `API_BASE` in `src/shared/services/appConfig.js`.

- Environment variable: `VITE_API_BASE`
- Default value: `http://localhost:8080/api`

So unless overridden, all relative paths below are rooted at:

```text
http://localhost:8080/api
```

---

## 1. Team Names

### GET `/backend/teamNames`
Fetches the available team names.

- Method: `GET`
- Full default URL: `http://localhost:8080/api/backend/teamNames`
- Service: `src/shared/services/teamNamesService.js`
- Consumed by: `src/shared/store/teamNamesContext.jsx`

---

## 2. Configuration Metadata APIs

### GET `/config/transformers`
Fetches transformer definitions.

- Method: `GET`
- Full default URL: `http://localhost:8080/api/config/transformers`
- Service: `src/shared/services/configService.js`
- Consumed by: `src/shared/store/configContext.jsx`

### GET `/config/filters`
Fetches filter operator definitions.

- Method: `GET`
- Full default URL: `http://localhost:8080/api/config/filters`
- Service: `src/shared/services/configService.js`
- Consumed by: `src/shared/store/configContext.jsx`

### GET `/backbone/entities`
Fetches available entities.

- Method: `GET`
- Full default URL: `http://localhost:8080/api/backbone/entities`
- Service: `src/shared/services/configService.js`
- Consumed by: `src/shared/store/configContext.jsx`

### GET `/backend/schema/entity/{entityName}`
Fetches the target/entity schema for the selected entity.

- Method: `GET`
- Full default URL example: `http://localhost:8080/api/backend/schema/entity/Product`
- Path params:
  - `entityName`
- Service: `src/shared/services/configService.js`
- Consumed by: `src/features/file-upload/MetadataStep.jsx`

### POST `/backend/schemaByExample`
Infers source schema from uploaded example content.

- Method: `POST`
- Full default URL: `http://localhost:8080/api/backend/schemaByExample`
- Headers used by frontend:
  - `Content-Type: <file content type>`
  - `Accept: application/json, text/plain`
  - optional `X-File-Name`
- Body: raw uploaded file text
- Service: `src/shared/services/configService.js`
- Consumed by: `src/features/source-config/SourceUploadStep.jsx`

---

## 3. Draft Configuration YAML APIs

### GET `/backend/configuration/draft/yaml`
Fetches saved draft YAML for preview.

- Method: `GET`
- Full default URL: `http://localhost:8080/api/backend/configuration/draft/yaml`
- Query params:
  - `productType`
  - `source`
  - `team`
  - `environment`
- Service: `src/shared/services/configService.js`
- Consumed by: `src/features/etl-wizard/ETLManagementScreen.jsx`

### GET `/backend/configuration/yaml`
Fetches editable/current draft YAML.

- Method: `GET`
- Full default URL: `http://localhost:8080/api/backend/configuration/yaml`
- Query params:
  - `productType`
  - `source`
  - `team`
  - `environment`
- Service: `src/shared/services/configService.js`
- Consumed by: `src/features/etl-wizard/ETLManagementScreen.jsx`

### POST `/backend/configuration/yaml`
Saves draft YAML.

- Method: `POST`
- Full default URL: `http://localhost:8080/api/backend/configuration/yaml`
- Query params:
  - `productType`
  - `source`
  - `team`
  - `environment`
- Headers used by frontend: `Content-Type: application/json`
- Body: YAML text
- Service: `src/shared/services/configService.js`
- Consumed by: `src/features/summary/SummaryStep.jsx`

> Note: the current frontend sends raw YAML text in the request body while setting `Content-Type: application/json`, because that is how `saveDraftConfiguration(...)` is implemented today.

---

## 4. Kafka API

### GET `/backend/kafka/test-connection`
Tests Kafka connectivity for the selected topic/environment.

- Method: `GET`
- Full default URL: `http://localhost:8080/api/backend/kafka/test-connection`
- Query params:
  - `topicName`
  - `environment`
- Service: `src/shared/services/kafkaService.js`
- Consumed by: `src/features/source-config/SourceConfigStep.jsx`

---

## 5. Deployment APIs

### GET `/backend/deployments`
Fetches deployments for the management screen.

- Method: `GET`
- Full default URL: `http://localhost:8080/api/backend/deployments`
- Query params:
  - `teamName`
- Service: `src/shared/services/deploymentsService.js`
- Consumed by: `src/features/etl-wizard/ETLManagementScreen.jsx`

### POST `/backend/deployments/deploy`
Deploys a new pipeline or upgrades an existing one.

- Method: `POST`
- Full default URL: `http://localhost:8080/api/backend/deployments/deploy`
- Query params:
  - `productType`
  - `source`
  - `team`
  - `environment`
  - `isDeploy`
- Headers used by frontend: `Content-Type: text/plain`
- Body: YAML text (`configurationYaml`)
- Service: `src/shared/services/deploymentsService.js`
- Consumed by:
  - `src/features/summary/SummaryStep.jsx`
  - `src/features/etl-wizard/ETLManagementScreen.jsx`

### GET `/backend/deployments/steps`
Fetches deployment step definitions for the progress modal.

- Method: `GET`
- Full default URL: `http://localhost:8080/api/backend/deployments/steps`
- Service: `src/shared/services/deploymentsService.js`
- Consumed by:
  - `src/features/summary/SummaryStep.jsx`
  - `src/features/etl-wizard/ETLManagementScreen.jsx`

### POST `/backend/deployments/stop`
Stops a deployment.

- Method: `POST`
- Full default URL: `http://localhost:8080/api/backend/deployments/stop`
- Query params:
  - `productType`
  - `source`
  - `team`
  - `environment`
- Service: `src/shared/services/deploymentsService.js`
- Consumed by: `src/features/etl-wizard/ETLManagementScreen.jsx`

### DELETE `/backend/deployments/delete`
Deletes a deployment.

- Method: `DELETE`
- Full default URL: `http://localhost:8080/api/backend/deployments/delete`
- Query params:
  - `productType`
  - `source`
  - `team`
  - `environment`
  - `isPermanent`
- Service: `src/shared/services/deploymentsService.js`
- Consumed by: `src/features/etl-wizard/ETLManagementScreen.jsx`

### POST `/backend/deployments/{id}/restore`
Restores a deleted deployment.

- Method: `POST`
- Full default URL example: `http://localhost:8080/api/backend/deployments/123/restore`
- Path params:
  - `id`
- Service: `src/shared/services/deploymentsService.js`
- Consumed by: `src/features/etl-wizard/ETLManagementScreen.jsx`

---

## 6. Real-Time Progress API (SSE)

This is not a normal REST endpoint, but the app actively uses it.

### GET `/backend/deployments/{deploymentId}/progress`
Server-Sent Events stream for deploy/upgrade progress.

- Transport: `EventSource` / SSE
- Full default URL example: `http://localhost:8080/api/backend/deployments/run-123/progress`
- Path params:
  - `deploymentId`
- Expected content type: `text/event-stream`
- Service: `src/shared/services/deploymentsService.js`
- Consumed by:
  - `src/features/summary/SummaryStep.jsx`
  - `src/features/etl-wizard/ETLManagementScreen.jsx`

---

## 7. Admin APIs

These endpoints are used by the admin-only workspace added for team and user management.

All admin requests are sent through `fetchWithUserId(...)`, so the frontend also includes the current user header:

- Header: `X-user-ID: <logged-in-user-id>`

### GET `/backend/admin/teams`
Fetches teams for the Team Management table and the team options used by User Management.

- Method: `GET`
- Full default URL: `http://localhost:8080/api/backend/admin/teams`
- Headers used by frontend:
  - `Accept: application/json, text/plain`
- Service: `src/shared/services/adminService.js`
- Consumed by:
  - `src/features/admin/TeamManagementTable.jsx`
  - `src/features/admin/UserManagementTable.jsx`

Expected response shape used by the frontend:

```json
[
  {
    "id": "team-data-platform",
    "teamName": "data-platform",
    "devopsName": "platform-devops",
    "createdAt": "2026-01-10T09:00:00.000Z",
    "updatedAt": "2026-03-08T14:20:00.000Z"
  }
]
```

The frontend also accepts these aliases when normalizing the payload:

- `teamName` / `team` / `name`
- `devopsName` / `devops` / `devopsOwner` / `devops_name`
- `createdAt` / `dateOfCreate` / `createdDate` / `created_at`
- `updatedAt` / `dateOfChange` / `modifiedAt` / `updated_at`

### POST `/backend/admin/teams`
Creates a new team.

- Method: `POST`
- Full default URL: `http://localhost:8080/api/backend/admin/teams`
- Headers used by frontend:
  - `Content-Type: application/json`
  - `Accept: application/json, text/plain`
- Body:

```json
{
  "teamName": "data-platform",
  "devopsName": "platform-devops"
}
```

- Service: `src/shared/services/adminService.js`
- Consumed by: `src/features/admin/TeamManagementTable.jsx`

### PUT `/backend/admin/teams/{id}`
Updates an existing team row.

- Method: `PUT`
- Full default URL example: `http://localhost:8080/api/backend/admin/teams/team-data-platform`
- Path params:
  - `id`
- Headers used by frontend:
  - `Content-Type: application/json`
  - `Accept: application/json, text/plain`
- Body:

```json
{
  "teamName": "data-platform",
  "devopsName": "platform-devops"
}
```

- Service: `src/shared/services/adminService.js`
- Consumed by: `src/features/admin/TeamManagementTable.jsx`

### DELETE `/backend/admin/teams/{id}`
Deletes a team row.

- Method: `DELETE`
- Full default URL example: `http://localhost:8080/api/backend/admin/teams/team-data-platform`
- Path params:
  - `id`
- Headers used by frontend:
  - `Accept: application/json, text/plain`
- Service: `src/shared/services/adminService.js`
- Consumed by: `src/features/admin/TeamManagementTable.jsx`

### GET `/backend/admin/users`
Fetches users for the User Management table.

- Method: `GET`
- Full default URL: `http://localhost:8080/api/backend/admin/users`
- Headers used by frontend:
  - `Accept: application/json, text/plain`
- Service: `src/shared/services/adminService.js`
- Consumed by: `src/features/admin/UserManagementTable.jsx`

Expected response shape used by the frontend:

```json
[
  {
    "id": "alice",
    "userId": "alice",
    "teamName": "data-platform",
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-03-09T13:10:00.000Z"
  }
]
```

The frontend also accepts these aliases when normalizing the payload:

- `userId` / `userID` / `username` / `id`
- `teamName` / `team` / `team_name`
- `createdAt` / `dateOfCreate` / `createdDate` / `created_at`
- `updatedAt` / `dateOfChange` / `modifiedAt` / `updated_at`

### POST `/backend/admin/users`
Creates a new user row.

- Method: `POST`
- Full default URL: `http://localhost:8080/api/backend/admin/users`
- Headers used by frontend:
  - `Content-Type: application/json`
  - `Accept: application/json, text/plain`
- Body:

```json
{
  "userId": "alice",
  "teamName": "data-platform"
}
```

- Service: `src/shared/services/adminService.js`
- Consumed by: `src/features/admin/UserManagementTable.jsx`

### PUT `/backend/admin/users/{id}`
Updates an existing user row.

- Method: `PUT`
- Full default URL example: `http://localhost:8080/api/backend/admin/users/alice`
- Path params:
  - `id`
- Headers used by frontend:
  - `Content-Type: application/json`
  - `Accept: application/json, text/plain`
- Body:

```json
{
  "userId": "alice",
  "teamName": "analytics"
}
```

- Service: `src/shared/services/adminService.js`
- Consumed by: `src/features/admin/UserManagementTable.jsx`

### DELETE `/backend/admin/users/{id}`
Deletes a user row.

- Method: `DELETE`
- Full default URL example: `http://localhost:8080/api/backend/admin/users/alice`
- Path params:
  - `id`
- Headers used by frontend:
  - `Accept: application/json, text/plain`
- Service: `src/shared/services/adminService.js`
- Consumed by: `src/features/admin/UserManagementTable.jsx`

---

## Quick List

```text
GET    /backend/teamNames

GET    /config/transformers
GET    /config/filters
GET    /backbone/entities
GET    /backend/schema/entity/{entityName}
POST   /backend/schemaByExample

GET    /backend/configuration/draft/yaml
GET    /backend/configuration/yaml
POST   /backend/configuration/yaml

GET    /backend/kafka/test-connection

GET    /backend/deployments
POST   /backend/deployments/deploy
GET    /backend/deployments/steps
POST   /backend/deployments/stop
DELETE /backend/deployments/delete
POST   /backend/deployments/{id}/restore

SSE    /backend/deployments/{deploymentId}/progress

GET    /backend/admin/teams
POST   /backend/admin/teams
PUT    /backend/admin/teams/{id}
DELETE /backend/admin/teams/{id}

GET    /backend/admin/users
POST   /backend/admin/users
PUT    /backend/admin/users/{id}
DELETE /backend/admin/users/{id}
```

---

## Implemented in Service Layer but Not Currently Wired from Main Screens

### GET `/backend/deployments/{id}/config`
This endpoint exists in the frontend service layer, but I did not find an active usage from the main feature screens.

- Method: `GET`
- Full default URL example: `http://localhost:8080/api/backend/deployments/123/config`
- Service: `src/shared/services/deploymentsService.js`

---

## Source Files Scanned

Core services:

- `src/shared/services/appConfig.js`
- `src/shared/services/teamNamesService.js`
- `src/shared/services/kafkaService.js`
- `src/shared/services/configService.js`
- `src/shared/services/deploymentsService.js`
- `src/shared/services/adminService.js`

Main consumers:

- `src/shared/store/teamNamesContext.jsx`
- `src/shared/store/configContext.jsx`
- `src/features/file-upload/MetadataStep.jsx`
- `src/features/source-config/SourceUploadStep.jsx`
- `src/features/source-config/SourceConfigStep.jsx`
- `src/features/summary/SummaryStep.jsx`
- `src/features/etl-wizard/ETLManagementScreen.jsx`
- `src/features/admin/AdminWorkspace.jsx`
- `src/features/admin/AdminScreen.jsx`
- `src/features/admin/TeamManagementTable.jsx`
- `src/features/admin/UserManagementTable.jsx`

---

## Excluded on Purpose

These files contain demo/example API snippets, not the live app API flow, so they are not included above:

- `src/shared/components/INTEGRATION_EXAMPLES.jsx`
- `src/shared/components/DeploymentExample.jsx`

