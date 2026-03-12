import { render, screen, waitFor } from '@testing-library/react'
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

function renderWithPersistedState(mappingOverrides = {}) {
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
      upload: { done: true },
      mappings: [
        {
          src: 'productName',
          tgt: 'name',
          srcNodeId: 'src-productName',
          tgtNodeId: 'tgt-name',
          srcPos: { x: 40, y: 30 },
          tgtPos: { x: 650, y: 30 },
          srcMetadata: { sendToSaknay: true, sendToGP: true, expression: '' },
          tgtMetadata: { sendToSaknay: true, sendToGP: true, expression: '' },
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
})
