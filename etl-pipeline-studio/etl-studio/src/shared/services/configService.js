import { MOCK_SCHEMA, normalizeSourceSchema, TARGET_FIELDS } from '../types/index.js'
import { upsertSavedDraftDeployment } from './deploymentsService.js'
import { API_BASE } from './appConfig.js'
import { compactYamlDocument } from './configurationYaml.js'
import { fetchWithUserId } from './requestHeaders.js'

// ── Config Service ─────────────────────────────────────────────────────────
// Loads transformers, filters and entities either from the backend API or
// from the mock data below (when useMock = true).
//
// Live endpoints:
//   Transformers : GET http://localhost:8080/api/config/transformers
//   Filters      : GET http://localhost:8080/api/config/filters
//   Entities     : GET http://localhost:8080/api/backbone/entities
//
// Transformer shape (backend contract):
//   { _id, name, description, format, canonize, inputType, additionalProperties }
//
// inputType enum:
//   NONE   – transformer takes no input field (rare, e.g. constant value producers)
//   SINGLE – transformer takes exactly one input field (default)
//   MULTI  – transformer takes multiple input fields (e.g. Concatenate)

/** @enum {string} */
export const TRANSFORMER_INPUT_AMOUNT = {
  NONE:   'NONE',
  SINGLE: 'SINGLE',
  MULTI:  'MULTI',
}
//
// propsSchema is derived from additionalProperties for BOTH mock and live
// responses, so any new property added on the backend is surfaced in the UI
// automatically without a frontend change.


function asString(value, fallback = '') {
  if (value === undefined || value === null) return fallback
  return String(value)
}

function buildApiUrl(pathname = '', { apiBase = API_BASE, origin } = {}) {
  const normalizedBase = String(apiBase ?? '').trim().replace(/\/+$/, '')
  const normalizedPath = String(pathname ?? '').trim().replace(/^\/+/, '')

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(normalizedBase)) {
    return new URL(`${normalizedBase}/${normalizedPath}`)
  }

  const resolvedOrigin = origin
    ?? globalThis.location?.origin
    ?? 'http://localhost'

  const relativeUrl = `${normalizedBase}/${normalizedPath}`.replace(/\/+/g, '/').replace(/^(?!\/)/, '/')
  return new URL(relativeUrl, resolvedOrigin)
}

export function buildConfigurationYamlUrl(pathname = 'backend/configuration/yaml', query = {}, options = {}) {
  const url = buildApiUrl(pathname, options)
  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.set(key, value ?? '')
  })
  return url.toString()
}

function extractSchemaVersionFromYaml(yaml = '') {
  const match = String(yaml ?? '').match(/^\s*schemaVersion\s*:\s*(.+)$/m)
  return match?.[1]?.trim() || '1.0'
}

// ── Helper ────────────────────────────────────────────────────────────────

/**
 * Builds a propsSchema array from a transformer's additionalProperites map.
 *
 * Each key becomes one editable row in the properties panel.
 * Type inference:
 *   number  → 'number' input
 *   boolean → 'select' with ['true','false'] options
 *   string  → 'text' input
 *
 * Example:
 *   { format: "dd/MM/yyyy", zone: "Asia/Jerusalem", output_format: "yyyy-MM-dd'T'HH:mm:ss" }
 * →
 *   [
 *     { key:'format',        label:'Format',        type:'text', default:"dd/MM/yyyy",            description:'' },
 *     { key:'zone',          label:'Zone',          type:'text', default:"Asia/Jerusalem",         description:'' },
 *     { key:'output_format', label:'Output Format', type:'text', default:"yyyy-MM-dd'T'HH:mm:ss", description:'' },
 *   ]
 */
/**
 * Builds a propsSchema array from a transformer's additionalProperites map.
 *
 * Backend shape: Map<String, Object> where:
 *   - each regular key's value is a plain string/number/boolean that describes
 *     what the property expects (shown as a placeholder/hint in the UI).
 *     The user must supply the actual value — there is no pre-filled default.
 *   - "_required" is a special key whose value is a String[] of mandatory key names;
 *     it is consumed here to mark fields required and is NEVER rendered as a row.
 *
 * NOTE: the API field is "additionalProperties" (correct spelling).
 *       The legacy typo "additionalProperites" is handled by the caller.
 */
