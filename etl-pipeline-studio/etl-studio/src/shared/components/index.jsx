import { useState } from 'react'

// ── Chip / Badge ──────────────────────────────────────────────────────────
const CHIP_COLORS = {
  blue:   { background: 'rgba(79,110,247,.15)',  color: '#818cf8' },
  green:  { background: 'rgba(34,197,94,.15)',   color: '#4ade80' },
  purple: { background: 'rgba(124,58,237,.15)',  color: '#a78bfa' },
  amber:  { background: 'rgba(245,158,11,.15)',  color: '#fbbf24' },
  red:    { background: 'rgba(239,68,68,.15)',   color: '#f87171' },
  muted:  { background: 'rgba(100,116,139,.15)', color: '#94a3b8' },
}

export function Chip({ c = 'blue', children, style = {} }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      ...(CHIP_COLORS[c] || CHIP_COLORS.blue),
      ...style,
    }}>
      {children}
    </span>
  )
}

export function TypeBadge({ type, style = {} }) {
  const map = { string: 'green', number: 'amber', boolean: 'purple', date: 'blue', object: 'red', array: 'amber' }
  return (
    <span style={{
      background: 'var(--surf2)', color: 'var(--accent)',
      fontSize: 10, padding: '1px 7px', borderRadius: 8,
      fontWeight: 600, fontFamily: 'var(--mono)', ...style,
    }}>
      {type}
    </span>
  )
}

// ── Button ────────────────────────────────────────────────────────────────
const BTN_VARIANTS = {
  primary:   (h, d) => ({ background: d ? 'var(--muted)' : h ? '#3d5ce6' : 'var(--accent)', color: '#fff' }),
  secondary: (h)    => ({ background: h ? '#2a2f47' : 'var(--surf2)', color: 'var(--text)', border: '1px solid var(--border)' }),
  success:   (h)    => ({ background: h ? '#16a34a' : 'var(--success)', color: '#fff' }),
  ghost:     (h)    => ({ background: h ? 'var(--surf2)' : 'transparent', color: h ? 'var(--text)' : 'var(--muted)', border: `1px solid ${h ? 'var(--accent)' : 'var(--border)'}` }),
  danger:    (h)    => ({ background: h ? '#b91c1c' : 'rgba(239,68,68,.15)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,.3)' }),
  accent2:   (h)    => ({ background: h ? '#6d28d9' : 'var(--accent2)', color: '#fff' }),
}

export function Btn({ children, v = 'primary', sm, onClick, disabled, style = {} }) {
  const [hov, setHov] = useState(false)
  const variant = BTN_VARIANTS[v] || BTN_VARIANTS.primary
  const variantStyle = typeof variant === 'function' ? variant(hov && !disabled, disabled) : variant

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: sm ? '5px 12px' : '8px 20px',
        borderRadius: 7, fontSize: sm ? 12 : 13,
        fontWeight: 600, border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'all .15s', fontFamily: 'var(--font)',
        ...variantStyle, ...style,
      }}
    >
      {children}
    </button>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────
export function Card({ children, style = {}, p = '20px 22px' }) {
  return (
    <div style={{
      background: 'var(--surf)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: p, marginBottom: 18,
      animation: 'fadeIn .25s ease', ...style,
    }}>
      {children}
    </div>
  )
}

export function CardTitle({ children, style = {} }) {
  return (
    <div style={{
      fontSize: 14, fontWeight: 700, marginBottom: 14,
      display: 'flex', alignItems: 'center', gap: 8,
      flexWrap: 'wrap', ...style,
    }}>
      {children}
    </div>
  )
}

// ── Form ──────────────────────────────────────────────────────────────────
export function FormRow({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
      {children}
    </div>
  )
}

export function FormGroup({ label, required, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }}>
          {label}{required && <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>}
        </label>
      )}
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{hint}</div>}
    </div>
  )
}

// ── Validation Item ───────────────────────────────────────────────────────
const VAL_STYLES = {
  ok:   { background: 'rgba(34,197,94,.08)',  color: 'var(--success)' },
  err:  { background: 'rgba(239,68,68,.08)',  color: 'var(--danger)'  },
  warn: { background: 'rgba(245,158,11,.08)', color: 'var(--warning)' },
}

export function ValidationItem({ type = 'ok', children }) {
  const icons = { ok: '✔', err: '✖', warn: '⚠' }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 10px', borderRadius: 6, marginBottom: 5, fontSize: 12,
      ...(VAL_STYLES[type] || VAL_STYLES.ok),
    }}>
      <span>{icons[type]}</span>
      {children}
    </div>
  )
}

// ── Side Panel ────────────────────────────────────────────────────────────
export function SidePanel({ title, items, children }) {
  return (
    <div style={{
      width: 190, background: 'var(--surf)', borderLeft: '1px solid var(--border)',
      padding: 14, overflowY: 'auto', flexShrink: 0,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: .5, color: 'var(--muted)',
        textTransform: 'uppercase', marginBottom: 10,
      }}>
        {title}
      </div>
      {items?.map(([k, v], i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12,
        }}>
          <span style={{ color: 'var(--muted)' }}>{k}</span>
          <span style={{
            color: 'var(--text)', fontWeight: 500,
            maxWidth: 100, textAlign: 'right',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {v}
          </span>
        </div>
      ))}
      {children}
    </div>
  )
}

// ── Config Panel ─────────────────────────────────────────────────────────
export function CfgPanel({ title, children }) {
  return (
    <div style={{
      background: 'rgba(79,110,247,.05)', border: '1px solid rgba(79,110,247,.25)',
      borderRadius: 10, padding: 18, marginTop: 4, animation: 'fadeIn .2s ease',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 800, letterSpacing: .6,
        textTransform: 'uppercase', marginBottom: 14, color: 'var(--accent)',
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

// ── Draft Badge ───────────────────────────────────────────────────────────
export function DraftBadge() {
  return (
    <span style={{
      background: 'rgba(245,158,11,.15)', color: 'var(--warning)',
      border: '1px solid rgba(245,158,11,.3)',
      padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
    }}>
      ● DRAFT
    </span>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────
export function Spinner({ size = 44 }) {
  return (
    <div style={{
      width: size, height: size,
      border: '4px solid var(--border)',
      borderTop: '4px solid var(--accent)',
      borderRadius: '50%',
      animation: 'spin .7s linear infinite',
    }} />
  )
}
