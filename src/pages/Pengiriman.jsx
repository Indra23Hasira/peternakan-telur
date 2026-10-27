import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCol } from '../hooks/useFirestore'
import { saveDoc, removeDoc, statusText } from '../lib/db'
import { today, monthKey, recentMonths, monthLabel } from '../lib/dates'
import { num, fmtRp, fmtNum, fmtTgl, byNama } from '../lib/format'
import SimpleCrud from '../components/SimpleCrud'
import { PageHeader, Panel, Field, Notice, NumInput, RowActions, EmptyRow, Badge } from '../components/ui'

const blank = () => ({
  tanggal: today(),
  armadaId: '',
  sopir: '',
  penjualanIds: [],
  biayaBbm: '',
  biayaTol: '',
  uangJalan: '',
  catatan: '',
})

export const biayaTrip = (t) => num(t.biayaBbm) + num(t.biayaTol) + num(t.uangJalan)

export default function Pengiriman() {
  const { data: armada } = useCol('armada')
  const { data: trips, loading } = useCol('trip')
  const [form, setForm] = useState(blank)
  const [editId, setEditId] = useState(null)
  const [msg, setMsg] = useState(null)
  const [bulan, setBulan] = useState(monthKey(today()))
  const { data: notaHari } = useCol('penjualan', { wheres: [['tanggal', '==', form.tanggal]] })

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const armadaAktif = armada.filter((a) => a.aktif !== false || a.id === form.armadaId).sort(byNama)

  // nota yang sudah dibawa trip lain
  const dipakai = new Set(trips.filter((t) => t.id !== editId).flatMap((t) => t.penjualanIds || []))
  const notaPilihan = notaHari.filter((n) => !dipakai.has(n.id)).sort((a, b) => String(a.pelangganNama).localeCompare(String(b.pelangganNama)))

  async function submit(e) {
    e.preventDefault()
    if (!form.armadaId) return setMsg({ type: 'error', text: 'Pilih armada.' })
    if (!form.penjualanIds.length) return setMsg({ type: 'error', text: 'Pilih minimal satu nota yang dibawa.' })
    const a = armada.find((x) => x.id === form.armadaId)
    const notas = notaHari.filter((n) => form.penjualanIds.includes(n.id))
    const { status } = await saveDoc('trip', editId, {
      tanggal: form.tanggal,
      armadaId: form.armadaId,
      armadaNama: a ? `${a.nama}${a.plat ? ` (${a.plat})` : ''}` : '',
      sopir: form.sopir.trim(),
      penjualanIds: form.penjualanIds,
      totalKg: notas.reduce((s, n) => s + (n.items || []).reduce((x, i) => x + num(i.kg), 0), 0),
      biayaBbm: num(form.biayaBbm),
      biayaTol: num(form.biayaTol),
      uangJalan: num(form.uangJalan),
      catatan: form.catatan.trim(),
    })
    setMsg({ type: 'success', text: statusText(status) })
    setForm(blank())
    setEditId(null)
  }

  const rows = trips
    .filter((t) => bulan === 'semua' || monthKey(t.tanggal) === bulan)
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))

  return (
    <>
      <PageHeader
        title="Pengiriman"
        subtitle="Satu trip = satu armada + sopir + beberapa nota. Biaya trip masuk ke biaya operasional."
      />

      <Panel title={editId ? 'Edit trip' : 'Trip baru'}>
        <form onSubmit={submit}>
          <div className="form-grid">
            <Field label="Tanggal *">
              <input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value, penjualanIds: [] })} />
            </Field>
            <Field label="Armada *">
              <select value={form.armadaId} onChange={(e) => set('armadaId', e.target.value)}>
                <option value="">— pilih —</option>
                {armadaAktif.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nama} {a.plat ? `(${a.plat})` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nama sopir">
              <input value={form.sopir} onChange={(e) => set('sopir', e.target.value)} />
            </Field>
          </div>

          <h3 className="sub-title">Nota yang dibawa ({form.penjualanIds.length})</h3>
          {notaPilihan.length ? (
            <div className="multicheck">
              {notaPilihan.map((n) => (
                <label key={n.id} className="chip-check">
                  <input
                    type="checkbox"
                    checked={form.penjualanIds.includes(n.id)}
                    onChange={(e) =>
                      set('penjualanIds', e.target.checked ? [...form.penjualanIds, n.id] : form.penjualanIds.filter((x) => x !== n.id))
                    }
                  />
                  {n.pelangganNama} · {fmtNum((n.items || []).reduce((s, i) => s + num(i.kg), 0), 1)} kg
                </label>
              ))}
            </div>
          ) : (
            <p className="muted small">Tidak ada nota (yang belum dibawa trip lain) di tanggal ini. Buat nota dulu di menu Penjualan.</p>
          )}

          <div className="form-grid">
            <Field label="BBM (Rp)">
              <NumInput value={form.biayaBbm} onChange={(v) => set('biayaBbm', v)} />
            </Field>
            <Field label="Tol / parkir (Rp)">
              <NumInput value={form.biayaTol} onChange={(v) => set('biayaTol', v)} />
            </Field>
            <Field label="Uang jalan sopir (Rp)">
              <NumInput value={form.uangJalan} onChange={(v) => set('uangJalan', v)} />
            </Field>
            <Field label="Catatan">
              <input value={form.catatan} onChange={(e) => set('catatan', e.target.value)} />
            </Field>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary">{editId ? 'Simpan perubahan' : 'Simpan trip'}</button>
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
        title="Daftar trip"
        actions={
          <select value={bulan} onChange={(e) => setBulan(e.target.value)}>
            <option value="semua">Semua bulan</option>
            {recentMonths().map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        }
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Armada</th>
                <th>Sopir</th>
                <th className="num">Nota</th>
                <th className="num">Total kg</th>
                <th className="num">Biaya</th>
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {loading && <EmptyRow cols={7} text="Memuat…" />}
              {!loading && !rows.length && <EmptyRow cols={7} />}
              {rows.map((t) => (
                <tr key={t.id} className={editId === t.id ? 'row-editing' : ''}>
                  <td>{fmtTgl(t.tanggal)}</td>
                  <td>{t.armadaNama}</td>
                  <td>{t.sopir || '–'}</td>
                  <td className="num">{(t.penjualanIds || []).length}</td>
                  <td className="num">{fmtNum(t.totalKg, 1)}</td>
                  <td className="num">{fmtRp(biayaTrip(t))}</td>
                  <td className="col-actions">
                    <RowActions
                      onEdit={() => {
                        setEditId(t.id)
                        setForm({
                          tanggal: t.tanggal,
                          armadaId: t.armadaId,
                          sopir: t.sopir || '',
                          penjualanIds: t.penjualanIds || [],
                          biayaBbm: t.biayaBbm ? String(t.biayaBbm) : '',
                          biayaTol: t.biayaTol ? String(t.biayaTol) : '',
                          uangJalan: t.uangJalan ? String(t.uangJalan) : '',
                          catatan: t.catatan || '',
                        })
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      onDelete={() => removeDoc('trip', t.id)}
                    >
                      <Link className="icon-btn" title="Surat jalan" to={`/trip/${t.id}`}>
                        📄
                      </Link>
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <SimpleCrud
        title="Armada"
        name="armada"
        sort={byNama}
        fields={[
          { name: 'nama', label: 'Nama kendaraan', required: true, placeholder: 'Pickup L300' },
          { name: 'plat', label: 'Plat nomor' },
          { name: 'aktif', label: 'Status', type: 'checkbox', checkLabel: 'Aktif dipakai', default: true },
        ]}
        columns={[
          { label: 'Kendaraan', render: (r) => <b>{r.nama}</b> },
          { label: 'Plat', render: (r) => r.plat || '–' },
          { label: 'Status', render: (r) => (r.aktif === false ? <Badge>Nonaktif</Badge> : <Badge tone="green">Aktif</Badge>) },
        ]}
      />
    </>
  )
}
