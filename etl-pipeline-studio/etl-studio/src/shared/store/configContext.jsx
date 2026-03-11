import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { fetchTransformers, fetchFilters, fetchEntities } from '../services/configService.js'

// ── Step indices that need pre-fetched config data ────────────────────────
export const STEP_METADATA      = 0   // needs entities
export const STEP_FILTERS       = 3   // needs filter operators
export const STEP_FIELD_MAPPING = 4   // needs transformers

const ConfigContext = createContext({
  entities:     [],
  filters:      [],
  transformers: [],
  loadingEntities:     false,
  loadingFilters:      false,
  loadingTransformers: false,
  prefetchForStep: () => {},
})

export function ConfigProvider({ children }) {
  const [entities,     setEntities]     = useState([])
  const [filters,      setFilters]      = useState([])
  const [transformers, setTransformers] = useState([])

  const [loadingEntities,     setLoadingEntities]     = useState(false)
  const [loadingFilters,      setLoadingFilters]      = useState(false)
  const [loadingTransformers, setLoadingTransformers] = useState(false)

  // Refs track in-flight requests — never trigger re-renders, safe as useCallback deps
  const fetchingEntities     = useRef(false)
  const fetchingFilters      = useRef(false)
  const fetchingTransformers = useRef(false)

  // Stable callback: deps are the setter functions (always stable) and the refs
  const prefetchForStep = useCallback((step, useMock) => {
    if (step === STEP_METADATA && !fetchingEntities.current) {
      fetchingEntities.current = true
      setLoadingEntities(true)
      fetchEntities(useMock)
        .then(setEntities)
        .catch(console.error)
        .finally(() => {
          fetchingEntities.current = false
          setLoadingEntities(false)
        })
    }

    if (step === STEP_FILTERS && !fetchingFilters.current) {
      fetchingFilters.current = true
      setLoadingFilters(true)
      fetchFilters(useMock)
        .then(setFilters)
        .catch(console.error)
        .finally(() => {
          fetchingFilters.current = false
          setLoadingFilters(false)
        })
    }

    if (step === STEP_FIELD_MAPPING && !fetchingTransformers.current) {
      fetchingTransformers.current = true
      setLoadingTransformers(true)
      fetchTransformers(useMock)
        .then(setTransformers)
        .catch(console.error)
        .finally(() => {
          fetchingTransformers.current = false
          setLoadingTransformers(false)
        })
    }
  }, []) // no deps — refs and setters are all stable

  return (
    <ConfigContext.Provider value={{
      entities,
      filters,
      transformers,
      loadingEntities,
      loadingFilters,
      loadingTransformers,
      prefetchForStep,
    }}>
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig() {
  return useContext(ConfigContext)
}
