import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TopNav from './TopNav.jsx'

const mockActions = {
  setNavigationMode: vi.fn(),
  toggleTheme: vi.fn(),
}

const logout = vi.fn()

vi.mock('../../shared/store/wizardStore.jsx', () => ({
  useWizard: () => ({
    state: { theme: 'dark' },
    actions: mockActions,
  }),
}))

vi.mock('../../shared/store/userContext.jsx', () => ({
  useUser: () => ({ logout }),
}))

describe('TopNav', () => {
  it('shows the UI version in the shared header', () => {
    render(<TopNav />)

    expect(screen.getByText(/^v\d+\.\d+\.\d+$/)).toBeInTheDocument()
  })
})

