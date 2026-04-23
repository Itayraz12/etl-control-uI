const DEFAULT_API_BASE = 'http://localhost:8080/api'
const DEFAULT_API_BASE_SIM = 'http://localhost:8083/api'
const DEFAULT_PRODUCT_CODE_LABEL = 'Product Code'
const DEFAULT_SHADOW_LABEL = 'SHADOW'
const DEFAULT_ASG_LABEL = 'ASG'
const DEFAULT_SAKNAY_LABEL = 'Saknay'
const DEFAULT_METADATA_LOCATIONS = ['HOME', 'OFFICE']

function normalizeApiBase(value, fallback = DEFAULT_API_BASE) {
  const candidate = String(value ?? '').trim()
  const base = candidate || fallback
  return base.replace(/\/+$/, '')
}

function normalizeVersion(value, fallback = '') {
  const candidate = String(value ?? '').trim()
  return candidate || fallback
}

function normalizeDisplayLabel(value, fallback = '') {
  const candidate = String(value ?? '').trim()
  return candidate || fallback
}

function normalizeMetadataLocations(value, fallback = DEFAULT_METADATA_LOCATIONS) {
  const candidateValues = String(value ?? '')
    .split(',')
    .map(item => item.trim().toUpperCase())
    .filter(Boolean)

  const normalizedValues = Array.from(new Set(candidateValues))
  return normalizedValues.length > 0 ? normalizedValues : [...fallback]
}

function normalizeLabelTokens(value, fallback = '') {
  const candidate = normalizeDisplayLabel(value, fallback)
  const tokens = candidate
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .match(/[A-Za-z\d]+/g)
    ?.map(token => token.trim())
    .filter(Boolean)

  if (Array.isArray(tokens) && tokens.length > 0) {
    return tokens
  }

  const fallbackToken = normalizeDisplayLabel(fallback, 'value').replace(/[^A-Za-z\d]+/g, '') || 'value'
  return [fallbackToken]
}

