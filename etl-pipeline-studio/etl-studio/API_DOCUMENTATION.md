# ETL Pipeline Studio - REST API Documentation

## Overview

This document provides a comprehensive reference for all REST API endpoints used by the ETL Pipeline Studio. The API is organized into logical modules: Configuration Management, Deployment Management, Data Processing, and planned endpoints for future enhancements.

**Base URL:** `http://localhost:8080/api`

## API Inventory

### Live Endpoints (10 Total)

#### Configuration Management (5 endpoints)
- `GET /transformers` - Fetch available data transformers
- `GET /filters` - Fetch available filter definitions
- `GET /entities` - Fetch available entity types
- `POST /schema/infer` - Infer schema from sample data
- `GET /drafts/:id` / `POST /drafts` - Retrieve or save draft configurations

#### Deployment Management (4 endpoints)
- `GET /deployments` - List all ETL deployments
- `POST /deployments` - Create new deployment
- `GET /deployments/:id` - Get deployment details
- `POST /backend/deployments/stop` - Stop/cancel deployment

#### Data Processing (1 endpoint)
- `POST /process` - Execute data transformation pipeline

### Planned Endpoints (2 Total)
- `POST /deployments/:id/start` - Start ETL deployment execution
- `GET /deployments/:id/status` - Poll deployment execution status

---

## Configuration Management APIs

### 1. GET /transformers

Fetch all available data transformers/processors supported by the ETL system.

**Method:** `GET`  
**Path:** `/transformers`  
**Authentication:** Not required (mock mode)  
**Status Code:** `200 OK`

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "id": "mapper",
      "name": "Field Mapper",
      "description": "Maps source fields to target fields",
      "version": "1.0.0"
    },
    {
      "id": "filter",
      "name": "Row Filter",
      "description": "Filters rows based on conditions",
      "version": "1.0.0"
    },
    {
      "id": "enricher",
      "name": "Data Enricher",
      "description": "Enriches data with external lookups",
      "version": "1.0.0"
    }
  ]
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Failed to fetch transformers",
  "statusCode": 500
}
```

**Usage Location:** `src/shared/services/configService.js:fetchTransformers()`

**Mock Data:** Automatically provided in mock mode with 3 standard transformers

---

### 2. GET /filters

Fetch all available predefined filter templates and condition types.

**Method:** `GET`  
**Path:** `/filters`  
**Authentication:** Not required (mock mode)  
**Status Code:** `200 OK`

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "id": "equals",
      "label": "Equals",
      "operators": ["==", "!="]
    },
    {
      "id": "range",
      "label": "Between Range",
      "operators": [">=", "<=", "between"]
    },
    {
      "id": "contains",
      "label": "Text Contains",
      "operators": ["contains", "startsWith", "endsWith"]
    }
  ]
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Failed to fetch filters",
  "statusCode": 500
}
```

**Usage Location:** `src/shared/services/configService.js:fetchFilters()`

**Mock Data:** Provided in mock mode with standard filter operators

---

### 3. GET /entities

Fetch available entity types (source systems, target systems, data models).

