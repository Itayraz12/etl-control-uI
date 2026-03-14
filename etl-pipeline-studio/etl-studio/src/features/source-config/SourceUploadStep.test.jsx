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
})

