import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const WIZARD_STORAGE_KEY = 'etl-studio-wizard-draft'

async function loadSinkStep() {
  const [{ default: SinkConfigStep }, { WizardProvider }] = await Promise.all([
    import('./SinkConfigStep.jsx'),
    import('../../shared/store/wizardStore.jsx'),
  ])

  return { SinkConfigStep, WizardProvider }
}

describe('SinkConfigStep external labels', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('renders overridden external labels without showing the legacy Saknay label', async () => {
    vi.stubEnv('VITE_SHADOW_LABEL', 'Wolf')
    vi.stubEnv('VITE_ASG_LABEL', 'Bear')
    vi.stubEnv('VITE_SAKNAY_LABEL', 'Dog')
    vi.resetModules()

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
        mappings: [
          {
            src: 'sku',
            tgt: 'sku',
            tgtMetadata: { sendToSaknay: true },
          },
        ],
        filters: [],
        sink: {
          sinkType: 'kafka',
          sinkKafkaTopic: 'catalog-sink',
          sinkKafkaEnv: 'production',
          sinkKafkaAdditionalPropertiesEnabled: false,
          sinkKafkaAdditionalProperties: [],
          shadow: true,
          shadowTopic: 'audit-shadow',
          saknay: true,
          saknayTopic: 'dog-topic',
          asg: true,
        },
        theme: 'dark',
      })
    )

    const { SinkConfigStep, WizardProvider } = await loadSinkStep()

    render(
      <WizardProvider>
        <SinkConfigStep />
      </WizardProvider>
    )

    expect(await screen.findByText('🦆 DOG')).toBeInTheDocument()
    expect(screen.getByText('Dog Topic')).toBeInTheDocument()
    expect(screen.getByText('🌬️ Wolf')).toBeInTheDocument()
    expect(screen.getByText('📊 Bear')).toBeInTheDocument()
    expect(screen.queryByText(/saknay/i)).not.toBeInTheDocument()
  })
})

