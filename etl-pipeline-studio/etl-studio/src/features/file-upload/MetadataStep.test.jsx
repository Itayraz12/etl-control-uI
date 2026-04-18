import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MetadataStep from './MetadataStep.jsx'
import { WizardProvider } from '../../shared/store/wizardStore.jsx'

let mockUser = { userId: 'alice', teamName: 'platform', role: 'regular' }
let mockConfig = {}

vi.mock('../../shared/services/configService.js', () => ({
  MOCK_STREAMING_CONTINUITIES: [
    { value: 'continuous', label: 'Continuous' },
  ],
  MOCK_RECORDS_PER_DAY: [
    { value: 'millions', label: 'A Few Millions' },
  ],
}))

vi.mock('../../shared/store/configContext.jsx', () => ({
  useConfig: () => mockConfig,
}))

vi.mock('../../shared/store/userContext.jsx', () => ({
  useUser: () => ({
    user: mockUser,
  }),
}))

vi.mock('../../shared/store/mockModeContext.jsx', () => ({
  useMockMode: () => ({ useMock: false, setUseMock: vi.fn() }),
}))

vi.mock('../../shared/store/teamNamesContext.jsx', () => ({
  useTeamNames: () => ({
    teamNames: ['platform', 'analytics', 'Team A'],
    loadingTeamNames: false,
    teamNamesError: '',
    refreshTeamNames: vi.fn(),
  }),
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
        productCode: '',
        location: '',
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

function rerenderStep(view) {
  view.rerender(
    <WizardProvider>
      <MetadataStep />
    </WizardProvider>
  )
}

function setResolvedEntitySchema(entityName, schema, { error = '', loading = false } = {}) {
  mockConfig = {
    ...mockConfig,
    selectedEntitySchemaName: entityName,
    selectedEntitySchema: schema,
    entitySchemaError: error,
    loadingEntitySchema: loading,
  }
}

describe('MetadataStep entity target schema', () => {
  beforeEach(() => {
    mockUser = { userId: 'alice', teamName: 'platform', role: 'regular' }
    mockConfig = {
      entities: [
        { id: 'ent-1', name: 'ProductEntity', type: 'Product' },
        { id: 'ent-2', name: 'OrderEntity', type: 'Order' },
      ],
      streamingContinuities: [
        { value: 'continuous', label: 'Continuous' },
        { value: 'every-day', label: 'Once a Day' },
      ],
      recordsPerDay: [
        { value: 'millions', label: 'A Few Millions' },
        { value: 'thousands', label: 'Thousands' },
      ],
      selectedEntitySchema: [],
      selectedEntitySchemaName: '',
      loadingEntitySchema: false,
      entitySchemaError: '',
    }
  })

  it('shows the logged-in team in a disabled dropdown for regular users', () => {
    renderStep()

    const teamSelect = screen.getByRole('combobox', { name: 'Team' })
    expect(teamSelect).toHaveValue('platform')
    expect(teamSelect).toBeDisabled()
  })

  it('allows admin users to change the team dropdown value', async () => {
    const user = userEvent.setup()
    mockUser = { userId: 'admin-user', teamName: 'platform', role: 'admin' }

    renderStep()

    const teamSelect = screen.getByRole('combobox', { name: 'Team' })
    expect(teamSelect).toBeEnabled()

    await user.selectOptions(teamSelect, 'analytics')

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.metadata?.team).toBe('analytics')
    })
  })

  it('shows only the entity name in the entity dropdown options', () => {
    renderStep()

    expect(screen.getByRole('option', { name: 'ProductEntity' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'OrderEntity' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'ProductEntity (Product)' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'OrderEntity (Order)' })).not.toBeInTheDocument()
  })

  it('renders Data Stream Info in metadata and persists its source settings', async () => {
    const user = userEvent.setup()

    renderStep()

    expect(screen.getByText('📊 Data Stream Info')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Once a Day' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Thousands' })).toBeInTheDocument()
    })

    const streamContinuitySelect = screen.getByDisplayValue('Continuous')
    const recordsPerDaySelect = screen.getByDisplayValue('A Few Millions')

    await user.selectOptions(streamContinuitySelect, 'every-day')
    await user.selectOptions(recordsPerDaySelect, 'thousands')

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.source?.streamingContinuity).toBe('every-day')
      expect(persisted.source?.recordsPerDay).toBe('thousands')
    })

  })

  it('accepts only numeric characters in the product code field', async () => {
    const user = userEvent.setup()

    renderStep()

    expect(screen.getByText('Product Code')).toBeInTheDocument()

    const productCodeInput = screen.getByPlaceholderText('Numbers only')
    await user.type(productCodeInput, 'ab12-34x')

    expect(productCodeInput).toHaveValue('1234')

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.metadata?.productCode).toBe('1234')
    })
  })

  it('allows production to have no default location and select HOME or OFFICE', async () => {
    const user = userEvent.setup()

    renderStep({
      metadata: {
        environment: 'production',
        location: '',
      },
    })

    const locationSelect = screen.getByRole('combobox', { name: 'Location' })

    expect(locationSelect).toHaveValue('')
    expect(screen.getByRole('option', { name: 'HOME' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'OFFICE' })).toBeInTheDocument()

    await user.selectOptions(locationSelect, 'OFFICE')

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.metadata?.location).toBe('OFFICE')
    })
  })

  it('forces non-production environments to HOME only', async () => {
    const user = userEvent.setup()

    renderStep({
      metadata: {
        environment: 'production',
        location: 'OFFICE',
      },
    })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Environment' }), 'staging')

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(screen.getByRole('combobox', { name: 'Location' })).toHaveValue('HOME')
      expect(screen.queryByRole('option', { name: 'OFFICE' })).not.toBeInTheDocument()
      expect(persisted.metadata?.environment).toBe('staging')
      expect(persisted.metadata?.location).toBe('HOME')
    })
  })

  it('shows CAP and PROD in the environment dropdown and hides dev', () => {
    renderStep()

    const environmentSelect = screen.getByRole('combobox', { name: 'Environment' })

    expect(screen.getByRole('option', { name: 'CAP' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'PROD' })).toBeInTheDocument()
    expect(within(environmentSelect).queryByRole('option', { name: /dev/i })).not.toBeInTheDocument()
  })

  it('fetches entity schema on selection and persists parsed target fields', async () => {
    const user = userEvent.setup()
    const view = renderStep()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Entity Name' }), 'Product')

    setResolvedEntitySchema('Product', {
      type: 'object',
      required: ['code'],
      properties: {
        code: { type: 'string' },
        price: { type: 'number' },
      },
    })
    rerenderStep(view)

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
    const view = renderStep({
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
          srcMetadata: { sendToSaknay: true, expression: '' },
          tgtMetadata: { sendToSaknay: true, expression: '' },
          transformer: 'none',
          transformerInputType: 'any',
          transformerOutputType: 'any',
          transformerProps: {},
          extraInputs: [],
        },
      ],
    })

    setResolvedEntitySchema('Order', [
      { id: 'orderId', name: 'orderId', path: 'orderId', type: 'string', required: true },
    ])
    rerenderStep(view)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Entity Name' }), 'Product')

    setResolvedEntitySchema('Product', [
      { id: 'code', name: 'code', path: 'code', type: 'string', required: true },
    ])
    rerenderStep(view)

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

  it('persists nested array target fields when the selected entity schema contains arrays', async () => {
    const user = userEvent.setup()
    const view = renderStep()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Entity Name' }), 'Product')

    setResolvedEntitySchema('Product', {
      type: 'object',
      properties: {
        persons: {
          type: 'array',
          items: {
            type: 'object',
            required: ['firstName'],
            properties: {
              firstName: { type: 'string' },
              lastName: { type: 'string' },
            },
          },
        },
      },
    })
    rerenderStep(view)

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.targetSchema).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'person.*.firstName', type: 'string', required: true }),
          expect.objectContaining({ id: 'person.*.lastName', type: 'string' }),
        ])
      )
    })
  })

  it('persists referenced array target fields like person.*.firstName after entity change', async () => {
    const user = userEvent.setup()
    const view = renderStep()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Entity Name' }), 'Product')

    setResolvedEntitySchema('Product', {
      type: 'object',
      properties: {
        persons: {
          type: 'array',
          items: {
            $ref: '#/$defs/Person',
          },
        },
      },
      $defs: {
        Person: {
          type: 'object',
          required: ['firstName'],
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
          },
        },
      },
    })
    rerenderStep(view)

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.targetSchema).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'person.*.firstName', type: 'string', required: true }),
          expect.objectContaining({ id: 'person.*.lastName', type: 'string' }),
        ])
      )
      expect(persisted.targetSchema).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'persons[]' }),
        ])
      )
    })
  })

  it('uses the prefetched selected entity schema when returning to metadata instead of fetching from the step again', async () => {
    const view = renderStep({
      metadata: { entityName: 'Product' },
    })

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Entity Name' })).toHaveValue('Product')
    })

    setResolvedEntitySchema('Product', [
      { id: 'code', name: 'code', path: 'code', type: 'string', required: true },
    ])
    rerenderStep(view)

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.targetSchema).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'code', type: 'string', required: true }),
        ])
      )
    })
  })
})




