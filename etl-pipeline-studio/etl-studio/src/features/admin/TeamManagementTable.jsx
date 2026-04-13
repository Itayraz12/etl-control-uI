import { useCallback, useEffect, useMemo, useState } from 'react'
import { Btn, Card, CardTitle, ModalDialog, Spinner } from '../../shared/components/index.jsx'
import { useMockMode } from '../../shared/store/mockModeContext.jsx'
import {
  createAdminTeam,
  deleteAdminTeam,
  fetchAdminTeams,
  updateAdminTeam,
} from '../../shared/services/adminService.js'

const EMPTY_TEAM_DRAFT = {
  teamName: '',
  devopsName: '',
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

export default function TeamManagementTable() {
  const { useMock } = useMockMode()
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [screenError, setScreenError] = useState('')
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [editingKey, setEditingKey] = useState(null)
  const [draft, setDraft] = useState(EMPTY_TEAM_DRAFT)
  const [saving, setSaving] = useState(false)
  const [deletingKey, setDeletingKey] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  const loadTeams = useCallback(async () => {
    setLoading(true)
    setScreenError('')

    try {
      const nextTeams = await fetchAdminTeams(useMock)
      setTeams(nextTeams)
    } catch (error) {
      setScreenError(error?.message || 'Failed to load teams.')
    } finally {
      setLoading(false)
    }
  }, [useMock])

  useEffect(() => {
    loadTeams()
  }, [loadTeams])

  const renderedRows = useMemo(() => {
    if (editingKey !== '__new__') return teams
    return [{ id: '__new__', createdAt: '', updatedAt: '', ...EMPTY_TEAM_DRAFT }, ...teams]
  }, [editingKey, teams])

  function startAdd() {
    setEditingKey('__new__')
    setDraft(EMPTY_TEAM_DRAFT)
    setFormError('')
    setNotice('')
  }

  function startEdit(team) {
    setEditingKey(team.id)
    setDraft({
      teamName: team.teamName || '',
      devopsName: team.devopsName || '',
    })
    setFormError('')
    setNotice('')
  }

  function cancelEditing() {
    setEditingKey(null)
    setDraft(EMPTY_TEAM_DRAFT)
    setFormError('')
  }

  function updateDraft(key, value) {
    setDraft(current => ({ ...current, [key]: value }))
  }

  async function handleSave() {
    const teamName = String(draft.teamName || '').trim()
    const devopsName = String(draft.devopsName || '').trim()

    if (!teamName) {
      setFormError('Team name is required.')
      return
    }

    if (!devopsName) {
      setFormError('DevOps name is required.')
      return
    }

    setSaving(true)
    setFormError('')
    setScreenError('')

    try {
      if (editingKey === '__new__') {
        await createAdminTeam({ teamName, devopsName }, useMock)
        setNotice(`Team “${teamName}” was created.`)
      } else {
        await updateAdminTeam(editingKey, { teamName, devopsName }, useMock)
        setNotice(`Team “${teamName}” was updated.`)
      }

      setEditingKey(null)
      setDraft(EMPTY_TEAM_DRAFT)
      await loadTeams()
    } catch (error) {
      setFormError(error?.message || 'Failed to save team.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeleteTeam() {
    if (!confirmDelete) return

    const target = confirmDelete
    setDeletingKey(target.id)
    setScreenError('')
    setConfirmDelete(null)

    try {
      await deleteAdminTeam(target.id, useMock)
      setNotice(`Team “${target.teamName}” was deleted.`)
      if (editingKey === target.id) {
        cancelEditing()
      }
      await loadTeams()
    } catch (error) {
      setScreenError(error?.message || 'Failed to delete team.')
    } finally {
      setDeletingKey('')
    }
  }

  return (
    <>
      <Card style={{ marginBottom: 0 }}>
        <CardTitle style={{ justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div>👥 Team Management</div>
            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>
              Manage the teams returned by the backend admin APIs.
            </div>
          </div>
          <Btn sm onClick={startAdd} disabled={loading || saving || editingKey === '__new__'}>
            + Add Team
          </Btn>
        </CardTitle>

        {notice && (
          <div data-testid="team-management-notice" style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(34,197,94,.28)', background: 'rgba(34,197,94,.10)', color: 'var(--success)', fontSize: 12, fontWeight: 600 }}>
            {notice}
          </div>
        )}

        {screenError && (
          <div data-testid="team-management-error" style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,.28)', background: 'rgba(239,68,68,.10)', color: 'var(--danger)', fontSize: 12, fontWeight: 600 }}>
            {screenError}
          </div>
        )}

        {formError && editingKey && (
          <div data-testid="team-management-form-error" style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(245,158,11,.28)', background: 'rgba(245,158,11,.10)', color: 'var(--warning)', fontSize: 12, fontWeight: 600 }}>
            {formError}
          </div>
        )}

        {loading ? (
          <div style={{ minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spinner size={38} />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table data-testid="team-management-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  {['Team Name', 'DevOps Name', 'Date of Create', 'Date of Change', 'Actions'].map(label => (
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
                      No teams were returned by the backend.
                    </td>
                  </tr>
                ) : renderedRows.map(team => {
                  const isEditing = editingKey === team.id

                  return (
                    <tr key={team.id || team.teamName}>
                      <td style={TABLE_CELL_STYLE}>
                        {isEditing ? (
                          <input
                            aria-label="Team Name"
                            data-testid="team-management-team-name-input"
                            value={draft.teamName}
                            onChange={event => updateDraft('teamName', event.target.value)}
                            style={INPUT_STYLE}
                          />
                        ) : team.teamName || '—'}
                      </td>
                      <td style={TABLE_CELL_STYLE}>
                        {isEditing ? (
                          <input
                            aria-label="DevOps Name"
                            data-testid="team-management-devops-name-input"
                            value={draft.devopsName}
                            onChange={event => updateDraft('devopsName', event.target.value)}
                            style={INPUT_STYLE}
                          />
                        ) : team.devopsName || '—'}
                      </td>
                      <td style={TABLE_CELL_STYLE}>{formatAdminDate(team.createdAt)}</td>
                      <td style={TABLE_CELL_STYLE}>{formatAdminDate(team.updatedAt)}</td>
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
                              <Btn sm v="ghost" onClick={() => startEdit(team)} disabled={Boolean(editingKey) || deletingKey === team.id}>
                                Edit
                              </Btn>
                              <Btn
                                sm
                                v="danger"
                                onClick={() => setConfirmDelete(team)}
                                disabled={Boolean(editingKey) || deletingKey === team.id}
                              >
                                {deletingKey === team.id ? 'Deleting...' : 'Delete'}
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
        title="Delete Team"
        message={`Delete team “${confirmDelete?.teamName || ''}”?`}
        icon="🗑️"
        tone="danger"
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={confirmDeleteTeam}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  )
}


