import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Circle, CircleOff, GripVertical, Trash2 } from 'lucide-react'
import { Btn, Card, CardTitle, ModalDialog, Spinner, Chip, FilterTabs, Tooltip } from '../../shared/components/index.jsx'
import { useMockMode } from '../../shared/store/mockModeContext.jsx'
import {
  deleteAdminUDF,
  fetchAdminUDFs,
  updateAdminUDF,
} from '../../shared/services/adminService.js'

const UDF_TABS = [
  { id: 'all', label: 'All' },
  { id: 'filter', label: 'Filter' },
  { id: 'transformer', label: 'Transformer' },
]

const TABLE_COLUMNS = [
  { key: 'name', label: 'Name', defaultWidth: 200, minWidth: 150 },
  { key: 'type', label: 'Type', defaultWidth: 130, minWidth: 110 },
  { key: 'description', label: 'Description', defaultWidth: 260, minWidth: 180 },
  { key: 'team', label: 'Team', defaultWidth: 140, minWidth: 120 },
  { key: 'filePath', label: 'File Path', defaultWidth: 240, minWidth: 170 },
  { key: 'version', label: 'Version', defaultWidth: 110, minWidth: 90 },
  { key: 'isApproved', label: 'Approved', defaultWidth: 92, minWidth: 78, align: 'center' },
  { key: 'isActive', label: 'Active', defaultWidth: 82, minWidth: 72, align: 'center' },
  { key: 'dateApproved', label: 'Date Approved', defaultWidth: 180, minWidth: 150 },
  { key: 'createdAt', label: 'Created', defaultWidth: 180, minWidth: 150 },
  { key: 'updatedAt', label: 'Updated', defaultWidth: 180, minWidth: 150 },
  { key: 'actions', label: 'Actions', defaultWidth: 90, minWidth: 78, align: 'center' },
]

const INITIAL_COLUMN_WIDTHS = Object.fromEntries(TABLE_COLUMNS.map(column => [column.key, column.defaultWidth]))

const FILTER_INPUT_STYLE = {
  flex: 1,
  minWidth: 220,
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  fontSize: 13,
  background: 'var(--bg)',
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
}

const FILTER_SELECT_STYLE = {
  width: 160,
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  fontSize: 13,
  background: 'var(--bg)',
  color: 'var(--text)',
  boxSizing: 'border-box',
}

const ICON_BUTTON_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  padding: 0,
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  cursor: 'pointer',
  transition: 'all .15s ease',
}

const TABLE_CELL_STYLE = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--border)',
  fontSize: 13,
  color: 'var(--text)',
  verticalAlign: 'middle',
}

const CELL_HORIZONTAL_PADDING = 24
const HEADER_RESIZER_SPACE = 18

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

function getColumnCellStyle(columnWidths, column) {
  const width = columnWidths[column.key] || column.defaultWidth

  return {
    ...TABLE_CELL_STYLE,
    width,
    minWidth: width,
    maxWidth: width,
    textAlign: column.align || 'left',
  }
}

function getColumnContentWidth(columnWidths, column, reservedSpace = CELL_HORIZONTAL_PADDING) {
  const width = columnWidths[column.key] || column.defaultWidth
  return Math.max(48, width - reservedSpace)
}

