import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import FieldMappingStep from './FieldMappingStepCanvas.jsx'
import { WizardProvider } from '../../shared/store/wizardStore.jsx'

vi.mock('../../shared/store/configContext.jsx', () => ({
  useConfig: () => ({
    transformers: [
      {
        _id: 'tf-1',
        name: 'Concatenate',
        icon: '∥',
        inputType: 'MULTI',
        propsSchema: [
          { key: 'separator', label: 'Separator', type: 'text', default: '-', required: false, description: '' },
        ],
      },
      {
        _id: 'tf-2',
        name: 'Uppercase',
        icon: 'Aa',
        inputType: 'SINGLE',
        propsSchema: [],
      },
      {
        _id: 'tf-3',
        name: 'MergeFields',
        icon: '⇉',
        inputType: 'MULTI',
        propsSchema: [],
      },
      {
        _id: 'tf-4',
        name: 'ConvertMulti',
        icon: '⚙',
        inputType: 'SINGLE',
        propsSchema: [
          { key: 'logic', label: 'Logic', type: 'text', default: '', required: true, description: 'e.g. a:b:c' },
        ],
      },
      {
        _id: 'tf-4',
        name: 'ConvertMulti',
        icon: '⚙',
        inputType: 'NONE',
        propsSchema: [
          { key: 'InputValue', label: 'InputValue', type: 'text', default: '', required: true, description: 'e.g. good' },
        ],
      }
    ],
  }),
}))

const WIZARD_STORAGE_KEY = 'etl-studio-wizard-draft'
const PREVIEW_USER = { userId: 'alice', teamName: 'platform' }

function seedPreviewState(wizardState) {
  window.history.pushState({}, '', '/?preview=true&deploymentId=dep-1&previewSource=saved')
  localStorage.setItem(
    'etl-deployment-preview:dep-1:saved',
    JSON.stringify({ wizardState })
  )
}

