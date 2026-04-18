import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('SummaryStep external labels', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('serializes overridden external labels into the generated YAML', async () => {
    vi.stubEnv('VITE_PRODUCT_CODE_LABEL', 'Custom Param')
    vi.stubEnv('VITE_SHADOW_LABEL', 'Wolf')
    vi.stubEnv('VITE_ASG_LABEL', 'Bear')
    vi.stubEnv('VITE_SAKNAY_LABEL', 'Dog')
    vi.resetModules()

    const mockWizardState = {
      currentStep: 6,
      readOnly: false,
      theme: 'dark',
      metadata: {
        entityName: 'product',
        productSource: 'ERP',
        productType: 'Catalog',
        productCode: 'P-42',
        location: '',
        environment: 'production',
        team: 'data-platform',
      },
      source: {
        sourceType: 'kafka',
        kafkaTopic: 'catalog-topic',
        kafkaOffset: 'earliest',
        kafkaKeys: '',
        format: 'JSON',
        streamingContinuity: 'continuous',
        recordsPerDay: 'millions',
      },
      upload: {
        done: true,
        schema: [
          { id: 'sku', name: 'sku', path: 'sku', type: 'string', nullable: false },
        ],
      },
      targetSchema: [
        { id: 'sku', name: 'sku', path: 'sku', type: 'string', required: true },
      ],
      mappings: [
        {
          src: 'sku',
          tgt: 'sku',
          transformer: 'none',
          extraInputs: [],
          tgtMetadata: {
            sendToSaknay: true,
          },
        },
      ],
      filters: [],
      sink: {
        sinkType: 'kafka',
        sinkKafkaTopic: 'catalog-sink',
        sinkKafkaAdditionalProperties: [],
        sinkKafkaAdditionalPropertiesEnabled: false,
        shadow: true,
        shadowTopic: '',
        saknay: true,
        saknayTopic: '',
        asg: true,
      },
      originalDraftYaml: '',
      originalDraftSignature: '',
    }

    const mockActions = {
      setNavigationMode: vi.fn(),
      goTo: vi.fn(),
      goBack: vi.fn(),
      goNext: vi.fn(),
    }
    const mockSaveDraftConfiguration = vi.fn(() => Promise.resolve({ success: true }))

    vi.doMock('../../shared/store/wizardStore.jsx', () => ({
      useWizard: () => ({
        state: mockWizardState,
        actions: mockActions,
      }),
    }))

    vi.doMock('../../shared/store/configContext.jsx', () => ({
      useConfig: () => ({
        transformers: [],
      }),
    }))

    vi.doMock('../../shared/hooks/useDeploymentProgress.js', () => ({
      useDeploymentProgress: () => ({
        isOpen: false,
        steps: [],
        currentStepIndex: 0,
        isComplete: false,
        isError: false,
        errorMessage: '',
        startDeployment: vi.fn(),
        reset: vi.fn(),
        updateStep: vi.fn(),
        setCurrentStepIndex: vi.fn(),
        setIsComplete: vi.fn(),
      }),
    }))

    vi.doMock('../../shared/services/configService.js', () => ({
      MOCK_FILTER_OPERATORS: [],
      saveDraftConfiguration: (...args) => mockSaveDraftConfiguration(...args),
    }))

    vi.doMock('../../shared/services/deploymentsService.js', () => ({
      fetchDeploymentSteps: vi.fn(async () => [{ id: 'validate', label: 'Validate' }]),
      deployFromYaml: vi.fn(async () => ({ success: true, deploymentId: 'dep-1' })),
      subscribeToDeploymentProgress: vi.fn(() => vi.fn()),
      setDeploymentStatus: vi.fn(),
    }))

    const { default: SummaryStep } = await import('./SummaryStep.jsx')

    render(<SummaryStep />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
      await Promise.resolve()
    })

    expect(mockSaveDraftConfiguration).toHaveBeenCalledTimes(1)

    const [{ yaml }] = mockSaveDraftConfiguration.mock.calls[0]
    expect(yaml).toContain('  dog:')
    expect(yaml).toContain('    customParam: "P-42"')
    expect(yaml).toContain('isWolfEnabled: true')
    expect(yaml).toContain('isDogEnabled: true')
    expect(yaml).toContain('isBearEnabled: true')
    expect(yaml).toContain('wolf_topic:')
    expect(yaml).toContain('    dog_topic:')
    expect(yaml).toContain('sendToDog: true')
    expect(yaml).not.toContain('productCode:')
    expect(yaml).not.toContain('isShadowEnabled:')
    expect(yaml).not.toContain('isSaknayEnabled:')
    expect(yaml).not.toContain('isAsgEnabled:')
    expect(yaml).not.toContain('shadow_topic:')
    expect(yaml).not.toContain('saknay_topic:')
    expect(yaml).not.toContain('sendToSaknay:')
    expect(yaml).not.toContain('metadata:\n  genomeEntity: product\n  customParam:')
    expect(yaml).not.toContain('  kafka:\n    topic: catalog-sink\n    dog_topic:')
  })
})

