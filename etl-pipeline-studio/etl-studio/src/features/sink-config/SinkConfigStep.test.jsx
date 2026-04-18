import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SinkConfigStep from './SinkConfigStep.jsx'
import { WizardProvider } from '../../shared/store/wizardStore.jsx'

const testRabbitMqConnection = vi.fn()
const PREVIEW_USER = { userId: 'alice', teamName: 'data-platform' }

vi.mock('../../shared/services/rabbitmqService.js', () => ({
  testRabbitMqConnection: (...args) => testRabbitMqConnection(...args),
}))

const WIZARD_STORAGE_KEY = 'etl-studio-wizard-draft'
const READ_ONLY_CSS = `
  [data-etl-ro] input,
  [data-etl-ro] select,
  [data-etl-ro] textarea,
  [data-etl-ro] button:not([data-etl-ro-allow]),
  [data-etl-ro] [role="button"]:not([data-etl-ro-allow]),
  [data-etl-ro] [draggable="true"],
  [data-etl-ro] label {
    pointer-events: none !important;
    cursor: default !important;
  }
`

function renderStep(initialSink = {}, initialMappings = [], initialMetadata = {}) {
  localStorage.setItem(
    WIZARD_STORAGE_KEY,
    JSON.stringify({
      navigationMode: 'etl-config',
      currentStep: 5,
      completedSteps: [0, 1, 2, 3, 4],
      metadata: {
        productSource: 'ERP',
        productType: 'Inventory',
        team: 'data-platform',
        environment: 'production',
        entityName: 'Product',
        tags: '',
        ...initialMetadata,
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
      upload: { done: true, schema: [], fileName: '', fileType: '', fileSize: 0 },
      targetSchema: [],
      mappings: initialMappings,
      filters: [],
      sink: {
        sinkType: 'kafka',
        sinkKafkaTopic: '',
        sinkKafkaEnv: 'production',
        sinkKafkaAdditionalPropertiesEnabled: false,
        sinkKafkaAdditionalProperties: [],
        shadow: false,
        shadowTopic: '',
        saknay: false,
        saknayTopic: '',
        asg: false,
        ...initialSink,
      },
      readOnly: true,
      theme: 'dark',
    })
  )

  return render(
    <WizardProvider>
      <SinkConfigStep />
    </WizardProvider>
  )
}

function renderReadOnlyStep(initialSink = {}, initialMappings = []) {
  window.history.pushState({}, '', '/?preview=true&deploymentId=dep-1&previewSource=saved')
  localStorage.setItem(
    'etl-deployment-preview:dep-1:saved',
    JSON.stringify({
      wizardState: {
        navigationMode: 'etl-config',
        currentStep: 5,
        completedSteps: [0, 1, 2, 3, 4],
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
        upload: { done: true, schema: [], fileName: '', fileType: '', fileSize: 0 },
        targetSchema: [],
        mappings: initialMappings,
        filters: [],
        sink: {
          sinkType: 'kafka',
          sinkKafkaTopic: '',
          sinkKafkaEnv: 'production',
          sinkKafkaAdditionalPropertiesEnabled: false,
          sinkKafkaAdditionalProperties: [],
          shadow: false,
          shadowTopic: '',
          saknay: false,
          saknayTopic: '',
          asg: false,
          ...initialSink,
        },
        theme: 'dark',
      },
    })
  )

  return render(
    <WizardProvider user={PREVIEW_USER}>
      <style>{READ_ONLY_CSS}</style>
      <div data-etl-ro="true">
        <SinkConfigStep />
      </div>
    </WizardProvider>
  )
}

describe('SinkConfigStep Kafka additional properties', () => {
  beforeEach(() => {
    localStorage.clear()
    testRabbitMqConnection.mockReset()
  })

  it('lets the user add, edit, and persist Kafka additional properties', async () => {
    const user = userEvent.setup()
    renderStep()

    const apssToggle = screen.getByRole('checkbox', { name: 'Add APSS properties (optional)' })
    expect(apssToggle).not.toBeChecked()
    expect(screen.queryByText('Add APSS properties as key / value pairs.')).not.toBeInTheDocument()

    await user.click(apssToggle)

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.sink?.sinkKafkaAdditionalPropertiesEnabled).toBe(true)
    })

    expect(screen.getByText('Add APSS properties as key / value pairs.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /add property/i }))
    expect(screen.queryByText('No additional Kafka properties defined.')).not.toBeInTheDocument()

    const keyInputs = screen.getAllByPlaceholderText('acks')
    const valueInputs = screen.getAllByPlaceholderText('all')

    await user.type(keyInputs[0], 'acks')
    await user.type(valueInputs[0], 'all')

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.sink?.sinkKafkaAdditionalProperties).toEqual([
        expect.objectContaining({ key: 'acks', value: 'all' }),
      ])
    })

    await user.click(screen.getByRole('button', { name: /remove/i }))

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.sink?.sinkKafkaAdditionalProperties).toEqual([])
    })
  })

  it('renders the Kafka output topic empty by default', () => {
    renderStep()

    const outputTopicInput = screen.getByText('Output Topic').closest('label')?.parentElement?.querySelector('input')
    expect(outputTopicInput).toHaveValue('')
  })

  it('defaults the Kafka bootstrap environment from metadata and still allows independent selection', async () => {
    const user = userEvent.setup()

    renderStep({ sinkKafkaEnv: '' }, [], { environment: 'staging' })

    const environmentSelect = screen.getByRole('combobox', { name: 'Bootstrap Environment' })

    expect(environmentSelect).not.toBeDisabled()
    expect(environmentSelect).toHaveValue('staging')
    expect(screen.getByRole('option', { name: 'CAP' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'PROD' })).toBeInTheDocument()
    expect(within(environmentSelect).queryByRole('option', { name: /dev/i })).not.toBeInTheDocument()

    await user.selectOptions(environmentSelect, 'production')

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.metadata?.environment).toBe('staging')
      expect(persisted.sink?.sinkKafkaEnv).toBe('production')
    })
  })

  it('keeps the selected sink Kafka environment when metadata changes', async () => {
    renderStep({ sinkKafkaEnv: 'production' }, [], { environment: 'staging' })

    await waitFor(() => {
      const environmentSelect = screen.getByRole('combobox', { name: 'Bootstrap Environment' })
      expect(environmentSelect).toHaveValue('production')

      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.metadata?.environment).toBe('staging')
      expect(persisted.sink?.sinkKafkaEnv).toBe('production')
    })
  })

  it('renders persisted Kafka additional properties when reopening the step', () => {
    renderStep({
      sinkKafkaAdditionalPropertiesEnabled: true,
      sinkKafkaAdditionalProperties: [
        { id: 'prop-1', key: 'compression.type', value: 'gzip' },
      ],
    })

    expect(screen.getByRole('checkbox', { name: 'Add APSS properties (optional)' })).toBeChecked()
    const keyInput = screen.getByDisplayValue('compression.type')
    const valueInput = screen.getByDisplayValue('gzip')

    expect(keyInput).toBeInTheDocument()
    expect(valueInput).toBeInTheDocument()
    expect(screen.getByText('Add APSS properties as key / value pairs.')).toBeInTheDocument()
  })

  it('shows a Saknay section without a checkbox when a mapped target sends to Saknay', () => {
    renderStep(
      { saknayTopic: 'saknay.products' },
      [
        {
          src: 'source_products_raw',
          tgt: 'name',
          tgtMetadata: { sendToSaknay: true },
        },
      ]
    )

    expect(screen.getByTestId('sink-saknay-section')).toBeInTheDocument()
    expect(screen.getByText('Enabled automatically from Field Mapping target settings.')).toBeInTheDocument()
    expect(screen.getByDisplayValue('saknay.products')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /saknay/i })).not.toBeInTheDocument()
  })

  it('uses derived Saknay targets for the auto-generated topic placeholder', () => {
    renderStep(
      { sinkKafkaTopic: '', shadow: false },
      [
        {
          src: 'source_products_raw',
          tgt: 'name',
          tgtMetadata: { sendToSaknay: true },
        },
      ]
    )

    const outputTopicInput = screen.getByText('Output Topic').closest('label')?.parentElement?.querySelector('input')
    expect(outputTopicInput).toHaveAttribute('placeholder', 'Leave empty for auto-generation')
  })

  it('hides the Saknay section when no mapped target sends to Saknay', () => {
    renderStep(
      { saknayTopic: 'legacy-topic' },
      [
        {
          src: 'source_products_raw',
          tgt: 'name',
          tgtMetadata: { sendToSaknay: false },
        },
      ]
    )

    expect(screen.queryByText('🦆 SAKNAY')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('legacy-topic')).not.toBeInTheDocument()
  })

  it('does not render a test connection button for the Kafka sink config', () => {
    renderStep()

    expect(screen.queryByRole('button', { name: /test connection/i })).not.toBeInTheDocument()
  })

  it('allows selecting the RabbitMQ sink card and shows the RabbitMQ connection test controls', async () => {
    const user = userEvent.setup()
    renderStep()

    await user.click(screen.getByText('RabbitMQ'))

    expect(screen.getByText('🐇 RabbitMQ Sink')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'VHOST' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'PORT' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Queue Name' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /test connection/i })).toBeInTheDocument()
  })

  it('calls the RabbitMQ sink test endpoint and shows a success icon', async () => {
    const user = userEvent.setup()
    testRabbitMqConnection.mockResolvedValue({ success: true, message: 'RabbitMQ sink reachable' })

    renderStep({
      sinkType: 'rabbitmq',
      sinkRmqVhost: '/etl',
      sinkRmqPort: '5672',
      sinkRmqQueue: 'products.sink',
      sinkRmqExchange: 'etl.exchange',
    })

    await user.click(screen.getByRole('button', { name: /test connection/i }))

    await waitFor(() => {
      expect(testRabbitMqConnection).toHaveBeenCalledWith({
        vhost: '/etl',
        port: '5672',
        queue: 'products.sink',
        exchange: 'etl.exchange',
        environment: 'production',
      })
    })

    expect(await screen.findByLabelText('RabbitMQ connection test succeeded')).toBeInTheDocument()
    expect(screen.getByText('RabbitMQ sink reachable')).toBeInTheDocument()
  })

  it('clears the previous RabbitMQ sink connection result when sink inputs change', async () => {
    const user = userEvent.setup()
    testRabbitMqConnection.mockResolvedValue({ success: true, message: 'RabbitMQ sink reachable' })

    renderStep({
      sinkType: 'rabbitmq',
      sinkRmqVhost: '/etl',
      sinkRmqPort: '5672',
      sinkRmqQueue: 'products.sink',
    })

    await user.click(screen.getByRole('button', { name: /test connection/i }))
    expect(await screen.findByLabelText('RabbitMQ connection test succeeded')).toBeInTheDocument()

    const queueInput = screen.getByRole('textbox', { name: 'Queue Name' })
    await user.clear(queueInput)
    await user.type(queueInput, 'products.retry')

    await waitFor(() => {
      expect(screen.queryByLabelText('RabbitMQ connection test succeeded')).not.toBeInTheDocument()
    })
  })

  it('shows a validation error instead of calling the RabbitMQ sink API when required fields are missing', async () => {
    const user = userEvent.setup()

    renderStep({
      sinkType: 'rabbitmq',
      sinkRmqVhost: '',
      sinkRmqPort: '5672',
      sinkRmqQueue: '',
    })

    await user.click(screen.getByRole('button', { name: /test connection/i }))

    expect(testRabbitMqConnection).not.toHaveBeenCalled()
    expect(await screen.findByLabelText('RabbitMQ connection test failed')).toBeInTheDocument()
    expect(screen.getByText('VHOST, port, and queue name are required to test the RabbitMQ connection.')).toBeInTheDocument()
  })

  it('disables RabbitMQ sink test connection in read-only mode', async () => {
    renderReadOnlyStep({
      sinkType: 'rabbitmq',
      sinkRmqVhost: '/etl',
      sinkRmqPort: '5672',
      sinkRmqQueue: 'products.sink',
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /test connection/i })).toBeDisabled()
    })
  })

  it('keeps SHADOW and ASG hints visible in read-only mode', () => {
    renderReadOnlyStep()

    const shadowRow = screen.getByTestId('sink-shadow-row')
    const asgRow = screen.getByTestId('sink-asg-row')

    expect(shadowRow).toBeTruthy()
    expect(asgRow).toBeTruthy()

    fireEvent.mouseEnter(within(shadowRow).getByText('i'))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Mirrors output data to a shadow topic for audit and validation purposes')

    fireEvent.mouseLeave(within(shadowRow).getByText('i'))
    fireEvent.mouseEnter(within(asgRow).getByText('i'))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Asgard data governance system for compliance and metadata management')
  })
})



