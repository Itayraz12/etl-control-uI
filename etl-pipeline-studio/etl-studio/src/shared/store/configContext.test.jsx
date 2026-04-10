import { useEffect } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfigProvider, STEP_FILTERS, STEP_METADATA, useConfig } from './configContext.jsx'

const fetchEntities = vi.fn()
const fetchEntitySchema = vi.fn()
const fetchStreamingContinuities = vi.fn()
const fetchRecordsPerDay = vi.fn()
const fetchFilters = vi.fn()
const fetchTransformers = vi.fn()

vi.mock('../services/configService.js', () => ({
  fetchTransformers: (...args) => fetchTransformers(...args),
  fetchFilters: (...args) => fetchFilters(...args),
  fetchEntities: (...args) => fetchEntities(...args),
  fetchEntitySchema: (...args) => fetchEntitySchema(...args),
  fetchStreamingContinuities: (...args) => fetchStreamingContinuities(...args),
  fetchRecordsPerDay: (...args) => fetchRecordsPerDay(...args),
  MOCK_STREAMING_CONTINUITIES: [
    { value: 'continuous', label: 'Continuous' },
  ],
  MOCK_RECORDS_PER_DAY: [
    { value: 'millions', label: 'A Few Millions' },
  ],
}))

function PrefetchProbe({ step, entityName = '', useMock = false }) {
  const {
    prefetchForStep,
    loadingMetadata,
    loadingEntitySchema,
    entities,
    selectedEntitySchemaName,
  } = useConfig()

  useEffect(() => {
    prefetchForStep(step, useMock, { entityName })
  }, [entityName, prefetchForStep, step, useMock])

  return (
    <div data-testid="status">
      {JSON.stringify({
        loadingMetadata,
        loadingEntitySchema,
        entitiesCount: entities.length,
        selectedEntitySchemaName,
      })}
    </div>
  )
}

describe('ConfigProvider metadata prefetching', () => {
  beforeEach(() => {
    fetchEntities.mockReset()
    fetchEntitySchema.mockReset()
    fetchStreamingContinuities.mockReset()
    fetchRecordsPerDay.mockReset()
    fetchFilters.mockReset()
    fetchTransformers.mockReset()

    fetchEntities.mockResolvedValue([
      { id: 'ent-1', name: 'ProductEntity', type: 'Product' },
      { id: 'ent-2', name: 'OrderEntity', type: 'Order' },
    ])
    fetchStreamingContinuities.mockResolvedValue([
      { value: 'continuous', label: 'Continuous' },
    ])
    fetchRecordsPerDay.mockResolvedValue([
      { value: 'millions', label: 'A Few Millions' },
    ])
    fetchEntitySchema.mockImplementation(async (entityName) => ({
      type: 'object',
      properties: {
        [String(entityName).toLowerCase()]: { type: 'string' },
      },
    }))
    fetchFilters.mockResolvedValue([])
    fetchTransformers.mockResolvedValue([])
  })

  it('does not refetch metadata option lists when only the selected entity changes inside the metadata tab', async () => {
    const view = render(
      <ConfigProvider>
        <PrefetchProbe step={STEP_METADATA} entityName="Product" />
      </ConfigProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('"loadingMetadata":false')
      expect(screen.getByTestId('status')).toHaveTextContent('"selectedEntitySchemaName":"Product"')
    })

    expect(fetchEntities).toHaveBeenCalledTimes(1)
    expect(fetchStreamingContinuities).toHaveBeenCalledTimes(1)
    expect(fetchRecordsPerDay).toHaveBeenCalledTimes(1)
    expect(fetchEntitySchema).toHaveBeenCalledTimes(1)
    expect(fetchEntitySchema).toHaveBeenLastCalledWith('Product', false)

    view.rerender(
      <ConfigProvider>
        <PrefetchProbe step={STEP_METADATA} entityName="Order" />
      </ConfigProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('"selectedEntitySchemaName":"Order"')
    })

    expect(fetchEntities).toHaveBeenCalledTimes(1)
    expect(fetchStreamingContinuities).toHaveBeenCalledTimes(1)
    expect(fetchRecordsPerDay).toHaveBeenCalledTimes(1)
    expect(fetchEntitySchema).toHaveBeenCalledTimes(2)
    expect(fetchEntitySchema).toHaveBeenLastCalledWith('Order', false)
  })

  it('refetches metadata option lists when the user leaves and re-enters the metadata tab', async () => {
    const view = render(
      <ConfigProvider>
        <PrefetchProbe step={STEP_METADATA} entityName="Product" />
      </ConfigProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('"loadingMetadata":false')
      expect(screen.getByTestId('status')).toHaveTextContent('"selectedEntitySchemaName":"Product"')
    })

    view.rerender(
      <ConfigProvider>
        <PrefetchProbe step={STEP_FILTERS} entityName="Product" />
      </ConfigProvider>
    )

    await waitFor(() => {
      expect(fetchFilters).toHaveBeenCalledTimes(1)
    })

    view.rerender(
      <ConfigProvider>
        <PrefetchProbe step={STEP_METADATA} entityName="Product" />
      </ConfigProvider>
    )

    await waitFor(() => {
      expect(fetchEntities).toHaveBeenCalledTimes(2)
      expect(fetchStreamingContinuities).toHaveBeenCalledTimes(2)
      expect(fetchRecordsPerDay).toHaveBeenCalledTimes(2)
      expect(fetchEntitySchema).toHaveBeenCalledTimes(2)
    })
  })
})

