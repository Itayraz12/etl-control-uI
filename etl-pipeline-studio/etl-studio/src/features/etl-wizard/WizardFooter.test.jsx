import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WizardFooter from './WizardFooter.jsx'

const wizardState = {
  currentStep: 1,
  metadata: { productSource: 'ERP', productType: 'Inventory', environment: 'production', entityName: 'Product' },
  source: { sourceType: 'kafka' },
  upload: { done: false, schema: [], fileName: '', fileType: '', fileSize: 0 },
  mappings: [],
  targetSchema: [],
  sink: { sinkType: '' },
}

const actions = {
  goBack: vi.fn(),
  goNext: vi.fn(),
}

vi.mock('../../shared/store/wizardStore.jsx', () => ({
  useWizard: () => ({
    state: wizardState,
    actions,
  }),
}))

vi.mock('../../shared/store/configContext.jsx', () => ({
  useConfig: () => ({
    transformers: [
      {
        _id: 'tf-required',
        name: 'RequiredTransformer',
        propsSchema: [{ key: 'logic', label: 'Logic', required: true }],
      },
    ],
  }),
}))

describe('WizardFooter', () => {
  beforeEach(() => {
    wizardState.currentStep = 1
    wizardState.upload = { done: false, schema: [], fileName: '', fileType: '', fileSize: 0 }
    wizardState.mappings = []
    wizardState.targetSchema = []
    actions.goBack.mockClear()
    actions.goNext.mockClear()
  })

  it('does not show the Draft badge next to the Back button', () => {
    render(<WizardFooter />)

    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
    expect(screen.queryByText(/draft/i)).not.toBeInTheDocument()
  })

  it('includes incomplete transformer requirements in the field-mapping validation modal', async () => {
    const user = userEvent.setup()

    wizardState.currentStep = 4
    wizardState.upload = { done: true, schema: [{ id: 'sourceName' }], fileName: 'schema.json', fileType: 'application/json', fileSize: 10 }
    wizardState.targetSchema = [{ id: 'targetName', name: 'Target Name', required: true }]
    wizardState.mappings = [
      {
        src: 'sourceName',
        tgt: 'targetName',
        transformer: 'tf-required',
        transformerProps: { logic: '' },
        transformerChainDetailed: [{ id: 'tf-required', props: { logic: '' } }],
      },
    ]

    render(<WizardFooter />)

    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(screen.getByText('Field mapping is incomplete')).toBeInTheDocument()
    expect(screen.getByText(/Incomplete transformers: RequiredTransformer \(Logic\)/i)).toBeInTheDocument()
  })
})