import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SummaryStep from './SummaryStep.jsx'
import WizardFooter from '../etl-wizard/WizardFooter.jsx'
import { SummaryFooterProvider } from './summaryFooterContext.jsx'
import { buildPipelineChangeSignature } from '../../shared/services/pipelineChangeDetection.js'
import {
  ASG_YAML_FLAG_KEY,
  SAKNAY_TOPIC_YAML_KEY,
  SAKNAY_YAML_FLAG_KEY,
  SHADOW_TOPIC_YAML_KEY,
  SHADOW_YAML_FLAG_KEY,
  TARGET_SAKNAY_YAML_KEY,
} from '../../shared/services/appConfig.js'

const mockWizardState = {
  currentStep: 6,
  readOnly: false,
  theme: 'dark',
  metadata: {
    entityName: 'product',
    productSource: 'ERP',
    productType: 'Catalog',
    location: '',
    environment: 'production',
    team: 'data-platform',
  },
  source: {
    sourceType: 'kafka',
    kafkaEnv: 'production',
    kafkaTopic: 'catalog-topic',
    kafkaOffset: 'earliest',
    kafkaKeys: 'sku-key, inventory-key',
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
      extraInputs: [
        { field: 'skuVariant' },
      ],
    },
  ],
  filters: [],
  sink: {
    sinkType: 'kafka',
    sinkKafkaTopic: 'catalog-sink',
    sinkKafkaEnv: 'production',
    sinkKafkaAdditionalProperties: [],
    sinkRmqVhost: '',
    sinkRmqPort: '',
    sinkRmqQueue: '',
    sinkRmqExchange: '',
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
const mockFetchDeploymentSteps = vi.fn(() => Promise.resolve([{ id: 'validate', label: 'Validate' }]))
const mockDeployFromYaml = vi.fn(() => Promise.resolve({ success: true, deploymentId: 'dep-1' }))
const mockSubscribeToDeploymentProgress = vi.fn(() => vi.fn())
let mockTransformers = []
let mockFilterOperators = []
const originalClipboard = navigator.clipboard
const originalExecCommand = document.execCommand

function setClipboardApi(writeText) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
}

function setExecCommandMock(mockImpl) {
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: mockImpl,
  })
}

function setPassingValidationChecklist() {
  mockWizardState.metadata.location = 'OFFICE'
  mockWizardState.filters = [
    {
      id: 'group-1',
      logic: 'AND',
      rules: [
        { id: 'rule-1', field: 'sku', op: 'eq', value: 'ABC-123' },
      ],
      subgroups: [],
    },
  ]
}

vi.mock('../../shared/store/wizardStore.jsx', () => ({
  useWizard: () => ({
    state: mockWizardState,
    actions: mockActions,
  }),
}))

vi.mock('../../shared/store/configContext.jsx', () => ({
  useConfig: () => ({
    filters: mockFilterOperators,
    transformers: mockTransformers,
  }),
}))

vi.mock('../../shared/hooks/useDeploymentProgress.js', () => ({
  useDeploymentProgress: () => ({
    isOpen: false,
    steps: [],
    currentStepIndex: 0,
    isComplete: false,
    isError: false,
    errorMessage: '',
    startDeployment: vi.fn(),
    reset: vi.fn(),
  }),
}))

vi.mock('../../shared/services/configService.js', () => ({
  MOCK_FILTER_OPERATORS: [],
  saveDraftConfiguration: (...args) => mockSaveDraftConfiguration(...args),
}))

vi.mock('../../shared/services/deploymentsService.js', () => ({
  fetchDeploymentSteps: (...args) => mockFetchDeploymentSteps(...args),
  deployFromYaml: (...args) => mockDeployFromYaml(...args),
  subscribeToDeploymentProgress: (...args) => mockSubscribeToDeploymentProgress(...args),
}))

