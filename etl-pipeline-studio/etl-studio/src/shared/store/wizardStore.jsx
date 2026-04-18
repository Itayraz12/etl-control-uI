import { createContext, useContext, useReducer, useEffect, useMemo } from 'react'
import {
  buildDefaultWizardStateForUser,
  buildStateFromPersisted,
  loadPersistedWizardStateForUser,
  serializeWizardState,
} from './wizardPersistence.js'
import { normalizeEnvironmentValue, normalizeFilterGroups, normalizeMetadataLocation } from '../types/index.js'

function getPreviewStateStorageKey(search = window.location.search) {
  const params = new URLSearchParams(search)
  const isPreview = params.get('preview') === 'true'
  const deploymentId = params.get('deploymentId')
  const previewSource = params.get('previewSource')

  if (!isPreview || !deploymentId || !['saved', 'deployed'].includes(previewSource)) {
    return null
  }

  return `etl-deployment-preview:${deploymentId}:${previewSource}`
}

const initialState = {
  // Global navigation mode
  navigationMode: 'menu', // 'menu' | 'etl-config' | 'etl-management' | 'etl-admin' | 'udf-admin'
  currentStep: 0,
  furthestStepVisited: 0,
  completedSteps: new Set(),
  originalDraftYaml: '',
  originalDraftSignature: '',
  deploymentContext: null,
  // When true, all wizard inputs/buttons are locked (opened from saved-version preview)
  readOnly: false,
  // Theme preference
  theme: 'dark',

  // Step 1 — Metadata
  metadata: {
    productSource:  'ERP-System-v2',
    productType:    'Inventory',
    productCode:    '',
    location:       '',
    team:           'data-platform',
    environment:    '',
    entityName:     '',
    tags:           '',
  },

  // Step 2 — Source Config
  source: {
    sourceType:           'kafka',
    kafkaEnv:             '',
    kafkaTopic:           '',
    kafkaOffset:          '',
    kafkaKeys:            '',
    kafkaKeyMode:         'include',
    rmqIp:                '',
    rmqPort:              '5672',
    rmqUsername:          '',
    rmqPassword:          '',
    rmqQueue:             '',
    rmqVhost:             '/',
    format:               'JSON',
    csvDelimiter:         '',
    rowDelimiter:         '',
    jsonSplit:            '',
    streamingContinuity:  'continuous',
    recordsPerDay:        'millions',
  },

  // Step 3 — Source Upload
  upload: {
    done: false,
    schema: [],
    schemaName: '',
    fileName: '',
    fileType: '',
    fileSize: 0,
  },

  // Step 4 — Field Mapping
  targetSchema: [],
  mappings: [],

  // Step 5 — Filters
  filters: [],

  // Step 6 — Sink Config
  sink: {
    sinkType:        'kafka',
    sinkKafkaTopic:  '',
    sinkKafkaEnv:    '',
    sinkKafkaAdditionalPropertiesEnabled: false,
    sinkKafkaAdditionalProperties: [],
    shadow:          false,
    shadowTopic:     '',
    saknay:          false,
    saknayTopic:     '',
    asg:             false,
  },
}

function normalizeMetadataState(metadata = {}) {
  const nextMetadata = { ...initialState.metadata, ...(metadata || {}) }
  const environment = normalizeEnvironmentValue(nextMetadata.environment)

  return {
    ...nextMetadata,
    environment,
    location: normalizeMetadataLocation(nextMetadata.location, environment),
  }
}

function normalizeSourceState(source = {}, metadataEnvironment = '') {
  const nextSource = { ...initialState.source, ...(source || {}) }
  const kafkaEnv = normalizeEnvironmentValue(nextSource.kafkaEnv, metadataEnvironment)

  return {
    ...nextSource,
    kafkaEnv,
  }
}

function normalizeSinkState(sink = {}, metadataEnvironment = '') {
  const nextSink = { ...initialState.sink, ...(sink || {}) }
  const sinkKafkaEnv = normalizeEnvironmentValue(nextSink.sinkKafkaEnv, metadataEnvironment)

  return {
    ...nextSink,
    sinkKafkaEnv,
  }
}

function defaultKafkaEnvironments(nextState, previousMetadataEnvironment = '') {
  const metadata = normalizeMetadataState(nextState?.metadata)
  const metadataEnvironment = normalizeEnvironmentValue(metadata?.environment)
  const previousEnvironment = normalizeEnvironmentValue(previousMetadataEnvironment)

  const source = normalizeSourceState(nextState?.source, metadataEnvironment || previousEnvironment)
  const sink = normalizeSinkState(nextState?.sink, metadataEnvironment || previousEnvironment)

  return {
    ...nextState,
    metadata,
    source,
    sink,
  }
}

function syncStepEnvironments(nextState) {
  return nextState
}

