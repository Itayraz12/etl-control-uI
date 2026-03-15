// ── Schema Types ──────────────────────────────────────────────────────────

export const FIELD_TYPES = ['string', 'number', 'boolean', 'date', 'object', 'array', 'null']
export const ENVIRONMENTS = ['dev', 'staging', 'production']

/**
 * @typedef {'string'|'number'|'boolean'|'date'|'object'|'array'|'null'} FieldType
 */

/**
 * @typedef {Object} SchemaField
 * @property {string}        id
 * @property {string}        path
 * @property {string}        name
 * @property {FieldType}     type
 * @property {FieldType}     [arrayItemType]
 * @property {SchemaField[]} [children]
 * @property {boolean}       nullable
 * @property {unknown[]}     [sampleValues]
 * @property {string}        [inferredFormat]
 */

/**
 * @typedef {Object} EntityField
 * @property {string}        id
 * @property {string}        name
 * @property {string}        path
 * @property {FieldType}     type
 * @property {boolean}       required
 * @property {string}        [description]
 * @property {EntityField[]} [children]
 */

// ── Wizard State ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} MetadataState
 * @property {string} productSource
 * @property {string} productType
 * @property {string} team
 * @property {'dev'|'staging'|'production'} environment
 * @property {string} entityName
 * @property {string} schemaVersion
 * @property {string} tags
 */

/**
 * @typedef {Object} SourceState
 * @property {'kafka'|'rabbitmq'|'file'|'db'|'http'|'s3'} sourceType
 * @property {string} format
 * @property {string} encoding
 * @property {string} dateFormat
 * @property {string} rootPath
 * @property {string} [kafkaBootstrap]
 * @property {string} [kafkaTopic]
 * @property {string} [kafkaGroup]
 * @property {string} [kafkaOffset]
 */

/**
 * @typedef {Object} FieldMapping
 * @property {string}  id
 * @property {string}  src
 * @property {string}  tgt
 * @property {boolean} warn
 */

/**
 * @typedef {Object} FilterRule
 * @property {string} id
 * @property {string} field
 * @property {string} op
 * @property {string} value
 */

/**
 * @typedef {Object} FilterGroup
 * @property {string}      id
 * @property {'AND'|'OR'}  logic
 * @property {FilterRule[]} rules
 * @property {FilterGroup[]} subgroups
 */

/**
 * @typedef {Object} SinkState
 * @property {'kafka'|'file'|'db'|'http'} sinkType
 * @property {string} [sinkKafkaTopic]
 * @property {string} [sinkKafkaBootstrap]
 * @property {string} [sinkFilePath]
 * @property {string} [sinkDbConn]
 * @property {string} [sinkDbTable]
 * @property {string} [sinkHttpUrl]
 */

export const STEPS = [
  { id: 0, key: 'metadata',      label: 'Metadata'      },
  { id: 1, key: 'source-config', label: 'Source Config' },
  { id: 2, key: 'source-upload', label: 'Source Upload' },
  { id: 3, key: 'filters',       label: 'Filters'       },
  { id: 4, key: 'field-mapping', label: 'Field Mapping' },
  { id: 5, key: 'sink-config',   label: 'Sink Config'   },
  { id: 6, key: 'summary',       label: 'Summary'       },
]

export const SOURCE_TYPES = [
  { id: 'kafka',    icon: '☕', name: 'Kafka',        sub: 'Streaming topic',    mode: 'Streaming' },
  { id: 'rabbitmq', icon: '🐇', name: 'RabbitMQ',     sub: 'Queue',              mode: 'Streaming' },
  { id: 'file',     icon: '📂', name: 'File / Object', sub: 'JSON · CSV',         mode: 'Batch'     },
  { id: 'db',       icon: '🗄️', name: 'Database',     sub: 'PostgreSQL · MySQL', mode: 'Batch'     },
  { id: 'http',     icon: '🌐', name: 'HTTP API',      sub: 'Polling / webhook',  mode: 'Hybrid'    },
  { id: 's3',       icon: '☁️', name: 'S3 / Blob',    sub: 'Batch files',        mode: 'Batch'     },
]

