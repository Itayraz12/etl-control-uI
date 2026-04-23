import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FiltersStep from './FiltersStep.jsx'
import { WizardProvider } from '../../shared/store/wizardStore.jsx'

const WIZARD_STORAGE_KEY = 'etl-studio-wizard-draft'
const PREVIEW_USER = { userId: 'alice', teamName: 'platform' }
let mockFilters = []

vi.mock('../../shared/store/configContext.jsx', () => ({
  useConfig: () => ({
    filters: mockFilters,
  }),
}))

function seedPreviewState(wizardState) {
  window.history.pushState({}, '', '/?preview=true&deploymentId=dep-1&previewSource=saved')
  localStorage.setItem(
    'etl-deployment-preview:dep-1:saved',
    JSON.stringify({ wizardState })
  )
}

function renderStep({ user = null, filters = null, uploadSchema = null } = {}) {
  localStorage.setItem(
    WIZARD_STORAGE_KEY,
    JSON.stringify({
      navigationMode: 'etl-config',
      currentStep: 3,
      completedSteps: [0, 1, 2],
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
      },
      upload: {
        done: true,
        schema: uploadSchema ?? [
          { id: 'sku', name: 'sku', path: 'sku', type: 'string' },
        ],
        fileName: 'sample.json',
        fileType: 'application/json',
        fileSize: 123,
      },
      targetSchema: [],
      mappings: [],
      filters: filters ?? [
        {
          id: 'g-1',
          logic: 'AND',
          mode: 'include',
          rules: [{ id: 'r-1', field: 'sku', op: 'eq', value: '1' }],
          subgroups: [],
        },
      ],
      sink: { sinkType: 'kafka' },
      theme: 'dark',
    })
  )

  return render(
    <WizardProvider user={user}>
      <FiltersStep />
    </WizardProvider>
  )
}

