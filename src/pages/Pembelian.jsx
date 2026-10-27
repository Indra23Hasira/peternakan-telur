import { Fragment, useState } from 'react'
import { useCol } from '../hooks/useFirestore'
import { saveWithEffects, deleteWithEffects, statusText } from '../lib/db'
import { pembelianEffect } from '../lib/effects'
import { sisaTagihan, sumBayar, statusBayar, aging, AGING_LABEL } from '../lib/calc'
import { today, addDays, monthKey, recentMonths, monthLabel } from '../lib/dates'
import { num, fmtRp, fmtNum, fmtTgl, byNama } from '../lib/format'
import { PageHeader, Panel, Field, Notice, NumInput, RowActions, StatusBadge, EmptyRow, Stat } from '../components/ui'
import PembayaranPanel from '../components/PembayaranPanel'

const blankItem = () => ({ barangId: '', qty: '', hargaPerSatuan: '', qtyDiterima: '', catatanSelisih: '' })
const blank = () => ({
  tanggal: today(),
  supplierId: '',
  noNota: '',
  items: [blankItem()],
  ongkir: '',
  statusBayar: 'cash',
  jatuhTempo: '',
  catatan: '',
})

export default function Pembelian() {
  const { data: list, loading } = useCol('pembelian')
  const { data: supplier } = useCol('supplier')
  const { data: barang } = useCol('barang')

  const [form, setForm] = useState(blank)
  const [editId, setEditId] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [bulan, setBulan] = useState('semua')
  const [hanyaHutang, setHanyaHutang] = useState(false)
  const [openId, setOpenId] = useState(null)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const setItem = (i, k, v) => setForm((f) => ({ ...f, items: f.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) }))
  const barangOf = (id) => barang.find((b) => b.id === id)

  function onSupplier(id) {
    const s = supplier.find((x) => x.id === id)
    setForm((f) => ({
      ...f,
      supplierId: id,
      statusBayar: s?.termin === 'tempo' ? 'tempo' : 'cash',
      jatuhTempo: s?.termin === 'tempo' ? addDays(f.tanggal, num(s.hariTempo) || 14) : '',
    }))
  }

  const subtotal = form.items.reduce((s, it) => s + num(it.qty) * num(it.hargaPerSatuan), 0)
  const total = subtotal + num(form.ongkir)

  async function submit(e) {
    e.preventDefault()
    setMsg(null)
    const items = form.items.filter((it) => it.barangId && num(it.qty) > 0)
    if (!form.supplierId) return setMsg({ type: 'error', text: 'Pilih supplier.' })
    if (!items.length) return setMsg({ type: 'error', text: 'Isi minimal satu barang dengan jumlahnya.' })
    if (form.statusBayar === 'tempo' && !form.jatuhTempo) return setMsg({ type: 'error', text: 'Isi tanggal jatuh tempo.' })

    const old = editId ? list.find((x) => x.id === editId) : null
    const sup = supplier.find((s) => s.id === form.supplierId)
    const data = {
      tanggal: form.tanggal,
      supplierId: form.supplierId,
      supplierNama: sup?.nama || '',
      noNota: form.noNota.trim(),
      items: items.map((it) => {
        const b = barangOf(it.barangId)
        return {
          barangId: it.barangId,
          barangNama: b?.nama || '',
          kategori: b?.kategori || '',
          satuanBeli: b?.satuanBeli || '',
          isiPerSatuan: num(b?.isiPerSatuan) || 1,
          satuanStok: b?.satuanStok || '',
          qty: num(it.qty),
          hargaPerSatuan: num(it.hargaPerSatuan),
          qtyDiterima: it.qtyDiterima === '' ? num(it.qty) : num(it.qtyDiterima),
          catatanSelisih: it.catatanSelisih.trim(),
        }
      }),
      ongkir: num(form.ongkir),
      total,
      statusBayar: form.statusBayar,
      jatuhTempo: form.statusBayar === 'tempo' ? form.jatuhTempo : form.tanggal,
      catatan: form.catatan.trim(),
      pembayaran:
        form.statusBayar === 'cash'
          ? [{ tanggal: form.tanggal, jumlah: total, catatan: 'Cash' }]
          : old?.statusBayar === 'tempo'
            ? old.pembayaran || []
            : [],
    }
    setBusy(true)
    try {
      const { status } = await saveWithEffects('pembelian', editId, data, pembelianEffect)
      setMsg({ type: 'success', text: statusText(status) })
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
      supplierId: p.supplierId,
      noNota: p.noNota || '',
      items: (p.items || []).map((it) => ({
        barangId: it.barangId,
        qty: String(it.qty),
        hargaPerSatuan: String(it.hargaPerSatuan),
        qtyDiterima: String(it.qtyDiterima),
        catatanSelisih: it.catatanSelisih || '',
      })),
      ongkir: p.ongkir ? String(p.ongkir) : '',
      statusBayar: p.statusBayar || 'cash',
      jatuhTempo: p.statusBayar === 'tempo' ? p.jatuhTempo || '' : '',
      catatan: p.catatan || '',
    })
    setMsg(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ringkasan hutang
  const hutang = list.filter((p) => sisaTagihan(p) > 0)
  const totalHutang = hutang.reduce((s, p) => s + sisaTagihan(p), 0)
  const lewat = hutang.filter((p) => aging(p) === 'lewat')
  const mingguIni = hutang.filter((p) => aging(p) === 'minggu_ini')
  const perSupplier = {}
  for (const p of hutang) perSupplier[p.supplierNama || '–'] = (perSupplier[p.supplierNama || '–'] || 0) + sisaTagihan(p)

  const rows = list
    .filter((p) => bulan === 'semua' || monthKey(p.tanggal) === bulan)
    .filter((p) => !hanyaHutang || sisaTagihan(p) > 0)
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))

  return (
    <>
      <PageHeader
        title="Pembelian & hutang"
        subtitle="Stok gudang bertambah sesuai jumlah yang diterima. Tempo otomatis tercatat sebagai hutang supplier."
      />

      <div className="stats">
        <Stat label="Total hutang supplier" value={fmtRp(totalHutang)} sub={`${hutang.length} nota belum lunas`} />
        <Stat label="Lewat jatuh tempo" value={fmtRp(lewat.reduce((s, p) => s + sisaTagihan(p), 0))} sub={`${lewat.length} nota`} tone={lewat.length ? 'danger' : null} />
        <Stat label="Jatuh tempo ≤ 7 hari" value={fmtRp(mingguIni.reduce((s, p) => s + sisaTagihan(p), 0))} sub={`${mingguIni.length} nota`} tone={mingguIni.length ? 'warning' : null} />
      </div>
      {Object.keys(perSupplier).length > 0 && (
        <p className="muted small">
          Per supplier:{' '}
          {Object.entries(perSupplier)
            .map(([k, v]) => `${k} ${fmtRp(v)}`)
            .join(' · ')}
        </p>
      )}

      <Panel title={editId ? 'Edit pembelian' : 'Catat pembelian baru'}>
        <form onSubmit={submit}>
          <div className="form-grid">
            <Field label="Tanggal *">
              <input type="date" value={form.tanggal} onChange={(e) => set('tanggal', e.target.value)} />
            </Field>
            <Field label="Supplier *">
              <select value={form.supplierId} onChange={(e) => onSupplier(e.target.value)}>
                <option value="">— pilih —</option>
                {[...supplier].sort(byNama).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="No. nota supplier">
              <input value={form.noNota} onChange={(e) => set('noNota', e.target.value)} />
            </Field>
          </div>

          <div className="table-scroll">
            <table className="items-table">
              <thead>
                <tr>
                  <th>Barang</th>
                  <th className="num">Jumlah beli</th>
                  <th className="num">Harga / satuan</th>
                  <th className="num">Jumlah diterima</th>
                  <th>Catatan selisih / rusak</th>
                  <th className="num">Subtotal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {form.items.map((it, i) => {
                  const b = barangOf(it.barangId)
                  return (
                    <tr key={i}>
                      <td>
                        <select value={it.barangId} onChange={(e) => setItem(i, 'barangId', e.target.value)}>
                          <option value="">— pilih —</option>
                          {[...barang].sort(byNama).map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.nama}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="num">
                        <NumInput value={it.qty} onChange={(v) => setItem(i, 'qty', v)} placeholder={b?.satuanBeli || 'qty'} />
                      </td>
                      <td className="num">
                        <NumInput value={it.hargaPerSatuan} onChange={(v) => setItem(i, 'hargaPerSatuan', v)} placeholder="Rp" />
                      </td>
                      <td className="num">
                        <NumInput
                          value={it.qtyDiterima}
                          onChange={(v) => setItem(i, 'qtyDiterima', v)}
                          placeholder={it.qty || 'sama'}
                        />
                      </td>
                      <td>
                        <input value={it.catatanSelisih} onChange={(e) => setItem(i, 'catatanSelisih', e.target.value)} />
                      </td>
                      <td className="num">{fmtRp(num(it.qty) * num(it.hargaPerSatuan))}</td>
                      <td>
                        {form.items.length > 1 && (
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => set('items', form.items.filter((_, j) => j !== i))}
                          >
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
            + Tambah barang
          </button>
          <p className="muted small">Jumlah diterima kosong = sama dengan jumlah beli. Stok bertambah sebesar jumlah diterima.</p>

          <div className="form-grid">
            <Field label="Ongkir / bongkar muat" hint="Ikut dihitung ke harga pokok per kg.">
              <NumInput value={form.ongkir} onChange={(v) => set('ongkir', v)} />
            </Field>
            <Field label="Pembayaran">
              <select value={form.statusBayar} onChange={(e) => set('statusBayar', e.target.value)}>
                <option value="cash">Cash (langsung lunas)</option>
                <option value="tempo">Tempo (hutang)</option>
              </select>
            </Field>
            {form.statusBayar === 'tempo' && (
              <Field label="Jatuh tempo *">
                <input type="date" value={form.jatuhTempo} onChange={(e) => set('jatuhTempo', e.target.value)} />
              </Field>
            )}
            <Field label="Catatan">
              <input value={form.catatan} onChange={(e) => set('catatan', e.target.value)} />
            </Field>
          </div>
          <div className="total-line">
            Total pembelian: <b>{fmtRp(total)}</b>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" disabled={busy}>
              {editId ? 'Simpan perubahan' : 'Simpan pembelian'}
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
        title="Daftar pembelian"
        actions={
          <>
            <select value={bulan} onChange={(e) => setBulan(e.target.value)}>
              <option value="semua">Semua bulan</option>
              {recentMonths().map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <label className="check-inline">
              <input type="checkbox" checked={hanyaHutang} onChange={(e) => setHanyaHutang(e.target.checked)} /> Belum lunas
            </label>
          </>
        }
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Supplier</th>
                <th>Barang</th>
                <th className="num">Total</th>
                <th className="num">Terbayar</th>
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
                  <Fragment key={p.id}>
                    <tr className={editId === p.id ? 'row-editing' : ''}>
                      <td>
                        {fmtTgl(p.tanggal)}
                        {p.noNota && <div className="muted small">#{p.noNota}</div>}
                      </td>
                      <td>{p.supplierNama}</td>
                      <td className="wrap">
                        {(p.items || []).map((it, i) => (
                          <div key={i}>
                            {it.barangNama} · {fmtNum(it.qtyDiterima, 2)} {it.satuanBeli}
                            {num(it.qtyDiterima) !== num(it.qty) && (
                              <span className="text-danger"> (pesan {fmtNum(it.qty, 2)})</span>
                            )}
                          </div>
                        ))}
                      </td>
                      <td className="num">{fmtRp(p.total)}</td>
                      <td className="num">{fmtRp(sumBayar(p))}</td>
                      <td className="num">{fmtRp(sisaTagihan(p))}</td>
                      <td>
                        <StatusBadge status={statusBayar(p)} />
                      </td>
                      <td>
                        {p.statusBayar === 'tempo' ? fmtTgl(p.jatuhTempo) : 'Cash'}
                        {ag !== 'lunas' && ag !== 'belum_jt' && (
                          <div>
                            <StatusBadge status={ag} label={AGING_LABEL[ag]} />
                          </div>
                        )}
                      </td>
                      <td className="col-actions">
                        <RowActions
                          onEdit={() => startEdit(p)}
                          onDelete={() => deleteWithEffects('pembelian', p.id, pembelianEffect)}
                          confirmText="Hapus pembelian ini? Stok barang ikut dikurangi kembali."
                        >
                          <button type="button" className="icon-btn" title="Pembayaran" onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                            💰
                          </button>
                        </RowActions>
                      </td>
                    </tr>
                    {openId === p.id && (
                      <tr className="row-expand">
                        <td colSpan={9}>
                          <PembayaranPanel name="pembelian" doc={p} label="Bayar" />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
