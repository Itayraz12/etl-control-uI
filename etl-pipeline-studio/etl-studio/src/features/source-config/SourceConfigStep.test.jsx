import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SourceConfigStep from './SourceConfigStep.jsx'
import { WizardProvider } from '../../shared/store/wizardStore.jsx'

const testKafkaConnection = vi.fn()
const WIZARD_STORAGE_KEY = 'etl-studio-wizard-draft'
const PREVIEW_USER = { userId: 'alice', teamName: 'platform' }

vi.mock('../../shared/services/kafkaService.js', () => ({
  testKafkaConnection: (...args) => testKafkaConnection(...args),
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
        environment: 'production',
        entityName: 'Product',
        tags: '',
        ...initialMetadata,
      },
      source: {
        sourceType: 'kafka',
        kafkaEnv: 'production',
        kafkaTopic: 'source_products_raw',
        kafkaOffset: '',
        kafkaKeys: '',
        format: 'JSON',
        jsonSplit: '',
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
        sinkKafkaEnv: 'production',
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

  it('persists the selected Kafka offset', async () => {
    const user = userEvent.setup()

    renderStep()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Offset' }), 'latest')

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
      expect(persisted.source?.kafkaOffset).toBe('latest')
    })
  })

  it('calls the Kafka test endpoint and shows a success icon for the source config', async () => {
    const user = userEvent.setup()
    testKafkaConnection.mockResolvedValue({ success: true, message: 'Kafka source reachable' })

    renderStep()

    await user.click(screen.getByRole('button', { name: /test connection/i }))

    await waitFor(() => {
      expect(testKafkaConnection).toHaveBeenCalledWith({
        topic: 'source_products_raw',
        environment: 'production',
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
        environment: 'production',
        entityName: 'Product',
        tags: '',
      },
      source: {
        sourceType: 'kafka',
        kafkaEnv: 'production',
        kafkaTopic: 'source_products_raw',
        kafkaOffset: '',
        kafkaKeys: '',
        format: 'JSON',
        jsonSplit: '',
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

    renderStep()

    await user.click(screen.getByRole('button', { name: /test connection/i }))
    expect(await screen.findByLabelText('Kafka connection test succeeded')).toBeInTheDocument()

    const topicInput = screen.getByDisplayValue('source_products_raw')
    await user.clear(topicInput)
    await user.type(topicInput, 'source_products_retry')

    await waitFor(() => {
      expect(screen.queryByLabelText('Kafka connection test succeeded')).not.toBeInTheDocument()
    })
  })

  it('shows a failure icon and message when the source Kafka test request fails', async () => {
    const user = userEvent.setup()
    testKafkaConnection.mockRejectedValue(new Error('Source broker unreachable'))

    renderStep()

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
    expect(screen.getByText('Topic and environment are required to test the Kafka connection.')).toBeInTheDocument()
  })
})



