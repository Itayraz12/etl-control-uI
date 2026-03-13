import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { UserProvider, useUser } from './userContext.jsx'
import { ACTIVE_USER_STORAGE_KEY } from './userSessionPersistence.js'

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
})

