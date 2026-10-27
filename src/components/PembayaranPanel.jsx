import { useState } from 'react'
import { patchDoc, statusText } from '../lib/db'
import { sumBayar, sisaTagihan } from '../lib/calc'
import { today } from '../lib/dates'
import { num, fmtRp, fmtTgl } from '../lib/format'
import { Field, Notice, NumInput, RowActions } from './ui'

/** Daftar pembayaran (bertahap) untuk satu nota pembelian / penjualan. */
export default function PembayaranPanel({ name, doc, label = 'Pembayaran' }) {
  const sisa = sisaTagihan(doc)
  const [f, setF] = useState({ tanggal: today(), jumlah: '', catatan: '' })
  const [msg, setMsg] = useState(null)
  const list = doc.pembayaran || []

  async function add(e) {
    e.preventDefault()
    const jumlah = num(f.jumlah)
    if (jumlah <= 0) return setMsg({ type: 'error', text: 'Isi jumlah pembayaran.' })
    if (jumlah > sisa + 0.5) return setMsg({ type: 'error', text: `Melebihi sisa tagihan (${fmtRp(sisa)}).` })
    const st = await patchDoc(name, doc.id, {
      pembayaran: [...list, { tanggal: f.tanggal, jumlah, catatan: f.catatan.trim() }],
    })
    setMsg({ type: 'success', text: statusText(st) })
    setF({ tanggal: today(), jumlah: '', catatan: '' })
  }

  const remove = (i) => patchDoc(name, doc.id, { pembayaran: list.filter((_, j) => j !== i) })

  return (
    <div className="bayar-panel">
      <div className="bayar-summary">
        <span>
          Total <b>{fmtRp(doc.total)}</b>
        </span>
        <span>
          Terbayar <b>{fmtRp(sumBayar(doc))}</b>
        </span>
        <span>
          Sisa <b className={sisa > 0 ? 'text-danger' : 'text-success'}>{fmtRp(sisa)}</b>
        </span>
      </div>
      {list.length > 0 && (
        <table className="mini-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th className="num">Jumlah</th>
              <th>Catatan</th>
              <th className="col-actions" />
            </tr>
          </thead>
          <tbody>
            {list.map((p, i) => (
              <tr key={i}>
                <td>{fmtTgl(p.tanggal)}</td>
                <td className="num">{fmtRp(p.jumlah)}</td>
                <td>{p.catatan}</td>
                <td className="col-actions">
                  <RowActions onDelete={() => remove(i)} confirmText="Hapus pembayaran ini?" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {sisa > 0 && (
        <form className="form-grid compact" onSubmit={add}>
          <Field label="Tanggal">
            <input type="date" value={f.tanggal} onChange={(e) => setF({ ...f, tanggal: e.target.value })} />
          </Field>
          <Field label={`Jumlah ${label.toLowerCase()}`}>
            <NumInput value={f.jumlah} onChange={(v) => setF({ ...f, jumlah: v })} placeholder={String(Math.round(sisa))} />
          </Field>
          <Field label="Catatan">
            <input value={f.catatan} onChange={(e) => setF({ ...f, catatan: e.target.value })} placeholder="Transfer BCA, tunai…" />
          </Field>
          <div className="form-actions">
            <button className="btn btn-primary">Catat {label.toLowerCase()}</button>
            <button type="button" className="btn" onClick={() => setF({ ...f, jumlah: String(Math.round(sisa)) })}>
              Lunasi
            </button>
          </div>
          <Notice msg={msg} />
        </form>
      )}
    </div>
  )
}