function resolveFurthestStepVisited(currentStep = 0, completedSteps = [], furthestStepVisited = null) {
  const completedIndexes = completedSteps instanceof Set
    ? Array.from(completedSteps)
    : Array.isArray(completedSteps)
      ? completedSteps
      : []

  const numericCompletedIndexes = completedIndexes.filter(Number.isInteger)
  const furthestCompletedStep = numericCompletedIndexes.length > 0
    ? Math.max(...numericCompletedIndexes)
    : 0
  const normalizedCurrentStep = Number.isInteger(currentStep) ? currentStep : 0
  const normalizedVisitedStep = Number.isInteger(furthestStepVisited) ? furthestStepVisited : 0

  return Math.max(normalizedCurrentStep, furthestCompletedStep, normalizedVisitedStep)
}

// ── Reducer ───────────────────────────────────────────────────────────────
function wizardReducer(state, action) {
  switch (action.type) {
    case 'SET_NAVIGATION_MODE':
      return { ...state, navigationMode: action.payload }
    case 'SET_STEP':
      return {
        ...state,
        currentStep: action.payload,
        furthestStepVisited: resolveFurthestStepVisited(action.payload, state.completedSteps, state.furthestStepVisited),
      }
    case 'COMPLETE_STEP':
      return {
        ...state,
        completedSteps: new Set([...state.completedSteps, action.payload]),
        furthestStepVisited: resolveFurthestStepVisited(state.currentStep, [...state.completedSteps, action.payload], state.furthestStepVisited),
      }
    case 'LOAD_STATE': {
      const payload = action.payload || {}
      const completedSteps = new Set(
        payload.completedSteps instanceof Set
          ? Array.from(payload.completedSteps)
          : Array.isArray(payload.completedSteps)
            ? payload.completedSteps
            : []
      )
      const currentStep = Number.isInteger(payload.currentStep) ? payload.currentStep : 0

      return defaultKafkaEnvironments({
        ...initialState,
        ...payload,
        theme: state.theme,
        navigationMode: payload.navigationMode ?? initialState.navigationMode,
        readOnly: payload.readOnly === true,
        currentStep,
        furthestStepVisited: resolveFurthestStepVisited(currentStep, completedSteps, payload.furthestStepVisited),
        originalDraftYaml: typeof payload.originalDraftYaml === 'string' ? payload.originalDraftYaml : '',
        originalDraftSignature: typeof payload.originalDraftSignature === 'string' ? payload.originalDraftSignature : '',
        completedSteps,
        metadata: normalizeMetadataState(payload.metadata),
        source: normalizeSourceState(payload.source, normalizeEnvironmentValue(payload?.metadata?.environment)),
        upload: { ...initialState.upload, ...(payload.upload || {}) },
        targetSchema: Array.isArray(payload.targetSchema) || (payload.targetSchema && typeof payload.targetSchema === 'object')
          ? payload.targetSchema
          : [],
        mappings: Array.isArray(payload.mappings) ? payload.mappings : [],
        filters: normalizeFilterGroups(payload.filters),
        sink: normalizeSinkState(payload.sink, normalizeEnvironmentValue(payload?.metadata?.environment)),
      })
    }
    case 'UPDATE_METADATA':
      return defaultKafkaEnvironments({
        ...state,
        metadata: normalizeMetadataState({
          ...state.metadata,
          ...action.payload,
        }),
      }, state.metadata?.environment)
    case 'UPDATE_SOURCE':
      return {
        ...state,
        source: normalizeSourceState({
          ...state.source,
          ...action.payload,
        }, state.metadata?.environment),
      }
    case 'UPDATE_UPLOAD':
      return { ...state, upload: { ...state.upload, ...action.payload } }
    case 'SET_TARGET_SCHEMA':
      return { ...state, targetSchema: action.payload }
    case 'SET_UPLOAD_DONE':
      return { ...state, upload: { ...state.upload, done: action.payload } }
    case 'SET_MAPPINGS':
      return { ...state, mappings: action.payload }
    case 'SET_FILTERS':
      return { ...state, filters: normalizeFilterGroups(action.payload) }
    case 'UPDATE_SINK':
      return {
        ...state,
        sink: normalizeSinkState({
          ...state.sink,
          ...action.payload,
        }, state.metadata?.environment),
      }
    case 'SET_THEME':
      return { ...state, theme: action.payload }
    case 'TOGGLE_THEME':
      return { ...state, theme: state.theme === 'dark' ? 'light' : 'dark' }
    default:
      return state
  }
}

// ── Context ───────────────────────────────────────────────────────────────
const WizardContext = createContext(null)