function buildPropsSchema(additionalProperties = {}) {
  console.log('[buildPropsSchema] input:', JSON.stringify(additionalProperties))
  const requiredKeys = new Set(
    Array.isArray(additionalProperties._required) ? additionalProperties._required : []
  )

  const result = Object.entries(additionalProperties)
    .filter(([key]) => key !== '_required')
    .map(([key, raw]) => {
      const label    = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      const required = requiredKeys.has(key)

      // Unwrap object wrappers if present; otherwise use raw value directly.
      const val = (raw !== null && typeof raw === 'object' && !Array.isArray(raw))
        ? (raw.default ?? raw.value ?? '')
        : raw

      // The value is a description / hint for the property — not a pre-filled default.
      // Show it as a placeholder so the input starts empty.
      const description = String(val ?? '')

      if (typeof val === 'number') {
        return { key, label, type: 'number', default: '', required, description }
      }
      if (typeof val === 'boolean') {
        // For select controls the first option acts as the initial selection.
        return { key, label, type: 'select', options: ['true', 'false'], default: 'true', required, description }
      }
      return { key, label, type: 'text', default: '', required, description }
    })

  console.log('[buildPropsSchema] output:', JSON.stringify(result))
  return result
}

// ── Mock data (matches backend JSON contracts exactly) ────────────────────

/**
 * Mock transformers — shape mirrors transformers.json
 * propsSchema is intentionally omitted here; it is generated at runtime via
 * buildPropsSchema(additionalProperites), exactly as in the live path.
 * icon is a frontend-only display helper.
 */
const RAW_MOCK_TRANSFORMERS = [
  {
    _id: '00000000-0000-0000-0000-000000000001',
    name: 'Transformer A',
    description: 'Maps source fields to canonical schema',
    format: 'yaml', canonize: true, inputType: 'SINGLE',
    additionalProperties: { version: '1.0', owner: 'team-a' },
    icon: '🗺',
  },
  {
    _id: '00000000-0000-0000-0000-000000000002',
    name: 'Transformer B',
    description: 'Merges multiple inbound payloads',
    format: 'json', canonize: false, inputType: 'MULTI',
    additionalProperties: { version: '2.1', owner: 'team-b' },
    icon: '⊕',
  },
  {
    _id: '00000000-0000-0000-0000-000000000003',
    name: 'AddString',
    description: 'Adds a configured string at a selected position',
    format: 'json', canonize: false, inputType: 'SINGLE',
    additionalProperties: { _required: ['add_value', 'position'], add_value: '', position: 'PREFIX' },
    icon: '＋',
  },
  {
    _id: '00000000-0000-0000-0000-000000000004',
    name: 'ToTimestamp',
    description: 'Convert a date string to a canonical timestamp',
    format: 'string', canonize: false, inputType: 'SINGLE',
    additionalProperties: {
      _required: ['format', 'zone'],
      format:        "dd/MM/yyyy",
      zone:          "Asia/Jerusalem",
      output_format: "yyyy-MM-dd'T'HH:mm:ss",
    },
    icon: '🕐',
  },
  // ── Classic single-field transformers ──────────────────────────────────
  { _id: '00000000-0000-0000-0000-000000000010', name: 'Uppercase',    description: 'Converts the value to upper case',                  format: 'json', canonize: false, inputType: 'SINGLE', additionalProperties: {},                                          icon: 'Aa' },
  { _id: '00000000-0000-0000-0000-000000000011', name: 'Lowercase',    description: 'Converts the value to lower case',                  format: 'json', canonize: false, inputType: 'SINGLE', additionalProperties: {},                                          icon: 'aa' },
  { _id: '00000000-0000-0000-0000-000000000012', name: 'Trim',         description: 'Strips leading/trailing whitespace',                format: 'json', canonize: false, inputType: 'SINGLE', additionalProperties: { side: 'both' },                            icon: '✂'  },
  { _id: '00000000-0000-0000-0000-000000000013', name: 'Concatenate',  description: 'Joins multiple field values with a separator',      format: 'json', canonize: false, inputType: 'MULTI',  additionalProperties: { separator: '', values: '' },               icon: '∥'  },
  { _id: '00000000-0000-0000-0000-000000000014', name: 'Replace',      description: 'Finds and replaces text in the value',              format: 'json', canonize: false, inputType: 'SINGLE', additionalProperties: { find: '', replace: '', regex: 'false' },   icon: 'R'  },
  { _id: '00000000-0000-0000-0000-000000000015', name: 'Substring',    description: 'Extracts a portion of the string value',            format: 'json', canonize: false, inputType: 'SINGLE', additionalProperties: { start: '0', end: '' },                     icon: 'S'  },
  { _id: '00000000-0000-0000-0000-000000000016', name: 'Split',        description: 'Splits the value by a delimiter and picks one part',format: 'json', canonize: false, inputType: 'SINGLE', additionalProperties: { delimiter: ',', index: '0' },              icon: '⊣'  },
  { _id: '00000000-0000-0000-0000-000000000017', name: 'Round',        description: 'Rounds a numeric value to N decimal places',        format: 'json', canonize: false, inputType: 'SINGLE', additionalProperties: { decimals: '2', mode: 'half-up' },          icon: '◯'  },
  { _id: '00000000-0000-0000-0000-000000000018', name: 'Hash',         description: 'Hashes the value with a chosen algorithm',          format: 'json', canonize: false, inputType: 'SINGLE', additionalProperties: { algorithm: 'sha256', encoding: 'hex' },    icon: '#'  },
  // ── No-input (constant) transformers ──────────────────────────────────
  { _id: '00000000-0000-0000-0000-000000000020', name: 'Constant',     description: 'Produces a fixed constant value; ignores source field', format: 'json', canonize: false, inputType: 'NONE',   additionalProperties: { _required: ['value'], value: '' },         icon: '∞'  },
]

