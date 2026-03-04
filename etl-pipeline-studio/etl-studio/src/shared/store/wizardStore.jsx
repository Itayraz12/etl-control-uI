import { createContext, useContext, useReducer } from 'react'

// ── Initial State ─────────────────────────────────────────────────────────
const initialState = {
  currentStep: 0,
  completedSteps: new Set(),

  // Step 1 — Metadata
  metadata: {
    productSource:  'ERP-System-v2',
    productType:    'Inventory',
    team:           'data-platform',
    environment:    'production',
    entityName:     'Product',
    schemaVersion:  'v2',
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
    dateFormat:      'YYYY-MM-DD',
    rootPath:        '$.data.products[*]',
  },

  // Step 3 — Source Upload
  upload: {
    done: false,
  },

  // Step 4 — Field Mapping
  mappings: [
    { id: 'e1', src: 'productName', tgt: 'name',      warn: false },
    { id: 'e2', src: 'price',       tgt: 'unitPrice',  warn: true  },
    { id: 'e3', src: 'stockQty',    tgt: 'quantity',   warn: false },
    { id: 'e4', src: 'category',    tgt: 'status',     warn: false },
  ],

  // Step 5 — Filters
  filters: [{
    id: 'g1', logic: 'AND',
    rules: [
      { id: 'r1', field: 'isActive', op: 'equals',      value: 'true' },
      { id: 'r2', field: 'price',    op: 'greater than', value: '0'    },
    ],
    subgroups: [{
      id: 'g2', logic: 'OR',
      rules: [
        { id: 'r3', field: 'category', op: 'contains', value: 'Electronics' },
        { id: 'r4', field: 'category', op: 'contains', value: 'Grocery'     },
      ],
      subgroups: [],
    }],
  }],

  // Step 6 — Sink Config
  sink: {
    sinkType:       'kafka',
    sinkKafkaTopic: 'etl.products.v3',
  },
}

// ── Reducer ───────────────────────────────────────────────────────────────
function wizardReducer(state, action) {
  switch (action.type) {
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
    default:
      return state
  }
}

// ── Context ───────────────────────────────────────────────────────────────
const WizardContext = createContext(null)

export function WizardProvider({ children }) {
  const [state, dispatch] = useReducer(wizardReducer, initialState)

  const actions = {
    setStep:        (step)    => dispatch({ type: 'SET_STEP', payload: step }),
    completeStep:   (step)    => dispatch({ type: 'COMPLETE_STEP', payload: step }),
    updateMetadata: (patch)   => dispatch({ type: 'UPDATE_METADATA', payload: patch }),
    updateSource:   (patch)   => dispatch({ type: 'UPDATE_SOURCE',   payload: patch }),
    setUploadDone:  (val)     => dispatch({ type: 'SET_UPLOAD_DONE', payload: val }),
    setMappings:    (maps)    => dispatch({ type: 'SET_MAPPINGS',     payload: maps }),
    setFilters:     (filters) => dispatch({ type: 'SET_FILTERS',      payload: filters }),
    updateSink:     (patch)   => dispatch({ type: 'UPDATE_SINK',      payload: patch }),

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
