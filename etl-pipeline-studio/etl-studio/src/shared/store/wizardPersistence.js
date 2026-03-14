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

export function parsePersistedWizardState(raw) {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    return {
      ...parsed,
      currentStep: Number.isInteger(parsed.currentStep) ? parsed.currentStep : 0,
      completedSteps: new Set(Array.isArray(parsed.completedSteps) ? parsed.completedSteps : []),
      mappings: Array.isArray(parsed.mappings) ? parsed.mappings : [],
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