export const MOCK_SCHEMA = [
  { id: 'id',          path: 'id',          name: 'id',          type: 'string',  nullable: false, sampleValues: ['ORD-001'],      required: true  },
  { id: 'productName', path: 'productName', name: 'productName', type: 'string',  nullable: false, sampleValues: ['Widget Pro'],   required: true  },
  { id: 'price',       path: 'price',       name: 'price',       type: 'number',  nullable: true,  sampleValues: [49.99]                           },
  { id: 'stockQty',    path: 'stockQty',    name: 'stockQty',    type: 'number',  nullable: true,  sampleValues: [42], isArray: true               },
  { id: 'category',    path: 'category',    name: 'category',    type: 'string',  nullable: true,  sampleValues: ['Electronics']                   },
  { id: 'isActive',    path: 'isActive',    name: 'isActive',    type: 'boolean', nullable: false, sampleValues: [true]                            },
  { id: 'createdAt',   path: 'createdAt',   name: 'createdAt',   type: 'date',    nullable: true,  sampleValues: ['2024-01-15']                    },
  { id: 'updatedAt',   path: 'updatedAt',   name: 'updatedAt',   type: 'date',    nullable: true,  sampleValues: ['2024-03-01']                    },
]

function normalizeFieldType(rawType, fallback = 'string') {
  const type = Array.isArray(rawType)
    ? String(rawType.find(value => value && String(value).trim().toLowerCase() !== 'null') ?? rawType[0] ?? '').trim().toLowerCase()
    : String(rawType ?? '').trim().toLowerCase()
  if (!type) return fallback
  if (FIELD_TYPES.includes(type)) return type
  if (['integer', 'long', 'double', 'float', 'decimal', 'short'].includes(type)) return 'number'
  if (['bool'].includes(type)) return 'boolean'
  if (['datetime', 'timestamp'].includes(type)) return 'date'
  return fallback
}

function isJsonSchemaObject(schema) {
  return Boolean(
    schema
    && typeof schema === 'object'
    && !Array.isArray(schema)
    && (
      Object.prototype.hasOwnProperty.call(schema, '$schema')
      || Object.prototype.hasOwnProperty.call(schema, 'properties')
      || Object.prototype.hasOwnProperty.call(schema, 'items')
      || Object.prototype.hasOwnProperty.call(schema, 'required')
      || Object.prototype.hasOwnProperty.call(schema, 'type')
    )
  )
}

function resolveJsonPointer(rootSchema, pointer) {
  if (!pointer || typeof pointer !== 'string' || !pointer.startsWith('#/')) return null

  return pointer
    .slice(2)
    .split('/')
    .reduce((current, segment) => {
      if (!current || typeof current !== 'object') return null
      const key = segment.replace(/~1/g, '/').replace(/~0/g, '~')
      return current[key] ?? null
    }, rootSchema)
}

function dereferenceJsonSchema(schema, rootSchema, seenRefs = new Set()) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return schema
  if (!schema.$ref || typeof schema.$ref !== 'string') return schema
  if (seenRefs.has(schema.$ref)) return schema

  const resolved = resolveJsonPointer(rootSchema, schema.$ref)
  if (!resolved || resolved === schema) return schema

  const nextSeenRefs = new Set(seenRefs)
  nextSeenRefs.add(schema.$ref)

  return {
    ...dereferenceJsonSchema(resolved, rootSchema, nextSeenRefs),
    ...schema,
    $ref: undefined,
  }
}

function normalizeJsonSchemaField(path, schema = {}, required = false, rootSchema = null) {
  const resolvedSchema = dereferenceJsonSchema(schema, rootSchema || schema)
  const type = normalizeFieldType(resolvedSchema.type, resolvedSchema.properties ? 'object' : resolvedSchema.items ? 'array' : 'string')
  const id = path || 'root'
  const name = id.includes('.') ? id.split('.').at(-1) : id
  const itemType = resolvedSchema.items
    ? normalizeFieldType(resolvedSchema.items.type, resolvedSchema.items?.properties ? 'object' : 'string')
    : undefined

  return {
    id,
    path: id,
    name,
    type,
    arrayItemType: type === 'array' ? itemType : undefined,
    nullable: Array.isArray(resolvedSchema.type)
      ? resolvedSchema.type.some(value => String(value).trim().toLowerCase() === 'null')
      : Boolean(resolvedSchema.nullable),
    required,
    isArray: type === 'array',
    description: typeof resolvedSchema.description === 'string' ? resolvedSchema.description : undefined,
    inferredFormat: typeof resolvedSchema.format === 'string' ? resolvedSchema.format : undefined,
  }
}

