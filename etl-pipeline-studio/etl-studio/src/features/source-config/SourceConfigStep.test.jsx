import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SourceConfigStep from './SourceConfigStep.jsx'
import { WizardProvider } from '../../shared/store/wizardStore.jsx'

const testKafkaConnection = vi.fn()
const testRabbitMqConnection = vi.fn()
const WIZARD_STORAGE_KEY = 'etl-studio-wizard-draft'
const PREVIEW_USER = { userId: 'alice', teamName: 'platform' }

vi.mock('../../shared/services/kafkaService.js', () => ({
  testKafkaConnection: (...args) => testKafkaConnection(...args),
}))

vi.mock('../../shared/services/rabbitmqService.js', () => ({
  testRabbitMqConnection: (...args) => testRabbitMqConnection(...args),
}))

function seedPreviewState(wizardState) {
  window.history.pushState({}, '', '/?preview=true&deploymentId=dep-1&previewSource=saved')
  localStorage.setItem(
    'etl-deployment-preview:dep-1:saved',
    JSON.stringify({ wizardState })
  )
}

function renderStep(initialSource = {}, initialMetadata = {}, options = {}) {
  const { user = null } = options

  localStorage.setItem(
    WIZARD_STORAGE_KEY,
    JSON.stringify({
      navigationMode: 'etl-config',
      currentStep: 1,
      completedSteps: [0],
      metadata: {
        productSource: 'ERP',
        productType: 'Inventory',
        team: 'data-platform',
        environment: 'PROD',
        entityName: 'Product',
        tags: '',
        ...initialMetadata,
      },
      source: {
        sourceType: 'kafka',
        kafkaEnv: 'PROD',
        kafkaTopic: '',
        kafkaOffset: '',
        kafkaKeys: '',
        format: 'JSON',
        jsonSplit: '',
        rowDelimiter: '',
        streamingContinuity: 'continuous',
        recordsPerDay: 'millions',
        ...initialSource,
      },
      upload: { done: false, schema: [], fileName: '', fileType: '', fileSize: 0 },
      targetSchema: [],
      mappings: [],
      filters: [],
      sink: {
        sinkType: 'kafka',
        sinkKafkaTopic: 'etl_products_v3',
        sinkKafkaEnv: 'PROD',
      },
      theme: 'dark',
    })
  )

  return render(
    <WizardProvider user={user}>
      <SourceConfigStep />
    </WizardProvider>
  )
}

