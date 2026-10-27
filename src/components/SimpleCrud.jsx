import { useState } from 'react'
import { useCol } from '../hooks/useFirestore'
import { saveDoc, removeDoc, statusText } from '../lib/db'
import { num } from '../lib/format'
import { Panel, Field, Notice, RowActions, EmptyRow, NumInput } from './ui'

/**
 * CRUD generik untuk master data: form di atas, tabel di bawah, edit mengisi ulang form.
 * fields: [{ name, label, type: text|number|date|select|textarea|multicheck|checkbox,
 *            options: [{value,label}] | (form)=>[...], required, default, show:(form)=>bool, hint }]
 * columns: [{ label, render: (row)=>node, className }]
 */
export default function SimpleCrud({
  title,
  name,
  fields,
  columns,
  sort,
  filterRows,
  beforeSave,
  canEdit = true,
  canDelete = true,
  toolbar,
  footer,
  addLabel = 'Simpan',
}) {
  const { data, loading } = useCol(name)
  const blank = () =>
    Object.fromEntries(
      fields.map((f) => [
        f.name,
        typeof f.default === 'function'
          ? f.default()
          : f.default ?? (f.type === 'multicheck' ? [] : f.type === 'checkbox' ? false : ''),
      ]),
    )
  const [form, setForm] = useState(blank)
  const [editId, setEditId] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  let rows = filterRows ? data.filter(filterRows) : data
  rows = sort ? [...rows].sort(sort) : rows

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const visible = (f) => !f.show || f.show(form)

  async function submit(e) {
    e.preventDefault()
    setMsg(null)
    for (const f of fields) {
      if (!visible(f) || !f.required) continue
      const v = form[f.name]
      if (v === '' || v === null || v === undefined || (Array.isArray(v) && !v.length)) {
        setMsg({ type: 'error', text: `${f.label} wajib diisi.` })
        return
      }
    }
    let out = {}
    for (const f of fields) {
      const v = form[f.name]
      if (!visible(f)) out[f.name] = f.type === 'number' ? 0 : f.type === 'multicheck' ? [] : f.type === 'checkbox' ? false : ''
      else out[f.name] = f.type === 'number' ? num(v) : typeof v === 'string' ? v.trim() : v
    }
    try {
      if (beforeSave) out = await beforeSave(out, editId ? data.find((r) => r.id === editId) : null, data)
      setBusy(true)
      const { status } = await saveDoc(name, editId, out)
      setMsg({ type: 'success', text: statusText(status) })
      setForm(blank())
      setEditId(null)
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Gagal menyimpan.' })
    } finally {
      setBusy(false)
    }
  }

  function startEdit(row) {
    const f = blank()
    for (const fd of fields) if (row[fd.name] !== undefined) f[fd.name] = row[fd.name]
    setForm(f)
    setEditId(row.id)
    setMsg(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function del(row) {
    try {
      await removeDoc(name, row.id)
      if (editId === row.id) {
        setEditId(null)
        setForm(blank())
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  const showActions = canEdit || canDelete

  return (
    <Panel title={title} actions={toolbar}>
      {canEdit && (
        <form className="form-grid" onSubmit={submit}>
          {fields.filter(visible).map((f) => (
            <Field key={f.name} label={f.label + (f.required ? ' *' : '')} hint={f.hint} wide={f.wide}>
              <FieldInput f={f} value={form[f.name]} form={form} onChange={(v) => set(f.name, v)} />
            </Field>
          ))}
          <div className="form-actions">
            <button className="btn btn-primary" disabled={busy}>
              {editId ? 'Simpan perubahan' : addLabel}
            </button>
            {editId && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setEditId(null)
                  setForm(blank())
                }}
              >
                Batal
              </button>
            )}
          </div>
          <Notice msg={msg} />
        </form>
      )}

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.label} className={c.className}>
                  {c.label}
                </th>
              ))}
              {showActions && <th className="col-actions" />}
            </tr>
          </thead>
          <tbody>
            {loading && <EmptyRow cols={columns.length + 1} text="Memuat…" />}
            {!loading && !rows.length && <EmptyRow cols={columns.length + 1} />}
            {rows.map((r) => (
              <tr key={r.id} className={editId === r.id ? 'row-editing' : ''}>
                {columns.map((c) => (
                  <td key={c.label} className={c.className}>
                    {c.render(r)}
                  </td>
                ))}
                {showActions && (
                  <td className="col-actions">
                    <RowActions
                      onEdit={canEdit ? () => startEdit(r) : null}
                      onDelete={canDelete ? () => del(r) : null}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer && footer(rows)}
    </Panel>
  )
}

export function FieldInput({ f, value, form, onChange }) {
  const opts = typeof f.options === 'function' ? f.options(form) : f.options || []
  switch (f.type) {
    case 'number':
      return <NumInput value={value} onChange={onChange} placeholder={f.placeholder} />
    case 'date':
      return <input type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} />
    case 'textarea':
      return <textarea rows={2} value={value || ''} onChange={(e) => onChange(e.target.value)} />
    case 'select':
      return (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">— pilih —</option>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    case 'checkbox':
      return (
        <span className="check-inline">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {f.checkLabel || 'Ya'}
        </span>
      )
    case 'multicheck': {
      const arr = Array.isArray(value) ? value : []
      if (!opts.length) return <span className="muted">{f.emptyText || 'Belum ada pilihan'}</span>
      return (
        <div className="multicheck">
          {opts.map((o) => (
            <label key={o.value} className="chip-check">
              <input
                type="checkbox"
                checked={arr.includes(o.value)}
                onChange={(e) =>
                  onChange(e.target.checked ? [...arr, o.value] : arr.filter((x) => x !== o.value))
                }
              />
              {o.label}
            </label>
          ))}
        </div>
      )
    }
    default:
      return (
        <input
          type="text"
          value={value || ''}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}
