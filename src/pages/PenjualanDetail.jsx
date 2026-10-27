import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useDocData } from '../hooks/useFirestore'
import { saveWithEffects, statusText } from '../lib/db'
import { penjualanEffect } from '../lib/effects'
import { sisaTagihan, sumBayar, statusBayar } from '../lib/calc'
import { GRADES, GRADE_LABEL } from '../lib/constants'
import { num, fmtRp, fmtNum, fmtTgl, waLink } from '../lib/format'
import { Panel, Field, Notice, NumInput, RowActions, StatusBadge, Loading } from '../components/ui'
import PembayaranPanel from '../components/PembayaranPanel'

export function notaText(p, namaFarm) {
  const lines = [
    `*${namaFarm}*`,
    `Nota ${p.noNota} — ${fmtTgl(p.tanggal)}`,
    `Kepada: ${p.pelangganNama}`,
    '',
    ...(p.items || []).map(
      (i) =>
        `• Telur ${GRADE_LABEL[i.grade].toLowerCase()} ${fmtNum(i.qty, 2)} ${i.satuan}${i.satuan === 'peti' ? ` (${fmtNum(i.kg, 2)} kg)` : ''} × ${fmtRp(i.harga)} = ${fmtRp(i.subtotal)}`,
    ),
  ]
  if (num(p.totalPotongan)) {
    lines.push(`Potongan (pecah/retur): -${fmtRp(p.totalPotongan)}`)
  }
  lines.push('', `*Total: ${fmtRp(p.total)}*`)
  const bayar = sumBayar(p)
  if (bayar > 0) lines.push(`Sudah dibayar: ${fmtRp(bayar)}`)
  const sisa = sisaTagihan(p)
  if (sisa > 0) lines.push(`*Sisa tagihan: ${fmtRp(sisa)}*`, `Jatuh tempo: ${fmtTgl(p.jatuhTempo)}`)
  else lines.push('Status: LUNAS')
  lines.push('', 'Terima kasih 🙏')
  return lines.join('\n')
}