function normalizeKeyToken(token) {
  const normalized = String(token ?? '').trim().toLowerCase()
  if (!normalized) return ''
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`
}

function buildCamelCaseKey(tokens = []) {
  const normalizedTokens = tokens.map(normalizeKeyToken).filter(Boolean)
  if (normalizedTokens.length === 0) return ''

  const [firstToken, ...restTokens] = normalizedTokens
  return `${firstToken.charAt(0).toLowerCase()}${firstToken.slice(1)}${restTokens.join('')}`
}

function buildPascalCaseKey(tokens = []) {
  return tokens.map(normalizeKeyToken).filter(Boolean).join('')
}

function buildSnakeCaseKey(tokens = []) {
  return tokens
    .map(token => String(token ?? '').trim().toLowerCase())
    .filter(Boolean)
    .join('_')
}

function buildYamlAliasKeys({
  productCodeLabel = DEFAULT_PRODUCT_CODE_LABEL,
  shadowLabel = DEFAULT_SHADOW_LABEL,
  asgLabel = DEFAULT_ASG_LABEL,
  saknayLabel = DEFAULT_SAKNAY_LABEL,
} = {}) {
  const productCodeTokens = normalizeLabelTokens(productCodeLabel, DEFAULT_PRODUCT_CODE_LABEL)
  const shadowTokens = normalizeLabelTokens(shadowLabel, DEFAULT_SHADOW_LABEL)
  const asgTokens = normalizeLabelTokens(asgLabel, DEFAULT_ASG_LABEL)
  const saknayTokens = normalizeLabelTokens(saknayLabel, DEFAULT_SAKNAY_LABEL)

  return {
    productCode: buildCamelCaseKey(productCodeTokens),
    shadowFlag: `is${buildPascalCaseKey(shadowTokens)}Enabled`,
    shadowTopic: `${buildSnakeCaseKey(shadowTokens)}_topic`,
    asgFlag: `is${buildPascalCaseKey(asgTokens)}Enabled`,
    saknayFlag: `is${buildPascalCaseKey(saknayTokens)}Enabled`,
    saknayTopic: `${buildSnakeCaseKey(saknayTokens)}_topic`,
    targetSaknayFlag: `sendTo${buildPascalCaseKey(saknayTokens)}`,
  }
}

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE, DEFAULT_API_BASE)
export const API_BASE_SIM = normalizeApiBase(import.meta.env.VITE_API_BASE_SIM, DEFAULT_API_BASE_SIM)
export const APP_VERSION = normalizeVersion(import.meta.env.VITE_APP_VERSION, __APP_VERSION__)
export const PRODUCT_CODE_LABEL = normalizeDisplayLabel(import.meta.env.VITE_PRODUCT_CODE_LABEL, DEFAULT_PRODUCT_CODE_LABEL)
export const SHADOW_LABEL = normalizeDisplayLabel(import.meta.env.VITE_SHADOW_LABEL, DEFAULT_SHADOW_LABEL)
export const ASG_LABEL = normalizeDisplayLabel(import.meta.env.VITE_ASG_LABEL, DEFAULT_ASG_LABEL)
export const SAKNAY_LABEL = normalizeDisplayLabel(import.meta.env.VITE_SAKNAY_LABEL, DEFAULT_SAKNAY_LABEL)
export const METADATA_LOCATIONS = normalizeMetadataLocations(import.meta.env.VITE_METADATA_LOCATIONS, DEFAULT_METADATA_LOCATIONS)
export const DEFAULT_METADATA_LOCATION = METADATA_LOCATIONS[0] || DEFAULT_METADATA_LOCATIONS[0]
export const SAKNAY_YAML_SECTION_KEY = buildSnakeCaseKey(normalizeLabelTokens(SAKNAY_LABEL, DEFAULT_SAKNAY_LABEL)) || 'saknay'
export const YAML_LABEL_ALIASES = buildYamlAliasKeys({
  productCodeLabel: PRODUCT_CODE_LABEL,
  shadowLabel: SHADOW_LABEL,
  asgLabel: ASG_LABEL,
  saknayLabel: SAKNAY_LABEL,
})
export const PRODUCT_CODE_YAML_KEY = YAML_LABEL_ALIASES.productCode
export const SHADOW_YAML_FLAG_KEY = YAML_LABEL_ALIASES.shadowFlag
export const SHADOW_TOPIC_YAML_KEY = YAML_LABEL_ALIASES.shadowTopic
export const ASG_YAML_FLAG_KEY = YAML_LABEL_ALIASES.asgFlag
export const SAKNAY_YAML_FLAG_KEY = YAML_LABEL_ALIASES.saknayFlag
export const SAKNAY_TOPIC_YAML_KEY = YAML_LABEL_ALIASES.saknayTopic
export const TARGET_SAKNAY_YAML_KEY = YAML_LABEL_ALIASES.targetSaknayFlag

export const APP_CONFIG = {
  apiBase: API_BASE,
  apiBaseSim: API_BASE_SIM,
  version: APP_VERSION,
  productCodeLabel: PRODUCT_CODE_LABEL,
  shadowLabel: SHADOW_LABEL,
  asgLabel: ASG_LABEL,
  saknayLabel: SAKNAY_LABEL,
  metadataLocations: METADATA_LOCATIONS,
  saknaySectionKey: SAKNAY_YAML_SECTION_KEY,
  yamlAliases: YAML_LABEL_ALIASES,
}

export {
  DEFAULT_API_BASE,
  DEFAULT_API_BASE_SIM,
  DEFAULT_PRODUCT_CODE_LABEL,
  DEFAULT_SHADOW_LABEL,
  DEFAULT_ASG_LABEL,
  DEFAULT_SAKNAY_LABEL,
  DEFAULT_METADATA_LOCATIONS,
  normalizeApiBase,
  normalizeVersion,
  normalizeDisplayLabel,
  normalizeMetadataLocations,
  normalizeLabelTokens,
  buildCamelCaseKey,
  buildPascalCaseKey,
  buildSnakeCaseKey,
  buildYamlAliasKeys,
}

