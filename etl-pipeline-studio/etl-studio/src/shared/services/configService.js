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
//   { _id, name, description, format, canonize, isMultipleInput, additionalProperties }
//
// propsSchema is derived from additionalProperties for BOTH mock and live
// responses, so any new property added on the backend is surfaced in the UI
// automatically without a frontend change.

const API_BASE = 'http://localhost:8080/api'

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
 *   - each regular key's value is a plain primitive (string / number / boolean)
 *     used as the default for that property
 *   - "_required" is a special key whose value is a String[] of mandatory key names;
 *     it is consumed here to mark fields required and is NEVER rendered as a row
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

      // If the backend wraps the value in an object (e.g. { default: "x" } or { value: "x" }),
      // unwrap it — otherwise use the raw value directly as the default.
      const val = (raw !== null && typeof raw === 'object' && !Array.isArray(raw))
        ? (raw.default ?? raw.value ?? '')
        : raw

      if (typeof val === 'number') {
        return { key, label, type: 'number', default: String(val), required, description: '' }
      }
      if (typeof val === 'boolean') {
        return { key, label, type: 'select', options: ['true', 'false'], default: String(val), required, description: '' }
      }
      return { key, label, type: 'text', default: String(val ?? ''), required, description: '' }
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
    format: 'yaml', canonize: true, isMultipleInput: false,
    additionalProperties: { version: '1.0', owner: 'team-a' },
    icon: '🗺',
  },
  {
    _id: '00000000-0000-0000-0000-000000000002',
    name: 'Transformer B',
    description: 'Merges multiple inbound payloads',
    format: 'json', canonize: false, isMultipleInput: true,
    additionalProperties: { version: '2.1', owner: 'team-b' },
    icon: '⊕',
  },
  {
    _id: '00000000-0000-0000-0000-000000000003',
    name: 'AddString',
    description: 'Adds a configured string at a selected position',
    format: 'json', canonize: false, isMultipleInput: false,
    additionalProperties: { _required: ['add_value', 'position'], add_value: '', position: 'PREFIX' },
    icon: '＋',
  },
  {
    _id: '00000000-0000-0000-0000-000000000004',
    name: 'ToTimestamp',
    description: 'Convert a date string to a canonical timestamp',
    format: 'string', canonize: false, isMultipleInput: false,
    additionalProperties: {
      _required: ['format', 'zone'],
      format:        "dd/MM/yyyy",
      zone:          "Asia/Jerusalem",
      output_format: "yyyy-MM-dd'T'HH:mm:ss",
    },
    icon: '🕐',
  },
  // ── Classic single-field transformers ──────────────────────────────────
  { _id: '00000000-0000-0000-0000-000000000010', name: 'Uppercase',    description: 'Converts the value to upper case',                  format: 'json', canonize: false, isMultipleInput: false, additionalProperties: {},                                          icon: 'Aa' },
  { _id: '00000000-0000-0000-0000-000000000011', name: 'Lowercase',    description: 'Converts the value to lower case',                  format: 'json', canonize: false, isMultipleInput: false, additionalProperties: {},                                          icon: 'aa' },
  { _id: '00000000-0000-0000-0000-000000000012', name: 'Trim',         description: 'Strips leading/trailing whitespace',                format: 'json', canonize: false, isMultipleInput: false, additionalProperties: { side: 'both' },                            icon: '✂'  },
  { _id: '00000000-0000-0000-0000-000000000013', name: 'Concatenate',  description: 'Joins multiple field values with a separator',      format: 'json', canonize: false, isMultipleInput: true,  additionalProperties: { separator: '', values: '' },               icon: '∥'  },
  { _id: '00000000-0000-0000-0000-000000000014', name: 'Replace',      description: 'Finds and replaces text in the value',              format: 'json', canonize: false, isMultipleInput: false, additionalProperties: { find: '', replace: '', regex: 'false' },   icon: 'R'  },
  { _id: '00000000-0000-0000-0000-000000000015', name: 'Substring',    description: 'Extracts a portion of the string value',            format: 'json', canonize: false, isMultipleInput: false, additionalProperties: { start: '0', end: '' },                     icon: 'S'  },
  { _id: '00000000-0000-0000-0000-000000000016', name: 'Split',        description: 'Splits the value by a delimiter and picks one part',format: 'json', canonize: false, isMultipleInput: false, additionalProperties: { delimiter: ',', index: '0' },              icon: '⊣'  },
  { _id: '00000000-0000-0000-0000-000000000017', name: 'Round',        description: 'Rounds a numeric value to N decimal places',        format: 'json', canonize: false, isMultipleInput: false, additionalProperties: { decimals: '2', mode: 'half-up' },          icon: '◯'  },
  { _id: '00000000-0000-0000-0000-000000000018', name: 'Hash',         description: 'Hashes the value with a chosen algorithm',          format: 'json', canonize: false, isMultipleInput: false, additionalProperties: { algorithm: 'sha256', encoding: 'hex' },    icon: '#'  },
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
 * Mock filters — shape mirrors filters.json
 */
export const MOCK_FILTERS = [
  { id: 'f-1', name: 'Filter 1', rule: 'severity >= warning',      isInclude: true  },
  { id: 'f-2', name: 'Filter 2', rule: 'source == legacy-system',  isInclude: false },
]

/**
 * Mock filter operators used in the FiltersStep rule builder.
 */
export const MOCK_FILTER_OPERATORS = [
  { id: 'eq',         name: 'Equals',           symbol: '='  },
  { id: 'neq',        name: 'Not Equals',        symbol: '≠'  },
  { id: 'gt',         name: 'Greater Than',      symbol: '>'  },
  { id: 'gte',        name: 'Greater or Equal',  symbol: '≥'  },
  { id: 'lt',         name: 'Less Than',         symbol: '<'  },
  { id: 'lte',        name: 'Less or Equal',     symbol: '≤'  },
  { id: 'in',         name: 'In List',           symbol: '∈'  },
  { id: 'nin',        name: 'Not In List',       symbol: '∉'  },
  { id: 'contains',   name: 'Contains',          symbol: '⊇'  },
  { id: 'startswith', name: 'Starts With',       symbol: '⊢'  },
  { id: 'endswith',   name: 'Ends With',         symbol: '⊣'  },
  { id: 'regex',      name: 'Regex Match',       symbol: '~'  },
  { id: 'between',    name: 'Between',           symbol: '↔'  },
  { id: 'isnull',     name: 'Is Null',           symbol: '∅'  },
  { id: 'isnotnull',  name: 'Is Not Null',       symbol: '∃'  },
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
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  return res.json()
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
 *   { _id, name, description, format, canonize, isMultipleInput, additionalProperites }
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
