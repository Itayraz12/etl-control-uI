import { useEffect } from 'react'
import { Btn } from './index.jsx'

const HEADER_ACCENTS = {
  accent: 'var(--accent)',
  success: 'var(--success)',
  danger: 'var(--danger)',
  warning: 'var(--warning)',
  muted: 'var(--muted)',
}

export default function ModalDialog({
  isOpen,
  title,
  message,
  icon,
  tone = 'accent',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
  children,
  footer,
  disableBackdropClose = false,
}) {
  useEffect(() => {
    if (!isOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  if (!isOpen) return null

  const accent = HEADER_ACCENTS[tone] || HEADER_ACCENTS.accent

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.52)',
          zIndex: 999,
        }}
        onClick={() => {
          if (!disableBackdropClose) onCancel?.()
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(92vw, 480px)',
          background: 'var(--surf)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
          zIndex: 1000,
        }}
      >
        <div style={{
          background: accent,
          color: '#fff',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          {icon ? <div style={{ fontSize: 24, lineHeight: 1 }}>{icon}</div> : null}
          <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
        </div>
        <div style={{
          padding: '20px',
          color: 'var(--text)',
          fontSize: 14,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
        }}>
          {message}
          {children}
        </div>
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
        }}>
          {footer || (
            <>
              <Btn v="ghost" onClick={onCancel}>{cancelLabel}</Btn>
              {onConfirm ? <Btn v={confirmVariant} onClick={onConfirm}>{confirmLabel}</Btn> : null}
            </>
          )}
        </div>
      </div>
    </>
  )
}