function flattenJsonSchemaProperties(properties = {}, requiredFields = [], basePath = '', rootSchema = null) {
  const requiredSet = new Set(Array.isArray(requiredFields) ? requiredFields : [])

  return Object.entries(properties).flatMap(([key, value]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return []

    const path = basePath ? `${basePath}.${key}` : key
    return flattenJsonSchemaNode(path, value, requiredSet.has(key), rootSchema)
  })
}

function singularizeSchemaSegment(segment = '') {
  const value = String(segment ?? '').trim()
  if (!value) return value
  if (/ies$/i.test(value) && value.length > 3) return value.replace(/ies$/i, 'y')
  if (/(sses|shes|ches|xes|zes)$/i.test(value)) return value.replace(/es$/i, '')
  if (/s$/i.test(value) && !/ss$/i.test(value) && value.length > 1) return value.slice(0, -1)
  return value
}

function buildJsonSchemaArrayPath(path = '') {
  const segments = String(path ?? '').split('.').filter(Boolean)
  if (segments.length === 0) return 'item.*'

  const baseSegments = segments.slice(0, -1)
  const lastSegment = singularizeSchemaSegment(segments[segments.length - 1])
  return [...baseSegments, `${lastSegment}.*`].join('.')
}

function getJsonSchemaArrayItemSchemas(schema = {}, rootSchema = null) {
  const resolvedSchema = dereferenceJsonSchema(schema, rootSchema || schema)
  const tupleItems = Array.isArray(resolvedSchema?.items) ? resolvedSchema.items : []
  const prefixedItems = Array.isArray(resolvedSchema?.prefixItems) ? resolvedSchema.prefixItems : []
  const directItem = resolvedSchema?.items && typeof resolvedSchema.items === 'object' && !Array.isArray(resolvedSchema.items)
    ? [resolvedSchema.items]
    : []

  return [...directItem, ...tupleItems, ...prefixedItems]
    .filter(item => item && typeof item === 'object' && !Array.isArray(item))
}

function flattenJsonSchemaArrayItems(path, itemsSchema, required = false, rootSchema = null) {
  if (!itemsSchema || typeof itemsSchema !== 'object' || Array.isArray(itemsSchema)) return []

  const resolvedItemsSchema = dereferenceJsonSchema(itemsSchema, rootSchema || itemsSchema)

  const arrayPath = buildJsonSchemaArrayPath(path)
  const itemType = normalizeFieldType(
    resolvedItemsSchema.type,
    resolvedItemsSchema.properties ? 'object' : resolvedItemsSchema.items ? 'array' : 'string'
  )

  if (itemType === 'object' && resolvedItemsSchema.properties && typeof resolvedItemsSchema.properties === 'object') {
    return flattenJsonSchemaProperties(resolvedItemsSchema.properties, resolvedItemsSchema.required, arrayPath, rootSchema)
  }

  if (itemType === 'array' && getJsonSchemaArrayItemSchemas(resolvedItemsSchema, rootSchema).length > 0) {
    return [
      normalizeJsonSchemaField(arrayPath, resolvedItemsSchema, required, rootSchema),
      ...getJsonSchemaArrayItemSchemas(resolvedItemsSchema, rootSchema).flatMap(itemSchema => (
        flattenJsonSchemaArrayItems(arrayPath, itemSchema, false, rootSchema)
      )),
    ]
  }

  return [normalizeJsonSchemaField(arrayPath, resolvedItemsSchema, required, rootSchema)]
}

