import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { UserProvider, useUser } from './userContext.jsx'
import { ACTIVE_USER_STORAGE_KEY, PENDING_SCOPE_RESET_STORAGE_KEY } from './userSessionPersistence.js'
import { getWizardStorageKeyForUser } from './wizardPersistence.js'

function TestConsumer() {
  const { user, login, logout } = useUser()

  return (
    <div>
      <div data-testid="active-user">{user ? `${user.userId}|${user.teamName}` : 'anonymous'}</div>
      <button type="button" onClick={() => login({ userId: 'alice', teamName: 'platform' })}>
        Login
      </button>
      <button type="button" onClick={() => logout('manual')}>
        Logout
      </button>
      <button type="button" onClick={() => logout('idle')}>
        Idle Logout
      </button>
    </div>
  )
}

describe('UserProvider persistence', () => {
  it('hydrates the active user from localStorage on mount', async () => {
    localStorage.setItem(
      ACTIVE_USER_STORAGE_KEY,
      JSON.stringify({ userId: 'alice', teamName: 'platform' })
    )

    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('active-user')).toHaveTextContent('alice|platform')
    })
  })

  it('persists login and clears persisted user on logout', async () => {
    const user = userEvent.setup()

    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    )

    expect(screen.getByTestId('active-user')).toHaveTextContent('anonymous')

    await user.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(screen.getByTestId('active-user')).toHaveTextContent('alice|platform')
      expect(JSON.parse(localStorage.getItem(ACTIVE_USER_STORAGE_KEY) || '{}')).toMatchObject({
        userId: 'alice',
        teamName: 'platform',
      })
    })

    await user.click(screen.getByRole('button', { name: 'Logout' }))

    await waitFor(() => {
      expect(screen.getByTestId('active-user')).toHaveTextContent('anonymous')
      expect(localStorage.getItem(ACTIVE_USER_STORAGE_KEY)).toBeNull()
    })
  })

  it('immediately resets the user scope on manual logout', async () => {
    const user = userEvent.setup()
    const scopedWizardStorageKey = getWizardStorageKeyForUser('alice')

    localStorage.setItem(
      scopedWizardStorageKey,
      JSON.stringify({
        currentStep: 4,
        metadata: { team: 'platform' },
      })
    )
    localStorage.setItem(
      PENDING_SCOPE_RESET_STORAGE_KEY,
      JSON.stringify({ alice: Date.now() + 60_000 })
    )

    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    )

    await user.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(screen.getByTestId('active-user')).toHaveTextContent('alice|platform')
    })

    expect(localStorage.getItem(scopedWizardStorageKey)).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Logout' }))

    await waitFor(() => {
      expect(screen.getByTestId('active-user')).toHaveTextContent('anonymous')
      expect(localStorage.getItem(ACTIVE_USER_STORAGE_KEY)).toBeNull()
      expect(localStorage.getItem(scopedWizardStorageKey)).toBeNull()
      expect(localStorage.getItem(PENDING_SCOPE_RESET_STORAGE_KEY)).toBeNull()
    })
  })

  it('keeps the scope during idle logout and schedules a pending reset', async () => {
    const user = userEvent.setup()
    const scopedWizardStorageKey = getWizardStorageKeyForUser('alice')

    localStorage.setItem(
      scopedWizardStorageKey,
      JSON.stringify({
        currentStep: 4,
        metadata: { team: 'platform' },
      })
    )

    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    )

    await user.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(screen.getByTestId('active-user')).toHaveTextContent('alice|platform')
    })

    await user.click(screen.getByRole('button', { name: 'Idle Logout' }))

    await waitFor(() => {
      expect(screen.getByTestId('active-user')).toHaveTextContent('anonymous')
      expect(localStorage.getItem(ACTIVE_USER_STORAGE_KEY)).toBeNull()
      expect(localStorage.getItem(scopedWizardStorageKey)).not.toBeNull()
      expect(JSON.parse(localStorage.getItem(PENDING_SCOPE_RESET_STORAGE_KEY) || '{}')).toHaveProperty('alice')
    })
  })
})