describe('SourceConfigStep Kafka test connection', () => {
  beforeEach(() => {
    localStorage.clear()
    testKafkaConnection.mockReset()
    testRabbitMqConnection.mockReset()
    window.history.pushState({}, '', '/')
  })

  it('does not render the Data Stream Info card in source config anymore', () => {
    renderStep()

    expect(screen.queryByText('📊 Data Stream Info')).not.toBeInTheDocument()
  })

  it('shows Kafka offset with no default value selected', () => {
    renderStep()

    const offsetSelect = screen.getByRole('combobox', { name: 'Offset' })
    expect(offsetSelect).toHaveValue('')
    expect(screen.getByRole('option', { name: 'earliest' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'latest' })).toBeInTheDocument()
  })

  it('shows Kafka topic as an empty required field by default', () => {
    renderStep()

    const topicInput = screen.getByRole('textbox', { name: 'Topic' })
    expect(topicInput).toHaveValue('')
    expect(topicInput).toBeRequired()
  })

  it('defaults the Kafka environment from metadata and still allows independent selection', async () => {
    const user = userEvent.setup()

    renderStep({ kafkaEnv: '' }, { environment: 'CAP' })

    const environmentSelect = screen.getByRole('combobox', { name: 'Environment' })

    expect(environmentSelect).not.toBeDisabled()
    expect(environmentSelect).toHaveValue('CAP')
    expect(screen.getByRole('option', { name: 'CAP' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'PROD' })).toBeInTheDocument()
    expect(within(environmentSelect).queryByRole('option', { name: /dev/i })).not.toBeInTheDocument()

    await user.selectOptions(environmentSelect, 'PROD')

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.metadata?.environment).toBe('CAP')
      expect(persisted.source?.kafkaEnv).toBe('PROD')
    })
  })

  it('keeps the selected source Kafka environment when metadata changes', async () => {
    renderStep({ kafkaEnv: 'PROD' }, { environment: 'CAP' })

    await waitFor(() => {
      const environmentSelect = screen.getByRole('combobox', { name: 'Environment' })
      expect(environmentSelect).toHaveValue('PROD')

      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.metadata?.environment).toBe('CAP')
      expect(persisted.source?.kafkaEnv).toBe('PROD')
    })
  })

  it('marks missing Kafka required fields as invalid', () => {
    renderStep({ kafkaEnv: '', kafkaTopic: '', kafkaOffset: '' }, { environment: '' })

    expect(screen.getByRole('combobox', { name: 'Environment' })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('textbox', { name: 'Topic' })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('combobox', { name: 'Offset' })).toHaveAttribute('aria-invalid', 'true')
  })

  it('persists the selected Kafka offset', async () => {
    const user = userEvent.setup()

    renderStep()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Offset' }), 'latest')

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.source?.kafkaOffset).toBe('latest')
    })
  })

  it('persists the CSV row delimiter from source format settings', async () => {
    const user = userEvent.setup()

    renderStep({ format: 'CSV', rowDelimiter: '' })

    const rowDelimiterInput = screen.getByText('Row Delimiter').parentElement.querySelector('input')
    expect(rowDelimiterInput).toBeTruthy()
    await user.type(rowDelimiterInput, '\\r\\n')

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.source?.format).toBe('CSV')
      expect(persisted.source?.rowDelimiter).toBe('\\r\\n')
    })
  })

  it('renders the CSV column delimiter as an empty required field with a comma placeholder', () => {
    renderStep({ format: 'CSV', csvDelimiter: '' })

    const columnDelimiterInput = screen.getByRole('textbox', { name: 'Column Delimiter' })
    expect(columnDelimiterInput).toHaveValue('')
    expect(columnDelimiterInput).toBeRequired()
    expect(columnDelimiterInput).toHaveAttribute('placeholder', ',')
  })

  it('persists the CSV column delimiter from source format settings', async () => {
    const user = userEvent.setup()

    renderStep({ format: 'CSV', csvDelimiter: '' })

    const columnDelimiterInput = screen.getByRole('textbox', { name: 'Column Delimiter' })
    await user.type(columnDelimiterInput, ';')

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.source?.format).toBe('CSV')
      expect(persisted.source?.csvDelimiter).toBe(';')
    })
  })

  it('calls the Kafka test endpoint and shows a success icon for the source config', async () => {
    const user = userEvent.setup()
    testKafkaConnection.mockResolvedValue({ success: true, message: 'Kafka source reachable' })

    renderStep({ kafkaEnv: 'CAP', kafkaTopic: 'source_products_raw' }, { environment: 'PROD' })

    await user.click(screen.getByRole('button', { name: /test connection/i }))

    await waitFor(() => {
      expect(testKafkaConnection).toHaveBeenCalledWith({
        topic: 'source_products_raw',
        environment: 'CAP',
      })
    })

    expect(await screen.findByLabelText('Kafka connection test succeeded')).toBeInTheDocument()
    expect(screen.getByText('Kafka source reachable')).toBeInTheDocument()
  })

  it('disables test connection in preview mode', async () => {
    const user = userEvent.setup()

    seedPreviewState({
      navigationMode: 'etl-config',
      currentStep: 1,
      completedSteps: [0],
      metadata: {
        productSource: 'ERP',
        productType: 'Inventory',
        team: 'platform',
          environment: 'PROD',
        entityName: 'Product',
        tags: '',
      },
      source: {
        sourceType: 'kafka',
          kafkaEnv: 'PROD',
        kafkaTopic: 'source_products_raw',
        kafkaOffset: '',
        kafkaKeys: '',
        format: 'JSON',
        jsonSplit: '',
        rowDelimiter: '',
        streamingContinuity: 'continuous',
        recordsPerDay: 'millions',
      },
    })

    renderStep({}, {}, { user: PREVIEW_USER })

    const testConnectionButton = screen.getByRole('button', { name: /test connection/i })
    expect(testConnectionButton).toBeDisabled()

    await user.click(testConnectionButton)

    expect(testKafkaConnection).not.toHaveBeenCalled()
  })

  it('clears the previous source connection result when Kafka inputs change', async () => {
    const user = userEvent.setup()
    testKafkaConnection.mockResolvedValue({ success: true, message: 'Kafka source reachable' })

    renderStep({ kafkaTopic: 'source_products_raw' })

    await user.click(screen.getByRole('button', { name: /test connection/i }))
    expect(await screen.findByLabelText('Kafka connection test succeeded')).toBeInTheDocument()

    const topicInput = screen.getByRole('textbox', { name: 'Topic' })
    await user.clear(topicInput)
    await user.type(topicInput, 'source_products_retry')

    await waitFor(() => {
      expect(screen.queryByLabelText('Kafka connection test succeeded')).not.toBeInTheDocument()
    })
  })

  it('shows a failure icon and message when the source Kafka test request fails', async () => {
    const user = userEvent.setup()
    testKafkaConnection.mockRejectedValue(new Error('Source broker unreachable'))

    renderStep({ kafkaTopic: 'source_products_raw' })

    await user.click(screen.getByRole('button', { name: /test connection/i }))

    expect(await screen.findByLabelText('Kafka connection test failed')).toBeInTheDocument()
    expect(screen.getByText('Source broker unreachable')).toBeInTheDocument()
  })

  it('shows a validation error instead of calling the API when source topic is missing', async () => {
    const user = userEvent.setup()

    renderStep({ kafkaTopic: '' })

    await user.click(screen.getByRole('button', { name: /test connection/i }))

    expect(testKafkaConnection).not.toHaveBeenCalled()
    expect(await screen.findByLabelText('Kafka connection test failed')).toBeInTheDocument()
    expect(screen.getByText('Topic and Kafka environment are required to test the Kafka connection.')).toBeInTheDocument()
  })

  it('calls the RabbitMQ test endpoint and shows an inline success message instead of a popup', async () => {
    const user = userEvent.setup()
    testRabbitMqConnection.mockResolvedValue({ success: true, message: 'RabbitMQ source reachable' })

    renderStep({
      sourceType: 'rabbitmq',
      rmqIp: '10.0.0.12',
      rmqPort: '5672',
      rmqUsername: 'guest',
      rmqPassword: 'secret',
      rmqQueue: 'products.ingest',
      rmqVhost: '/etl',
    })

    await user.click(screen.getByRole('button', { name: /test connection/i }))

    await waitFor(() => {
      expect(testRabbitMqConnection).toHaveBeenCalledWith({
        ip: '10.0.0.12',
        port: '5672',
        username: 'guest',
        password: 'secret',
        queue: 'products.ingest',
        vhost: '/etl',
        environment: 'PROD',
      })
    })

    expect(await screen.findByLabelText('RabbitMQ connection test succeeded')).toBeInTheDocument()
    expect(screen.getByText('RabbitMQ source reachable')).toBeInTheDocument()
  })

  it('shows a validation error instead of calling the RabbitMQ API when required fields are missing', async () => {
    const user = userEvent.setup()

    renderStep({
      sourceType: 'rabbitmq',
      rmqIp: '',
      rmqPort: '5672',
      rmqUsername: '',
      rmqPassword: '',
      rmqQueue: '',
      rmqVhost: '/etl',
    })

    await user.click(screen.getByRole('button', { name: /test connection/i }))

    expect(testRabbitMqConnection).not.toHaveBeenCalled()
    expect(await screen.findByLabelText('RabbitMQ connection test failed')).toBeInTheDocument()
    expect(screen.getByText('IP, port, username, password, and queue are required to test the RabbitMQ connection.')).toBeInTheDocument()
  })

  it('marks missing RabbitMQ required fields as invalid', () => {
    renderStep({
      sourceType: 'rabbitmq',
      rmqIp: '',
      rmqPort: '',
      rmqUsername: '',
      rmqPassword: '',
      rmqQueue: '',
    })

    expect(screen.getByRole('textbox', { name: 'IP' })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('textbox', { name: 'PORT' })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('textbox', { name: 'Username' })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('textbox', { name: 'Queue' })).toHaveAttribute('aria-invalid', 'true')
  })
})

