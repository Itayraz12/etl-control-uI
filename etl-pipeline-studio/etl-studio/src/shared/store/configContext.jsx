import { createContext, useContext, useState, useCallback, useRef } from 'react'
import {
  fetchTransformers,
  fetchFilters,
  fetchEntities,
  fetchEntitySchema,
  fetchStreamingContinuities,
  fetchRecordsPerDay,
  MOCK_STREAMING_CONTINUITIES,
  MOCK_RECORDS_PER_DAY,
} from '../services/configService.js'

// ── Step indices that need pre-fetched config data ────────────────────────
export const STEP_METADATA      = 0   // needs entities
export const STEP_FILTERS       = 3   // needs filter operators
export const STEP_FIELD_MAPPING = 4   // needs transformers
export const STEP_SUMMARY       = 6   // needs transformers for readable names in YAML preview

const ConfigContext = createContext({
  entities:     [],
  streamingContinuities: MOCK_STREAMING_CONTINUITIES,
  recordsPerDay: MOCK_RECORDS_PER_DAY,
  selectedEntitySchema: [],
  selectedEntitySchemaName: '',
  filters:      [],
  transformers: [],
  loadingMetadata:     false,
  loadingEntitySchema: false,
  entitySchemaError: '',
  loadingEntities:     false,
  loadingFilters:      false,
  loadingTransformers: false,
  prefetchForStep: () => {},
})

export function ConfigProvider({ children }) {
  const [entities,     setEntities]     = useState([])
  const [streamingContinuities, setStreamingContinuities] = useState(MOCK_STREAMING_CONTINUITIES)
  const [recordsPerDay, setRecordsPerDay] = useState(MOCK_RECORDS_PER_DAY)
  const [selectedEntitySchema, setSelectedEntitySchema] = useState([])
  const [selectedEntitySchemaName, setSelectedEntitySchemaName] = useState('')
  const [filters,      setFilters]      = useState([])
  const [transformers, setTransformers] = useState([])

  const [loadingMetadata,     setLoadingMetadata]     = useState(false)
  const [loadingEntitySchema, setLoadingEntitySchema] = useState(false)
  const [entitySchemaError, setEntitySchemaError] = useState('')
  const [loadingEntities,     setLoadingEntities]     = useState(false)
  const [loadingFilters,      setLoadingFilters]      = useState(false)
  const [loadingTransformers, setLoadingTransformers] = useState(false)

  // Refs track in-flight requests — never trigger re-renders, safe as useCallback deps
  const fetchingMetadata     = useRef(false)
  const fetchingEntities     = useRef(false)
  const fetchingEntitySchemaKey = useRef('')
  const handledEntitySchemaKey = useRef('')
  const entitySchemaRequestId = useRef(0)
  const previousStepRef = useRef(null)
  const fetchingFilters      = useRef(false)
  const fetchingTransformers = useRef(false)

  // Stable callback: deps are the setter functions (always stable) and the refs
  const prefetchForStep = useCallback((step, useMock, { entityName = '' } = {}) => {
    const isMetadataStep = step === STEP_METADATA
    const wasMetadataStep = previousStepRef.current === STEP_METADATA
    const isEnteringMetadataStep = isMetadataStep && !wasMetadataStep
    const normalizedEntityName = String(entityName ?? '').trim()

    if (isEnteringMetadataStep) {
      handledEntitySchemaKey.current = ''
    }

    if (!isMetadataStep && wasMetadataStep) {
      entitySchemaRequestId.current += 1
      fetchingEntitySchemaKey.current = ''
      handledEntitySchemaKey.current = ''
      setLoadingEntitySchema(false)
    }

    previousStepRef.current = step

    if (isEnteringMetadataStep && !fetchingMetadata.current) {
      fetchingMetadata.current = true
      fetchingEntities.current = true
      setLoadingMetadata(true)
      setLoadingEntities(true)
      Promise.all([
        fetchEntities(useMock),
        fetchStreamingContinuities(useMock).catch(() => MOCK_STREAMING_CONTINUITIES),
        fetchRecordsPerDay(useMock).catch(() => MOCK_RECORDS_PER_DAY),
      ])
        .then(([nextEntities, nextStreamingContinuities, nextRecordsPerDay]) => {
          setEntities(nextEntities)
          setStreamingContinuities(nextStreamingContinuities)
          setRecordsPerDay(nextRecordsPerDay)
        })
        .catch(console.error)
        .finally(() => {
          fetchingMetadata.current = false
          fetchingEntities.current = false
          setLoadingMetadata(false)
          setLoadingEntities(false)
        })
    }

    if (step === STEP_METADATA) {
      if (!normalizedEntityName) {
        entitySchemaRequestId.current += 1
        fetchingEntitySchemaKey.current = ''
        handledEntitySchemaKey.current = ''
        setSelectedEntitySchemaName('')
        setSelectedEntitySchema([])
        setEntitySchemaError('')
        setLoadingEntitySchema(false)
      } else {
        const requestKey = `${useMock ? 'mock' : 'live'}::${normalizedEntityName.toLowerCase()}`

        if (handledEntitySchemaKey.current !== requestKey && fetchingEntitySchemaKey.current !== requestKey) {
          handledEntitySchemaKey.current = requestKey
          fetchingEntitySchemaKey.current = requestKey
          const currentRequestId = entitySchemaRequestId.current + 1
          entitySchemaRequestId.current = currentRequestId
          setLoadingEntitySchema(true)
          setEntitySchemaError('')

          fetchEntitySchema(normalizedEntityName, useMock)
            .then(schema => {
              if (entitySchemaRequestId.current !== currentRequestId) return
              setSelectedEntitySchemaName(normalizedEntityName)
              setSelectedEntitySchema(schema)
            })
            .catch(error => {
              if (entitySchemaRequestId.current !== currentRequestId) return
              setSelectedEntitySchemaName(normalizedEntityName)
              setSelectedEntitySchema([])
              setEntitySchemaError(error?.message || 'Failed to load entity schema.')
            })
            .finally(() => {
              if (entitySchemaRequestId.current !== currentRequestId) return
              if (fetchingEntitySchemaKey.current === requestKey) {
                fetchingEntitySchemaKey.current = ''
              }
              setLoadingEntitySchema(false)
            })
        }
      }
    }

    if ((step === STEP_FILTERS || step === STEP_SUMMARY) && !fetchingFilters.current) {
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

    if ((step === STEP_FIELD_MAPPING || step === STEP_SUMMARY) && !fetchingTransformers.current) {
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
      streamingContinuities,
      recordsPerDay,
      selectedEntitySchema,
      selectedEntitySchemaName,
      filters,
      transformers,
      loadingMetadata,
      loadingEntitySchema,
      entitySchemaError,
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
