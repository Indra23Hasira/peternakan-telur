import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useCol, useDocData } from '../hooks/useFirestore'
import { saveWithEffects, deleteWithEffects, statusText } from '../lib/db'
import { penjualanEffect } from '../lib/effects'
import { hargaAktif, sisaTagihan, sumBayar, statusBayar, aging, AGING_LABEL } from '../lib/calc'
import { GRADES, GRADE_LABEL } from '../lib/constants'
import { today, addDays, monthKey, recentMonths, monthLabel } from '../lib/dates'
import { num, fmtRp, fmtNum, fmtTgl, byNama } from '../lib/format'
import { PageHeader, Panel, Field, Notice, NumInput, RowActions, StatusBadge, EmptyRow, Stat } from '../components/ui'

const blankItem = () => ({ grade: 'utuh', satuan: 'peti', qty: '', kg: '', kgManual: false, harga: '', hargaManual: false })
const blank = () => ({ tanggal: today(), pelangganId: '', items: [blankItem()], termin: 'cash', jatuhTempo: '', catatan: '' })

const noNota = (tgl) =>
  `J${tgl.slice(2, 4)}${tgl.slice(5, 7)}${tgl.slice(8, 10)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`

export default function Penjualan() {
  const { settings, isOwner } = useApp()
  const { data: list, loading } = useCol('penjualan')
  const { data: pelanggan } = useCol('pelanggan')
  const { data: harga } = useCol('hargaJual')
  const { data: wilayah } = useCol('wilayah')
  const wNama = (id) => wilayah.find((w) => w.id === id)?.nama || ''
  const { data: saldo } = useDocData('stokTelur', 'saldo')

  const [form, setForm] = useState(blank)
  const [editId, setEditId] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [bulan, setBulan] = useState(monthKey(today()))
  const [filter, setFilter] = useState('semua')

  const pel = pelanggan.find((p) => p.id === form.pelangganId)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  // nilai turunan per item: kg default & harga dari daftar harga aktif
  const derive = (it) => {
    const kg = it.satuan === 'kg' ? num(it.qty) : it.kgManual ? num(it.kg) : num(it.qty) * settings.kgPerPeti
    const auto = pel ? hargaAktif(harga, pel.wilayahId, it.grade, it.satuan, form.tanggal) : null
    const h = it.hargaManual ? num(it.harga) : auto ? auto.harga : 0
    const subtotal = (it.satuan === 'kg' ? kg : num(it.qty)) * h
    return { kg, harga: h, auto, subtotal }
  }

  const setItem = (i, patch) => setForm((f) => ({ ...f, items: f.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }))

  function onPelanggan(id) {
    const p = pelanggan.find((x) => x.id === id)
    setForm((f) => ({
      ...f,
      pelangganId: id,
      termin: p?.termin === 'tempo' ? 'tempo' : 'cash',
      jatuhTempo: p?.termin === 'tempo' ? addDays(f.tanggal, num(p.hariTempo) || 7) : '',
    }))
  }

  const totalBruto = form.items.reduce((s, it) => s + derive(it).subtotal, 0)

  // cek stok: kebutuhan per grade vs saldo (+ yang sudah dipotong oleh nota yang sedang diedit)
  const old = editId ? list.find((x) => x.id === editId) : null
  const kurangStok = GRADES.filter((g) => {
    const butuh = form.items.filter((it) => it.grade === g).reduce((s, it) => s + derive(it).kg, 0)
    const sudah = (old?.items || []).filter((it) => it.grade === g).reduce((s, it) => s + num(it.kg), 0)
    return butuh > 0 && butuh > num(saldo?.[g]) + sudah + 0.01
  })

  async function submit(e) {
    e.preventDefault()
    setMsg(null)
    if (!pel) return setMsg({ type: 'error', text: 'Pilih pelanggan.' })
    const items = form.items.filter((it) => num(it.qty) > 0)
    if (!items.length) return setMsg({ type: 'error', text: 'Isi minimal satu item.' })
    for (const it of items) {
      const d = derive(it)
      if (d.harga <= 0)
        return setMsg({
          type: 'error',
          text: `Belum ada harga aktif untuk ${GRADE_LABEL[it.grade]} per ${it.satuan} di wilayah ini${
            isOwner ? ' — isi harga manual atau set di menu Harga jual.' : '. Minta owner menetapkan harga di menu Harga jual.'
          }`,
        })
      if (d.kg <= 0) return setMsg({ type: 'error', text: 'Isi berat (kg) aktual hasil timbang.' })
    }
    if (form.termin === 'tempo' && !form.jatuhTempo) return setMsg({ type: 'error', text: 'Isi tanggal jatuh tempo.' })

    const itemsOut = items.map((it) => {
      const d = derive(it)
      return { grade: it.grade, satuan: it.satuan, qty: num(it.qty), kg: d.kg, harga: d.harga, subtotal: d.subtotal }
    })
    const bruto = itemsOut.reduce((s, it) => s + it.subtotal, 0)
    const potongan = old?.potongan || []
    const totalPotongan = potongan.reduce((s, p) => s + num(p.nilai), 0)
    const total = bruto - totalPotongan
    const data = {
      tanggal: form.tanggal,
      noNota: old?.noNota || noNota(form.tanggal),
      pelangganId: pel.id,
      pelangganNama: pel.nama,
      wilayahId: pel.wilayahId,
      wilayahNama: wNama(pel.wilayahId),
      kontak: pel.kontak || '',
      alamat: pel.alamat || '',
      items: itemsOut,
      totalBruto: bruto,
      potongan,
      totalPotongan,
      total,
      termin: form.termin,
      jatuhTempo: form.termin === 'tempo' ? form.jatuhTempo : form.tanggal,
      catatan: form.catatan.trim(),
      pembayaran:
        form.termin === 'cash'
          ? [{ tanggal: form.tanggal, jumlah: total, catatan: 'Cash' }]
          : old?.termin === 'tempo'
            ? old.pembayaran || []
            : [],
    }
    setBusy(true)
    try {
      const { status } = await saveWithEffects('penjualan', editId, data, penjualanEffect)
      setMsg({ type: 'success', text: `${statusText(status)} Nota ${data.noNota}.` })
      setForm(blank())
      setEditId(null)
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  function startEdit(p) {
    setEditId(p.id)
    setForm({
      tanggal: p.tanggal,
      pelangganId: p.pelangganId,
      items: (p.items || []).map((it) => ({
        grade: it.grade,
        satuan: it.satuan,
        qty: String(it.qty),
        kg: String(it.kg),
        kgManual: it.satuan === 'peti',
        harga: String(it.harga),
        hargaManual: true, // harga nota lama dipertahankan
      })),
      termin: p.termin || 'cash',
      jatuhTempo: p.termin === 'tempo' ? p.jatuhTempo : '',
      catatan: p.catatan || '',
    })
    setMsg(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const piutangAll = list.filter((p) => sisaTagihan(p) > 0)
  const sumSisa = (arr) => arr.reduce((s, p) => s + sisaTagihan(p), 0)
  const lewat = piutangAll.filter((p) => aging(p) === 'lewat')
  const minggu = piutangAll.filter((p) => aging(p) === 'minggu_ini')

  const rows = list
    .filter((p) => (filter === 'piutang' ? sisaTagihan(p) > 0 : bulan === 'semua' || monthKey(p.tanggal) === bulan))
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || String(b.noNota).localeCompare(String(a.noNota)))
  const sumRows = rows.reduce((s, p) => s + num(p.total), 0)
  const kgRows = rows.reduce((s, p) => s + (p.items || []).reduce((a, i) => a + num(i.kg), 0), 0)

  return (
    <>
      <PageHeader title="Penjualan & piutang" />
      <div className="stats">
        <Stat label="Total piutang" value={fmtRp(sumSisa(piutangAll))} sub={`${piutangAll.length} nota`} />
        <Stat label="Lewat jatuh tempo" value={fmtRp(sumSisa(lewat))} sub={`${lewat.length} nota`} tone={lewat.length ? 'danger' : null} />
        <Stat label="Jatuh tempo ≤ 7 hari" value={fmtRp(sumSisa(minggu))} sub={`${minggu.length} nota`} tone={minggu.length ? 'warning' : null} />
      </div>

      <Panel title={editId ? `Edit nota ${old?.noNota || ''}` : 'Nota penjualan baru'}>
        <form onSubmit={submit}>
          <div className="form-grid">
            <Field label="Tanggal *">
              <input type="date" value={form.tanggal} onChange={(e) => set('tanggal', e.target.value)} />
            </Field>
            <Field label="Pelanggan *" hint={pel ? `Wilayah: ${wNama(pel.wilayahId) || '–'}` : null}>
              <select value={form.pelangganId} onChange={(e) => onPelanggan(e.target.value)}>
                <option value="">— pilih —</option>
                {[...pelanggan].sort(byNama).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="table-scroll">
            <table className="items-table">
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>Satuan</th>
                  <th className="num">Jumlah</th>
                  <th className="num">Kg aktual (timbang)</th>
                  <th className="num">Harga</th>
                  <th className="num">Subtotal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {form.items.map((it, i) => {
                  const d = derive(it)
                  return (
                    <tr key={i}>
                      <td>
                        <select value={it.grade} onChange={(e) => setItem(i, { grade: e.target.value, hargaManual: false })}>
                          {GRADES.map((g) => (
                            <option key={g} value={g}>
                              {GRADE_LABEL[g]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select value={it.satuan} onChange={(e) => setItem(i, { satuan: e.target.value, hargaManual: false })}>
                          <option value="peti">Peti</option>
                          <option value="kg">Kg</option>
                        </select>
                      </td>
                      <td className="num">
                        <NumInput value={it.qty} onChange={(v) => setItem(i, { qty: v })} placeholder={it.satuan} />
                      </td>
                      <td className="num">
                        {it.satuan === 'kg' ? (
                          <span className="muted">{fmtNum(d.kg, 2)}</span>
                        ) : (
                          <NumInput
                            value={it.kgManual ? it.kg : d.kg ? String(d.kg) : ''}
                            onChange={(v) => setItem(i, { kg: v, kgManual: true })}
                            placeholder={`${fmtNum(settings.kgPerPeti)}/peti`}
                          />
                        )}
                      </td>
                      <td className="num">
                        {isOwner || it.hargaManual ? (
                          <NumInput
                            value={it.hargaManual ? it.harga : d.harga ? String(d.harga) : ''}
                            onChange={(v) => setItem(i, { harga: v, hargaManual: true })}
                            placeholder="Rp"
                            readOnly={!isOwner}
                          />
                        ) : d.auto ? (
                          fmtRp(d.harga)
                        ) : (
                          <span className="text-danger small">belum ada harga</span>
                        )}
                        {isOwner && it.hargaManual && d.auto && num(it.harga) !== d.auto.harga && (
                          <div className="muted small">daftar: {fmtRp(d.auto.harga)}</div>
                        )}
                      </td>
                      <td className="num">{fmtRp(d.subtotal)}</td>
                      <td>
                        {form.items.length > 1 && (
                          <button type="button" className="icon-btn" onClick={() => set('items', form.items.filter((_, j) => j !== i))}>
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-small" onClick={() => set('items', [...form.items, blankItem()])}>
            + Tambah item
          </button>
          {kurangStok.length > 0 && (
            <div className="notice notice-warning">
              Stok gudang tidak cukup untuk: {kurangStok.map((g) => `${GRADE_LABEL[g]} (sisa ${fmtNum(saldo?.[g], 1)} kg)`).join(', ')}.
              Nota tetap bisa disimpan, tapi cek kembali input produksi.
            </div>
          )}

          <div className="form-grid">
            <Field label="Pembayaran">
              <select
                value={form.termin}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    termin: e.target.value,
                    jatuhTempo: e.target.value === 'tempo' && !f.jatuhTempo ? addDays(f.tanggal, num(pel?.hariTempo) || 7) : f.jatuhTempo,
                  }))
                }
              >
                <option value="cash">Cash (langsung lunas)</option>
                <option value="tempo">Tempo (piutang)</option>
              </select>
            </Field>
            {form.termin === 'tempo' && (
              <Field label="Jatuh tempo *">
                <input type="date" value={form.jatuhTempo} onChange={(e) => set('jatuhTempo', e.target.value)} />
              </Field>
            )}
            <Field label="Catatan">
              <input value={form.catatan} onChange={(e) => set('catatan', e.target.value)} />
            </Field>
          </div>
          <div className="total-line">
            Total: <b>{fmtRp(totalBruto - num(old?.totalPotongan))}</b>
            {old?.totalPotongan ? <span className="muted small"> (setelah potongan {fmtRp(old.totalPotongan)})</span> : null}
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" disabled={busy}>
              {editId ? 'Simpan perubahan' : 'Simpan nota'}
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
      </Panel>

      <Panel
        title="Daftar nota"
        actions={
          <>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="semua">Per bulan</option>
              <option value="piutang">Semua yang belum lunas</option>
            </select>
            {filter === 'semua' && (
              <select value={bulan} onChange={(e) => setBulan(e.target.value)}>
                <option value="semua">Semua bulan</option>
                {recentMonths().map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            )}
          </>
        }
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Nota</th>
                <th>Pelanggan</th>
                <th className="num">Kg</th>
                <th className="num">Total</th>
                <th className="num">Sisa</th>
                <th>Status</th>
                <th>Jatuh tempo</th>
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {loading && <EmptyRow cols={9} text="Memuat…" />}
              {!loading && !rows.length && <EmptyRow cols={9} />}
              {rows.map((p) => {
                const ag = aging(p)
                return (
                  <tr key={p.id} className={editId === p.id ? 'row-editing' : ''}>
                    <td>{fmtTgl(p.tanggal)}</td>
                    <td>
                      <Link to={`/penjualan/${p.id}`}>{p.noNota}</Link>
                    </td>
                    <td>
                      {p.pelangganNama}
                      <div className="muted small">{p.wilayahNama}</div>
                    </td>
                    <td className="num">{fmtNum((p.items || []).reduce((s, i) => s + num(i.kg), 0), 1)}</td>
                    <td className="num">{fmtRp(p.total)}</td>
                    <td className="num">{fmtRp(sisaTagihan(p))}</td>
                    <td>
                      <StatusBadge status={statusBayar(p)} />
                    </td>
                    <td>
                      {p.termin === 'tempo' ? fmtTgl(p.jatuhTempo) : 'Cash'}
                      {ag !== 'lunas' && ag !== 'belum_jt' && (
                        <div>
                          <StatusBadge status={ag} label={AGING_LABEL[ag]} />
                        </div>
                      )}
                    </td>
                    <td className="col-actions">
                      <RowActions
                        onEdit={() => startEdit(p)}
                        onDelete={() => deleteWithEffects('penjualan', p.id, penjualanEffect)}
                        confirmText="Hapus nota ini? Stok telur dikembalikan ke gudang."
                      >
                        <Link className="icon-btn" title="Detail, bayar, cetak" to={`/penjualan/${p.id}`}>
                          🧾
                        </Link>
                      </RowActions>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3}>Total {rows.length} nota</td>
                  <td className="num">{fmtNum(kgRows, 1)}</td>
                  <td className="num">{fmtRp(sumRows)}</td>
                  <td className="num">{fmtRp(rows.reduce((s, p) => s + sisaTagihan(p), 0))}</td>
                  <td colSpan={3}>Terbayar {fmtRp(rows.reduce((s, p) => s + sumBayar(p), 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Panel>
    </>
  )
}
