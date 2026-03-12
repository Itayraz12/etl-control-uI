import { createContext, useContext, useReducer, useEffect, useMemo } from 'react'

const WIZARD_STORAGE_KEY = 'etl-studio-wizard-draft'

function loadPersistedWizardState() {
  try {
    const raw = localStorage.getItem(WIZARD_STORAGE_KEY)
    if (!raw) return null
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
      sink: parsed.sink && typeof parsed.sink === 'object' ? parsed.sink : undefined,
      navigationMode: ['menu', 'etl-config', 'etl-management'].includes(parsed.navigationMode) ? parsed.navigationMode : 'menu',
      theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : 'dark',
    }
  } catch {
    return null
  }
}

// ── Initial State ─────────────────────────────────────────────────────────
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
    environment:    'production',
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

export function WizardProvider({ children }) {
  const [state, dispatch] = useReducer(wizardReducer, initialState, (baseState) => {
    const persistedState = loadPersistedWizardState()
    return persistedState ? {
      ...baseState,
      ...persistedState,
      metadata: persistedState.metadata ? { ...baseState.metadata, ...persistedState.metadata } : baseState.metadata,
      source: persistedState.source ? { ...baseState.source, ...persistedState.source } : baseState.source,
      upload: persistedState.upload ? { ...baseState.upload, ...persistedState.upload } : baseState.upload,
      sink: persistedState.sink ? { ...baseState.sink, ...persistedState.sink } : baseState.sink,
    } : baseState
  })

  // apply theme when it changes & persist
  useEffect(() => {
    document.documentElement.dataset.theme = state.theme
    try { localStorage.setItem('theme', state.theme) } catch {}
  }, [state.theme])

  useEffect(() => {
    try {
      localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify({
        ...state,
        completedSteps: Array.from(state.completedSteps),
      }))
    } catch {}
  }, [state])

  // on mount, load saved theme
  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved === 'light' || saved === 'dark') {
        dispatch({ type: 'SET_THEME', payload: saved })
      }
    } catch {}
  }, [])

  const actions = useMemo(() => ({
    setNavigationMode: (mode) => dispatch({ type: 'SET_NAVIGATION_MODE', payload: mode }),
    setStep:        (step)    => dispatch({ type: 'SET_STEP', payload: step }),
    completeStep:   (step)    => dispatch({ type: 'COMPLETE_STEP', payload: step }),
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
