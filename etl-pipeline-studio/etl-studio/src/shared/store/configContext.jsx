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

function normalizeFilterCacheKey(value = '') {
  return String(value ?? '').trim().toLowerCase()
}

function getFilterSelectionKey(operatorLike = {}) {
  const operatorId = normalizeFilterCacheKey(operatorLike?.id ?? operatorLike?.op)
  const isReverted = operatorLike?.isReverted === true
  if (!operatorId) return ''
  return `${operatorId}::${isReverted ? '1' : '0'}`
}

function hasRequiredFilterOperators(cachedFilters = [], requiredGroups = []) {
  const requiredKeys = new Set()

  const visitGroup = (group) => {
    if (!group || typeof group !== 'object') return

    ;(Array.isArray(group.rules) ? group.rules : []).forEach((rule) => {
      const key = getFilterSelectionKey(rule)
      if (key) requiredKeys.add(key)
    })

    ;(Array.isArray(group.subgroups) ? group.subgroups : []).forEach(visitGroup)
  }

  ;(Array.isArray(requiredGroups) ? requiredGroups : []).forEach(visitGroup)

  if (requiredKeys.size === 0) return true

  const cachedKeys = new Set(
    (Array.isArray(cachedFilters) ? cachedFilters : [])
      .map(operator => getFilterSelectionKey(operator))
      .filter(Boolean)
  )

  return Array.from(requiredKeys).every(key => cachedKeys.has(key))
}

function mergeFilterDefinitions(existingFilters = [], nextFilters = []) {
  const merged = [...(Array.isArray(existingFilters) ? existingFilters : [])]
  const existingKeys = new Set(merged.map(operator => getFilterSelectionKey(operator)).filter(Boolean))

  ;(Array.isArray(nextFilters) ? nextFilters : []).forEach((operator) => {
    const key = getFilterSelectionKey(operator)
    if (!key || existingKeys.has(key)) return
    existingKeys.add(key)
    merged.push(operator)
  })

  return merged
}

function normalizeTransformerCacheKey(value = '') {
  return String(value ?? '').trim().toLowerCase()
}

function hasTransformerReference(transformers = [], transformerRef = '') {
  const normalizedRef = normalizeTransformerCacheKey(transformerRef)
  if (!normalizedRef || normalizedRef === 'none') return true

  return (Array.isArray(transformers) ? transformers : []).some(transformer => (
    normalizeTransformerCacheKey(transformer?._id) === normalizedRef
    || normalizeTransformerCacheKey(transformer?.name) === normalizedRef
  ))
}

function getRequiredTransformerReferences(mappings = []) {
  const references = new Set()

  ;(Array.isArray(mappings) ? mappings : []).forEach((mapping) => {
    const directTransformer = String(mapping?.transformer ?? '').trim()
    if (directTransformer && directTransformer !== 'none') {
      references.add(directTransformer)
    }

    ;(Array.isArray(mapping?.transformerChain) ? mapping.transformerChain : []).forEach((entry) => {
      const reference = String(entry?.id ?? entry?.transformer ?? entry?._id ?? entry ?? '').trim()
      if (reference && reference !== 'none') {
        references.add(reference)
      }
    })
  })

  return Array.from(references)
}

function hasRequiredTransformers(cachedTransformers = [], mappings = []) {
  return getRequiredTransformerReferences(mappings)
    .every(reference => hasTransformerReference(cachedTransformers, reference))
}

function mergeTransformerDefinitions(existingTransformers = [], nextTransformers = []) {
  const merged = [...(Array.isArray(existingTransformers) ? existingTransformers : [])]
  const existingRefs = new Set(
    merged.flatMap(transformer => [transformer?._id, transformer?.name].map(normalizeTransformerCacheKey).filter(Boolean))
  )

  ;(Array.isArray(nextTransformers) ? nextTransformers : []).forEach((transformer) => {
    const keys = [transformer?._id, transformer?.name].map(normalizeTransformerCacheKey).filter(Boolean)
    if (keys.length === 0) return
    if (keys.some(key => existingRefs.has(key))) return

    keys.forEach(key => existingRefs.add(key))
    merged.push(transformer)
  })

  return merged
}

