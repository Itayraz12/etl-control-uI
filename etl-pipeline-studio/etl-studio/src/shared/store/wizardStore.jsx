import { createContext, useContext, useReducer, useEffect, useMemo } from 'react'
import {
  buildDefaultWizardStateForUser,
  buildStateFromPersisted,
  loadPersistedWizardStateForUser,
  serializeWizardState,
} from './wizardPersistence.js'

const initialState = {
  // Global navigation mode
  navigationMode: 'menu', // 'menu' | 'etl-config' | 'etl-management'
  currentStep: 0,
  completedSteps: new Set(),
  // Theme preference
  theme: 'dark',

  // Step 1 — Metadata
  metadata: {
    productSource:  'ERP-System-v2',
    productType:    'Inventory',
    team:           'data-platform',
    environment:    '',
    entityName:     '',
    tags:           '',
  },

  // Step 2 — Source Config
  source: {
    sourceType:           'kafka',
    kafkaEnv:             'production',
    kafkaTopic:           'source_products_raw',
    kafkaKeys:            '',
    kafkaKeyMode:         'include',
    rmqIp:                '',
    rmqPort:              '5672',
    rmqUsername:          '',
    rmqPassword:          '',
    rmqQueue:             '',
    rmqVhost:             '/',
    format:               'JSON',
    csvDelimiter:         ',',
    jsonSplit:            '',
    streamingContinuity:  'continuous',
    recordsPerDay:        'millions',
  },

  // Step 3 — Source Upload
  upload: {
    done: false,
  },

  // Step 4 — Field Mapping
  mappings: [],

  // Step 5 — Filters
  filters: [],

  // Step 6 — Sink Config
  sink: {
    sinkType:        'kafka',
    sinkKafkaTopic:  'etl_products_v3',
    sinkKafkaEnv:    'production',
    shadow:          false,
    shadowTopic:     '',
    saknay:          false,
    saknayTopic:     '',
    asg:             false,
  },
}

// ── Reducer ───────────────────────────────────────────────────────────────
function wizardReducer(state, action) {
  switch (action.type) {
    case 'SET_NAVIGATION_MODE':
      return { ...state, navigationMode: action.payload }
    case 'SET_STEP':
      return { ...state, currentStep: action.payload }
    case 'COMPLETE_STEP':
      return { ...state, completedSteps: new Set([...state.completedSteps, action.payload]) }
    case 'LOAD_STATE': {
      const payload = action.payload || {}
      return {
        ...initialState,
        ...payload,
        theme: state.theme,
        navigationMode: payload.navigationMode ?? initialState.navigationMode,
        currentStep: Number.isInteger(payload.currentStep) ? payload.currentStep : 0,
        completedSteps: new Set(
          payload.completedSteps instanceof Set
            ? Array.from(payload.completedSteps)
            : Array.isArray(payload.completedSteps)
              ? payload.completedSteps
              : []
        ),
        metadata: { ...initialState.metadata, ...(payload.metadata || {}) },
        source: { ...initialState.source, ...(payload.source || {}) },
        upload: { ...initialState.upload, ...(payload.upload || {}) },
        mappings: Array.isArray(payload.mappings) ? payload.mappings : [],
        filters: Array.isArray(payload.filters) ? payload.filters : [],
        sink: { ...initialState.sink, ...(payload.sink || {}) },
      }
    }
    case 'UPDATE_METADATA':
      return { ...state, metadata: { ...state.metadata, ...action.payload } }
    case 'UPDATE_SOURCE':
      return { ...state, source: { ...state.source, ...action.payload } }
    case 'SET_UPLOAD_DONE':
      return { ...state, upload: { ...state.upload, done: action.payload } }
    case 'SET_MAPPINGS':
      return { ...state, mappings: action.payload }
    case 'SET_FILTERS':
      return { ...state, filters: action.payload }
    case 'UPDATE_SINK':
      return { ...state, sink: { ...state.sink, ...action.payload } }
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
    setUploadDone:  (val)     => dispatch({ type: 'SET_UPLOAD_DONE', payload: val }),
    setMappings:    (maps)    => dispatch({ type: 'SET_MAPPINGS',     payload: maps }),
    setFilters:     (filters) => dispatch({ type: 'SET_FILTERS',      payload: filters }),
    updateSink:     (patch)   => dispatch({ type: 'UPDATE_SINK',      payload: patch }),

    setTheme:       (theme)   => dispatch({ type: 'SET_THEME',       payload: theme }),
    toggleTheme:    ()        => dispatch({ type: 'TOGGLE_THEME' }),

    goNext: (current) => {
      dispatch({ type: 'COMPLETE_STEP', payload: current })
      dispatch({ type: 'SET_STEP',      payload: Math.min(current + 1, 6) })
    },
    goBack: (current) => {
      dispatch({ type: 'SET_STEP', payload: Math.max(current - 1, 0) })
    },
    goTo: (step, state) => {
      if (step <= state.currentStep || state.completedSteps.has(step)) {
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
