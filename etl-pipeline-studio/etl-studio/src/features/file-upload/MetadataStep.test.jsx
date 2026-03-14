import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MetadataStep from './MetadataStep.jsx'
import { WizardProvider } from '../../shared/store/wizardStore.jsx'

const fetchEntitySchema = vi.fn()

vi.mock('../../shared/services/configService.js', () => ({
  fetchEntitySchema: (...args) => fetchEntitySchema(...args),
}))

vi.mock('../../shared/store/configContext.jsx', () => ({
  useConfig: () => ({
    entities: [
      { id: 'ent-1', name: 'ProductEntity', type: 'Product' },
      { id: 'ent-2', name: 'OrderEntity', type: 'Order' },
    ],
  }),
}))

vi.mock('../../shared/store/userContext.jsx', () => ({
  useUser: () => ({
    user: { userId: 'alice', teamName: 'platform' },
  }),
}))

vi.mock('../../shared/store/mockModeContext.jsx', () => ({
  useMockMode: () => ({ useMock: false, setUseMock: vi.fn() }),
}))

const WIZARD_STORAGE_KEY = 'etl-studio-wizard-draft'

function renderStep(initialState = {}) {
  localStorage.setItem(
    WIZARD_STORAGE_KEY,
    JSON.stringify({
      navigationMode: 'etl-config',
      currentStep: 0,
      completedSteps: [],
      metadata: {
        productSource: 'ERP',
        productType: 'Inventory',
        team: 'platform',
        environment: 'production',
        entityName: '',
        tags: '',
        ...(initialState.metadata || {}),
      },
      source: {
        sourceType: 'kafka',
        kafkaEnv: 'production',
        kafkaTopic: 'source_products_raw',
        format: 'JSON',
        jsonSplit: '',
        streamingContinuity: 'continuous',
        recordsPerDay: 'millions',
      },
      upload: { done: false, schema: [], fileName: '', fileType: '', fileSize: 0 },
      targetSchema: initialState.targetSchema || [],
      mappings: initialState.mappings || [],
      filters: [],
      sink: {
        sinkType: 'kafka',
        sinkKafkaTopic: 'etl_products_v3',
        sinkKafkaEnv: 'production',
        shadow: false,
        shadowTopic: '',
        saknay: false,
        saknayTopic: '',
        asg: false,
      },
      theme: 'dark',
    })
  )

  return render(
    <WizardProvider>
      <MetadataStep />
    </WizardProvider>
  )
}

describe('MetadataStep entity target schema', () => {
  beforeEach(() => {
    fetchEntitySchema.mockReset()
  })

  it('fetches entity schema on selection and persists parsed target fields', async () => {
    const user = userEvent.setup()
    fetchEntitySchema.mockResolvedValue({
      type: 'object',
      required: ['code'],
      properties: {
        code: { type: 'string' },
        price: { type: 'number' },
      },
    })

    renderStep()

    await user.selectOptions(screen.getAllByRole('combobox')[1], 'Product')

    await waitFor(() => {
      expect(fetchEntitySchema).toHaveBeenCalledWith('Product', false)
    })

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.metadata?.entityName).toBe('Product')
      expect(persisted.targetSchema).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'code', type: 'string', required: true }),
          expect.objectContaining({ id: 'price', type: 'number' }),
        ])
      )
    })
  })

  it('clears stale mappings when the entity changes', async () => {
    const user = userEvent.setup()
    fetchEntitySchema.mockResolvedValue([
      { id: 'code', name: 'code', path: 'code', type: 'string', required: true },
    ])

    renderStep({
      metadata: { entityName: 'Order' },
      targetSchema: [{ id: 'orderId', name: 'orderId', path: 'orderId', type: 'string', required: true }],
      mappings: [
        {
          src: 'productName',
          tgt: 'orderId',
          srcNodeId: 'src-productName',
          tgtNodeId: 'tgt-orderId',
          srcPos: { x: 40, y: 30 },
          tgtPos: { x: 650, y: 30 },
          srcMetadata: { sendToSaknay: true, sendToGP: true, expression: '' },
          tgtMetadata: { sendToSaknay: true, sendToGP: true, expression: '' },
          transformer: 'none',
          transformerInputType: 'any',
          transformerOutputType: 'any',
          transformerProps: {},
          extraInputs: [],
        },
      ],
    })

    await user.selectOptions(screen.getAllByRole('combobox')[1], 'Product')

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.metadata?.entityName).toBe('Product')
      expect(persisted.mappings).toEqual([])
      expect(persisted.targetSchema).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'code', type: 'string' }),
        ])
      )
    })
  })
})


