export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  )
}

export function Panel({ title, actions, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <div className="panel-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="panel-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function Field({ label, hint, children, wide }) {
  return (
    <label className={`field ${wide ? 'field-wide' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function Notice({ msg }) {
  if (!msg) return null
  return <div className={`notice notice-${msg.type || 'info'}`}>{msg.text}</div>
}

export function Badge({ tone = 'gray', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

const STATUS_TONE = {
  lunas: 'green',
  sebagian: 'amber',
  belum: 'red',
  lewat: 'red',
  minggu_ini: 'amber',
  belum_jt: 'gray',
  aktif: 'green',
  pending: 'amber',
  ditolak: 'gray',
  afkir: 'gray',
}
const STATUS_LABEL = {
  lunas: 'Lunas',
  sebagian: 'Sebagian',
  belum: 'Belum bayar',
  aktif: 'Aktif',
  pending: 'Menunggu approval',
  ditolak: 'Ditolak',
  afkir: 'Afkir',
}
export function StatusBadge({ status, label }) {
  return <Badge tone={STATUS_TONE[status] || 'gray'}>{label || STATUS_LABEL[status] || status}</Badge>
}

export function RowActions({ onEdit, onDelete, children, confirmText = 'Hapus data ini?' }) {
  return (
    <div className="row-actions">
      {children}
      {onEdit && (
        <button type="button" className="icon-btn" title="Edit" onClick={onEdit}>
          ✏️
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          className="icon-btn"
          title="Hapus"
          onClick={() => window.confirm(confirmText) && onDelete()}
        >
          🗑️
        </button>
      )}
    </div>
  )
}

export function Stat({ label, value, sub, tone }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function EmptyRow({ cols, text = 'Belum ada data' }) {
  return (
    <tr>
      <td colSpan={cols} className="empty">
        {text}
      </td>
    </tr>
  )
}

export function Loading({ text = 'Memuat…' }) {
  return <div className="loading">{text}</div>
}

/** Input angka yang ramah HP (keyboard angka, koma diterima) */
export function NumInput({ value, onChange, ...rest }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.,-]/g, ''))}
      {...rest}
    />
  )
}