/**
 * MOCK_TRANSFORMERS — RAW_MOCK_TRANSFORMERS enriched with propsSchema built
 * from additionalProperties, matching exactly what fetchTransformers returns.
 */
export const MOCK_TRANSFORMERS = RAW_MOCK_TRANSFORMERS.map(t => ({
  ...t,
  propsSchema: buildPropsSchema(t.additionalProperties),
}))

/**
 * Mock filter operators used in the FiltersStep rule builder.
 * Each operator can include additionalProperties with:
 *   - options: Array of predefined values (renders a dropdown)
 *   - properties: Array of property definitions for complex filters (renders multiple inputs)
 */
export const MOCK_FILTER_OPERATORS = [
  { id: 'eq',         name: 'Equals',           symbol: '=',  additionalProperties: {} },
  { id: 'neq',        name: 'Not Equals',        symbol: '≠',  additionalProperties: {} },
  { id: 'gt',         name: 'Greater Than',      symbol: '>',  additionalProperties: {} },
  { id: 'gte',        name: 'Greater or Equal',  symbol: '≥',  additionalProperties: {} },
  { id: 'lt',         name: 'Less Than',         symbol: '<',  additionalProperties: {} },
  { id: 'lte',        name: 'Less or Equal',     symbol: '≤',  additionalProperties: {} },
  { id: 'in',         name: 'In List',           symbol: '∈',  additionalProperties: { options: ['1', '2', '3', '5', '10', 'custom'] } },
  { id: 'nin',        name: 'Not In List',       symbol: '∉',  additionalProperties: { options: ['1', '2', '3', '5', '10', 'custom'] } },
  { id: 'contains',   name: 'Contains',          symbol: '⊇',  additionalProperties: {} },
  { id: 'startswith', name: 'Starts With',       symbol: '⊢',  additionalProperties: {} },
  { id: 'endswith',   name: 'Ends With',         symbol: '⊣',  additionalProperties: {} },
  { id: 'regex',      name: 'Regex Match',       symbol: '~',  additionalProperties: {} },
  { id: 'between',    name: 'Between',           symbol: '↔',  additionalProperties: { 
    properties: [
      { key: 'min_value',    label: 'Min Value',    type: 'number', default: '0' },
      { key: 'max_value',    label: 'Max Value',    type: 'number', default: '100' },
      { key: 'include_edges', label: 'Include Edges', type: 'boolean', default: 'true' }
    ] 
  } },
  { id: 'isnull',     name: 'Is Null',           symbol: '∅',  additionalProperties: {} },
  { id: 'isnotnull',  name: 'Is Not Null',       symbol: '∃',  additionalProperties: {} },
  { id: 'status',     name: 'Status',            symbol: '◉',  additionalProperties: { options: ['active', 'inactive', 'pending', 'archived'] } },
  { id: 'priority',   name: 'Priority Level',    symbol: '▲',  additionalProperties: { options: ['low', 'medium', 'high', 'critical'] } },
  { id: 'inrange',    name: 'In Range',          symbol: '⊗',  additionalProperties: { 
    properties: [
      { key: 'start',   label: 'Start', type: 'number', default: '1' },
      { key: 'end',     label: 'End',   type: 'number', default: '10' },
      { key: 'step',    label: 'Step',  type: 'number', default: '1' }
    ] 
  } },
  { id: 'match',      name: 'Pattern Match',     symbol: '≈',  additionalProperties: { 
    properties: [
      { key: 'pattern',   label: 'Pattern',    type: 'text',    default: '' },
      { key: 'case_sensitive', label: 'Case Sensitive', type: 'boolean', default: 'false' }
    ] 
  } },
]