function flattenJsonSchemaNode(path, schema = {}, required = false, rootSchema = null) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return []

  const resolvedSchema = dereferenceJsonSchema(schema, rootSchema || schema)

  const type = normalizeFieldType(resolvedSchema.type, resolvedSchema.properties ? 'object' : resolvedSchema.items ? 'array' : 'string')
  const field = normalizeJsonSchemaField(path, resolvedSchema, required, rootSchema || resolvedSchema)

  if (type === 'object' && resolvedSchema.properties && typeof resolvedSchema.properties === 'object') {
    return flattenJsonSchemaProperties(resolvedSchema.properties, resolvedSchema.required, path, rootSchema || resolvedSchema)
  }

  if (type === 'array') {
    const itemSchemas = getJsonSchemaArrayItemSchemas(resolvedSchema, rootSchema || resolvedSchema)
    if (itemSchemas.length > 0) {
      return [
        field,
        ...itemSchemas.flatMap(itemSchema => flattenJsonSchemaArrayItems(path, itemSchema, required, rootSchema || resolvedSchema)),
      ]
    }
  }

  return [field]
}

function normalizeSourceSchemaFromJsonSchema(schema) {
  if (!isJsonSchemaObject(schema)) return []

  const rootType = normalizeFieldType(schema.type, schema.properties ? 'object' : schema.items ? 'array' : 'string')

  if (rootType === 'object' && schema.properties && typeof schema.properties === 'object') {
    return flattenJsonSchemaProperties(schema.properties, schema.required, '', schema)
  }

  if (rootType === 'array') {
    const itemSchemas = getJsonSchemaArrayItemSchemas(schema, schema)
    if (itemSchemas.length > 0) {
      return itemSchemas.flatMap(itemSchema => flattenJsonSchemaArrayItems('items', itemSchema, false, schema))
    }
  }

  return flattenJsonSchemaNode('value', schema, false, schema)
}

export function normalizeSchemaField(field, index = 0) {
  if (!field) return null

  if (typeof field === 'string') {
    const name = field.trim()
    if (!name) return null
    return {
      id: name,
      path: name,
      name,
      type: 'string',
      nullable: true,
      required: false,
      isArray: false,
    }
  }

  if (typeof field !== 'object' || Array.isArray(field)) return null

  const name = String(field.name ?? field.id ?? field.path ?? field.fieldName ?? `field_${index + 1}`).trim()
  if (!name) return null

  const path = String(field.path ?? field.fieldPath ?? field.id ?? name).trim() || name
  const id = String(field.id ?? field.path ?? field.fieldName ?? name).trim() || name
  const rawType = field.type ?? field.fieldType ?? field.dataType ?? field.valueType ?? (field.isArray ? field.arrayItemType : undefined)
  const type = normalizeFieldType(rawType)
  const required = Boolean(field.required ?? field.isRequired ?? field.mandatory)
  const nullable = field.nullable ?? field.isNullable ?? !required
  const isArray = Boolean(field.isArray ?? field.array ?? normalizeFieldType(rawType, '') === 'array')

  return {
    ...field,
    id,
    path,
    name,
    type,
    nullable: Boolean(nullable),
    required,
    isArray,
    sampleValues: Array.isArray(field.sampleValues)
      ? field.sampleValues
      : Array.isArray(field.examples)
        ? field.examples
        : undefined,
  }
}

export function normalizeSourceSchema(schema) {
  if (isJsonSchemaObject(schema)) {
    return normalizeSourceSchemaFromJsonSchema(schema)
  }

  if (!Array.isArray(schema)) return []
  return schema
    .map((field, index) => normalizeSchemaField(field, index))
    .filter(Boolean)
}

export function resolveSourceSchema(uploadState) {
  const uploadedSchema = normalizeSourceSchema(uploadState?.schema)
  return uploadedSchema.length > 0 ? uploadedSchema : MOCK_SCHEMA
}

export function resolveTargetSchema(targetSchema) {
  const normalizedTargetSchema = normalizeSourceSchema(targetSchema)
  return normalizedTargetSchema.length > 0 ? normalizedTargetSchema : TARGET_FIELDS
}

export const TARGET_FIELDS = [
  { id: 'name',      name: 'name',      type: 'string',  required: true  },
  { id: 'unitPrice', name: 'unitPrice_unitPrice_unitPrice', type: 'number',  required: true  },
  { id: 'quantity',  name: 'quantity',  type: 'number',  required: false },
  { id: 'status',    name: 'status',    type: 'string',  required: false },
  { id: 'sku',       name: 'sku',       type: 'string',  required: false },
  { id: 'isEnabled', name: 'isEnabled', type: 'boolean', required: false },
]

