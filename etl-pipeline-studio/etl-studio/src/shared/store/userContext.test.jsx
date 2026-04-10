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
      <div data-testid="active-user">{user ? `${user.userId}|${user.teamName}|${user.role}` : 'anonymous'}</div>
      <div data-testid="user-role-header">{user?.userRoleHeader || '(missing)'}</div>
      <button type="button" onClick={() => login({ userId: 'alice', teamName: 'platform', role: 'admin', userRoleHeader: 'admin' })}>
        Login as Admin
      </button>
      <button type="button" onClick={() => login({ userId: 'bob', teamName: 'analytics' })}>Login as Regular</button>
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
      JSON.stringify({ userId: 'alice', teamName: 'platform', role: 'admin', userRoleHeader: 'admin' })
    )

    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('active-user')).toHaveTextContent('alice|platform|admin')
      expect(screen.getByTestId('user-role-header')).toHaveTextContent('admin')
    })
  })

  it('defaults missing persisted roles to regular', async () => {
    localStorage.setItem(
      ACTIVE_USER_STORAGE_KEY,
      JSON.stringify({ userId: 'bob', teamName: 'analytics' })
    )

    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('active-user')).toHaveTextContent('bob|analytics|regular')
      expect(screen.getByTestId('user-role-header')).toHaveTextContent('(missing)')
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

    await user.click(screen.getByRole('button', { name: 'Login as Admin' }))

    await waitFor(() => {
      expect(screen.getByTestId('active-user')).toHaveTextContent('alice|platform|admin')
      expect(screen.getByTestId('user-role-header')).toHaveTextContent('admin')
      expect(JSON.parse(localStorage.getItem(ACTIVE_USER_STORAGE_KEY) || '{}')).toMatchObject({
        userId: 'alice',
        teamName: 'platform',
        role: 'admin',
        userRoleHeader: 'admin',
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

    await user.click(screen.getByRole('button', { name: 'Login as Admin' }))

    await waitFor(() => {
      expect(screen.getByTestId('active-user')).toHaveTextContent('alice|platform|admin')
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

    await user.click(screen.getByRole('button', { name: 'Login as Admin' }))

    await waitFor(() => {
      expect(screen.getByTestId('active-user')).toHaveTextContent('alice|platform|admin')
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

