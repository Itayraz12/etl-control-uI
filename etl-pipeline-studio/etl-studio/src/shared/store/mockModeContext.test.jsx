import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  MOCK_MODE_STORAGE_KEY,
  MockModeProvider,
  useMockMode,
} from './mockModeContext.jsx'

function TestConsumer() {
  const { useMock, setUseMock } = useMockMode()

  return (
    <div>
      <div data-testid="mock-mode">{useMock ? 'mock' : 'live'}</div>
      <button type="button" onClick={() => setUseMock(prev => !prev)}>
        Toggle Mock
      </button>
    </div>
  )
}

describe('MockModeProvider persistence', () => {
  it('hydrates the persisted mock mode from localStorage on mount', async () => {
    localStorage.setItem(MOCK_MODE_STORAGE_KEY, JSON.stringify(false))

    render(
      <MockModeProvider>
        <TestConsumer />
      </MockModeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('mock-mode')).toHaveTextContent('live')
    })
  })

  it('persists toggled mock mode changes to localStorage', async () => {
    const user = userEvent.setup()

    render(
      <MockModeProvider>
        <TestConsumer />
      </MockModeProvider>
    )

    expect(screen.getByTestId('mock-mode')).toHaveTextContent('mock')

    await user.click(screen.getByRole('button', { name: 'Toggle Mock' }))

    await waitFor(() => {
      expect(screen.getByTestId('mock-mode')).toHaveTextContent('live')
      expect(JSON.parse(localStorage.getItem(MOCK_MODE_STORAGE_KEY) || 'null')).toBe(false)
    })
  })

  it('falls back to mock mode when the persisted value is invalid', async () => {
    localStorage.setItem(MOCK_MODE_STORAGE_KEY, 'not-json')

    render(
      <MockModeProvider>
        <TestConsumer />
      </MockModeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('mock-mode')).toHaveTextContent('mock')
      expect(JSON.parse(localStorage.getItem(MOCK_MODE_STORAGE_KEY) || 'null')).toBe(true)
    })
  })
})

