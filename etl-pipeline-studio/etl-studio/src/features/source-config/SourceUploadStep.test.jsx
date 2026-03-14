import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SourceUploadStep from './SourceUploadStep.jsx'
import { WizardProvider } from '../../shared/store/wizardStore.jsx'

const fetchSchemaByExample = vi.fn()

vi.mock('../../shared/services/configService.js', () => ({
  fetchSchemaByExample: (...args) => fetchSchemaByExample(...args),
}))

vi.mock('../../shared/store/mockModeContext.jsx', () => ({
  useMockMode: () => ({ useMock: false, setUseMock: vi.fn() }),
}))

function renderStep() {
  return render(
    <WizardProvider>
      <SourceUploadStep />
    </WizardProvider>
  )
}

describe('SourceUploadStep', () => {
  beforeEach(() => {
    fetchSchemaByExample.mockReset()
  })

  it('opens the native file picker when clicking Upload sample', async () => {
    const user = userEvent.setup()
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})

    renderStep()

    await user.click(screen.getByRole('button', { name: 'Upload sample' }))

    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('parses a JSON Schema response and persists the inferred source fields', async () => {
    fetchSchemaByExample.mockResolvedValue({
      type: 'object',
      required: ['customerId'],
      properties: {
        customerId: { type: 'string' },
        amount: { type: 'number' },
        customer: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
      },
    })

    renderStep()

    const input = screen.getByTestId('sample-file-input')
    const file = new File(['{"customerId":"1","amount":10}'], 'sample.json', { type: 'application/json' })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(fetchSchemaByExample).toHaveBeenCalledWith({
        example: '{"customerId":"1","amount":10}',
        fileName: 'sample.json',
        contentType: 'application/json',
      }, false)
    })

    await screen.findByText('Detected Schema')
    expect(screen.getByText('customerId')).toBeInTheDocument()
    expect(screen.getByText('amount')).toBeInTheDocument()
    expect(screen.getByText('customer.email')).toBeInTheDocument()
    expect(screen.queryByText('customer')).not.toBeInTheDocument()
    expect(screen.getByText('Backend schema inference completed')).toBeInTheDocument()

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem('etl-studio-wizard-draft') || '{}')
      expect(persisted.upload).toMatchObject({
        done: true,
        fileName: 'sample.json',
        fileType: 'application/json',
      })
      expect(persisted.upload.schema).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'customerId', type: 'string', required: true }),
          expect.objectContaining({ id: 'amount', type: 'number' }),
          expect.objectContaining({ id: 'customer.email', type: 'string', required: true }),
        ])
      )
      expect(persisted.upload.schema).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'customer' }),
        ])
      )
    })
  })

  it('shows an error and keeps the step idle when schema inference fails', async () => {
    fetchSchemaByExample.mockRejectedValue(new Error('schema lookup failed'))

    renderStep()

    const input = screen.getByTestId('sample-file-input')
    const file = new File(['id,name\n1,Widget'], 'sample.csv', { type: 'text/csv' })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByTestId('source-upload-error')).toHaveTextContent('schema lookup failed')
    })

    expect(screen.queryByText('Detected Schema')).not.toBeInTheDocument()

    const persisted = JSON.parse(localStorage.getItem('etl-studio-wizard-draft') || '{}')
    expect(persisted.upload?.done).not.toBe(true)
  })

  it('shows all nested fields when the uploaded schema contains arrays', async () => {
    fetchSchemaByExample.mockResolvedValue({
      type: 'object',
      properties: {
        orders: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'string' },
              lines: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    sku: { type: 'string' },
                    quantity: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    })

    renderStep()

    const input = screen.getByTestId('sample-file-input')
    const file = new File(['{"orders":[]}'], 'orders.json', { type: 'application/json' })

    fireEvent.change(input, { target: { files: [file] } })

    await screen.findByText('Detected Schema')

    expect(screen.getByText('orders')).toBeInTheDocument()
    expect(screen.getByText('order.*.id')).toBeInTheDocument()
    expect(screen.getByText('order.*.lines')).toBeInTheDocument()
    expect(screen.getByText('order.*.line.*.sku')).toBeInTheDocument()
    expect(screen.getByText('order.*.line.*.quantity')).toBeInTheDocument()
    expect(screen.queryByText('order.*.line.*.*')).not.toBeInTheDocument()

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem('etl-studio-wizard-draft') || '{}')
      expect(persisted.upload.schema).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'orders', type: 'array' }),
          expect.objectContaining({ id: 'order.*.id', type: 'string', required: true }),
          expect.objectContaining({ id: 'order.*.lines', type: 'array' }),
          expect.objectContaining({ id: 'order.*.line.*.sku', type: 'string' }),
          expect.objectContaining({ id: 'order.*.line.*.quantity', type: 'number' }),
        ])
      )
    })
  })

  it('shows child fields when array items are provided as a schema list', async () => {
    fetchSchemaByExample.mockResolvedValue({
      type: 'object',
      properties: {
        batches: {
          type: 'array',
          items: [
            {
              type: 'object',
              properties: {
                batchId: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
              },
            },
          ],
        },
      },
    })

    renderStep()

    const input = screen.getByTestId('sample-file-input')
    const file = new File(['{"batches":[]}'], 'batches.json', { type: 'application/json' })

    fireEvent.change(input, { target: { files: [file] } })

    await screen.findByText('Detected Schema')

    expect(screen.getByText('batches')).toBeInTheDocument()
    expect(screen.getByText('batch.*.batchId')).toBeInTheDocument()
    expect(screen.getByText('batch.*.createdAt')).toBeInTheDocument()

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem('etl-studio-wizard-draft') || '{}')
      expect(persisted.upload.schema).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'batches', type: 'array' }),
          expect.objectContaining({ id: 'batch.*.batchId', type: 'string' }),
          expect.objectContaining({ id: 'batch.*.createdAt', type: 'string', inferredFormat: 'date-time' }),
        ])
      )
    })
  })

  it('shows referenced array item fields like person.*.firstName', async () => {
    fetchSchemaByExample.mockResolvedValue({
      type: 'object',
      required: ['persons'],
      properties: {
        persons: {
          type: 'array',
          items: {
            $ref: '#/$defs/Person',
          },
        },
      },
      $defs: {
        Person: {
          type: 'object',
          required: ['firstName'],
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
          },
        },
      },
    })

    renderStep()

    const input = screen.getByTestId('sample-file-input')
    const file = new File(['{"persons":[]}'], 'persons.json', { type: 'application/json' })

    fireEvent.change(input, { target: { files: [file] } })

    await screen.findByText('Detected Schema')

    expect(screen.getByText('persons')).toBeInTheDocument()
    expect(screen.getByText('person.*.firstName')).toBeInTheDocument()
    expect(screen.getByText('person.*.lastName')).toBeInTheDocument()
    expect(screen.queryByText('persons[]')).not.toBeInTheDocument()

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem('etl-studio-wizard-draft') || '{}')
      expect(persisted.upload.schema).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'persons', type: 'array', required: true }),
          expect.objectContaining({ id: 'person.*.firstName', type: 'string', required: true }),
          expect.objectContaining({ id: 'person.*.lastName', type: 'string' }),
        ])
      )
    })
  })
})