/**
 * Mock entities — shape mirrors entity.json
 */
export const MOCK_ENTITIES = [
  { id: 'ent-1', name: 'CustomerEntity', type: 'Customer', description: 'Represents a customer profile'  },
  { id: 'ent-2', name: 'OrderEntity',    type: 'Order',    description: 'Represents an order aggregate'  },
  { id: 'ent-3', name: 'ProductEntity',  type: 'Product',  description: 'Represents a catalog product'   },
]

// ── Fetch helpers ─────────────────────────────────────────────────────────

async function fetchJson(url) {
  const res = await fetchWithUserId(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  return res.json()
}

function extractSchemaArray(payload) {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  return payload.schema ?? payload.fields ?? payload.data ?? payload.items ?? []
}

function normalizeSchemaByExamplePayload(payload) {
  const normalizedDirect = normalizeSourceSchema(payload)
  if (normalizedDirect.length > 0) return normalizedDirect
  return normalizeSourceSchema(extractSchemaArray(payload))
}

export function extractSchemaNameFromExamplePayload(payload, fallback = '') {
  if (!payload || Array.isArray(payload)) return asString(fallback)

  const candidate = payload.name
    ?? payload.schemaName
    ?? payload.title
    ?? payload.schema?.name
    ?? payload.schema?.schemaName
    ?? payload.schema?.title

  return asString(candidate, fallback).trim() || asString(fallback)
}

export function buildSchemaByExampleUrl({ sourceFormat } = {}) {
  const normalizedSourceFormat = String(sourceFormat ?? '').trim()
  return normalizedSourceFormat
    ? `${API_BASE}/backend/schemaByExample/${encodeURIComponent(normalizedSourceFormat)}`
    : `${API_BASE}/backend/schemaByExample`
}

export async function fetchEntitySchema(entityName, useMock = true) {
  if (useMock) {
    await new Promise(r => setTimeout(r, 150))
    return normalizeSourceSchema(TARGET_FIELDS)
  }

  const response = await fetchWithUserId(`${API_BASE}/backend/schema/entity/${encodeURIComponent(entityName ?? '')}`, {
    headers: {
      Accept: 'application/json, text/plain',
    },
  })

  if (!response.ok) {
    let message = `Entity schema fetch failed with status: ${response.status}`
    try {
      const text = await response.text()
      if (text) message = text
    } catch {}
    throw new Error(message)
  }

  const contentType = response.headers.get('content-type') || ''
  let payload

  if (contentType.includes('application/json')) {
    payload = await response.json()
  } else {
    const text = await response.text()
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  const schema = normalizeSchemaByExamplePayload(payload)
  if (schema.length === 0) {
    throw new Error('Entity schema returned no fields')
  }

  return schema
}

export async function fetchSchemaByExample({ example, fileName = '', contentType = 'text/plain', sourceFormat = '' }, useMock = true) {
  if (useMock) {
    await new Promise(r => setTimeout(r, 150))
    return {
      title: 'MockSourceSchema',
      name: 'MockSourceSchema',
      schema: normalizeSourceSchema(MOCK_SCHEMA),
    }
  }

  const response = await fetchWithUserId(buildSchemaByExampleUrl({ sourceFormat }), {
    method: 'POST',
    headers: {
      'Content-Type': contentType || 'text/plain',
      Accept: 'application/json, text/plain',
      ...(fileName ? { 'X-File-Name': fileName } : {}),
    },
    body: example ?? '',
  })

  if (!response.ok) {
    let message = `Schema inference failed with status: ${response.status}`
    try {
      const text = await response.text()
      if (text) message = text
    } catch {}
    throw new Error(message)
  }

  const responseType = response.headers.get('content-type') || ''
  let payload

  if (responseType.includes('application/json')) {
    payload = await response.json()
  } else {
    const text = await response.text()
    try {
      payload = JSON.parse(text)
    } catch {
      payload = []
    }
  }

  const schema = normalizeSchemaByExamplePayload(payload)
  if (schema.length === 0) {
    throw new Error('Schema inference returned no fields')
  }

  return payload
}

/**
 * Returns the transformer list.
 *
 * Mock  → MOCK_TRANSFORMERS (propsSchema already built from additionalProperites)
 * Live  → GET http://localhost:8080/api/config/transformers
 *         propsSchema is built dynamically from additionalProperites so any
 *         new property added on the backend is surfaced in the UI automatically.
 *
 * Expected backend item shape:
 *   { _id, name, description, format, canonize, inputType, additionalProperites }
 */
export async function fetchTransformers(useMock = true) {
  if (useMock) {
    await new Promise(r => setTimeout(r, 150))
    return MOCK_TRANSFORMERS
  }
  const raw = await fetchJson(`${API_BASE}/config/transformers`)
  console.log('[configService] raw transformers from API:', JSON.stringify(raw, null, 2))
  return raw.map(t => {
    // API sends "additionalProperties" (correct spelling).
    // Fall back to the legacy typo "additionalProperites" just in case.
    const addProps = t.additionalProperties ?? t.additionalProperites ?? {}
    console.log(`[configService] transformer "${t.name}" additionalProperties:`, addProps)
    const schema = buildPropsSchema(addProps)
    console.log(`[configService] transformer "${t.name}" propsSchema:`, schema)
    return {
      ...t,
      icon: RAW_MOCK_TRANSFORMERS.find(m => m.name === t.name)?.icon ?? '⚙',
      propsSchema: schema,
    }
  })
}

/**
 * Returns the filter operator list.
 *
 * Mock → MOCK_FILTER_OPERATORS
 * Live → GET http://localhost:8080/api/config/filters
 */
export async function fetchFilters(useMock = true) {
  if (useMock) {
    await new Promise(r => setTimeout(r, 150))
    return MOCK_FILTER_OPERATORS
  }
  const raw = await fetchJson(`${API_BASE}/config/filters`)
  return raw.map(f => ({
    id:        f.id,
    name:      f.name,
    symbol:    f.rule || f.id,
    isInclude: f.isInclude,
  }))
}

/**
 * Returns the entity list.
 *
 * Mock → MOCK_ENTITIES
 * Live → GET http://localhost:8080/api/backbone/entities
 */
export async function fetchEntities(useMock = true) {
  if (useMock) {
    await new Promise(r => setTimeout(r, 150))
    return MOCK_ENTITIES
  }
  return fetchJson(`${API_BASE}/backbone/entities`)
}

/**
 * Fetches the saved draft YAML for a pipeline from the backend's
 * `/api/backend/configuration/draft/yaml` endpoint.
 *
 * Used when clicking a saved-version badge in the management table to preview
 * the configuration in a new browser tab.
 */
export async function fetchSavedDraftYaml({ productType, source, team, environment }, useMock = true) {
  if (useMock) {
    await new Promise(r => setTimeout(r, 150))
    // Reuse the same mock payload as fetchDraftConfiguration
    return `# Saved draft – Generated by ETL Pipeline Studio
metadata:
  id: etl-mock-saved
  genomeEntity: Product
  productSource: ${source || 'Mock Source'}
  productType: ${productType || 'Mock Type'}
  environment: ${environment || 'production'}
  owner: ${team || 'default'}
  dataStreamInfo:
    streamingContinuity: continuous
    avgRecordsAmount: millions

source:
  type: kafka
  format: JSON
  topic: source_products_raw
general:
  inputFormat: JSON
  outputFormat: JSON

input:
  mapping:
    - name: id
      type: string
    - name: productName
      type: string
    - name: price
      type: number

output:
  mapping:
    - inName: productName
      outName: name
      sendToGP: true
      sendToSaknay: true
    - inName: price
      outName: unitPrice
      sendToGP: true
      sendToSaknay: true
  transformations:
    - "Uppercase(string, productName) -> (string, name)"
  filters:
    - "(isActive equals true)"

sink:
  type: kafka
  topic: etl_products_v3
`
  }

  const response = await fetchWithUserId(buildConfigurationYamlUrl('backend/configuration/draft/yaml', {
    productType,
    source,
    team,
    environment,
  }), {
    headers: {
      Accept: 'application/yaml, text/yaml, text/plain, application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Fetch saved draft failed with status: ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const payload = await response.json()
    return payload?.yaml ?? payload?.value ?? ''
  }

  return response.text()
}

export async function fetchDraftConfiguration({ productType, source, team, environment }, useMock = true) {
  if (useMock) {
    await new Promise(r => setTimeout(r, 150))
    return `# Generated by ETL Pipeline Studio
metadata:
  id: etl-mock-edit
  genomeEntity: Product
  productSource: ${source || 'Mock Source'}
  productType: ${productType || 'Mock Type'}
  environment: ${environment || 'production'}
  owner: ${team || 'default'}
  dataStreamInfo:
    streamingContinuity: continuous
    avgRecordsAmount: millions

source:
  type: kafka
  format: JSON
  topic: source_products_raw
general:
  inputFormat: JSON
  outputFormat: JSON

input:
  mapping:
    - name: id
      type: string
    - name: productName
      type: string
    - name: price
      type: number

output:
  mapping:
    - inName: productName
      outName: name
      sendToGP: true
      sendToSaknay: true
    - inName: price
      outName: unitPrice
      sendToGP: true
      sendToSaknay: true
  transformations:
    - "Uppercase(string, productName) -> (string, name)"
  filters:
    - "(isActive equals true)"

sink:
  type: kafka
  topic: etl_products_v3
`
  }

  const response = await fetchWithUserId(buildConfigurationYamlUrl('backend/configuration/yaml', {
    productType,
    source,
    team,
    environment,
  }), {
    headers: {
      Accept: 'application/yaml, text/yaml, text/plain, application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Fetch draft failed with status: ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const payload = await response.json()
    return payload?.yaml ?? payload?.value ?? ''
  }

  return response.text()
}

export async function saveDraftConfiguration({ productType, source, team, environment, yaml }) {
  const cleanYaml = compactYamlDocument(yaml)

  const response = await fetchWithUserId(buildConfigurationYamlUrl('backend/configuration/yaml', {
    productType,
    source,
    team,
    environment,
  }), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: cleanYaml,
  })

  if (!response.ok) {
    let message = `Save draft failed with status: ${response.status}`
    try {
      const text = await response.text()
      if (text) message = text
    } catch {}
    throw new Error(message)
  }

  const persistedDraft = {
    teamName: team,
    productSource: source,
    productType,
    environment,
    savedVersion: extractSchemaVersionFromYaml(cleanYaml),
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const payload = await response.json()
    upsertSavedDraftDeployment(persistedDraft)
    return payload
  }

  const text = await response.text()
  upsertSavedDraftDeployment(persistedDraft)

  return { success: true, message: text }
}