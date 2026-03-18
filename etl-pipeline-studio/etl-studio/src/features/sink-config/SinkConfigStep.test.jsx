import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import SinkConfigStep from './SinkConfigStep.jsx'
import { WizardProvider } from '../../shared/store/wizardStore.jsx'

const WIZARD_STORAGE_KEY = 'etl-studio-wizard-draft'

function renderStep(initialSink = {}) {
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
      mappings: [],
      filters: [],
      sink: {
        sinkType: 'kafka',
        sinkKafkaTopic: 'etl_products_v3',
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
    })
  )

  return render(
    <WizardProvider>
      <SinkConfigStep />
    </WizardProvider>
  )
}

describe('SinkConfigStep Kafka additional properties', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('lets the user add, edit, and persist Kafka additional properties', async () => {
    const user = userEvent.setup()
    renderStep()

    const apssToggle = screen.getByRole('checkbox', { name: 'Add APSS properites (optional)' })
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

  it('renders persisted Kafka additional properties when reopening the step', () => {
    renderStep({
      sinkKafkaAdditionalPropertiesEnabled: true,
      sinkKafkaAdditionalProperties: [
        { id: 'prop-1', key: 'compression.type', value: 'gzip' },
      ],
    })

    expect(screen.getByRole('checkbox', { name: 'Add APSS properites (optional)' })).toBeChecked()
    const keyInput = screen.getByDisplayValue('compression.type')
    const valueInput = screen.getByDisplayValue('gzip')

    expect(keyInput).toBeInTheDocument()
    expect(valueInput).toBeInTheDocument()
    expect(screen.getByText('Add APSS properties as key / value pairs.')).toBeInTheDocument()
  })
})



