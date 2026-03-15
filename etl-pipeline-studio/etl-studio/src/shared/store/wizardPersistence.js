export const LEGACY_WIZARD_STORAGE_KEY = 'etl-studio-wizard-draft'

export function normalizeStorageUserId(userId = '') {
  return String(userId ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
}

export function getWizardStorageKeyForUser(userId) {
  const normalizedUserId = normalizeStorageUserId(userId)
  return normalizedUserId ? `${LEGACY_WIZARD_STORAGE_KEY}:${normalizedUserId}` : LEGACY_WIZARD_STORAGE_KEY
}

function sanitizeMappingMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return metadata

  const { sendToGP, ...rest } = metadata
  return rest
}

function sanitizeMappings(mappings) {
  if (!Array.isArray(mappings)) return []

  return mappings.map(mapping => {
    if (!mapping || typeof mapping !== 'object') return mapping

    return {
      ...mapping,
      srcMetadata: sanitizeMappingMetadata(mapping.srcMetadata),
      tgtMetadata: sanitizeMappingMetadata(mapping.tgtMetadata),
    }
  })
}

export function parsePersistedWizardState(raw) {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    return {
      ...parsed,
      currentStep: Number.isInteger(parsed.currentStep) ? parsed.currentStep : 0,
      completedSteps: new Set(Array.isArray(parsed.completedSteps) ? parsed.completedSteps : []),
      mappings: sanitizeMappings(parsed.mappings),
      filters: Array.isArray(parsed.filters) ? parsed.filters : [],
      metadata: parsed.metadata && typeof parsed.metadata === 'object' ? parsed.metadata : undefined,
      source: parsed.source && typeof parsed.source === 'object' ? parsed.source : undefined,
      upload: parsed.upload && typeof parsed.upload === 'object' ? parsed.upload : undefined,
      targetSchema: Array.isArray(parsed.targetSchema) || (parsed.targetSchema && typeof parsed.targetSchema === 'object') ? parsed.targetSchema : undefined,
      sink: parsed.sink && typeof parsed.sink === 'object' ? parsed.sink : undefined,
      navigationMode: ['menu', 'etl-config', 'etl-management'].includes(parsed.navigationMode) ? parsed.navigationMode : 'menu',
      theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : 'dark',
    }
  } catch {
    return null
  }
}

export function serializeWizardState(state) {
  return JSON.stringify({
    ...state,
    mappings: sanitizeMappings(state.mappings),
    completedSteps: Array.from(state.completedSteps || []),
  })
}

export function loadPersistedWizardState(storageKey) {
  try {
    return parsePersistedWizardState(localStorage.getItem(storageKey))
  } catch {
    return null
  }
}

export function clearPersistedWizardStateForUser(userId) {
  try {
    localStorage.removeItem(getWizardStorageKeyForUser(userId))
  } catch {}
}

export function loadPersistedWizardStateForUser(userId) {
  const scopedStorageKey = getWizardStorageKeyForUser(userId)
  const scopedState = loadPersistedWizardState(scopedStorageKey)
  if (scopedState) return scopedState

  const normalizedUserId = normalizeStorageUserId(userId)
  if (!normalizedUserId) return loadPersistedWizardState(LEGACY_WIZARD_STORAGE_KEY)

  return null
}

export function buildStateFromPersisted(baseState, persistedState) {
  if (!persistedState) return baseState

  return {
    ...baseState,
    ...persistedState,
    navigationMode: baseState.navigationMode, // Always use the base navigationMode, don't restore from persisted
    metadata: persistedState.metadata ? { ...baseState.metadata, ...persistedState.metadata } : baseState.metadata,
    source: persistedState.source ? { ...baseState.source, ...persistedState.source } : baseState.source,
    upload: persistedState.upload ? { ...baseState.upload, ...persistedState.upload } : baseState.upload,
    targetSchema: persistedState.targetSchema ?? baseState.targetSchema,
    sink: persistedState.sink ? { ...baseState.sink, ...persistedState.sink } : baseState.sink,
  }
}

export function buildDefaultWizardStateForUser(baseState, user) {
  if (!user?.userId) return baseState

  return {
    ...baseState,
    navigationMode: 'etl-management',
    metadata: {
      ...baseState.metadata,
      team: user.teamName || baseState.metadata.team,
    },
  }
}