function buildFilterEnvironmentCacheKey(useMock, environment = '') {
  const normalizedEnvironment = String(environment ?? '').trim().toUpperCase() || '__default__'
  return `${useMock ? 'mock' : 'live'}::${normalizedEnvironment}`
}

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
  ensureDefinitionsForWizardState: async () => {},
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
  const filtersRef = useRef([])
  const transformersRef = useRef([])
  const filterRequestPromiseRef = useRef(null)
  const transformerRequestPromiseRef = useRef(null)
  const loadedFilterEnvironmentKeysRef = useRef(new Set())

  const setMergedFilters = useCallback((nextFilters) => {
    setFilters((currentFilters) => {
      const mergedFilters = mergeFilterDefinitions(currentFilters, nextFilters)
      filtersRef.current = mergedFilters
      return mergedFilters
    })
  }, [])

  const setMergedTransformers = useCallback((nextTransformers) => {
    setTransformers((currentTransformers) => {
      const mergedTransformers = mergeTransformerDefinitions(currentTransformers, nextTransformers)
      transformersRef.current = mergedTransformers
      return mergedTransformers
    })
  }, [])

  const loadFiltersIfNeeded = useCallback((useMock, { environment = '', requiredFilters = [] } = {}) => {
    const environmentCacheKey = buildFilterEnvironmentCacheKey(useMock, environment)
    const hasEnvironmentCache = loadedFilterEnvironmentKeysRef.current.has(environmentCacheKey)
    const hasRequiredOperators = hasRequiredFilterOperators(filtersRef.current, requiredFilters)

    if (hasEnvironmentCache && hasRequiredOperators) {
      return Promise.resolve(filtersRef.current)
    }

    if (filterRequestPromiseRef.current) {
      return filterRequestPromiseRef.current
    }

    fetchingFilters.current = true
    setLoadingFilters(true)
    filterRequestPromiseRef.current = fetchFilters(useMock, { environment })
      .then((nextFilters) => {
        loadedFilterEnvironmentKeysRef.current.add(environmentCacheKey)
        setMergedFilters(nextFilters)
        return filtersRef.current
      })
      .catch((error) => {
        throw error
      })
      .finally(() => {
        filterRequestPromiseRef.current = null
        fetchingFilters.current = false
        setLoadingFilters(false)
      })

    return filterRequestPromiseRef.current
  }, [setMergedFilters])

  const loadTransformersIfNeeded = useCallback((useMock, { requiredMappings = [] } = {}) => {
    const hasAnyTransformers = transformersRef.current.length > 0
    const hasRequiredTransformerEntries = hasRequiredTransformers(transformersRef.current, requiredMappings)

    if (hasAnyTransformers && hasRequiredTransformerEntries) {
      return Promise.resolve(transformersRef.current)
    }

    if (transformerRequestPromiseRef.current) {
      return transformerRequestPromiseRef.current
    }

    fetchingTransformers.current = true
    setLoadingTransformers(true)
    transformerRequestPromiseRef.current = fetchTransformers(useMock)
      .then((nextTransformers) => {
        setMergedTransformers(nextTransformers)
        return transformersRef.current
      })
      .catch((error) => {
        throw error
      })
      .finally(() => {
        transformerRequestPromiseRef.current = null
        fetchingTransformers.current = false
        setLoadingTransformers(false)
      })

    return transformerRequestPromiseRef.current
  }, [setMergedTransformers])

  const ensureDefinitionsForWizardState = useCallback(async (wizardState = {}, useMock = true, { environment = '' } = {}) => {
    await Promise.all([
      loadFiltersIfNeeded(useMock, {
        environment,
        requiredFilters: wizardState?.filters,
      }),
      loadTransformersIfNeeded(useMock, {
        requiredMappings: wizardState?.mappings,
      }),
    ])
  }, [loadFiltersIfNeeded, loadTransformersIfNeeded])

  // Stable callback: deps are the setter functions (always stable) and the refs
  const prefetchForStep = useCallback((step, useMock, {
    entityName = '',
    environment = '',
    requiredFilters = [],
    requiredMappings = [],
  } = {}) => {
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

    if (step === STEP_FILTERS || step === STEP_SUMMARY) {
      loadFiltersIfNeeded(useMock, {
        environment,
        requiredFilters,
      }).catch(console.error)
    }

    if (step === STEP_FIELD_MAPPING || step === STEP_SUMMARY) {
      loadTransformersIfNeeded(useMock, {
        requiredMappings,
      }).catch(console.error)
    }
  }, [loadFiltersIfNeeded, loadTransformersIfNeeded])

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
      ensureDefinitionsForWizardState,
    }}>
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig() {
  return useContext(ConfigContext)
}