export const TYPE_COLORS = {
  string:  '#22c55e',
  number:  '#f59e0b',
  boolean: '#7c3aed',
  date:    '#4f6ef7',
  object:  '#ec4899',
  array:   '#f97316',
  null:    '#64748b',
}

// ── Mock Data for Frontend (Will be replaced by Java Backend API) ────────────────

export const MOCK_ENTITIES = [
  { id: 'product', name: 'Product', icon: '📦', description: 'Product catalog data' },
  { id: 'customer', name: 'Customer', icon: '👤', description: 'Customer master data' },
  { id: 'order', name: 'Order', icon: '🛒', description: 'Customer orders' },
  { id: 'inventory', name: 'Inventory', icon: '📦', description: 'Stock levels' },
  { id: 'transaction', name: 'Transaction', icon: '💳', description: 'Financial transactions' },
  { id: 'supplier', name: 'Supplier', icon: '🏭', description: 'Supplier information' },
]

export const MOCK_TEAMS = [
  { id: 'data-platform', name: 'Data Platform', icon: '🚀' },
  { id: 'analytics', name: 'Analytics', icon: '📊' },
  { id: 'data-engineering', name: 'Data Engineering', icon: '⚙️' },
  { id: 'bi-team', name: 'Business Intelligence', icon: '📈' },
  { id: 'ml-ops', name: 'ML Ops', icon: '🤖' },
  { id: 'data-governance', name: 'Data Governance', icon: '🔐' },
]

export const MOCK_ENVIRONMENTS = [
  { id: 'dev', name: 'Development', icon: '🔧', color: '#f59e0b' },
  { id: 'staging', name: 'Staging', icon: '🧪', color: '#8b5cf6' },
  { id: 'production', name: 'Production', icon: '✅', color: '#22c55e' },
]

export const MOCK_PRODUCT_SOURCES = [
  { id: 'erp-sap', name: 'SAP ERP', icon: '🏢' },
  { id: 'erp-oracle', name: 'Oracle ERP', icon: '🏢' },
  { id: 'crm-salesforce', name: 'Salesforce CRM', icon: '☁️' },
  { id: 'crm-hubspot', name: 'HubSpot CRM', icon: '☁️' },
  { id: 'warehouse', name: 'Data Warehouse', icon: '🗄️' },
  { id: 'rest-api', name: 'REST API', icon: '🌐' },
  { id: 'database', name: 'Database', icon: '🗄️' },
]

export const MOCK_SINKS = [
  { id: 'kafka', name: 'Kafka', icon: '☕', description: 'Event streaming' },
  { id: 'rabbitmq', name: 'RabbitMQ', icon: '🐇', description: 'Message queue' },
  { id: 'snowflake', name: 'Snowflake', icon: '❄️', description: 'Cloud data warehouse' },
  { id: 'bigquery', name: 'Google BigQuery', icon: '🔵', description: 'Cloud analytics' },
  { id: 'redshift', name: 'Amazon Redshift', icon: '🟠', description: 'Data warehouse' },
  { id: 'postgresql', name: 'PostgreSQL', icon: '🐘', description: 'Relational database' },
  { id: 'mongodb', name: 'MongoDB', icon: '🍃', description: 'NoSQL database' },
]

export const MOCK_FILTER_OPERATORS = [
  { id: 'eq', name: 'Equals', symbol: '=' },
  { id: 'neq', name: 'Not Equals', symbol: '≠' },
  { id: 'gt', name: 'Greater Than', symbol: '>' },
  { id: 'gte', name: 'Greater or Equal', symbol: '≥' },
  { id: 'lt', name: 'Less Than', symbol: '<' },
  { id: 'lte', name: 'Less or Equal', symbol: '≤' },
  { id: 'in', name: 'In List', symbol: '∈' },
  { id: 'nin', name: 'Not In List', symbol: '∉' },
  { id: 'contains', name: 'Contains', symbol: '⊇' },
  { id: 'startswith', name: 'Starts With', symbol: '⊢' },
  { id: 'endswith', name: 'Ends With', symbol: '⊣' },
  { id: 'regex', name: 'Regex Match', symbol: '~' },
  { id: 'between', name: 'Between', symbol: '↔' },
  { id: 'isnull', name: 'Is Null', symbol: '∅' },
  { id: 'isnotnull', name: 'Is Not Null', symbol: '∃' },
]

