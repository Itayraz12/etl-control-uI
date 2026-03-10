import { createContext, useContext, useReducer, useEffect } from 'react'

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
    entityName:     'Product',
    tags:           '',
  },

  // Step 2 — Source Config
  source: {
    sourceType:      'kafka',
    kafkaBootstrap:  'kafka-1:9092,kafka-2:9092',
    kafkaTopic:      'source.products.raw',
    kafkaGroup:      'etl-wizard-group-01',
    kafkaOffset:     'latest',
    format:          'JSON',
    encoding:        'UTF-8',
  },

  // Step 3 — Source Upload
  upload: {
    done: false,
  },

  // Step 4 — Field Mapping
  mappings: [],

  // Step 5 — Filters
  filters: [],
  kafkaFilters: {
    keys: '',
    mode: 'include', // 'include' | 'exclude'
  },

  // Step 6 — Sink Config
  sink: {
    sinkType:       'kafka',
    sinkKafkaTopic: 'etl.products.v3',
    shadow:         false,
    shadowTopic:    '',
    saknay:         false,
    saknayTopic:    '',
    asg:            false,
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
    case 'SET_KAFKA_FILTERS':
      return { ...state, kafkaFilters: action.payload }
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
  const [state, dispatch] = useReducer(wizardReducer, initialState)

  // apply theme when it changes & persist
  useEffect(() => {
    document.documentElement.dataset.theme = state.theme
    try { localStorage.setItem('theme', state.theme) } catch {}
  }, [state.theme])

  // on mount, load saved theme
  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved === 'light' || saved === 'dark') {
        dispatch({ type: 'SET_THEME', payload: saved })
      }
    } catch {}
  }, [])

  const actions = {
    setNavigationMode: (mode) => dispatch({ type: 'SET_NAVIGATION_MODE', payload: mode }),
    setStep:        (step)    => dispatch({ type: 'SET_STEP', payload: step }),
    completeStep:   (step)    => dispatch({ type: 'COMPLETE_STEP', payload: step }),
    updateMetadata: (patch)   => dispatch({ type: 'UPDATE_METADATA', payload: patch }),
    updateSource:   (patch)   => dispatch({ type: 'UPDATE_SOURCE',   payload: patch }),
    setUploadDone:  (val)     => dispatch({ type: 'SET_UPLOAD_DONE', payload: val }),
    setMappings:    (maps)    => dispatch({ type: 'SET_MAPPINGS',     payload: maps }),
    setFilters:     (filters) => dispatch({ type: 'SET_FILTERS',      payload: filters }),
    setKafkaFilters: (kafkaFilters) => dispatch({ type: 'SET_KAFKA_FILTERS', payload: kafkaFilters }),
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
  }

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