describe('SummaryStep save draft behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockWizardState.currentStep = 6
    mockWizardState.readOnly = false
    mockWizardState.theme = 'dark'
    mockWizardState.originalDraftYaml = ''
    mockWizardState.originalDraftSignature = ''
    mockWizardState.metadata.location = ''
    mockWizardState.source.format = 'JSON'
    mockWizardState.source.kafkaEnv = 'production'
    mockWizardState.source.csvDelimiter = undefined
    mockWizardState.source.rowDelimiter = ''
    mockWizardState.source.jsonSplit = ''
    mockWizardState.source.kafkaOffset = 'earliest'
    mockWizardState.source.kafkaKeys = 'sku-key, inventory-key'
    mockWizardState.mappings = [
      {
        src: 'sku',
        tgt: 'sku',
        transformer: 'none',
        extraInputs: [
          { field: 'skuVariant' },
        ],
      },
    ]
    mockWizardState.sink.shadow = false
    mockWizardState.sink.shadowTopic = ''
    mockWizardState.sink.saknay = false
    mockFilterOperators = []
    mockWizardState.sink.saknayTopic = ''
    mockWizardState.sink.asg = false
    mockWizardState.sink.sinkType = 'kafka'
    mockWizardState.sink.sinkKafkaTopic = 'catalog-sink'
    mockWizardState.sink.sinkKafkaEnv = 'production'
    mockWizardState.sink.sinkKafkaAdditionalProperties = []
    mockWizardState.sink.sinkRmqVhost = ''
    mockWizardState.sink.sinkRmqPort = ''
    mockWizardState.sink.sinkRmqQueue = ''
    mockWizardState.sink.sinkRmqExchange = ''
    mockWizardState.filters = []
    mockActions.setNavigationMode.mockReset()
    mockActions.goTo.mockReset()
    mockActions.goBack.mockReset()
    mockActions.goNext.mockReset()
    mockSaveDraftConfiguration.mockClear()
    mockFetchDeploymentSteps.mockClear()
    mockDeployFromYaml.mockClear()
    mockSubscribeToDeploymentProgress.mockClear()
    mockTransformers = []
    setClipboardApi(vi.fn().mockResolvedValue(undefined))
    setExecCommandMock(vi.fn(() => true))
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    if (originalClipboard === undefined) {
      delete navigator.clipboard
    } else {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      })
    }

    if (originalExecCommand === undefined) {
      delete document.execCommand
    } else {
      Object.defineProperty(document, 'execCommand', {
        configurable: true,
        value: originalExecCommand,
      })
    }
  })

  it('saves the draft and navigates to management after the success popup closes', async () => {
    render(<SummaryStep />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
      await Promise.resolve()
    })

    expect(mockSaveDraftConfiguration).toHaveBeenCalledTimes(1)
    expect(mockSaveDraftConfiguration.mock.calls[0][0].yaml).not.toMatch(/\n\s*\n/)
    expect(mockSaveDraftConfiguration.mock.calls[0][0].yaml).not.toContain('# Generated by ETL Pipeline Studio')

    expect(screen.getByText('Draft Saved')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(1800)
      await Promise.resolve()
    })

    expect(mockActions.setNavigationMode).toHaveBeenCalledWith('etl-management')
  })

  it('renders summary save actions in the shared footer row when hosted by the summary footer provider', () => {
    render(
      <SummaryFooterProvider>
        <SummaryStep />
        <WizardFooter />
      </SummaryFooterProvider>
    )

    expect(screen.getByText('Step 7 of 7 — Summary')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /save draft/i })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: /save & deploy/i })).toHaveLength(1)
    expect(screen.getByRole('button', { name: /save & deploy/i })).toBeDisabled()
  })

  it('disables Save & Deploy when not all validation checklist items pass', () => {
    render(<SummaryStep />)

    expect(screen.getByRole('button', { name: /save & deploy/i })).toBeDisabled()
  })

  it('allows Save & Deploy when all required checklist items pass and no filters are defined', () => {
    mockWizardState.metadata.location = 'OFFICE'

    render(<SummaryStep />)

    expect(screen.getByRole('button', { name: /save & deploy/i })).toBeEnabled()
  })

  it('disables Save & Deploy when a filter rule is incomplete', () => {
    mockWizardState.metadata.location = 'OFFICE'
    mockWizardState.filters = [
      {
        id: 'group-1',
        logic: 'AND',
        rules: [
          { id: 'rule-1', field: 'sku', op: 'eq', value: '' },
        ],
        subgroups: [],
      },
    ]

    render(<SummaryStep />)

    expect(screen.getByText(/Filters incomplete\./i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save & deploy/i })).toBeDisabled()
  })

  it('includes missing required transformer properties in the validation checklist and keeps Save & Deploy disabled', () => {
    setPassingValidationChecklist()
    mockTransformers = [
      {
        _id: 'tf-required',
        name: 'RequiredTransformer',
        propsSchema: [{ key: 'logic', label: 'Logic', required: true }],
      },
    ]
    mockWizardState.mappings = [
      {
        src: 'sku',
        tgt: 'sku',
        transformer: 'tf-required',
        transformerProps: { logic: '   ' },
        transformerChainDetailed: [{ id: 'tf-required', props: { logic: '   ' } }],
      },
    ]

    render(<SummaryStep />)

    expect(screen.getByText(/Incomplete transformer configuration:/i)).toHaveTextContent('RequiredTransformer')
    expect(screen.getByRole('button', { name: /save & deploy/i })).toBeDisabled()
  })

  it('renders transformer props with = separators in the YAML preview', () => {
    setPassingValidationChecklist()
    mockWizardState.upload.schema = [
      { id: 'stockQty', name: 'stockQty', path: 'stockQty', type: 'number', nullable: false },
    ]
    mockWizardState.targetSchema = [
      { id: 'unitPrice', name: 'unitPrice', path: 'unitPrice', type: 'number', required: true },
    ]
    mockWizardState.mappings = [
      {
        src: 'stockQty',
        tgt: 'unitPrice',
        transformer: 'ConvertMulti',
        transformerProps: {
          logic: 'a?a1|b?b1',
          defaultValue: 'a',
          case_sensitive: 'a',
        },
      },
    ]

    render(<SummaryStep />)

    const yamlPreview = screen.getByTestId('yaml-preview')
    expect(yamlPreview).toHaveTextContent('transformations:')
    expect(yamlPreview).toHaveTextContent('ConvertMulti([stockQty],[')
    expect(yamlPreview).toHaveTextContent('logic=')
    expect(yamlPreview).toHaveTextContent('defaultValue=')
    expect(yamlPreview).toHaveTextContent('case_sensitive=')
    expect(yamlPreview).toHaveTextContent('-> (number, unitPrice)')
    expect(yamlPreview).not.toHaveTextContent('logic: a?a1|b?b1')
  })

  it('uses the REST API filter name in the YAML preview', () => {
    setPassingValidationChecklist()
    mockFilterOperators = [
      {
        id: 'eq',
        name: 'equals',
        isReverted: false,
      },
    ]

    render(<SummaryStep />)

    const yamlPreview = screen.getByTestId('yaml-preview')
    expect(yamlPreview).toHaveTextContent('filters:')
    expect(yamlPreview).toHaveTextContent('type: equals')
    expect(yamlPreview).not.toHaveTextContent('type: EQ')
  })

  it('shows a no-change popup and skips deployment when the edited YAML is unchanged', async () => {
    setPassingValidationChecklist()
    mockWizardState.originalDraftYaml = `metadata:
  genomeEntity: product
  location: "OFFICE"
  productSource: ERP
  productType: Catalog
  environment: PROD
  owner: data-platform
  dataStreamInfo:
    streamingContinuity: continuous
    avgRecordsAmount: millions

general:
  inputFormat: JSON
  outputFormat: JSON
  ${SHADOW_YAML_FLAG_KEY}: false
  ${SAKNAY_YAML_FLAG_KEY}: true
  ${ASG_YAML_FLAG_KEY}: false

source:
  kafka:
    brokers: PROD
    topic: catalog-topic
    offset: earliest
    filter: "sku-key, inventory-key"
input:
  convert:
    mapping:
      - name: sku
        type: string

output:
  mapping:
    - inName: sku
      outName: sku
      sendToGP: true
      ${TARGET_SAKNAY_YAML_KEY}: true
      additionalInputs:
        - skuVariant
  kafka:
    brokers: PROD
    topic: catalog-sink
  saknay:
    ${SAKNAY_TOPIC_YAML_KEY}:
filters:
  dependencies:
    - type: EQ
  config:
    - rule:
        and:
          - field: sku
            isReverted: false
            type: EQ
            values:
              - ABC-123`
    mockWizardState.originalDraftSignature = buildPipelineChangeSignature(mockWizardState)

    render(<SummaryStep />)

    expect(screen.getByRole('button', { name: /save & deploy/i })).toHaveTextContent(' Save & Deploy')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save & deploy/i }))
      await Promise.resolve()
    })

    expect(screen.getByText('No Changes Detected')).toBeInTheDocument()
    expect(screen.getByText('No changes were detected compared to the existing pipeline YAML. The system will not deploy anything.')).toBeInTheDocument()
    expect(mockFetchDeploymentSteps).not.toHaveBeenCalled()
    expect(mockDeployFromYaml).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'OK' }))
      await Promise.resolve()
    })

    expect(mockActions.setNavigationMode).toHaveBeenCalledWith('etl-management')
  })

  it('blocks deployment when kafka offset is missing', async () => {
    setPassingValidationChecklist()
    mockWizardState.source.kafkaOffset = ''

    render(<SummaryStep />)

    expect(screen.getByRole('button', { name: /save & deploy/i })).toBeDisabled()
    expect(mockFetchDeploymentSteps).not.toHaveBeenCalled()
    expect(mockDeployFromYaml).not.toHaveBeenCalled()
  })

  it('sends deploy request params and configurationYaml when saving and deploying', async () => {
    setPassingValidationChecklist()
    mockWizardState.source.kafkaOffset = 'earliest'
    mockWizardState.source.kafkaKeys = 'sku-key, inventory-key'
    mockWizardState.sink.sinkKafkaAdditionalProperties = [
      { id: '1', key: 'acks', value: 'all' },
      { id: '2', key: 'compression.type', value: 'gzip' },
    ]

    render(<SummaryStep />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save & deploy/i }))
      await Promise.resolve()
    })

    expect(mockFetchDeploymentSteps).toHaveBeenCalledTimes(1)
    expect(mockDeployFromYaml).toHaveBeenCalledWith(expect.objectContaining({
      productType: 'Catalog',
      source: 'ERP',
      team: 'data-platform',
      environment: 'PROD',
      isDeploy: true,
      configurationYaml: expect.stringContaining('productType: Catalog'),
    }))
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).toContain('genomeEntity: product')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).toContain('productSource: ERP')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).not.toContain('# Generated by ETL Pipeline Studio')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).not.toContain('\n  id:')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).not.toContain('\n  entity:')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).toContain('location: "OFFICE"')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).toMatch(/metadata:[\s\S]*?general:[\s\S]*?source:/)
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).toContain('source:\n  kafka:\n    brokers: PROD\n    topic: catalog-topic')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).toContain('offset: earliest')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).toContain('filter: "sku-key, inventory-key"')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).toContain('input:\n  convert:\n    mapping:\n      - name: sku')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).toContain('output:\n  mapping:')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).toContain('output:\n  mapping:')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).toContain('  kafka:\n    brokers: PROD\n    topic: catalog-sink')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).toContain(`  saknay:\n    ${SAKNAY_TOPIC_YAML_KEY}:`)
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).not.toContain(`  kafka:\n    brokers: PROD\n    topic: catalog-sink\n    ${SAKNAY_TOPIC_YAML_KEY}:`)
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).toContain('additionalConfig:\n  "acks": "all"\n  "compression.type": "gzip"')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).not.toContain('additional_properties:')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).not.toContain('\nsink:\n')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).not.toContain('source:\n  type: kafka')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).not.toContain('source:\n  format: JSON')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).not.toContain('keyFilter:')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).toContain('general:\n  inputFormat: JSON\n  outputFormat: JSON')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).toContain(`${SHADOW_YAML_FLAG_KEY}: false`)
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).toContain(`${SAKNAY_YAML_FLAG_KEY}: true`)
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).toContain(`${ASG_YAML_FLAG_KEY}: false`)
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).not.toContain('\n  saknay: true')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).not.toContain('\n  shadow: true')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).not.toContain('\n  asg: true')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).not.toContain('\n  format: JSON')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).toContain('additionalInputs:')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).not.toContain('additional_inputs:')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).toContain('streamingContinuity: continuous')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).toContain('avgRecordsAmount: millions')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).toContain('filters:\n  dependencies:\n    - type: EQ\n  config:\n    - rule:\n        and:\n          - field: sku\n            isReverted: false\n            type: EQ\n            values:\n              - ABC-123')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).not.toContain('filters:\n  - ')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).not.toContain('streaming_continuity:')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).not.toContain('avg_records_amount:')
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml).not.toContain(`metadata:\n  genomeEntity: product\n  ${TARGET_SAKNAY_YAML_KEY}`)
    expect(mockDeployFromYaml.mock.calls[0][0].configurationYaml.trimEnd()).not.toMatch(/}\s*$/)
    expect(mockSubscribeToDeploymentProgress).toHaveBeenCalledWith('dep-1', expect.any(Object))
  })

  it('serializes CSV row delimiter under general.split.delimiter', async () => {
    setPassingValidationChecklist()
    mockWizardState.source.format = 'CSV'
    mockWizardState.source.csvDelimiter = ';'
    mockWizardState.source.rowDelimiter = '\\r\\n'

    render(<SummaryStep />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save & deploy/i }))
      await Promise.resolve()
    })

    const yaml = mockDeployFromYaml.mock.calls[0][0].configurationYaml
    expect(yaml).toContain('general:\n  inputFormat: delimited\n  outputFormat: delimited')
    expect(yaml).toContain('input:\n  delimited:\n    columnDelimiter: ";"\n    mapping:\n      - name: sku')
    expect(yaml).toContain('split:')
    expect(yaml).toContain('delimiter: "\\\\r\\\\n"')
  })

  it('serializes JSON split key under input.convert.splitByPath', async () => {
    setPassingValidationChecklist()
    mockWizardState.source.format = 'JSON'
    mockWizardState.source.jsonSplit = '$.items'

    render(<SummaryStep />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save & deploy/i }))
      await Promise.resolve()
    })

    const yaml = mockDeployFromYaml.mock.calls[0][0].configurationYaml
    expect(yaml).toContain('input:\n  convert:\n    splitByPath: "$.items"\n    mapping:\n      - name: sku')
    expect(yaml).not.toContain('split_key:')
  })

  it('serializes RabbitMQ source config values into the YAML when rabbitmq is selected', async () => {
    setPassingValidationChecklist()
    mockWizardState.source.sourceType = 'rabbitmq'
    mockWizardState.source.rmqIp = '10.0.0.12'
    mockWizardState.source.rmqPort = '5672'
    mockWizardState.source.rmqUsername = 'guest'
    mockWizardState.source.rmqPassword = 'secret'
    mockWizardState.source.rmqQueue = 'products.ingest'
    mockWizardState.source.rmqVhost = '/etl'

    render(<SummaryStep />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save & deploy/i }))
      await Promise.resolve()
    })

    const yaml = mockDeployFromYaml.mock.calls[0][0].configurationYaml
    expect(yaml).toContain('source:\n  rabbitmq:\n    ip: 10.0.0.12\n    port: 5672\n    username: guest\n    password: secret\n    queue: products.ingest\n    vhost: /etl')
    expect(yaml).not.toContain('source:\n  kafka:')
  })

  it('serializes RabbitMQ sink config values into the YAML when the rabbitmq sink is selected', async () => {
    setPassingValidationChecklist()
    mockWizardState.sink.sinkType = 'rabbitmq'
    mockWizardState.sink.sinkRmqVhost = '/etl'
    mockWizardState.sink.sinkRmqPort = '5672'
    mockWizardState.sink.sinkRmqQueue = 'products.sink'
    mockWizardState.sink.sinkRmqExchange = 'etl.exchange'

    render(<SummaryStep />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save & deploy/i }))
      await Promise.resolve()
    })

    const yaml = mockDeployFromYaml.mock.calls[0][0].configurationYaml
    expect(yaml).toContain('output:\n  mapping:')
    expect(yaml).toContain('  rabbitmq:\n    vhost: /etl\n    port: 5672\n    queue: products.sink\n    exchange: etl.exchange')
    expect(yaml).not.toContain('\n  kafka:\n    topic: catalog-sink')
    expect(yaml).not.toContain('additionalConfig:\n')
  })

  it('serializes empty shadow_topic as an empty YAML value', async () => {
    setPassingValidationChecklist()
    mockWizardState.sink.shadow = true
    mockWizardState.sink.shadowTopic = ''

    render(<SummaryStep />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save & deploy/i }))
      await Promise.resolve()
    })

    const yaml = mockDeployFromYaml.mock.calls[0][0].configurationYaml
    expect(yaml).toContain(`  kafka:\n    brokers: PROD\n    topic: catalog-sink\n    ${SHADOW_TOPIC_YAML_KEY}:`)
    expect(yaml).not.toContain(`${SHADOW_TOPIC_YAML_KEY}: auto`)
  })

  it('serializes empty kafka sink topic as an empty YAML value instead of N/A', async () => {
    setPassingValidationChecklist()
    mockWizardState.sink.sinkKafkaTopic = ''

    render(<SummaryStep />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save & deploy/i }))
      await Promise.resolve()
    })

    const yaml = mockDeployFromYaml.mock.calls[0][0].configurationYaml
    expect(yaml).toContain('  kafka:\n    brokers: PROD\n    topic:')
    expect(yaml).not.toContain('topic: N/A')
  })

  it('renders source and sink kafka brokers from their own selected environments in the YAML preview', () => {
    setPassingValidationChecklist()
    mockWizardState.metadata.environment = 'PROD'
    mockWizardState.source.kafkaEnv = 'CAP'
    mockWizardState.sink.sinkKafkaEnv = 'PROD'

    render(<SummaryStep />)

    const yamlPreview = screen.getByTestId('yaml-preview')
    expect(yamlPreview).toHaveTextContent('source:')
    expect(yamlPreview).toHaveTextContent('brokers: CAP')
    expect(yamlPreview).toHaveTextContent('brokers: PROD')
    expect(yamlPreview).toHaveTextContent('topic: catalog-topic')
    expect(yamlPreview).toHaveTextContent('topic: catalog-sink')
  })

  it('highlights additionalConfig and nested kafka section keys in the YAML preview', () => {
    setPassingValidationChecklist()
    mockWizardState.sink.shadow = true
    mockWizardState.sink.shadowTopic = ''
    mockWizardState.sink.sinkKafkaAdditionalProperties = [
      { id: '1', key: 'acks', value: 'all' },
    ]

    render(<SummaryStep />)

    expect(screen.getByText('additionalConfig:')).toHaveStyle({
      color: 'rgb(208, 224, 255)',
      fontWeight: '600',
    })

    screen.getAllByText((_, element) => element?.textContent === '  kafka:').forEach((line) => {
      expect(line).toHaveStyle({
        color: 'rgb(208, 224, 255)',
        fontWeight: '600',
      })
    })

    ;[`${SHADOW_TOPIC_YAML_KEY}:`, 'saknay:', `${SAKNAY_TOPIC_YAML_KEY}:`].forEach((key) => {
      expect(screen.getByText((_, element) => element?.textContent?.trim() === key)).toHaveStyle({
        color: 'rgb(125, 211, 252)',
        fontWeight: '400',
      })
    })
  })

  it('uses a light YAML preview palette when the summary is in light mode', () => {
    mockWizardState.theme = 'light'

    render(<SummaryStep />)

    expect(screen.getByTestId('yaml-preview')).toHaveStyle({
      background: 'rgb(248, 250, 252)',
      color: 'rgb(51, 65, 85)',
    })

    expect(screen.getByText('metadata:')).toHaveStyle({
      color: 'rgb(29, 78, 216)',
      fontWeight: '600',
    })
  })

  it('copies the YAML preview with the async clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboardApi(writeText)

    render(<SummaryStep />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy yaml/i }))
      await Promise.resolve()
    })

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('genomeEntity: product'))
    expect(writeText.mock.calls[0][0]).not.toMatch(/\n\s*\n/)
    expect(writeText.mock.calls[0][0]).not.toContain('# Generated by ETL Pipeline Studio')
    expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument()
  })

  it('falls back to document.execCommand when clipboard API writes are blocked', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'))
    const execCommand = vi.fn(() => true)

    setClipboardApi(writeText)
    setExecCommandMock(execCommand)

    render(<SummaryStep />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy yaml/i }))
      await Promise.resolve()
    })

    expect(writeText).toHaveBeenCalledTimes(1)
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument()
    expect(screen.queryByText('Copy Failed')).not.toBeInTheDocument()
  })

  it('shows a copy failure dialog when both clipboard strategies fail', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'))
    const execCommand = vi.fn(() => false)

    setClipboardApi(writeText)
    setExecCommandMock(execCommand)

    render(<SummaryStep />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy yaml/i }))
      await Promise.resolve()
    })

    expect(writeText).toHaveBeenCalledTimes(1)
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(screen.getByText('Copy Failed')).toBeInTheDocument()
    expect(screen.getByText('Clipboard access is blocked in this environment. Please copy the YAML preview manually.')).toBeInTheDocument()
  })
})