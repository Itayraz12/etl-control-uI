import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
        isMultipleInput: true,
        propsSchema: [
          { key: 'separator', label: 'Separator', type: 'text', default: '-', required: false, description: '' },
        ],
      },
      {
        _id: 'tf-2',
        name: 'Uppercase',
        icon: 'Aa',
        isMultipleInput: false,
        propsSchema: [],
      },
    ],
  }),
}))

const WIZARD_STORAGE_KEY = 'etl-studio-wizard-draft'

function renderWithPersistedState(mappingOverrides = {}, uploadOverrides = {}, targetSchema = []) {
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
    <WizardProvider>
      <FieldMappingStep />
    </WizardProvider>
  )
}

function renderWithPersistedMappings(mappings, uploadOverrides = {}, targetSchema = []) {
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
    <WizardProvider>
      <FieldMappingStep />
    </WizardProvider>
  )
}

describe('FieldMappingStep transformer modal regression', () => {
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
      expect(screen.getByTestId('target-list-item-persons')).toBeInTheDocument()
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

  it('toggles the target Saknay badge and persists the updated target metadata', async () => {
    renderWithPersistedState()

    const saknayToggle = await screen.findByTestId('target-saknay-toggle-tgt-name')
    expect(saknayToggle).toHaveAttribute('title', 'Send to Saknay: Yes')
    expect(screen.queryByText('GP')).not.toBeInTheDocument()

    fireEvent.click(saknayToggle)

    await waitFor(() => {
      expect(screen.getByTestId('target-saknay-toggle-tgt-name')).toHaveAttribute('title', 'Send to Saknay: No')

      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.mappings?.[0]?.tgtMetadata?.sendToSaknay).toBe(false)
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

  it('opens the target field context menu on right click and persists Saknay/expression edits', async () => {
    const user = userEvent.setup()

    renderWithPersistedState()

    const targetNode = await waitFor(() => document.getElementById('nd-tgt-name'))
    fireEvent.contextMenu(targetNode)

    const saknayToggle = await screen.findByTestId('ctxmenu-saknay-toggle')
    const expressionInput = await screen.findByTestId('ctxmenu-expression-input')

    expect(saknayToggle).toBeChecked()
    expect(expressionInput).toHaveValue('')

    await user.click(saknayToggle)
    await user.type(expressionInput, 'price * 1.2')

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.mappings?.[0]?.tgtMetadata?.sendToSaknay).toBe(false)
      expect(persisted.mappings?.[0]?.tgtMetadata?.expression).toBe('price * 1.2')
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