describe('FiltersStep view mode', () => {
  beforeEach(() => {
    mockFilters = [
      { id: 'gt', name: 'Greater Than', isReverted: false },
      { id: 'gt', name: 'not Greater Than', isReverted: true },
      { id: 'eq', name: 'Equals', isReverted: false },
      { id: 'eq', name: 'not Equals', isReverted: true },
      { id: 'not_null', name: 'Is Not Null', isReverted: false },
    ]
  })

  it('disables the root group logic buttons and hides the root include/exclude buttons in preview mode', () => {
    localStorage.clear()
    window.history.pushState({}, '', '/')

    seedPreviewState({
      navigationMode: 'etl-config',
      currentStep: 3,
      completedSteps: [0, 1, 2],
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
        format: 'JSON',
      },
      upload: {
        done: true,
        schema: [
          { id: 'sku', name: 'sku', path: 'sku', type: 'string' },
        ],
        fileName: 'sample.json',
        fileType: 'application/json',
        fileSize: 123,
      },
      filters: [
        {
          id: 'g-1',
          logic: 'AND',
          mode: 'include',
          rules: [{ id: 'r-1', field: 'sku', op: 'eq', value: '1' }],
          subgroups: [],
        },
      ],
    })

    renderStep({ user: PREVIEW_USER })

    expect(screen.getByRole('button', { name: 'AND' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'OR' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'include' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'exclude' })).not.toBeInTheDocument()
  })

  it('keeps the selected reverted operator when adding a new condition to the current group', () => {
    renderStep()

    fireEvent.change(screen.getByDisplayValue('Equals'), { target: { value: 'eq::1' } })
    fireEvent.click(screen.getByRole('button', { name: /\+ add condition/i }))

    expect(screen.getAllByDisplayValue('not Equals')).toHaveLength(2)

    const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
    expect(persisted.filters[0].rules).toEqual([
      expect.objectContaining({ field: 'sku', op: 'eq', isReverted: true, value: '1' }),
      expect.objectContaining({ field: 'sku', op: 'eq', isReverted: true, value: '1' }),
    ])
  })

  it('creates a root group by default and hides add-group buttons', () => {
    renderStep({ filters: [] })

    expect(screen.getByText('ROOT GROUP')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /\+ add group/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'include' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'exclude' })).not.toBeInTheDocument()
  })

  it('uses the first configured operator when adding a condition to the default root group', () => {
    renderStep({ filters: [] })

    fireEvent.click(screen.getByRole('button', { name: /\+ add condition/i }))

    expect(screen.getAllByDisplayValue('Greater Than')).toHaveLength(1)

    const persisted = JSON.parse(localStorage.getItem(WIZARD_STORAGE_KEY) || '{}')
    expect(persisted.filters).toEqual([
      expect.objectContaining({
        id: 'root-group',
        mode: 'exclude',
        isRevertible: true,
        rules: [expect.objectContaining({ op: 'gt', isReverted: false })],
      }),
    ])
  })

  it('normalizes existing root groups to exclude', () => {
    renderStep({
      filters: [
        {
          id: 'g-1',
          logic: 'AND',
          mode: 'include',
          rules: [{ id: 'r-1', field: 'sku', op: 'eq', value: '1' }],
          subgroups: [],
        },
      ],
    })

    expect(screen.queryByRole('button', { name: 'include' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'exclude' })).not.toBeInTheDocument()
    expect(screen.getByText('NOT')).toBeInTheDocument()
  })

  it('uses normalized additionalParams descriptions as placeholders for complex filter inputs', () => {
    mockFilters = [
      {
        id: 'eq',
        name: 'Equals',
        isReverted: false,
      },
      {
        id: 'severity_filter',
        name: 'Severity Filter',
        isReverted: false,
        additionalProperties: {
          properties: [
            {
              key: 'severity',
              label: 'Severity',
              type: 'text',
              default: '',
              description: 'Minimum severity threshold to include.',
              isArray: false,
            },
          ],
        },
      },
    ]

    renderStep()

    fireEvent.change(screen.getByDisplayValue('Equals'), { target: { value: 'severity_filter::0' } })

    expect(screen.getByPlaceholderText('Minimum severity threshold to include.')).toBeInTheDocument()
  })

  it('uses the REST API filter name in the generated filter expression preview', () => {
    mockFilters = [
      {
        id: 'eq',
        name: 'equals',
        isReverted: false,
      },
    ]

    renderStep()

    const expressionCard = screen.getByText('Generated Filter Expression').closest('section, div')?.parentElement
      || screen.getByText('Generated Filter Expression').parentElement

    expect(expressionCard).toHaveTextContent('sku')
    expect(expressionCard).toHaveTextContent('equals')
    expect(expressionCard).toHaveTextContent('[1]')
    expect(expressionCard).not.toHaveTextContent(' sku eq ')
  })

  it('shows the filter description as a right-side hover hint on the filter-name dropdown', async () => {
    const user = userEvent.setup()

    mockFilters = [
      {
        id: 'eq',
        name: 'equals',
        description: 'Compare the field to an exact value.',
        isReverted: false,
      },
    ]

    renderStep()

    await user.hover(screen.getByTestId('root-filter-operator-r-1'))

    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip).toHaveTextContent('Compare the field to an exact value.')
    expect(tooltip).toHaveStyle({
      left: 'calc(100% + 8px)',
    })

    await user.unhover(screen.getByTestId('root-filter-operator-r-1'))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('selects the correct root-group operator when hydrated state stores the API display name', () => {
    mockFilters = [
      {
        id: 'eq',
        name: 'equals',
        isReverted: false,
      },
      {
        id: 'eq',
        name: 'not equals',
        isReverted: true,
      },
    ]

    renderStep({
      filters: [
        {
          id: 'g-1',
          logic: 'AND',
          mode: 'exclude',
          rules: [{ id: 'r-1', field: 'sku', op: 'equals', value: '1' }],
          subgroups: [],
        },
      ],
    })

    expect(screen.getByTestId('root-filter-operator-r-1')).toHaveValue('eq::0')
    expect(screen.getByDisplayValue('equals')).toBeInTheDocument()
  })

  it('does not render any extra value textbox when a filter explicitly has no additionalParams', () => {
    mockFilters = [
      {
        id: 'eq',
        name: 'Equals',
        isReverted: false,
      },
      {
        id: 'status_filter',
        name: 'Status Filter',
        isReverted: false,
        additionalParams: [],
        additionalProperties: {
          properties: [
            {
              key: 'severity',
              label: 'Severity',
              type: 'text',
              default: '',
              description: 'Should stay hidden.',
            },
          ],
        },
      },
    ]

    renderStep()

    fireEvent.change(screen.getByDisplayValue('Equals'), { target: { value: 'status_filter::0' } })

    expect(screen.queryByLabelText('Severity')).not.toBeInTheDocument()
    expect(screen.queryByTestId('filter-params-r-1')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Filter value')).not.toBeInTheDocument()
  })

  it('renders root-group complex params inline and keeps them invalid when empty', () => {
    mockFilters = [
      {
        id: 'eq',
        name: 'Equals',
        isReverted: false,
      },
      {
        id: 'severity_filter',
        name: 'Severity Filter',
        isReverted: false,
        additionalParams: [
          {
            name: 'severity',
            description: 'Minimum severity threshold to include.',
            type: 'string',
            isArray: false,
          },
        ],
        additionalProperties: {
          properties: [
            {
              key: 'severity',
              label: 'Severity',
              type: 'text',
              default: '',
              description: 'Minimum severity threshold to include.',
              isArray: false,
            },
          ],
        },
      },
    ]

    renderStep()

    fireEvent.change(screen.getByDisplayValue('Equals'), { target: { value: 'severity_filter::0' } })

    expect(screen.getByLabelText('Severity')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByTestId('filter-params-r-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('root-filter-value-gap-r-1')).toHaveStyle({
      width: '1cm',
      minWidth: '1cm',
      flex: '0 0 auto',
    })
    expect(screen.getByTestId('root-filter-value-area-r-1')).toHaveStyle({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      flexWrap: 'wrap',
    })
    expect(screen.getByTestId('root-filter-inline-params-r-1')).toHaveStyle({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      flexWrap: 'wrap',
    })
  })

  it('uses additionalParams.displayName in the filter builder while keeping the param name in the generated expression', () => {
    mockFilters = [
      {
        id: 'eq',
        name: 'Equals',
        isReverted: false,
      },
      {
        id: 'severity_filter',
        name: 'Severity Filter',
        isReverted: false,
        additionalParams: [
          {
            name: 'severity',
            displayName: 'Severity threshold',
            description: 'Minimum severity threshold to include.',
            type: 'string',
            isArray: false,
          },
        ],
        additionalProperties: {
          properties: [
            {
              key: 'severity',
              label: 'Severity',
              type: 'text',
              default: '',
              description: 'Minimum severity threshold to include.',
              isArray: false,
            },
          ],
        },
      },
    ]

    renderStep()

    fireEvent.change(screen.getByDisplayValue('Equals'), { target: { value: 'severity_filter::0' } })

    const displayInput = screen.getByLabelText('Severity threshold')
    expect(displayInput).toBeInTheDocument()
    expect(screen.getByText('Severity threshold:')).toBeInTheDocument()

    fireEvent.change(displayInput, { target: { value: 'warning' } })

    const expressionCard = screen.getByText('Generated Filter Expression').closest('section, div')?.parentElement
      || screen.getByText('Generated Filter Expression').parentElement

    expect(expressionCard).toHaveTextContent('severity=warning')
    expect(expressionCard).not.toHaveTextContent('Severity threshold=warning')
  })

  it('left-aligns root group rows and sizes field/operator selects from the longest labels', () => {
    mockFilters = [
      { id: 'eq', name: 'Equals', isReverted: false },
      { id: 'very_specific_status_filter', name: 'Very Specific Status Filter', isReverted: false },
    ]

    renderStep({
      uploadSchema: [
        { id: 'sku', name: 'sku', path: 'sku', type: 'string' },
        { id: 'customer_reference_identifier', name: 'customer_reference_identifier', path: 'customer_reference_identifier', type: 'string' },
      ],
      filters: [
        {
          id: 'g-1',
          logic: 'AND',
          mode: 'include',
          rules: [{ id: 'r-1', field: 'sku', op: 'eq', value: '1' }],
          subgroups: [],
        },
      ],
    })

    expect(screen.getByTestId('root-filter-row-r-1')).toHaveStyle({
      justifyContent: 'flex-start',
      flexWrap: 'wrap',
    })
    expect(screen.getByTestId('root-filter-logic-r-1')).toHaveStyle({
      width: '6ch',
      minWidth: '6ch',
      flex: '0 0 auto',
      textAlign: 'right',
    })
    expect(screen.getByTestId('root-filter-field-r-1')).toHaveStyle({
      width: '32ch',
      minWidth: '32ch',
      flex: '0 0 auto',
    })
    expect(screen.getByTestId('root-filter-operator-r-1')).toHaveStyle({
      width: '31ch',
      minWidth: '31ch',
      flex: '0 0 auto',
    })
    expect(screen.getByTestId('root-filter-value-gap-r-1')).toHaveStyle({
      width: '1cm',
      minWidth: '1cm',
      flex: '0 0 auto',
    })
  })

  it('keeps root-row field alignment the same for WHERE and AND/OR rows', () => {
    renderStep({
      filters: [
        {
          id: 'g-1',
          logic: 'AND',
          mode: 'exclude',
          rules: [
            { id: 'r-1', field: 'sku', op: 'eq', value: '1' },
            { id: 'r-2', field: 'sku', op: 'eq', value: '2' },
          ],
          subgroups: [],
        },
      ],
    })

    expect(screen.getByTestId('root-filter-logic-r-1')).toHaveStyle({
      width: '6ch',
      minWidth: '6ch',
      textAlign: 'right',
    })
    expect(screen.getByTestId('root-filter-logic-r-2')).toHaveStyle({
      width: '6ch',
      minWidth: '6ch',
      textAlign: 'right',
    })
    expect(screen.getByTestId('root-filter-field-r-1')).toHaveStyle({
      width: '12ch',
      minWidth: '12ch',
    })
    expect(screen.getByTestId('root-filter-field-r-2')).toHaveStyle({
      width: '12ch',
      minWidth: '12ch',
    })
  })

  it('keeps the root-row delete button aligned to the right edge', () => {
    renderStep({
      filters: [
        {
          id: 'g-1',
          logic: 'AND',
          mode: 'exclude',
          rules: [{ id: 'r-1', field: 'sku', op: 'eq', value: '1' }],
          subgroups: [],
        },
      ],
    })

    expect(screen.getByTestId('root-filter-remove-r-1')).toHaveStyle({
      marginLeft: 'auto',
      flex: '0 0 auto',
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
    })
  })
})