function renderWithPersistedState(mappingOverrides = {}, uploadOverrides = {}, targetSchema = [], options = {}) {
  const { user = null } = options

  localStorage.setItem(
    WIZARD_STORAGE_KEY,
    JSON.stringify({
      navigationMode: 'etl-config',
      currentStep: 4,
      completedSteps: [0, 1, 2, 3],
      metadata: {
        productSource: 'ERP',
        productType: 'Inventory',
        team: 'data-platform',
        environment: 'production',
        entityName: 'Product',
        tags: '',
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
      upload: { done: true, ...uploadOverrides },
      targetSchema,
      mappings: [
        {
          src: 'productName',
          tgt: 'name',
          srcNodeId: 'src-productName',
          tgtNodeId: 'tgt-name',
          srcPos: { x: 40, y: 30 },
          tgtPos: { x: 650, y: 30 },
          srcMetadata: { sendToSaknay: true, expression: '' },
          tgtMetadata: { sendToSaknay: true, expression: '' },
          transformer: 'none',
          transformerInputType: 'any',
          transformerOutputType: 'any',
          transformerProps: {},
          extraInputs: [],
          ...mappingOverrides,
        },
      ],
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
    <WizardProvider user={user}>
      <FieldMappingStep />
    </WizardProvider>
  )
}

function renderWithPersistedMappings(mappings, uploadOverrides = {}, targetSchema = [], options = {}) {
  const { user = null } = options

  localStorage.setItem(
    WIZARD_STORAGE_KEY,
    JSON.stringify({
      navigationMode: 'etl-config',
      currentStep: 4,
      completedSteps: [0, 1, 2, 3],
      metadata: {
        productSource: 'ERP',
        productType: 'Inventory',
        team: 'data-platform',
        environment: 'production',
        entityName: 'Product',
        tags: '',
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
      upload: { done: true, ...uploadOverrides },
      targetSchema,
      mappings,
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
    <WizardProvider user={user}>
      <FieldMappingStep />
    </WizardProvider>
  )
}

describe('FieldMappingStep zoom controls', () => {
  it('disables every rendered button in preview mode', async () => {
    localStorage.clear()
    window.history.pushState({}, '', '/')

    const upload = {
      done: true,
      schema: [
        { id: 'productName', name: 'productName', path: 'productName', type: 'string' },
      ],
      fileName: 'sample.json',
      fileType: 'application/json',
      fileSize: 123,
    }
    const targetSchema = [
      { id: 'name', name: 'name', path: 'name', type: 'string', required: false },
    ]

    seedPreviewState({
      navigationMode: 'etl-config',
      currentStep: 4,
      completedSteps: [0, 1, 2, 3],
      metadata: {
        productSource: 'ERP',
        productType: 'Inventory',
        team: 'platform',
        environment: 'production',
        entityName: 'Product',
        tags: '',
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
      upload,
      targetSchema,
      mappings: [
        {
          src: 'productName',
          tgt: 'name',
          srcNodeId: 'src-productName',
          tgtNodeId: 'tgt-name',
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
    })

    renderWithPersistedState({}, upload, targetSchema, { user: PREVIEW_USER })

    await waitFor(() => {
      expect(screen.getByText('Lineage Canvas')).toBeInTheDocument()
      expect(document.getElementById('nd-src-productName')).toBeInTheDocument()
    })

    const buttons = screen.getAllByRole('button', { hidden: true })
    expect(buttons.length).toBeGreaterThan(0)
    expect(buttons.every(button => button.disabled)).toBe(true)
  })

  it('does not render the Show Transformers button in the mapping toolbar', async () => {
    renderWithPersistedState()

    await waitFor(() => {
      expect(screen.getByText('Lineage Canvas')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: /show transformers/i })).not.toBeInTheDocument()
  })

  it('updates the canvas zoom and allows resetting back to 100%', async () => {
    const user = userEvent.setup()

    renderWithPersistedState()

    const stage = await screen.findByTestId('field-mapping-stage')
    expect(stage).toHaveStyle({ transform: 'scale(1)' })

    await user.click(screen.getByRole('button', { name: 'Zoom in' }))

    await waitFor(() => {
      expect(screen.getByTestId('field-mapping-zoom-reset')).toHaveTextContent('125%')
      expect(stage).toHaveStyle({ transform: 'scale(1.25)' })
    })

    await user.click(screen.getByRole('button', { name: 'Reset zoom' }))

    await waitFor(() => {
      expect(screen.getByTestId('field-mapping-zoom-reset')).toHaveTextContent('100%')
      expect(stage).toHaveStyle({ transform: 'scale(1)' })
    })
  })

  it('moves nodes using unscaled canvas coordinates while zoomed in', async () => {
    const user = userEvent.setup()

    renderWithPersistedState()

    await user.click(screen.getByRole('button', { name: 'Zoom in' }))

    await waitFor(() => {
      expect(document.getElementById('nd-src-productName')).toBeInTheDocument()
    })

    const sourceNode = document.getElementById('nd-src-productName')
    expect(sourceNode).toHaveStyle({ left: '40px', top: '30px' })

    fireEvent.mouseDown(sourceNode, { button: 0, clientX: 100, clientY: 100 })
    fireEvent.mouseMove(document, { clientX: 225, clientY: 100 })
    fireEvent.mouseUp(document)

    await waitFor(() => {
      expect(document.getElementById('nd-src-productName')).toHaveStyle({ left: '140px', top: '30px' })
    })
  })
})

describe('FieldMappingStep transformer modal regression', () => {
  it('keeps transformer selection locked in preview mode while allowing the modal to close', async () => {
    const user = userEvent.setup()
    localStorage.clear()
    window.history.pushState({}, '', '/')

    seedPreviewState({
      navigationMode: 'etl-config',
      currentStep: 4,
      completedSteps: [0, 1, 2, 3],
      metadata: {
        productSource: 'ERP',
        productType: 'Inventory',
        team: 'platform',
        environment: 'production',
        entityName: 'Product',
        tags: '',
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
      upload: {
        done: true,
        schema: [
          { id: 'productName', name: 'productName', path: 'productName', type: 'string' },
        ],
      },
      targetSchema: [
        { id: 'name', name: 'name', path: 'name', type: 'string', required: false },
      ],
      mappings: [
        {
          src: 'productName',
          tgt: 'name',
          srcNodeId: 'src-productName',
          tgtNodeId: 'tgt-name',
          srcPos: { x: 40, y: 30 },
          tgtPos: { x: 650, y: 30 },
          srcMetadata: { sendToSaknay: true, expression: '' },
          tgtMetadata: { sendToSaknay: true, expression: '' },
          transformer: 'tf-1',
          transformerInputType: 'string',
          transformerOutputType: 'string',
          transformerProps: { separator: '-' },
          extraInputs: [],
        },
      ],
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
    })

    renderWithPersistedState({
      transformer: 'tf-1',
      transformerInputType: 'string',
      transformerOutputType: 'string',
      transformerProps: { separator: '-' },
    }, {}, [], { user: PREVIEW_USER })

    const transformerNode = await screen.findByTestId('transformer-node-0-0')
    await user.click(transformerNode)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search transformers...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
      expect(screen.getByRole('button', { name: /save concatenate/i })).toBeDisabled()
      expect(screen.getByText('Separator')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Uppercase'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save concatenate/i })).toBeDisabled()
      expect(screen.getByText('Separator')).toBeInTheDocument()
      expect(screen.queryByText('No additional configurable properties')).not.toBeInTheDocument()
    })

    const closeButton = screen.getAllByRole('button').find(button => button.textContent === '×')
    expect(closeButton).toBeDefined()
    expect(closeButton).toBeEnabled()
    await user.click(closeButton)

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search transformers...')).not.toBeInTheDocument()
    })

    await user.click(await screen.findByTestId('transformer-node-0-0'))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search transformers...')).not.toBeInTheDocument()
    })
  })

  it('opens the transformer modal when clicking the add-transformer plus on a connection', async () => {
    const user = userEvent.setup()
    renderWithPersistedState()

    const plusTrigger = await screen.findByTestId('add-transformer-trigger-0')
    await user.click(plusTrigger)

    await waitFor(() => {
      expect(screen.getByText('Add Transformer')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Search transformers...')).toBeInTheDocument()
      expect(screen.getByText('Concatenate')).toBeInTheDocument()
    })
  })

  it('applies a transformer without showing input or output type controls', async () => {
    const user = userEvent.setup()
    renderWithPersistedState()

    const plusTrigger = await screen.findByTestId('add-transformer-trigger-0')
    await user.click(plusTrigger)

    await user.click(await screen.findByText('Concatenate'))

    await waitFor(() => {
      expect(screen.queryByText('Input Type')).not.toBeInTheDocument()
      expect(screen.queryByText('Output Type')).not.toBeInTheDocument()
      expect(screen.getByText('Separator')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '✓ Apply Concatenate' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '✓ Apply Concatenate' }))

    await waitFor(() => {
      expect(screen.getByText('Concatenate')).toBeInTheDocument()

      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.mappings?.[0]?.transformer).toBe('tf-1')
      expect(persisted.mappings?.[0]?.transformerProps).toEqual({ separator: '-' })
    })
  })

  it('supports chaining multiple transformers on a single connection', async () => {
    const user = userEvent.setup()

    renderWithPersistedState({
      transformer: 'tf-1',
      transformerProps: { separator: '-' },
      extraInputs: [],
    })

    await waitFor(() => {
      expect(screen.getByText('Concatenate')).toBeInTheDocument()
    })

    fireEvent.contextMenu(screen.getByText('Concatenate'))
    await user.click(await screen.findByText('Add Transformer After'))

    await user.click(await screen.findByText('Uppercase'))
    await user.click(screen.getByRole('button', { name: '✓ Apply Uppercase' }))

    await waitFor(() => {
      expect(screen.getByText('Concatenate')).toBeInTheDocument()
      expect(screen.getByText('Uppercase')).toBeInTheDocument()
    })

    const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
    expect(persisted.mappings?.[0]?.transformer).toBe('tf-1')
    expect(persisted.mappings?.[0]?.transformerChain).toEqual(['tf-1', 'tf-2'])
    expect(persisted.mappings?.[0]?.transformerChainDetailed).toEqual([
      { id: 'tf-1', props: { separator: '-' } },
      { id: 'tf-2', props: {} },
    ])
  })

  it('allows connecting an extra source to the third transformer when that transformer is multi-input', async () => {
    renderWithPersistedMappings([
      {
        src: 'productName',
        tgt: 'name',
        srcNodeId: 'src-productName',
        tgtNodeId: 'tgt-name',
        srcPos: { x: 40, y: 30 },
        tgtPos: { x: 650, y: 30 },
        srcMetadata: { sendToSaknay: true, expression: '' },
        tgtMetadata: { sendToSaknay: true, expression: '' },
        transformer: 'tf-2',
        transformerProps: {},
        transformerChain: [
          { id: 'tf-2', props: {} },
          { id: 'tf-2', props: {} },
          { id: 'tf-3', props: {} },
          { id: 'tf-2', props: {} },
        ],
        extraInputs: [],
      },
      {
        src: 'price',
        tgt: 'id',
        srcNodeId: 'src-price',
        tgtNodeId: 'tgt-id',
        srcPos: { x: 40, y: 220 },
        tgtPos: { x: 650, y: 220 },
        srcMetadata: { sendToSaknay: true, expression: '' },
        tgtMetadata: { sendToSaknay: true, expression: '' },
        transformer: 'none',
        transformerProps: {},
        extraInputs: [],
      },
    ])

    await waitFor(() => {
      expect(screen.getByText('MergeFields')).toBeInTheDocument()
      expect(screen.getByTestId('source-port-src-price')).toBeInTheDocument()
    })

    const sourcePort = screen.getByTestId('source-port-src-price')
    fireEvent.mouseDown(sourcePort, { button: 0, clientX: 300, clientY: 230 })
    fireEvent.mouseUp(document, { clientX: 430, clientY: 151 })

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      const firstMapping = persisted.mappings?.[0]
      expect(firstMapping?.extraInputs?.some(input => input?.nodeId === 'src-price')).toBe(true)
      const extra = firstMapping?.extraInputs?.find(input => input?.nodeId === 'src-price')
      expect(extra?.transformerIndex).toBe(2)
      expect(document.getElementById('nd-src-productName')).toHaveStyle({ top: '30px' })
      expect(document.getElementById('nd-tgt-name')).toHaveStyle({ top: '114px' })
      expect(document.getElementById('nd-src-price')).toHaveStyle({ top: '198px' })
      expect(document.getElementById('nd-tgt-id')).toHaveStyle({ top: '282px' })
    })
  })

  it('renders a loaded transformer when the saved mapping stores the transformer by name', async () => {
    renderWithPersistedState({
      transformer: 'Concatenate',
      transformerInputType: 'string',
      transformerOutputType: 'string',
      transformerProps: { separator: '-' },
    })

    await waitFor(() => {
      expect(screen.getByText('Concatenate')).toBeInTheDocument()
      expect(screen.queryByTestId('add-transformer-trigger-0')).not.toBeInTheDocument()
    })
  })

  it('adds source and target fields to the canvas on double click without creating duplicates', async () => {
    const user = userEvent.setup()

    renderWithPersistedMappings([])

    const sourceItem = await screen.findByTestId('source-list-item-price')
    const targetItem = await screen.findByTestId('target-list-item-unitPrice')

    await user.dblClick(sourceItem)
    await user.dblClick(targetItem)

    await waitFor(() => {
      expect(document.querySelectorAll('[id^="nd-source-price-"]').length).toBe(1)
      expect(document.querySelectorAll('[id^="nd-target-unitPrice-"]').length).toBe(1)
    })

    await user.dblClick(sourceItem)
    await user.dblClick(targetItem)

    await waitFor(() => {
      expect(document.querySelectorAll('[id^="nd-source-price-"]').length).toBe(1)
      expect(document.querySelectorAll('[id^="nd-target-unitPrice-"]').length).toBe(1)
    })
  })

  it('uses the uploaded response schema as the source-field list', async () => {
    renderWithPersistedMappings([], {
      schema: {
        type: 'object',
        required: ['customerId'],
        properties: {
          customerId: { type: 'string' },
          netAmount: { type: 'number' },
          customer: {
            type: 'object',
            properties: {
              email: { type: 'string' },
            },
          },
        },
      },
    })

    await waitFor(() => {
      expect(screen.getByTestId('source-list-item-customerId')).toBeInTheDocument()
      expect(screen.getByTestId('source-list-item-netAmount')).toBeInTheDocument()
      expect(screen.getByTestId('source-list-item-customer.email')).toBeInTheDocument()
    })

    expect(screen.getByTestId('source-list-name-customer.email')).toHaveTextContent('customer.email')
    expect(screen.queryByTestId('source-list-item-productName')).not.toBeInTheDocument()
    expect(screen.queryByTestId('source-list-item-price')).not.toBeInTheDocument()
    expect(screen.queryByTestId('source-list-item-customer')).not.toBeInTheDocument()
  })

  it('uses the selected entity schema as the target-field list', async () => {
    renderWithPersistedMappings([], {}, {
      type: 'object',
      required: ['product.code'],
      properties: {
        'product.code': { type: 'string' },
        totalAmount: { type: 'number' },
      },
    })

    await waitFor(() => {
      expect(screen.getByTestId('target-list-item-product.code')).toBeInTheDocument()
      expect(screen.getByTestId('target-list-item-totalAmount')).toBeInTheDocument()
    })

    expect(screen.getByTestId('target-list-name-product.code')).toHaveTextContent('product.code')
    expect(screen.queryByTestId('target-list-item-unitPrice')).not.toBeInTheDocument()
  })

  it('shows required markers only for target fields', async () => {
    renderWithPersistedMappings([], {
      schema: {
        type: 'object',
        required: ['customerId'],
        properties: {
          customerId: { type: 'string' },
        },
      },
    }, {
      type: 'object',
      required: ['product.code'],
      properties: {
        'product.code': { type: 'string' },
      },
    })

    const sourceItem = await screen.findByTestId('source-list-item-customerId')
    const targetItem = await screen.findByTestId('target-list-item-product.code')

    expect(within(sourceItem).queryByText('*')).not.toBeInTheDocument()
    expect(within(targetItem).getByText('*')).toBeInTheDocument()
  })

  it('shows referenced array target fields from the selected entity schema', async () => {
    renderWithPersistedMappings([], {}, {
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
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
          },
        },
      },
    })

    await waitFor(() => {
      expect(screen.queryByTestId('target-list-item-persons')).not.toBeInTheDocument()
      expect(screen.getByTestId('target-list-item-person.*.firstName')).toBeInTheDocument()
      expect(screen.getByTestId('target-list-item-person.*.lastName')).toBeInTheDocument()
    })

    expect(screen.getByTestId('target-list-name-person.*.firstName')).toHaveTextContent('person.*.firstName')
    expect(screen.queryByTestId('target-list-item-persons[]')).not.toBeInTheDocument()
  })

  it('auto-aligns saved source and target nodes when entering the field mapping tab', async () => {
    renderWithPersistedState({
      srcPos: { x: 210, y: 190 },
      tgtPos: { x: 520, y: 420 },
    })

    await waitFor(() => {
      expect(document.getElementById('nd-src-productName')).toHaveStyle({ left: '40px', top: '30px' })
      expect(document.getElementById('nd-tgt-name')).toHaveStyle({ left: '650px', top: '30px' })
    })
  })

  it('aligns unconnected source and target nodes onto the same row', async () => {
    const user = userEvent.setup()

    renderWithPersistedMappings([], {
      schema: {
        type: 'object',
        properties: {
          price: { type: 'number' },
        },
      },
    }, {
      type: 'object',
      properties: {
        unitPrice: { type: 'number' },
      },
    })

    const sourceItem = await screen.findByTestId('source-list-item-price')
    const targetItem = await screen.findByTestId('target-list-item-unitPrice')

    await user.dblClick(sourceItem)
    await user.dblClick(targetItem)

    await waitFor(() => {
      expect(document.querySelector('[id^="nd-source-price-"]')).toBeInTheDocument()
      expect(document.querySelector('[id^="nd-target-unitPrice-"]')).toBeInTheDocument()
    })

    const sourceNode = document.querySelector('[id^="nd-source-price-"]')
    const targetNode = document.querySelector('[id^="nd-target-unitPrice-"]')

    expect(sourceNode).toHaveStyle({ top: '30px' })
    expect(targetNode).not.toHaveStyle({ top: '30px' })

    await user.click(screen.getByRole('button', { name: 'Align' }))

    await waitFor(() => {
      expect(document.querySelector('[id^="nd-source-price-"]')).toHaveStyle({ left: '40px', top: '30px' })
      expect(document.querySelector('[id^="nd-target-unitPrice-"]')).toHaveStyle({ left: '650px', top: '30px' })
    })
  })

  it('toggles the target Saknay badge and persists the updated target metadata', async () => {
    renderWithPersistedState()

    const saknayToggle = await screen.findByTestId('target-saknay-toggle-tgt-name')
    expect(saknayToggle).toHaveTextContent('Saknay')
    expect(saknayToggle).toHaveAttribute('title', 'Send to Saknay: Yes')
    expect(screen.queryByText('GP')).not.toBeInTheDocument()

    fireEvent.click(saknayToggle)

    await waitFor(() => {
      expect(screen.getByTestId('target-saknay-toggle-tgt-name')).toHaveAttribute('title', 'Send to Saknay: No')

      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.mappings?.[0]?.tgtMetadata?.sendToSaknay).toBe(false)
    })
  })

  it('bulk toggles Saknay for all target fields shown on the canvas and persists every target metadata value', async () => {
    const user = userEvent.setup()

    renderWithPersistedMappings([
      {
        src: 'productName',
        tgt: 'name',
        srcNodeId: 'src-productName',
        tgtNodeId: 'tgt-name',
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
      {
        src: 'price',
        tgt: 'unitPrice',
        srcNodeId: 'src-price',
        tgtNodeId: 'tgt-unitPrice',
        srcPos: { x: 40, y: 140 },
        tgtPos: { x: 650, y: 140 },
        srcMetadata: { sendToSaknay: true, expression: '' },
        tgtMetadata: { sendToSaknay: false, expression: '' },
        transformer: 'none',
        transformerInputType: 'any',
        transformerOutputType: 'any',
        transformerProps: {},
        extraInputs: [],
      },
    ], {
      schema: [
        { id: 'productName', name: 'productName', path: 'productName', type: 'string' },
        { id: 'price', name: 'price', path: 'price', type: 'number' },
      ],
      fileName: 'sample.json',
      fileType: 'application/json',
      fileSize: 123,
    }, [
      { id: 'name', name: 'name', path: 'name', type: 'string', required: false },
      { id: 'unitPrice', name: 'unitPrice', path: 'unitPrice', type: 'number', required: false },
    ])

    await waitFor(() => {
      expect(screen.getByTestId('target-saknay-toggle-tgt-name')).toHaveAttribute('title', 'Send to Saknay: Yes')
      expect(screen.getByTestId('target-saknay-toggle-tgt-unitPrice')).toHaveAttribute('title', 'Send to Saknay: No')
    })

    const bulkToggle = screen.getByRole('button', { name: 'Enable Saknay for all target fields' })
    expect(bulkToggle).toHaveTextContent('Enable All Saknay')

    await user.click(bulkToggle)

    await waitFor(() => {
      expect(screen.getByTestId('target-saknay-toggle-tgt-name')).toHaveAttribute('title', 'Send to Saknay: Yes')
      expect(screen.getByTestId('target-saknay-toggle-tgt-unitPrice')).toHaveAttribute('title', 'Send to Saknay: Yes')

      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.mappings?.map(mapping => mapping.tgtMetadata?.sendToSaknay)).toEqual([true, true])
    })

    await user.click(screen.getByRole('button', { name: 'Disable Saknay for all target fields' }))

    await waitFor(() => {
      expect(screen.getByTestId('target-saknay-toggle-tgt-name')).toHaveAttribute('title', 'Send to Saknay: No')
      expect(screen.getByTestId('target-saknay-toggle-tgt-unitPrice')).toHaveAttribute('title', 'Send to Saknay: No')

      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.mappings?.map(mapping => mapping.tgtMetadata?.sendToSaknay)).toEqual([false, false])
    })
  })

  it('shows an exp badge on target nodes only when the expression is not empty', async () => {
    renderWithPersistedState({
      tgtMetadata: { sendToSaknay: true, expression: 'price * 1.2' },
    })

    await waitFor(() => {
      expect(screen.getByTestId('target-expression-badge-tgt-name')).toHaveTextContent('exp')
      expect(document.getElementById('nd-tgt-name')).toHaveStyle({ height: '74px' })
    })

    expect(screen.queryByTestId('target-expression-badge-src-productName')).not.toBeInTheDocument()
  })

  it('wraps long field names in the side lists and on canvas nodes', async () => {
    renderWithPersistedState({
      tgt: 'unitPrice',
      tgtNodeId: 'tgt-unitPrice',
    })

    await waitFor(() => {
      expect(screen.getByTestId('target-list-name-unitPrice')).toHaveStyle({ whiteSpace: 'normal' })
      expect(screen.getByTestId('target-list-name-unitPrice')).toHaveStyle({ overflowWrap: 'anywhere' })
      expect(screen.getByTestId('canvas-node-name-tgt-unitPrice')).toHaveStyle({ whiteSpace: 'normal' })
      expect(screen.getByTestId('canvas-node-name-tgt-unitPrice')).toHaveStyle({ overflowWrap: 'anywhere' })
    })
  })

  it('does not show an exp badge when the target expression is empty or whitespace', async () => {
    renderWithPersistedState({
      tgtMetadata: { sendToSaknay: true, expression: '   ' },
    })

    await waitFor(() => {
      expect(screen.getByTestId('target-saknay-toggle-tgt-name')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('target-expression-badge-tgt-name')).not.toBeInTheDocument()
  })

  it('does not open the context menu when right clicking a source node', async () => {
    renderWithPersistedState()

    const sourceNode = await waitFor(() => document.getElementById('nd-src-productName'))
    fireEvent.contextMenu(sourceNode)

    await waitFor(() => {
      expect(screen.queryByTestId('ctxmenu-saknay-toggle')).not.toBeInTheDocument()
      expect(screen.queryByTestId('ctxmenu-expression-input')).not.toBeInTheDocument()
    })
  })

  it('suppresses right click on the empty canvas board without affecting connection menus', async () => {
    renderWithPersistedState()

    const edgesSvg = await waitFor(() => document.getElementById('edges-svg'))
    const backgroundContextEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    edgesSvg.dispatchEvent(backgroundContextEvent)

    expect(backgroundContextEvent.defaultPrevented).toBe(true)

    await waitFor(() => {
      expect(screen.queryByText('Connection')).not.toBeInTheDocument()
      expect(screen.queryByTestId('ctxmenu-saknay-toggle')).not.toBeInTheDocument()
    })

    fireEvent.contextMenu(await screen.findByTestId('add-transformer-trigger-0'))

    await waitFor(() => {
      expect(screen.getByText('Connection')).toBeInTheDocument()
      expect(screen.getByText('Add Transformer')).toBeInTheDocument()
    })
  })

  it('uses an in-app confirmation modal when clearing the canvas', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true)

    renderWithPersistedState()

    await waitFor(() => {
      expect(document.getElementById('nd-src-productName')).toBeInTheDocument()
      expect(document.getElementById('nd-tgt-name')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Clear Canvas' }))

    await waitFor(() => {
      expect(screen.getByTestId('clear-canvas-modal')).toBeInTheDocument()
      expect(screen.getByText('Clear all nodes and mappings from the canvas?')).toBeInTheDocument()
    })

    expect(confirmSpy).not.toHaveBeenCalled()

    await user.click(screen.getByTestId('clear-canvas-cancel'))

    await waitFor(() => {
      expect(screen.queryByTestId('clear-canvas-modal')).not.toBeInTheDocument()
      expect(document.getElementById('nd-src-productName')).toBeInTheDocument()
      expect(document.getElementById('nd-tgt-name')).toBeInTheDocument()
    })

    let persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
    expect(persisted.mappings).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Clear Canvas' }))
    await user.click(screen.getByTestId('clear-canvas-confirm'))

    await waitFor(() => {
      expect(screen.queryByTestId('clear-canvas-modal')).not.toBeInTheDocument()
      expect(document.getElementById('nd-src-productName')).not.toBeInTheDocument()
      expect(document.getElementById('nd-tgt-name')).not.toBeInTheDocument()
    })

    persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
    expect(persisted.mappings).toEqual([])

    confirmSpy.mockRestore()
  })

  it('maps only field pairs whose similarity score is strictly higher than 70', async () => {
    const user = userEvent.setup()

    renderWithPersistedMappings(
      [],
      {
        schema: [
          { id: 'productName', name: 'productName', path: 'productName', type: 'string' },
          { id: 'abOrder', name: 'abOrder', path: 'abOrder', type: 'string' },
        ],
        fileName: 'sample.json',
        fileType: 'application/json',
        fileSize: 123,
      },
      [
        { id: 'name', name: 'name', path: 'name', type: 'string', required: false },
        { id: 'abValue', name: 'abValue', path: 'abValue', type: 'string', required: false },
      ],
    )

    await user.click(screen.getByRole('button', { name: '⚡ Map All Fields' }))

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.mappings).toEqual([
        expect.objectContaining({
          src: 'productName',
          tgt: 'name',
        }),
      ])
    })
  })

  it('opens the target field context menu on right click and persists Saknay/expression edits', async () => {
    const user = userEvent.setup()

    renderWithPersistedState()

    const targetNode = await waitFor(() => document.getElementById('nd-tgt-name'))
    fireEvent.contextMenu(targetNode)

    const modal = await screen.findByTestId('ctxmenu-modal')
    const saknayToggle = await screen.findByTestId('ctxmenu-saknay-toggle')
    const expressionInput = await screen.findByTestId('ctxmenu-expression-input')

    expect(modal).toHaveStyle({ width: '120px' })
    expect(screen.getByText('Saknay')).toBeInTheDocument()
    expect(saknayToggle).toBeChecked()
    expect(expressionInput).toHaveValue('')

    await user.click(saknayToggle)
    fireEvent.change(expressionInput, { target: { value: 'price * 1.2'.repeat(3) } })

    await waitFor(() => {
      expect(screen.getByTestId('ctxmenu-modal')).toHaveStyle({ width: '320px' })
    })

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.mappings?.[0]?.tgtMetadata?.sendToSaknay).toBe(false)
      expect(persisted.mappings?.[0]?.tgtMetadata?.expression).toBe('price * 1.2'.repeat(3))
    })
  })

  it('suppresses a second right click while the target context menu is already open', async () => {
    renderWithPersistedState()

    const targetNode = await waitFor(() => document.getElementById('nd-tgt-name'))
    fireEvent.contextMenu(targetNode)

    await screen.findByTestId('ctxmenu-saknay-toggle')

    const backdrop = await screen.findByTestId('ctxmenu-backdrop')
    const secondContextEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    backdrop.dispatchEvent(secondContextEvent)

    expect(secondContextEvent.defaultPrevented).toBe(true)
    expect(screen.getByTestId('ctxmenu-saknay-toggle')).toBeInTheDocument()
  })

  it('keeps extra-input source fields when bulk source cleanup runs on a multi-input transformer mapping', async () => {
    const user = userEvent.setup()

    renderWithPersistedState({
      transformer: 'tf-1',
      transformerInputType: 'string',
      transformerOutputType: 'string',
      transformerProps: { separator: '-' },
      extraInputs: [
        { nodeId: 'src-price-extra', field: 'price', pos: { x: 240, y: 260 } },
      ],
    })

    await waitFor(() => {
      expect(screen.getByText('Concatenate')).toBeInTheDocument()
      expect(document.getElementById('nd-src-price-extra')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '>>>' }))
    await user.click(screen.getAllByRole('button', { name: '<<<' })[0])

    await waitFor(() => {
      expect(screen.getByText('Concatenate')).toBeInTheDocument()
      expect(document.getElementById('nd-src-price-extra')).toBeInTheDocument()
    })
  })

  it('keeps the pending connector aligned with canvas coordinates after scrolling', async () => {
    renderWithPersistedState()

    const canvas = await screen.findByTestId('field-mapping-canvas')
    const sourcePort = await screen.findByTestId('source-port-src-productName')

    Object.defineProperty(canvas, 'scrollLeft', {
      configurable: true,
      get: () => 35,
    })

    Object.defineProperty(canvas, 'scrollTop', {
      configurable: true,
      get: () => 280,
    })

    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 40,
      left: 100,
      top: 40,
      right: 1100,
      bottom: 740,
      width: 1000,
      height: 700,
      toJSON: () => ({}),
    })

    fireEvent.mouseDown(sourcePort, { button: 0, clientX: 212, clientY: 59 })
    fireEvent.mouseMove(document, { clientX: 620, clientY: 210 })

    const pendingPath = document.getElementById('pending-path')

    await waitFor(() => {
      expect(pendingPath).toHaveAttribute('d', expect.stringContaining('555,450'))
    })
  })

  it('anchors transformed connections to the transformer middle left and right when source and target rows differ', async () => {
    renderWithPersistedMappings([
      {
        src: 'productName',
        tgt: 'name',
        srcNodeId: 'src-productName',
        tgtNodeId: 'tgt-name',
        srcPos: { x: 40, y: 10 },
        tgtPos: { x: 650, y: 300 },
        srcMetadata: { sendToSaknay: true, expression: '' },
        tgtMetadata: { sendToSaknay: true, expression: '' },
        transformer: 'tf-1',
        transformerInputType: 'string',
        transformerOutputType: 'string',
        transformerProps: { separator: '-' },
        extraInputs: [],
      },
      {
        src: 'price',
        tgt: 'id',
        srcNodeId: 'src-price',
        tgtNodeId: 'tgt-id',
        srcPos: { x: 40, y: 300 },
        tgtPos: { x: 650, y: 10 },
        srcMetadata: { sendToSaknay: true, expression: '' },
        tgtMetadata: { sendToSaknay: true, expression: '' },
        transformer: 'none',
        transformerInputType: 'any',
        transformerOutputType: 'any',
        transformerProps: {},
        extraInputs: [],
      },
    ])

    await waitFor(() => {
      expect(screen.getByText('Concatenate')).toBeInTheDocument()
      expect(document.getElementById('nd-src-productName')).toHaveStyle({ top: '30px' })
      expect(document.getElementById('nd-tgt-name')).toHaveStyle({ top: '30px' })
    })

    const pathData = Array.from(document.querySelectorAll('path')).map(path => path.getAttribute('d')).filter(Boolean)

    expect(pathData.some(d => /^M 300,67 C .* 405,67$/.test(d))).toBe(true)
    expect(pathData.some(d => /^M 545,67 C .* 650,67$/.test(d))).toBe(true)
  })

  it('reserves virtual target rows for extra multi-input sources during align', async () => {
    renderWithPersistedMappings([
      {
        src: 'productName',
        tgt: 'name',
        srcNodeId: 'src-productName',
        tgtNodeId: 'tgt-name',
        srcPos: { x: 40, y: 10 },
        tgtPos: { x: 650, y: 10 },
        srcMetadata: { sendToSaknay: true, expression: '' },
        tgtMetadata: { sendToSaknay: true, expression: '' },
        transformer: 'tf-1',
        transformerInputType: 'string',
        transformerOutputType: 'string',
        transformerProps: { separator: '-' },
        extraInputs: [
          { nodeId: 'src-price-extra', field: 'price', pos: { x: 40, y: 120 } },
          { nodeId: 'src-id-extra', field: 'id', pos: { x: 40, y: 220 } },
        ],
      },
      {
        src: 'category',
        tgt: 'id',
        srcNodeId: 'src-category',
        tgtNodeId: 'tgt-id',
        srcPos: { x: 40, y: 320 },
        tgtPos: { x: 650, y: 320 },
        srcMetadata: { sendToSaknay: true, expression: '' },
        tgtMetadata: { sendToSaknay: true, expression: '' },
        transformer: 'none',
        transformerInputType: 'any',
        transformerOutputType: 'any',
        transformerProps: {},
        extraInputs: [],
      },
    ])

    await waitFor(() => {
      expect(screen.getByText('Concatenate')).toBeInTheDocument()

      expect(document.getElementById('nd-src-productName')).toHaveStyle({ top: '30px' })
      expect(document.getElementById('nd-tgt-name')).toHaveStyle({ top: '30px' })

      expect(document.getElementById('nd-src-price-extra')).toHaveStyle({ top: '114px' })
      expect(document.getElementById('nd-src-id-extra')).toHaveStyle({ top: '198px' })

      expect(document.getElementById('nd-src-category')).toHaveStyle({ top: '282px' })
      expect(document.getElementById('nd-tgt-id')).toHaveStyle({ top: '282px' })
    })
  })
})