**Method:** `GET`  
**Path:** `/entities`  
**Authentication:** Not required (mock mode)  
**Status Code:** `200 OK`

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "id": "salesforce",
      "name": "Salesforce",
      "type": "source",
      "version": "v60.0"
    },
    {
      "id": "snowflake",
      "name": "Snowflake",
      "type": "sink",
      "connector": "snowflake-jdbc"
    },
    {
      "id": "postgresql",
      "name": "PostgreSQL",
      "type": "sink",
      "connector": "postgresql-jdbc"
    }
  ]
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Failed to fetch entities",
  "statusCode": 500
}
```

**Usage Location:** `src/shared/services/configService.js:fetchEntities()`

**Mock Data:** Provided in mock mode with common data sources and sinks

---

### 4. POST /schema/infer

Infer data schema from a sample dataset. Accepts raw data or CSV format and returns detected field types, constraints, and statistics.

**Method:** `POST`  
**Path:** `/schema/infer`  
**Authentication:** Not required  
**Content-Type:** `application/json`  
**Status Code:** `200 OK` / `400 Bad Request`

**Request Example:**
```json
{
  "data": "[{\"name\":\"John\",\"age\":30,\"email\":\"john@example.com\"},{\"name\":\"Jane\",\"age\":28,\"email\":\"jane@example.com\"}]",
  "format": "json"
}
```

**Query Parameters:**
- `sampleSize` (optional): Number of records to analyze (default: all)
- `confidence` (optional): Confidence threshold for type detection 0-1 (default: 0.95)

**Response Example:**
```json
{
  "success": true,
  "data": {
    "fields": [
      {
        "name": "name",
        "type": "string",
        "nullable": false,
        "examples": ["John", "Jane"]
      },
      {
        "name": "age",
        "type": "integer",
        "nullable": false,
        "min": 28,
        "max": 30
      },
      {
        "name": "email",
        "type": "string",
        "format": "email",
        "nullable": false
      }
    ],
    "recordCount": 2,
    "confidence": 0.98
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Invalid data format. Supported formats: json, csv",
  "statusCode": 400
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Schema inference failed",
  "details": "Unable to parse input data",
  "statusCode": 500
}
```

**Usage Location:** `src/shared/services/configService.js:fetchSchemaByExample()`

**Implementation Notes:**
- Query parameters are URL-encoded in the fetch call
- Response includes confidence metric for type detection accuracy
- Handles both inline data and multipart file uploads in production

---

### 5. GET /drafts/:id & POST /drafts

Retrieve a saved draft configuration or save a new draft.

**Method:** `GET` / `POST`  
**Path:** `/drafts/{draftId}` or `/drafts`  
**Authentication:** Not required (mock mode)  
**Status Code:** `200 OK` / `201 Created` / `404 Not Found`

**GET Request Example:**
```
GET /drafts/draft-12345
```

**GET Response Example:**
```json
{
  "success": true,
  "data": {
    "id": "draft-12345",
    "name": "Customer Data Migration",
    "createdAt": "2026-03-15T10:30:00Z",
    "updatedAt": "2026-03-15T14:45:00Z",
    "config": {
      "source": {
        "type": "postgresql",
        "connection": "prod-db-01"
      },
      "mappings": [
        {
          "sourceField": "customer_id",
          "targetField": "id"
        }
      ],
      "filters": []
    }
  }
}
```

**POST Request Example:**
```json
{
  "name": "Customer Data Migration",
  "config": {
    "source": { "type": "postgresql" },
    "mappings": [],
    "filters": []
  }
}
```

**POST Response Example:**
```json
{
  "success": true,
  "data": {
    "id": "draft-12345",
    "name": "Customer Data Migration",
    "createdAt": "2026-03-15T10:30:00Z"
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Draft not found",
  "statusCode": 404
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Invalid draft configuration",
  "validationErrors": {
    "config.source": "Source configuration is required"
  },
  "statusCode": 400
}
```

**Usage Location:** `src/shared/services/configService.js:fetchDraftConfiguration()` and `saveDraftConfiguration()`

**Mock Data:** Draft configurations stored in mock cache with timestamps

---

## Deployment Management APIs

### 6. GET /deployments

List all ETL deployments with filtering and pagination support.

**Method:** `GET`  
**Path:** `/deployments`  
**Authentication:** Not required (mock mode)  
**Status Code:** `200 OK`

**Query Parameters:**
- `status` (optional): Filter by status (pending, running, completed, failed)
- `limit` (optional): Number of records per page (default: 20)
- `offset` (optional): Pagination offset (default: 0)

**Request Example:**
```
GET /deployments?status=running&limit=10&offset=0
```

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "id": "deploy-001",
      "name": "Customer Migration Batch 1",
      "status": "running",
      "createdAt": "2026-03-15T10:00:00Z",
      "startedAt": "2026-03-15T10:05:00Z",
      "progress": 45,
      "totalRecords": 100000,
      "processedRecords": 45000,
      "config": {
        "source": "postgresql",
        "target": "snowflake"
      }
    },
    {
      "id": "deploy-002",
      "name": "Customer Migration Batch 2",
      "status": "pending",
      "createdAt": "2026-03-15T10:30:00Z",
      "progress": 0
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 10,
    "offset": 0
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Failed to fetch deployments",
  "statusCode": 500
}
```

**Usage Location:** `src/shared/services/deploymentsService.js:fetchDeployments()`

**Mock Data:** Returns 5-10 deployments in various states with simulated progress

---

### 7. POST /deployments

Create a new deployment from a configuration.

**Method:** `POST`  
**Path:** `/deployments`  
**Authentication:** Not required  
**Content-Type:** `application/json`  
**Status Code:** `201 Created` / `400 Bad Request`

**Request Example:**
```json
{
  "name": "Customer Data Migration",
  "draftId": "draft-12345",
  "config": {
    "source": {
      "type": "postgresql",
      "connection": "prod-db-01"
    },
    "sink": {
      "type": "snowflake",
      "warehouse": "PROD_WH"
    },
    "mappings": [
      {
        "sourceField": "customer_id",
        "targetField": "id",
        "transformation": "none"
      }
    ],
    "filters": []
  },
  "schedule": "immediate"
}
```

**Response Example:**
```json
{
  "success": true,
  "data": {
    "id": "deploy-12345",
    "name": "Customer Data Migration",
    "status": "pending",
    "createdAt": "2026-03-15T10:30:00Z",
    "estimatedDuration": 3600,
    "estimatedRecords": 500000
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Invalid deployment configuration",
  "validationErrors": {
    "config.sink": "Sink configuration is required",
    "config.mappings": "At least one field mapping is required"
  },
  "statusCode": 400
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Failed to create deployment",
  "statusCode": 500
}
```

**Usage Location:** `src/shared/services/deploymentsService.js:deployService()`

**Implementation Notes:**
- Validates all required configuration fields before creating
- Returns estimated duration based on data volume and complexity
- Deployment starts immediately unless schedule is specified

---

### 8. GET /deployments/:id

Get detailed status and progress of a specific deployment.

**Method:** `GET`  
**Path:** `/deployments/{deploymentId}`  
**Authentication:** Not required (mock mode)  
**Status Code:** `200 OK` / `404 Not Found`

**Request Example:**
```
GET /deployments/deploy-12345
```

**Response Example:**
```json
{
  "success": true,
  "data": {
    "id": "deploy-12345",
    "name": "Customer Data Migration",
    "status": "running",
    "createdAt": "2026-03-15T10:30:00Z",
    "startedAt": "2026-03-15T10:35:00Z",
    "progress": 65,
    "totalRecords": 500000,
    "processedRecords": 325000,
    "skippedRecords": 1250,
    "failedRecords": 150,
    "estimatedTimeRemaining": 1800,
    "currentStep": "Transform and Load",
    "logs": [
      {
        "timestamp": "2026-03-15T10:35:00Z",
        "level": "info",
        "message": "Deployment started"
      },
      {
        "timestamp": "2026-03-15T10:36:30Z",
        "level": "info",
        "message": "Extracting source data"
      }
    ]
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Deployment not found",
  "statusCode": 404
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Failed to fetch deployment status",
  "statusCode": 500
}
```

**Usage Location:** `src/shared/services/deploymentsService.js:fetchDeploymentConfig()`

**Mock Data:** Simulates incremental progress (5% per poll interval) with realistic step transitions

---

### 9. DELETE /backend/deployments/delete

Stop or cancel a deployment (if running) or delete a completed deployment.

**Method:** `DELETE`  
**Path:** `/api/backend/deployments/delete`  
**Authentication:** Not required (mock mode)  
**Status Code:** `200 OK` / `404 Not Found` / `409 Conflict`

**Request Parameters:**
- `productType` (`String`) — pipeline product type
- `source` (`String`) — pipeline source system
- `team` (`String`) — owning team name
- `environment` (`String`) — target environment
- `isPermanent` (`boolean`) — `false` for soft delete, `true` for permanent delete

**Request Example:**
```
DELETE /api/backend/deployments/delete?productType=Catalog&source=CRM&team=data-platform&environment=staging&isPermanent=false
```

**Response Example (Running):**
```json
{
  "success": true,
  "data": {
    "id": "deploy-12345",
    "status": "stopped",
    "message": "Deployment stopped successfully",
    "processedRecords": 325000,
    "totalRecords": 500000,
    "stoppedAt": "2026-03-15T11:45:00Z"
  }
}
```

**Response Example (Completed):**
```json
{
  "success": true,
  "data": {
    "id": "deploy-12345",
    "status": "deleted",
    "message": "Deployment deleted successfully"
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Deployment not found",
  "statusCode": 404
}
```

**Error Response (409):**
```json
{
  "success": false,
  "error": "Cannot delete deployment in current state",
  "currentStatus": "pending",
  "message": "Only running or completed deployments can be modified",
  "statusCode": 409
}
```

**Usage Location:** `src/shared/services/deploymentsService.js:deleteDeployment()`

**Implementation Notes:**
- Returns 409 Conflict if attempting to delete pending deployments
- Gracefully stops running deployments without data corruption
- Provides record counts at time of stoppage

---

## Data Processing APIs

### 10. POST /process

Execute a data transformation pipeline on sample data (used for testing before full deployment).

**Method:** `POST`  
**Path:** `/process`  
**Authentication:** Not required  
**Content-Type:** `application/json`  
**Status Code:** `200 OK` / `400 Bad Request`

**Request Example:**
```json
{
  "data": [
    {
      "customer_id": "C001",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com"
    },
    {
      "customer_id": "C002",
      "first_name": "Jane",
      "last_name": "Smith",
      "email": "jane@example.com"
    }
  ],
  "mappings": [
    {
      "sourceField": "customer_id",
      "targetField": "id"
    },
    {
      "sourceField": "first_name",
      "targetField": "firstName",
      "transformation": "trim"
    },
    {
      "sourceField": "email",
      "targetField": "emailAddress"
    }
  ],
  "filters": [
    {
      "field": "email",
      "operator": "contains",
      "value": "@example.com"
    }
  ]
}
```

**Response Example:**
```json
{
  "success": true,
  "data": {
    "processedRecords": 2,
    "output": [
      {
        "id": "C001",
        "firstName": "John",
        "emailAddress": "john@example.com"
      },
      {
        "id": "C002",
        "firstName": "Jane",
        "emailAddress": "jane@example.com"
      }
    ],
    "statistics": {
      "inputRecords": 2,
      "outputRecords": 2,
      "filteredRecords": 0,
      "transformationErrors": 0,
      "executionTime": 245
    }
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Invalid transformation configuration",
  "details": "Mapping field 'nonexistent' not found in source data",
  "statusCode": 400
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Data processing failed",
  "statusCode": 500
}
```

**Usage Location:** Referenced in integration patterns for data validation workflows

**Implementation Notes:**
- Validates all field mappings exist in source data before processing
- Returns detailed statistics on transformations applied
- Execution time includes transformation and filtering operations

---

## Planned Endpoints (Future Implementation)

### 11. POST /deployments/:id/start

Start/resume a pending or paused deployment.

**Method:** `POST`  
**Path:** `/deployments/{deploymentId}/start`  
**Authentication:** Required (not yet implemented)  
**Status Code:** `200 OK` / `409 Conflict` / `404 Not Found`

**Request Example:**
```json
{
  "resumeFromCheckpoint": false,
  "options": {
    "maxParallelConnections": 4,
    "retryFailedRecords": true
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "deploy-12345",
    "status": "running",
    "startedAt": "2026-03-15T11:00:00Z",
    "message": "Deployment started successfully"
  }
}
```

**Status:** Design pattern documented in `src/shared/components/INTEGRATION_EXAMPLES.jsx`

---

### 12. GET /deployments/:id/status

Get real-time deployment status via polling or Server-Sent Events.

**Method:** `GET`  
**Path:** `/deployments/{deploymentId}/status`  
**Query Parameters:**
- `stream` (optional): Set to `sse` for Server-Sent Events, or omit for polling
- `pollInterval` (optional): Polling interval in milliseconds (default: 5000)

**Status:** Design pattern with SSE and polling implementations documented in `src/shared/components/INTEGRATION_EXAMPLES.jsx`

---

## Error Handling

All endpoints follow consistent error response conventions:

**Standard Error Response Format:**
```json
{
  "success": false,
  "error": "Human-readable error message",
  "statusCode": 400,
  "details": "Optional technical details",
  "validationErrors": {
    "field": "Field-specific error message"
  }
}
```

**Common HTTP Status Codes:**
- `200 OK` — Successful GET or DELETE
- `201 Created` — Successful POST (resource created)
- `400 Bad Request` — Invalid input or validation failure
- `404 Not Found` — Resource does not exist
- `409 Conflict` — Request conflicts with current state
- `500 Internal Server Error` — Server-side error

---

## Mock Mode

All endpoints support a mock mode for development and testing without a backend:

**Activation:** Set `useMock: true` in service configuration (enabled by default in development)

**Mock Behavior:**
- Returns realistic sample data matching production response format
- Simulates delays (50-200ms) for network latency
- Simulates incremental progress for long-running operations
- Provides valid mock IDs and timestamps
- Includes logging for debugging: 🔵 blue for starting, 🟢 green for success, ❌ red for errors

**Example Usage:**
```javascript
const transformers = await fetchTransformers(useMock = true);
// Returns mock data immediately with similar structure
```

---

## Implementation Notes

### Service Architecture
- All services located in `src/shared/services/`
- `configService.js` handles Configuration Management APIs
- `deploymentsService.js` handles Deployment Management APIs
- Each service function includes try-catch error handling and logging

### Current Configuration
- API Base URL: `http://localhost:8080/api` (configurable via `API_BASE` constant)
- Authentication: Not yet implemented (planned for production)
- Rate Limiting: Not implemented
- CORS: Not restricted in development

### Production Deployment
Before deploying to production:
1. Update `API_BASE` URL to production backend
2. Set `useMock: false` in all service configurations
3. Implement authentication/authorization middleware
4. Add rate limiting and request throttling
5. Configure CORS policies
6. Set up API monitoring and logging
7. Implement automatic retry logic with exponential backoff

---

## Additional Resources

- **Integration Examples:** See `src/shared/components/INTEGRATION_EXAMPLES.jsx` for advanced pattern implementations
- **Deployment Modal:** See `src/features/summary/SummaryStep.jsx` for real-world API integration
- **Type Definitions:** See `src/shared/types/index.js` for TypeScript definitions
- **Configuration Service:** See `src/shared/services/configService.js` for implementation details

---

**Last Updated:** March 15, 2026  
**API Version:** 1.0  
**Status:** Production Ready (mock mode active by default)