function getAdaptiveTextStyle(columnWidths, column, reservedSpace = CELL_HORIZONTAL_PADDING) {
  return {
    display: 'block',
    width: '100%',
    maxWidth: getColumnContentWidth(columnWidths, column, reservedSpace),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
}

function getMeasuredNodeWidth(node) {
  if (!node) return 0

  const scrollWidth = Number(node.scrollWidth) || 0
  const rectWidth = typeof node.getBoundingClientRect === 'function'
    ? Math.ceil(node.getBoundingClientRect().width || 0)
    : 0

  return Math.max(scrollWidth, rectWidth)
}

function getUdfSearchTerms(filterText = '') {
  return String(filterText || '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function matchesUdfTab(udf, tabId) {
  if (tabId === 'all') return true
  return String(udf?.type || '').toLowerCase() === tabId
}

function matchesUdfSearch(udf, filterText = '') {
  const terms = getUdfSearchTerms(filterText)
  if (terms.length === 0) return true

  const searchableText = [
    udf?.name,
    udf?.type,
    udf?.description,
    udf?.team,
    udf?.filePath,
    udf?.version,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return terms.every(term => searchableText.includes(term))
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

function renderTruncatedTooltipText(value, columnWidths, column, testId) {
  const text = value || '—'

  return (
    <Tooltip content={text} placement="top" maxWidth={320}>
      <span
        data-testid={testId}
        data-udf-column-content={column.key}
        style={{
          ...getAdaptiveTextStyle(columnWidths, column),
          cursor: value ? 'help' : 'default',
        }}
      >
        {text}
      </span>
    </Tooltip>
  )
}

export default function UDFManagementTable() {
  const { useMock } = useMockMode()
  const tableRef = useRef(null)
  const [udfs, setUdfs] = useState([])
  const [loading, setLoading] = useState(true)
  const [screenError, setScreenError] = useState('')
  const [notice, setNotice] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [filterText, setFilterText] = useState('')
  const [approvalFilter, setApprovalFilter] = useState('all')
  const [activeFilter, setActiveFilter] = useState('all')
  const [columnWidths, setColumnWidths] = useState(INITIAL_COLUMN_WIDTHS)
  const [updatingKey, setUpdatingKey] = useState('')
  const [deletingKey, setDeletingKey] = useState('')
  const [statusDialog, setStatusDialog] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const loadUdfs = useCallback(async () => {
    setLoading(true)
    setScreenError('')

    try {
      const nextUdfs = await fetchAdminUDFs(useMock)
      setUdfs(nextUdfs)
    } catch (error) {
      setScreenError(error?.message || 'Failed to load UDFs.')
    } finally {
      setLoading(false)
    }
  }, [useMock])

  useEffect(() => {
    loadUdfs()
  }, [loadUdfs])

  const tabCounts = useMemo(() => Object.fromEntries(
    UDF_TABS.map(tab => [tab.id, udfs.filter(udf => matchesUdfTab(udf, tab.id)).length])
  ), [udfs])

  const renderedRows = useMemo(() => {
    return udfs
      .filter(udf => {
        if (!matchesUdfTab(udf, activeTab)) return false
        if (!matchesUdfSearch(udf, filterText)) return false
        if (approvalFilter !== 'all') {
          const isApproved = approvalFilter === 'approved'
          if (udf.isApproved !== isApproved) return false
        }
        if (activeFilter !== 'all') {
          const isActive = activeFilter === 'active'
          if (udf.isActive !== isActive) return false
        }
        return true
      })
      .sort((left, right) => left.name.localeCompare(right.name))
  }, [activeFilter, activeTab, approvalFilter, filterText, udfs])

  const tableMinWidth = useMemo(() => TABLE_COLUMNS.reduce(
    (sum, column) => sum + (columnWidths[column.key] || column.defaultWidth),
    0,
  ), [columnWidths])

  const hasActiveFilters = activeTab !== 'all' || filterText || approvalFilter !== 'all' || activeFilter !== 'all'

  function resetFilters() {
    setActiveTab('all')
    setFilterText('')
    setApprovalFilter('all')
    setActiveFilter('all')
  }

  function startColumnResize(columnKey, event) {
    event.preventDefault()
    event.stopPropagation()

    const column = TABLE_COLUMNS.find(candidate => candidate.key === columnKey)
    if (!column) return

    const startX = event.clientX
    const startWidth = columnWidths[columnKey] || column.defaultWidth

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent) => {
      const nextWidth = Math.max(column.minWidth, startWidth + (moveEvent.clientX - startX))
      setColumnWidths(current => ({ ...current, [columnKey]: nextWidth }))
    }

    const handleMouseUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const autoSizeColumn = useCallback((columnKey) => {
    const column = TABLE_COLUMNS.find(candidate => candidate.key === columnKey)
    if (!column || !tableRef.current) return

    const tableElement = tableRef.current
    const headerNode = tableElement.querySelector(`[data-udf-column-header-content="${columnKey}"]`)
    const contentNodes = Array.from(tableElement.querySelectorAll(`[data-udf-column-content="${columnKey}"]`))

    const headerWidth = getMeasuredNodeWidth(headerNode) + CELL_HORIZONTAL_PADDING + HEADER_RESIZER_SPACE
    const contentWidth = contentNodes.reduce((maxWidth, node) => {
      return Math.max(maxWidth, getMeasuredNodeWidth(node) + CELL_HORIZONTAL_PADDING)
    }, 0)

    const nextWidth = Math.max(column.minWidth, headerWidth, contentWidth)
    setColumnWidths(current => ({ ...current, [columnKey]: nextWidth }))
  }, [])

  async function confirmDeleteUDF() {
    if (!confirmDelete) return

    const target = confirmDelete
    setDeletingKey(target.id)
    setScreenError('')
    setConfirmDelete(null)

    try {
      await deleteAdminUDF(target.id, useMock)
      setNotice(`UDF "${target.name}" was deleted.`)
      await loadUdfs()
    } catch (error) {
      setScreenError(error?.message || 'Failed to delete UDF.')
    } finally {
      setDeletingKey('')
    }
  }

  async function handleApproveUDF(udf) {
    setUpdatingKey(udf.id)
    setScreenError('')

    try {
      const updatedUdf = await updateAdminUDF(udf.id, { isApproved: !udf.isApproved }, useMock)
      if (updatedUdf?.id) {
        setUdfs(current => current.map(existingUdf => (
          existingUdf.id === updatedUdf.id
            ? { ...existingUdf, ...updatedUdf }
            : existingUdf
        )))
      }
      setNotice(`UDF "${udf.name}" was ${!udf.isApproved ? 'approved' : 'unapproved'}.`)
    } catch (error) {
      setScreenError(error?.message || 'Failed to update UDF approval status.')
    } finally {
      setUpdatingKey('')
    }
  }

  function requestApproveUDF(udf) {
    setStatusDialog({
      kind: 'approval',
      udf,
      title: udf.isApproved ? 'Unapprove UDF?' : 'Approve UDF?',
      message: udf.isApproved
        ? `Are you sure you want to mark "${udf.name}" as not approved?`
        : `Are you sure you want to approve "${udf.name}"?`,
      tone: udf.isApproved ? 'warning' : 'success',
      icon: udf.isApproved ? '↩️' : '✅',
      confirmLabel: udf.isApproved ? 'Unapprove' : 'Approve',
      confirmVariant: udf.isApproved ? 'danger' : 'success',
    })
  }

  function showActiveStatusDialog(udf) {
    setStatusDialog({
      kind: 'active',
      udf,
      title: udf.isActive ? 'UDF is active' : 'UDF is inactive',
      message: udf.isActive
        ? `"${udf.name}" is currently active. Active status is managed outside this admin screen and cannot be changed here.`
        : `"${udf.name}" is currently inactive. Active status is managed outside this admin screen and cannot be changed here.`,
      tone: udf.isActive ? 'success' : 'muted',
      icon: udf.isActive ? '✅' : '⏸️',
    })
  }

  async function confirmStatusDialog() {
    if (!statusDialog) return

    if (statusDialog.kind === 'approval') {
      const targetUdf = statusDialog.udf
      setStatusDialog(null)
      await handleApproveUDF(targetUdf)
      return
    }

    setStatusDialog(null)
  }

  return (
    <>
      <Card style={{ marginBottom: 0 }}>
        <CardTitle style={{ justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div>⚙️ UDF Management</div>
            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>
              Review backend-registered UDFs and manage approval or deletion from the admin workspace.
            </div>
          </div>
        </CardTitle>


        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{udfs.length} total UDFs</span>
          <span>·</span>
          <span>{udfs.filter(udf => udf.isApproved).length} approved</span>
          <span>·</span>
          <span>{udfs.filter(udf => !udf.isApproved).length} pending</span>
          <span>·</span>
          <span>{udfs.filter(udf => udf.isActive).length} active</span>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={filterText}
            onChange={event => setFilterText(event.target.value)}
            placeholder="🔍 Filter UDFs by name, description, team, path, or version..."
            aria-label="Filter UDFs"
            data-testid="udf-management-filter-input"
            style={FILTER_INPUT_STYLE}
          />
          <select
            aria-label="Approval filter"
            data-testid="udf-management-approval-filter"
            value={approvalFilter}
            onChange={event => setApprovalFilter(event.target.value)}
            style={FILTER_SELECT_STYLE}
          >
            <option value="all">All approvals</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
          </select>
          <select
            aria-label="Active filter"
            data-testid="udf-management-active-filter"
            value={activeFilter}
            onChange={event => setActiveFilter(event.target.value)}
            style={FILTER_SELECT_STYLE}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <Btn sm v="ghost" onClick={resetFilters} disabled={!hasActiveFilters}>
            Clear filters
          </Btn>
        </div>

        <div
          data-testid="udf-management-tabs-frame"
          style={{
            width: 'fit-content',
            maxWidth: '100%',
            background: 'transparent',
            padding: 0,
            marginBottom: -1,
            alignSelf: 'flex-start',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div data-testid="udf-management-tabs" style={{ width: '100%', flexShrink: 0 }}>
            <FilterTabs
              tabs={UDF_TABS.map(tab => ({ ...tab, count: tabCounts[tab.id] || 0 }))}
              activeTab={activeTab}
              onChange={setActiveTab}
              style={{ marginBottom: 0, overflowX: 'visible' }}
              rowStyle={{
                minWidth: 'fit-content',
                background: 'var(--surf)',
                gap: 0,
                borderBottom: '1px solid var(--border)',
                borderTopLeftRadius: 10,
                borderTopRightRadius: 10,
                overflow: 'hidden',
                boxShadow: 'inset 0 0 0 1px var(--border)',
              }}
              tabStyle={{
                background: 'transparent',
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
                padding: '12px 14px 13px',
                textTransform: 'capitalize',
              }}
              activeTabStyle={{
                background: 'transparent',
                color: 'var(--text)',
              }}
              getTabStyle={(_tab, { isLast }) => ({
                borderRight: isLast ? 'none' : '1px solid var(--border)',
              })}
            />
          </div>
        </div>

        <div data-testid="udf-management-message-slot" style={MESSAGE_SLOT_STYLE}>
          {notice && (
            <div data-testid="udf-management-notice" style={NOTICE_BANNER_STYLE}>
              {notice}
            </div>
          )}

          {screenError && (
            <div data-testid="udf-management-error" style={ERROR_BANNER_STYLE}>
              {screenError}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spinner size={38} />
          </div>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surf)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table ref={tableRef} data-testid="udf-management-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: tableMinWidth, tableLayout: 'fixed' }}>
                <colgroup>
                  {TABLE_COLUMNS.map(column => {
                    const width = columnWidths[column.key] || column.defaultWidth

                    return (
                      <col
                        key={column.key}
                        data-testid={`udf-column-${column.key}-col`}
                        style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
                      />
                    )
                  })}
                </colgroup>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  {TABLE_COLUMNS.map(column => (
                    <th
                      key={column.key}
                      onDoubleClick={() => autoSizeColumn(column.key)}
                      style={{
                        position: 'relative',
                        textAlign: column.align || 'left',
                        padding: '10px 12px',
                        fontSize: 12,
                        color: 'var(--muted)',
                        fontWeight: 700,
                        borderBottom: '1px solid var(--border)',
                        userSelect: 'none',
                        width: columnWidths[column.key] || column.defaultWidth,
                        minWidth: columnWidths[column.key] || column.defaultWidth,
                        maxWidth: columnWidths[column.key] || column.defaultWidth,
                      }}
                    >
                      <span
                        data-udf-column-header-content={column.key}
                        style={{
                          ...getAdaptiveTextStyle(columnWidths, column, CELL_HORIZONTAL_PADDING + HEADER_RESIZER_SPACE),
                          paddingRight: 8,
                        }}
                      >
                        {column.label}
                      </span>
                      <div
                        role="separator"
                        aria-orientation="vertical"
                        data-testid={`udf-column-resizer-${column.key}`}
                        onMouseDown={(event) => startColumnResize(column.key, event)}
                        onDoubleClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          autoSizeColumn(column.key)
                        }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: 14,
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'col-resize',
                          color: 'var(--muted)',
                          opacity: 0.65,
                        }}
                      >
                        <GripVertical size={12} strokeWidth={2} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {renderedRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ ...TABLE_CELL_STYLE, textAlign: 'center', color: 'var(--muted)', padding: '28px 12px' }}>
                      {hasActiveFilters
                        ? 'No UDFs match the selected tabs or filters.'
                        : 'No UDFs were returned by the backend.'}
                    </td>
                  </tr>
                ) : renderedRows.map(udf => {
                  const isUpdating = updatingKey === udf.id
                  const isDeleting = deletingKey === udf.id

                  return (
                    <tr key={udf.id || udf.name}>
                      <td style={getColumnCellStyle(columnWidths, TABLE_COLUMNS[0])}>
                        <span data-udf-column-content={TABLE_COLUMNS[0].key} style={getAdaptiveTextStyle(columnWidths, TABLE_COLUMNS[0])}>{udf.name || '—'}</span>
                      </td>
                      <td style={getColumnCellStyle(columnWidths, TABLE_COLUMNS[1])}>
                        <span data-udf-column-content={TABLE_COLUMNS[1].key} style={{ display: 'inline-flex', maxWidth: getColumnContentWidth(columnWidths, TABLE_COLUMNS[1]) }}>
                          <Chip c={udf.type === 'transformer' ? 'blue' : 'green'} style={{ fontSize: 11, maxWidth: '100%' }}>
                            {udf.type === 'transformer' ? '🔄' : '🔍'} {udf.type}
                          </Chip>
                        </span>
                      </td>
                      <td style={getColumnCellStyle(columnWidths, TABLE_COLUMNS[2])}>
                        {renderTruncatedTooltipText(udf.description, columnWidths, TABLE_COLUMNS[2], `udf-description-${udf.id}`)}
                      </td>
                      <td style={getColumnCellStyle(columnWidths, TABLE_COLUMNS[3])}>
                        <span data-udf-column-content={TABLE_COLUMNS[3].key} style={getAdaptiveTextStyle(columnWidths, TABLE_COLUMNS[3])}>{udf.team || '—'}</span>
                      </td>
                      <td style={getColumnCellStyle(columnWidths, TABLE_COLUMNS[4])}>
                        {renderTruncatedTooltipText(udf.filePath, columnWidths, TABLE_COLUMNS[4], `udf-file-path-${udf.id}`)}
                      </td>
                      <td style={getColumnCellStyle(columnWidths, TABLE_COLUMNS[5])}>
                        <span data-udf-column-content={TABLE_COLUMNS[5].key} style={getAdaptiveTextStyle(columnWidths, TABLE_COLUMNS[5])}>{udf.version || '—'}</span>
                      </td>
                      <td style={getColumnCellStyle(columnWidths, TABLE_COLUMNS[6])}>
                        <span data-udf-column-content={TABLE_COLUMNS[6].key} style={{ display: 'inline-flex' }}>
                          <Tooltip content={udf.isApproved ? `Unapprove ${udf.name}` : `Approve ${udf.name}`}>
                            <button
                              type="button"
                              aria-label={udf.isApproved ? `Unapprove ${udf.name}` : `Approve ${udf.name}`}
                              data-testid={`udf-approval-toggle-${udf.id}`}
                              onClick={() => requestApproveUDF(udf)}
                              disabled={Boolean(updatingKey) || isDeleting}
                              style={{
                                ...ICON_BUTTON_STYLE,
                                borderColor: udf.isApproved ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)',
                                color: udf.isApproved ? 'var(--success)' : 'var(--danger)',
                                opacity: Boolean(updatingKey) || isDeleting ? 0.45 : 1,
                                cursor: Boolean(updatingKey) || isDeleting ? 'not-allowed' : 'pointer',
                                margin: '0 auto',
                              }}
                            >
                              {isUpdating ? '…' : <CheckCircle2 size={18} strokeWidth={2.2} fill={udf.isApproved ? 'currentColor' : 'none'} />}
                            </button>
                          </Tooltip>
                        </span>
                      </td>
                      <td style={getColumnCellStyle(columnWidths, TABLE_COLUMNS[7])}>
                        <span data-udf-column-content={TABLE_COLUMNS[7].key} style={{ display: 'inline-flex' }}>
                          <Tooltip content={udf.isActive ? 'Active' : 'Inactive'}>
                            <button
                              type="button"
                              aria-label={udf.isActive ? 'Active' : 'Inactive'}
                              data-testid={`udf-active-indicator-${udf.id}`}
                              onClick={() => showActiveStatusDialog(udf)}
                              style={{
                                ...ICON_BUTTON_STYLE,
                                borderColor: udf.isActive ? 'rgba(34,197,94,.35)' : 'rgba(100,116,139,.35)',
                                color: udf.isActive ? 'var(--success)' : 'var(--muted)',
                                cursor: 'pointer',
                                margin: '0 auto',
                              }}
                            >
                              {udf.isActive ? <CheckCircle2 size={18} strokeWidth={2.2} fill="currentColor" /> : <CircleOff size={18} strokeWidth={2.1} />}
                            </button>
                          </Tooltip>
                        </span>
                      </td>
                      <td style={getColumnCellStyle(columnWidths, TABLE_COLUMNS[8])}>
                        <span data-udf-column-content={TABLE_COLUMNS[8].key} style={getAdaptiveTextStyle(columnWidths, TABLE_COLUMNS[8])}>{formatAdminDate(udf.dateApproved)}</span>
                      </td>
                      <td style={getColumnCellStyle(columnWidths, TABLE_COLUMNS[9])}>
                        <span data-udf-column-content={TABLE_COLUMNS[9].key} style={getAdaptiveTextStyle(columnWidths, TABLE_COLUMNS[9])}>{formatAdminDate(udf.createdAt)}</span>
                      </td>
                      <td style={getColumnCellStyle(columnWidths, TABLE_COLUMNS[10])}>
                        <span data-udf-column-content={TABLE_COLUMNS[10].key} style={getAdaptiveTextStyle(columnWidths, TABLE_COLUMNS[10])}>{formatAdminDate(udf.updatedAt)}</span>
                      </td>
                      <td style={getColumnCellStyle(columnWidths, TABLE_COLUMNS[11])}>
                        <div data-udf-column-content={TABLE_COLUMNS[11].key} style={{ display: 'flex', justifyContent: 'center' }}>
                          <Tooltip content={`Delete ${udf.name}`}>
                            <button
                              type="button"
                              aria-label={`Delete ${udf.name}`}
                              data-testid={`udf-delete-${udf.id}`}
                              style={{
                                ...ICON_BUTTON_STYLE,
                                borderColor: 'rgba(239,68,68,.35)',
                                color: 'var(--danger)',
                                opacity: Boolean(updatingKey) || isDeleting ? 0.45 : 1,
                                cursor: Boolean(updatingKey) || isDeleting ? 'not-allowed' : 'pointer',
                                margin: '0 auto',
                              }}
                              disabled={Boolean(updatingKey) || isDeleting}
                              onClick={() => setConfirmDelete(udf)}
                            >
                              {isDeleting ? '…' : <Trash2 size={16} strokeWidth={2.1} />}
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </Card>

      <ModalDialog
        isOpen={Boolean(statusDialog)}
        title={statusDialog?.title}
        message={statusDialog?.message}
        icon={statusDialog?.icon}
        tone={statusDialog?.tone}
        confirmLabel={statusDialog?.confirmLabel}
        confirmVariant={statusDialog?.confirmVariant}
        cancelLabel={statusDialog?.kind === 'active' ? 'Close' : 'Cancel'}
        onConfirm={statusDialog?.kind === 'approval' ? confirmStatusDialog : undefined}
        onCancel={() => setStatusDialog(null)}
      />

      <ModalDialog
        isOpen={Boolean(confirmDelete)}
        title="Delete UDF"
        message={`Delete UDF "${confirmDelete?.name || ''}"? This action cannot be undone.`}
        icon="🗑️"
        tone="danger"
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={confirmDeleteUDF}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  )
}
