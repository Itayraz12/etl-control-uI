import { useCallback, useEffect, useMemo, useState } from 'react'
import { Btn, Card, CardTitle, ModalDialog, Spinner } from '../../shared/components/index.jsx'
import { useMockMode } from '../../shared/store/mockModeContext.jsx'
import {
  addAdminSystemAdmin,
  fetchAdminSystemAdmins,
  removeAdminSystemAdmin,
} from '../../shared/services/adminService.js'

const TABLE_CELL_STYLE = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--border)',
  fontSize: 13,
  color: 'var(--text)',
  verticalAlign: 'middle',
}

const MESSAGE_SLOT_STYLE = {
  minHeight: 44,
  marginBottom: 12,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 8,
}

const NOTICE_BANNER_STYLE = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid rgba(34,197,94,.28)',
  background: 'rgba(34,197,94,.10)',
  color: 'var(--success)',
  fontSize: 12,
  fontWeight: 600,
}

const ERROR_BANNER_STYLE = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid rgba(239,68,68,.28)',
  background: 'rgba(239,68,68,.10)',
  color: 'var(--danger)',
  fontSize: 12,
  fontWeight: 600,
}

const FORM_ERROR_BANNER_STYLE = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid rgba(245,158,11,.28)',
  background: 'rgba(245,158,11,.10)',
  color: 'var(--warning)',
  fontSize: 12,
  fontWeight: 600,
}

const INPUT_STYLE = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 13,
  boxSizing: 'border-box',
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

export default function AdminUsersTable() {
  const { useMock } = useMockMode()
  const [admins, setAdmins]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [screenError, setScreenError] = useState('')
  const [formError, setFormError]     = useState('')
  const [notice, setNotice]           = useState('')
  const [adding, setAdding]           = useState(false)
  const [newUserId, setNewUserId]     = useState('')
  const [saving, setSaving]           = useState(false)
  const [removingId, setRemovingId]   = useState('')
  const [confirmRemove, setConfirmRemove] = useState(null)

  const loadAdmins = useCallback(async () => {
    setLoading(true)
    setScreenError('')
    try {
      const rows = await fetchAdminSystemAdmins(useMock)
      setAdmins(rows)
    } catch (error) {
      setScreenError(error?.message || 'Failed to load admin users.')
    } finally {
      setLoading(false)
    }
  }, [useMock])

  useEffect(() => {
    loadAdmins()
  }, [loadAdmins])

  const renderedRows = useMemo(() => {
    if (!adding) return admins
    return [{ id: '__new__', userId: '', createdAt: '', updatedAt: '' }, ...admins]
  }, [adding, admins])

  function startAdd() {
    setAdding(true)
    setNewUserId('')
    setFormError('')
    setNotice('')
  }

  function cancelAdd() {
    setAdding(false)
    setNewUserId('')
    setFormError('')
  }

  async function handleAdd() {
    const userId = String(newUserId || '').trim()
    if (!userId) {
      setFormError('User ID is required.')
      return
    }

    setSaving(true)
    setFormError('')
    setScreenError('')
    try {
      await addAdminSystemAdmin({ userId }, useMock)
      setAdding(false)
      setNewUserId('')
      setNotice(`User "${userId}" was granted admin privileges.`)
      await loadAdmins()
    } catch (error) {
      setFormError(error?.message || 'Failed to add admin user.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmRemoveAdmin() {
    if (!confirmRemove) return
    const target = confirmRemove
    setRemovingId(target.id)
    setScreenError('')
    setConfirmRemove(null)
    try {
      await removeAdminSystemAdmin(target.id, useMock)
      setNotice(`Admin privileges revoked for "${target.userId}".`)
      await loadAdmins()
    } catch (error) {
      setScreenError(error?.message || 'Failed to remove admin user.')
    } finally {
      setRemovingId('')
    }
  }

  return (
    <>
      <Card style={{ marginBottom: 0 }}>
        <CardTitle style={{ justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div>🛡️ Admin Users</div>
            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>
              Manage users with admin privileges. Changes are applied via the admin backend APIs.
            </div>
          </div>
          <Btn sm onClick={startAdd} disabled={loading || saving || adding}>
            + Add Admin User
          </Btn>
        </CardTitle>

        <div data-testid="admin-users-message-slot" style={MESSAGE_SLOT_STYLE}>
          {notice && (
            <div data-testid="admin-users-notice" style={NOTICE_BANNER_STYLE}>{notice}</div>
          )}
          {screenError && (
            <div data-testid="admin-users-error" style={ERROR_BANNER_STYLE}>{screenError}</div>
          )}
          {formError && adding && (
            <div data-testid="admin-users-form-error" style={FORM_ERROR_BANNER_STYLE}>{formError}</div>
          )}
        </div>

        {loading ? (
          <div style={{ minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spinner size={38} />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              data-testid="admin-users-table"
              style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}
            >
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  {['User ID', 'Date Created', 'Date Modified', 'Actions'].map(label => (
                    <th
                      key={label}
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        fontSize: 12,
                        color: 'var(--muted)',
                        fontWeight: 700,
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {renderedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      style={{ ...TABLE_CELL_STYLE, textAlign: 'center', color: 'var(--muted)', padding: '28px 12px' }}
                    >
                      No admin users found.
                    </td>
                  </tr>
                ) : renderedRows.map(admin => {
                  const isNew = admin.id === '__new__'

                  return (
                    <tr key={admin.id}>
                      <td style={TABLE_CELL_STYLE}>
                        {isNew ? (
                          <input
                            aria-label="User ID"
                            data-testid="admin-users-user-id-input"
                            value={newUserId}
                            onChange={e => setNewUserId(e.target.value)}
                            placeholder="Enter user ID…"
                            style={INPUT_STYLE}
                            autoFocus
                          />
                        ) : (
                          <span style={{ fontWeight: 600 }}>{admin.userId}</span>
                        )}
                      </td>
                      <td style={TABLE_CELL_STYLE}>{isNew ? '—' : formatAdminDate(admin.createdAt)}</td>
                      <td style={TABLE_CELL_STYLE}>{isNew ? '—' : formatAdminDate(admin.updatedAt)}</td>
                      <td style={TABLE_CELL_STYLE}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {isNew ? (
                            <>
                              <Btn sm onClick={handleAdd} disabled={saving}>
                                {saving ? 'Adding…' : 'Add'}
                              </Btn>
                              <Btn sm v="ghost" onClick={cancelAdd} disabled={saving}>
                                Cancel
                              </Btn>
                            </>
                          ) : (
                            <Btn
                              sm
                              v="danger"
                              onClick={() => setConfirmRemove(admin)}
                              disabled={adding || removingId === admin.id}
                            >
                              {removingId === admin.id ? 'Removing…' : 'Remove'}
                            </Btn>
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
        isOpen={Boolean(confirmRemove)}
        title="Remove Admin User"
        message={`Revoke admin privileges for "${confirmRemove?.userId || ''}"?`}
        icon="🛡️"
        tone="danger"
        confirmLabel="Remove"
        confirmVariant="danger"
        onConfirm={confirmRemoveAdmin}
        onCancel={() => setConfirmRemove(null)}
      />
    </>
  )
}

