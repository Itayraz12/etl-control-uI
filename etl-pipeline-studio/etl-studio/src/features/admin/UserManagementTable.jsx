import { useCallback, useEffect, useMemo, useState } from 'react'
import { Btn, Card, CardTitle, ModalDialog, Spinner } from '../../shared/components/index.jsx'
import { useMockMode } from '../../shared/store/mockModeContext.jsx'
import {
  createAdminUser,
  deleteAdminUser,
  fetchAdminTeams,
  fetchAdminUsers,
  updateAdminUser,
} from '../../shared/services/adminService.js'

const EMPTY_USER_DRAFT = {
  userId: '',
  teamName: '',
}

const TABLE_CELL_STYLE = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--border)',
  fontSize: 13,
  color: 'var(--text)',
  verticalAlign: 'middle',
}

const INPUT_STYLE = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 13,
}

function formatAdminDate(value) {
  const normalizedValue = String(value || '').trim()
  if (!normalizedValue) return '—'

  const date = new Date(normalizedValue)
  if (Number.isNaN(date.getTime())) return normalizedValue

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function UserManagementTable() {
  const { useMock } = useMockMode()
  const [users, setUsers] = useState([])
  const [teamOptions, setTeamOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [screenError, setScreenError] = useState('')
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [editingKey, setEditingKey] = useState(null)
  const [draft, setDraft] = useState(EMPTY_USER_DRAFT)
  const [saving, setSaving] = useState(false)
  const [deletingKey, setDeletingKey] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setScreenError('')

    try {
      const [nextUsers, nextTeams] = await Promise.all([
        fetchAdminUsers(useMock),
        fetchAdminTeams(useMock),
      ])
      setUsers(nextUsers)
      setTeamOptions(nextTeams.map(team => team.teamName).filter(Boolean))
    } catch (error) {
      setScreenError(error?.message || 'Failed to load users.')
    } finally {
      setLoading(false)
    }
  }, [useMock])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const renderedRows = useMemo(() => {
    if (editingKey !== '__new__') return users
    return [{ id: '__new__', createdAt: '', updatedAt: '', ...EMPTY_USER_DRAFT }, ...users]
  }, [editingKey, users])

  function startAdd() {
    setEditingKey('__new__')
    setDraft(EMPTY_USER_DRAFT)
    setFormError('')
    setNotice('')
  }

  function startEdit(user) {
    setEditingKey(user.id)
    setDraft({
      userId: user.userId || '',
      teamName: user.teamName || '',
    })
    setFormError('')
    setNotice('')
  }

  function cancelEditing() {
    setEditingKey(null)
    setDraft(EMPTY_USER_DRAFT)
    setFormError('')
  }

  function updateDraft(key, value) {
    setDraft(current => ({ ...current, [key]: value }))
  }

  async function handleSave() {
    const userId = String(draft.userId || '').trim()
    const teamName = String(draft.teamName || '').trim()

    if (!userId) {
      setFormError('User ID is required.')
      return
    }

    if (!teamName) {
      setFormError('Team name is required.')
      return
    }

    setSaving(true)
    setFormError('')
    setScreenError('')

    try {
      if (editingKey === '__new__') {
        await createAdminUser({ userId, teamName }, useMock)
        setNotice(`User “${userId}” was created.`)
      } else {
        await updateAdminUser(editingKey, { userId, teamName }, useMock)
        setNotice(`User “${userId}” was updated.`)
      }

      setEditingKey(null)
      setDraft(EMPTY_USER_DRAFT)
      await loadUsers()
    } catch (error) {
      setFormError(error?.message || 'Failed to save user.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeleteUser() {
    if (!confirmDelete) return

    const target = confirmDelete
    setDeletingKey(target.id)
    setScreenError('')
    setConfirmDelete(null)

    try {
      await deleteAdminUser(target.id, useMock)
      setNotice(`User “${target.userId}” was deleted.`)
      if (editingKey === target.id) {
        cancelEditing()
      }
      await loadUsers()
    } catch (error) {
      setScreenError(error?.message || 'Failed to delete user.')
    } finally {
      setDeletingKey('')
    }
  }

  return (
    <>
      <Card style={{ marginBottom: 0 }}>
        <CardTitle style={{ justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div>🙍 User Management</div>
            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>
              Create, update, and delete user-to-team assignments from the admin backend APIs.
            </div>
          </div>
          <Btn sm onClick={startAdd} disabled={loading || saving || editingKey === '__new__'}>
            + Add User
          </Btn>
        </CardTitle>

        {notice && (
          <div data-testid="user-management-notice" style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(34,197,94,.28)', background: 'rgba(34,197,94,.10)', color: 'var(--success)', fontSize: 12, fontWeight: 600 }}>
            {notice}
          </div>
        )}

        {screenError && (
          <div data-testid="user-management-error" style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,.28)', background: 'rgba(239,68,68,.10)', color: 'var(--danger)', fontSize: 12, fontWeight: 600 }}>
            {screenError}
          </div>
        )}

        {formError && editingKey && (
          <div data-testid="user-management-form-error" style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(245,158,11,.28)', background: 'rgba(245,158,11,.10)', color: 'var(--warning)', fontSize: 12, fontWeight: 600 }}>
            {formError}
          </div>
        )}

        {loading ? (
          <div style={{ minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spinner size={38} />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table data-testid="user-management-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  {['User ID', 'Team Name', 'Date of Create', 'Date of Modified', 'Actions'].map(label => (
                    <th key={label} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {renderedRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ ...TABLE_CELL_STYLE, textAlign: 'center', color: 'var(--muted)', padding: '28px 12px' }}>
                      No users were returned by the backend.
                    </td>
                  </tr>
                ) : renderedRows.map(user => {
                  const isEditing = editingKey === user.id

                  return (
                    <tr key={user.id || user.userId}>
                      <td style={TABLE_CELL_STYLE}>
                        {isEditing ? (
                          <input
                            aria-label="User ID"
                            data-testid="user-management-user-id-input"
                            value={draft.userId}
                            onChange={event => updateDraft('userId', event.target.value)}
                            style={INPUT_STYLE}
                          />
                        ) : user.userId || '—'}
                      </td>
                      <td style={TABLE_CELL_STYLE}>
                        {isEditing ? (
                          teamOptions.length > 0 ? (
                            <select
                              aria-label="Team Name"
                              data-testid="user-management-team-name-input"
                              value={draft.teamName}
                              onChange={event => updateDraft('teamName', event.target.value)}
                              style={INPUT_STYLE}
                            >
                              <option value="">Select team...</option>
                              {teamOptions.map(teamName => (
                                <option key={teamName} value={teamName}>{teamName}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              aria-label="Team Name"
                              data-testid="user-management-team-name-input"
                              value={draft.teamName}
                              onChange={event => updateDraft('teamName', event.target.value)}
                              style={INPUT_STYLE}
                            />
                          )
                        ) : user.teamName || '—'}
                      </td>
                      <td style={TABLE_CELL_STYLE}>{formatAdminDate(user.createdAt)}</td>
                      <td style={TABLE_CELL_STYLE}>{formatAdminDate(user.updatedAt)}</td>
                      <td style={TABLE_CELL_STYLE}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {isEditing ? (
                            <>
                              <Btn sm onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving...' : 'Save'}
                              </Btn>
                              <Btn sm v="ghost" onClick={cancelEditing} disabled={saving}>
                                Cancel
                              </Btn>
                            </>
                          ) : (
                            <>
                              <Btn sm v="ghost" onClick={() => startEdit(user)} disabled={Boolean(editingKey) || deletingKey === user.id}>
                                Edit
                              </Btn>
                              <Btn
                                sm
                                v="danger"
                                onClick={() => setConfirmDelete(user)}
                                disabled={Boolean(editingKey) || deletingKey === user.id}
                              >
                                {deletingKey === user.id ? 'Deleting...' : 'Delete'}
                              </Btn>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ModalDialog
        isOpen={Boolean(confirmDelete)}
        title="Delete User"
        message={`Delete user “${confirmDelete?.userId || ''}”?`}
        icon="🗑️"
        tone="danger"
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={confirmDeleteUser}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  )
}