describe('FieldMappingStep required-prop validation', () => {
  it('marks transformer node as invalid when a required prop is empty and valid once filled', async () => {
    const user = userEvent.setup()

    // Render with a mapping that already has a transformer assigned but no props filled in
    renderWithPersistedMappings([
      {
        src: 'productName',
        tgt: 'name',
        srcNodeId: 'src-productName',
        tgtNodeId: 'tgt-name',
        srcPos: { x: 40, y: 30 },
        tgtPos: { x: 650, y: 30 },
        srcMetadata: { sendToSaknay: false, expression: '' },
        tgtMetadata: { sendToSaknay: false, expression: '' },
        transformer: 'tf-4',
        transformerInputType: 'any',
        transformerOutputType: 'any',
        // required prop "logic" is intentionally left empty
        transformerProps: { logic: '' },
        transformerChainDetailed: [{ id: 'tf-4', props: { logic: '' } }],
        extraInputs: [],
      },
    ])

    // Node should be marked invalid because "logic" is required and empty
    const node = await screen.findByTestId('transformer-node-0-0')
    expect(node).toHaveAttribute('data-invalid', 'true')

    fireEvent.mouseEnter(node)

    await waitFor(() => {
      expect(screen.getByTestId('invalid-transformer-tooltip')).toHaveTextContent('Missing required fields: Logic')
    })

    fireEvent.mouseLeave(node)

    await waitFor(() => {
      expect(screen.queryByTestId('invalid-transformer-tooltip')).not.toBeInTheDocument()
    })

    fireEvent.mouseEnter(node)

    await waitFor(() => {
      expect(screen.getByTestId('invalid-transformer-tooltip')).toHaveTextContent('Missing required fields: Logic')
    })

    // Click the node to open the edit modal
    await user.click(node)

    // Find the Logic row and type a value
    const logicLabel = await screen.findByText('Logic')
    const logicRow = logicLabel.closest('tr')
    const logicInput = within(logicRow).getByRole('textbox')
    await user.clear(logicInput)
    await user.type(logicInput, 'a:b:c')

    // Apply the transformer
    const applyBtn = screen.getByRole('button', { name: /save convertmulti/i })
    await user.click(applyBtn)

    // Node should now be valid
    await waitFor(() => {
      expect(screen.getByTestId('transformer-node-0-0')).toHaveAttribute('data-invalid', 'false')
      expect(screen.queryByTestId('invalid-transformer-tooltip')).not.toBeInTheDocument()
    })
  })
})