export default function PenjualanDetail() {
  const { id } = useParams()
  const { settings } = useApp()
  const { data: p, loading } = useDocData('penjualan', id)
  const [f, setF] = useState({ jenis: 'pecah', grade: 'utuh', kg: '', nilai: '', catatan: '' })
  const [msg, setMsg] = useState(null)

  if (loading) return <Loading />
  if (!p)
    return (
      <Panel>
        Nota tidak ditemukan. <Link to="/penjualan">Kembali</Link>
      </Panel>
    )

  // simpan ulang seluruh nota (potongan retur memengaruhi stok)
  async function savePotongan(potongan) {
    const { id: _id, createdAt, createdBy, updatedAt, updatedBy, ...rest } = p
    const totalPotongan = potongan.reduce((s, x) => s + num(x.nilai), 0)
    const total = num(p.totalBruto) - totalPotongan
    // nota cash: pembayaran ikut menyesuaikan total baru supaya tidak tercatat lebih bayar
    const pembayaran = p.termin === 'cash' ? [{ tanggal: p.tanggal, jumlah: total, catatan: 'Cash' }] : p.pembayaran || []
    const { status } = await saveWithEffects(
      'penjualan',
      id,
      { ...rest, potongan, totalPotongan, total, pembayaran },
      penjualanEffect,
    )
    return status
  }

  async function addPotongan(e) {
    e.preventDefault()
    if (num(f.kg) <= 0 && num(f.nilai) <= 0) return setMsg({ type: 'error', text: 'Isi kg dan nilai potongan.' })
    const status = await savePotongan([
      ...(p.potongan || []),
      { jenis: f.jenis, grade: f.grade, kg: num(f.kg), nilai: num(f.nilai), catatan: f.catatan.trim() },
    ])
    setMsg({ type: 'success', text: statusText(status) })
    setF({ ...f, kg: '', nilai: '', catatan: '' })
  }

  // saran nilai potongan = kg × harga per kg dari item dengan grade sama
  const itemSama = (p.items || []).find((i) => i.grade === f.grade)
  const hargaPerKg = itemSama ? (itemSama.satuan === 'kg' ? itemSama.harga : num(itemSama.subtotal) / Math.max(num(itemSama.kg), 0.001)) : 0

  return (
    <>
      <div className="page-header no-print">
        <div>
          <Link to="/penjualan" className="muted">
            ← Penjualan
          </Link>
          <h1>Nota {p.noNota}</h1>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => window.print()}>
            🖨️ Cetak
          </button>
          <a className="btn btn-primary" href={waLink(p.kontak, notaText(p, settings.nama))} target="_blank" rel="noreferrer">
            Kirim WA
          </a>
        </div>
      </div>

      <div className="print-area nota">
        <div className="nota-head">
          <div>
            <div className="nota-farm">{settings.nama}</div>
            <div className="muted">Nota penjualan telur</div>
          </div>
          <div className="nota-meta">
            <div>
              No. <b>{p.noNota}</b>
            </div>
            <div>{fmtTgl(p.tanggal)}</div>
            <StatusBadge status={statusBayar(p)} />
          </div>
        </div>
        <div className="nota-to">
          Kepada: <b>{p.pelangganNama}</b> · {p.wilayahNama}
          {p.alamat && <div className="muted">{p.alamat}</div>}
        </div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Jumlah</th>
              <th className="num">Berat</th>
              <th className="num">Harga</th>
              <th className="num">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {(p.items || []).map((i, k) => (
              <tr key={k}>
                <td>Telur {GRADE_LABEL[i.grade].toLowerCase()}</td>
                <td className="num">
                  {fmtNum(i.qty, 2)} {i.satuan}
                </td>
                <td className="num">{fmtNum(i.kg, 2)} kg</td>
                <td className="num">
                  {fmtRp(i.harga)}/{i.satuan}
                </td>
                <td className="num">{fmtRp(i.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {num(p.totalPotongan) > 0 && (
              <>
                <tr>
                  <td colSpan={4}>Subtotal</td>
                  <td className="num">{fmtRp(p.totalBruto)}</td>
                </tr>
                <tr>
                  <td colSpan={4}>Potongan pecah di jalan / retur</td>
                  <td className="num">−{fmtRp(p.totalPotongan)}</td>
                </tr>
              </>
            )}
            <tr className="nota-total">
              <td colSpan={4}>Total</td>
              <td className="num">{fmtRp(p.total)}</td>
            </tr>
            <tr>
              <td colSpan={4}>Terbayar</td>
              <td className="num">{fmtRp(sumBayar(p))}</td>
            </tr>
            <tr>
              <td colSpan={4}>
                <b>Sisa tagihan</b> {sisaTagihan(p) > 0 && `· jatuh tempo ${fmtTgl(p.jatuhTempo)}`}
              </td>
              <td className="num">
                <b>{fmtRp(sisaTagihan(p))}</b>
              </td>
            </tr>
          </tfoot>
        </table>
        {p.catatan && <p className="muted">Catatan: {p.catatan}</p>}
        <div className="sign-row">
          <div>Penerima</div>
          <div>Hormat kami</div>
        </div>
      </div>

      <div className="no-print">
        <Panel title="Pembayaran pelanggan">
          <PembayaranPanel name="penjualan" doc={p} label="Pembayaran" />
        </Panel>

        <Panel title="Potongan: pecah di jalan / retur">
          <p className="muted small">
            Pecah di jalan: mengurangi tagihan, stok tidak kembali (tercatat sebagai susut). Retur utuh: mengurangi tagihan
            dan telur kembali ke stok gudang.
          </p>
          {(p.potongan || []).length > 0 && (
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Jenis</th>
                  <th>Grade</th>
                  <th className="num">Kg</th>
                  <th className="num">Nilai</th>
                  <th>Catatan</th>
                  <th className="col-actions" />
                </tr>
              </thead>
              <tbody>
                {p.potongan.map((x, i) => (
                  <tr key={i}>
                    <td>{x.jenis === 'retur' ? 'Retur (kembali ke gudang)' : 'Pecah di jalan'}</td>
                    <td>{GRADE_LABEL[x.grade]}</td>
                    <td className="num">{fmtNum(x.kg, 2)}</td>
                    <td className="num">{fmtRp(x.nilai)}</td>
                    <td>{x.catatan}</td>
                    <td className="col-actions">
                      <RowActions onDelete={() => savePotongan(p.potongan.filter((_, j) => j !== i))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <form className="form-grid compact" onSubmit={addPotongan}>
            <Field label="Jenis">
              <select value={f.jenis} onChange={(e) => setF({ ...f, jenis: e.target.value })}>
                <option value="pecah">Pecah di jalan</option>
                <option value="retur">Retur (kembali ke gudang)</option>
              </select>
            </Field>
            <Field label="Grade">
              <select value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })}>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {GRADE_LABEL[g]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Kg">
              <NumInput value={f.kg} onChange={(v) => setF({ ...f, kg: v })} />
            </Field>
            <Field label="Nilai potongan (Rp)" hint={hargaPerKg && num(f.kg) ? `Saran: ${fmtRp(num(f.kg) * hargaPerKg)}` : null}>
              <NumInput value={f.nilai} onChange={(v) => setF({ ...f, nilai: v })} />
            </Field>
            <Field label="Catatan">
              <input value={f.catatan} onChange={(e) => setF({ ...f, catatan: e.target.value })} />
            </Field>
            <div className="form-actions">
              <button className="btn btn-primary">Tambah potongan</button>
              {hargaPerKg > 0 && num(f.kg) > 0 && (
                <button type="button" className="btn" onClick={() => setF({ ...f, nilai: String(Math.round(num(f.kg) * hargaPerKg)) })}>
                  Pakai saran
                </button>
              )}
            </div>
            <Notice msg={msg} />
          </form>
        </Panel>
      </div>
    </>
  )
}