export function WizardProvider({ children, user = null }) {
  const [state, dispatch] = useReducer(wizardReducer, initialState, (baseState) => {
    // If this window was opened from a management preview URL, peek at the
    // stashed wizard state and use it as the very first render state so we
    // start in read-only etl-config mode immediately.
    if (user?.userId) {
      try {
        const draftKey = getPreviewStateStorageKey()
        if (draftKey) {
          const raw = localStorage.getItem(draftKey)
          if (raw) {
            const { wizardState } = JSON.parse(raw)
            if (wizardState) {
              return defaultKafkaEnvironments({
                ...initialState,
                ...wizardState,
                metadata: normalizeMetadataState(wizardState.metadata),
                filters: normalizeFilterGroups(wizardState.filters),
                readOnly: true,
                theme: 'dark',
                completedSteps: new Set(Array.isArray(wizardState.completedSteps) ? wizardState.completedSteps : []),
                furthestStepVisited: resolveFurthestStepVisited(
                  wizardState.currentStep,
                  Array.isArray(wizardState.completedSteps) ? wizardState.completedSteps : [],
                  wizardState.furthestStepVisited,
                ),
              })
            }
          }
        }
      } catch {
        // fall through to normal persisted-state load
      }
    }

    const persistedState = loadPersistedWizardStateForUser(user?.userId)
    return buildStateFromPersisted(
      buildDefaultWizardStateForUser(baseState, user),
      persistedState,
    )
  })

  // apply theme when it changes & persist
  useEffect(() => {
    document.documentElement.dataset.theme = state.theme
    try { localStorage.setItem('theme', state.theme) } catch {}
  }, [state.theme])

  useEffect(() => {
    // Preview windows are bootstrapped from a deployment-id URL plus a
    // preview-specific localStorage entry. Normal localhost:5173 loads do not
    // carry these params and therefore stay editable.
    const draftKey = getPreviewStateStorageKey()

    if (draftKey && user?.userId) {
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        try {
          const { wizardState } = JSON.parse(raw)
          if (wizardState) {
            dispatch({
              type: 'LOAD_STATE',
              payload: {
                ...wizardState,
                readOnly: true,
              },
            })
            return
          }
        } catch (e) {
          console.error('[WizardProvider] failed to load pending draft:', e)
        }
      }
    }

    const persistedState = loadPersistedWizardStateForUser(user?.userId)
    dispatch({
      type: 'LOAD_STATE',
      payload: buildStateFromPersisted(
        buildDefaultWizardStateForUser(initialState, user),
        persistedState,
      ),
    })
  }, [user?.userId, user?.teamName])

  useEffect(() => {
    try {
      localStorage.setItem(
        user?.userId
          ? `etl-studio-wizard-draft:${String(user.userId).trim().toLowerCase().replace(/\s+/g, '-')}`
          : 'etl-studio-wizard-draft',
        serializeWizardState(state),
      )
    } catch {}
  }, [state, user?.userId])

  const actions = useMemo(() => ({
    setNavigationMode: (mode) => dispatch({ type: 'SET_NAVIGATION_MODE', payload: mode }),
    setStep:        (step)    => dispatch({ type: 'SET_STEP', payload: step }),
    completeStep:   (step)    => dispatch({ type: 'COMPLETE_STEP', payload: step }),
    loadState:      (next)    => dispatch({ type: 'LOAD_STATE', payload: next }),
    updateMetadata: (patch)   => dispatch({ type: 'UPDATE_METADATA', payload: patch }),
    updateSource:   (patch)   => dispatch({ type: 'UPDATE_SOURCE',   payload: patch }),
    updateUpload:   (patch)   => dispatch({ type: 'UPDATE_UPLOAD',   payload: patch }),
    setTargetSchema:(schema)  => dispatch({ type: 'SET_TARGET_SCHEMA', payload: schema }),
    setUploadDone:  (val)     => dispatch({ type: 'SET_UPLOAD_DONE', payload: val }),
    setMappings:    (maps)    => dispatch({ type: 'SET_MAPPINGS',     payload: maps }),
    setFilters:     (filters) => dispatch({ type: 'SET_FILTERS',      payload: filters }),
    updateSink:     (patch)   => dispatch({ type: 'UPDATE_SINK',      payload: patch }),

    toggleTheme:    ()        => dispatch({ type: 'TOGGLE_THEME' }),

    goNext: (current) => {
      dispatch({ type: 'COMPLETE_STEP', payload: current })
      dispatch({ type: 'SET_STEP',      payload: Math.min(current + 1, 6) })
    },
    goBack: (current) => {
      dispatch({ type: 'SET_STEP', payload: Math.max(current - 1, 0) })
    },
    goTo: (step, state) => {
      if (step <= resolveFurthestStepVisited(state.currentStep, state.completedSteps, state.furthestStepVisited)) {
        dispatch({ type: 'SET_STEP', payload: step })
      }
    },
  }), [])

  return (
    <WizardContext.Provider value={{ state, actions }}>
      {children}
    </WizardContext.Provider>
  )
}

export function useWizard() {
  const ctx = useContext(WizardContext)
  if (!ctx) throw new Error('useWizard must be used within WizardProvider')
  return ctx
}
