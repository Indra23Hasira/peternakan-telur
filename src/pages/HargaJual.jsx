import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useCol } from '../hooks/useFirestore'
import { saveDoc, patchDoc, removeDoc, statusText } from '../lib/db'
import { hargaAktif } from '../lib/calc'
import { GRADES, GRADE_LABEL } from '../lib/constants'
import { today } from '../lib/dates'
import { num, fmtRp, fmtTgl, byNama } from '../lib/format'
import { emailToUsername } from '../lib/auth'
import SimpleCrud from '../components/SimpleCrud'
import { PageHeader, Panel, Field, Notice, NumInput, RowActions, StatusBadge, EmptyRow } from '../components/ui'

const SATUAN = [
  { value: 'peti', label: 'per peti' },
  { value: 'kg', label: 'per kg' },
]

export default function HargaJual() {
  const { isOwner, user } = useApp()
  const { data: wilayah } = useCol('wilayah')
  const { data: harga, loading } = useCol('hargaJual')
  const wilayahSorted = [...wilayah].sort(byNama)
  const wNama = (id) => wilayah.find((w) => w.id === id)?.nama || '–'

  const blank = () => ({ wilayahId: '', grade: 'utuh', satuan: 'peti', harga: '', berlakuMulai: today(), catatan: '' })
  const [f, setF] = useState(blank)
  const [editId, setEditId] = useState(null)
  const [msg, setMsg] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!f.wilayahId || num(f.harga) <= 0) return setMsg({ type: 'error', text: 'Pilih wilayah dan isi harga.' })
    const data = {
      wilayahId: f.wilayahId,
      wilayahNama: wNama(f.wilayahId),
      grade: f.grade,
      satuan: f.satuan,
      harga: num(f.harga),
      berlakuMulai: f.berlakuMulai,
      catatan: f.catatan.trim(),
      status: isOwner ? 'aktif' : 'pending',
      diajukanOleh: user.email,
      ...(isOwner ? { disetujuiOleh: user.email } : {}),
    }
    try {
      const { status } = await saveDoc('hargaJual', editId, data)
      setMsg({
        type: 'success',
        text: isOwner ? `${statusText(status)} Harga langsung aktif.` : `${statusText(status)} Menunggu approval owner.`,
      })
      setF(blank())
      setEditId(null)
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  const approve = (h, ok) =>
    patchDoc('hargaJual', h.id, { status: ok ? 'aktif' : 'ditolak', disetujuiOleh: user.email })

  // matriks harga aktif hari ini
  const t = today()
  const pending = harga.filter((h) => h.status === 'pending')
  const riwayat = [...harga].sort(
    (a, b) => b.berlakuMulai.localeCompare(a.berlakuMulai) || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
  )

  return (
    <>
      <PageHeader
        title="Harga jual"
        subtitle={
          isOwner
            ? 'Harga yang Anda input langsung aktif. Usulan dari admin muncul di bawah untuk di-approve.'
            : 'Harga yang Anda ajukan berstatus menunggu sampai di-approve owner.'
        }
      />

      <Panel title="Harga aktif hari ini">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Wilayah</th>
                {GRADES.map((g) => (
                  <th key={g} className="num">
                    {GRADE_LABEL[g]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!wilayahSorted.length && <EmptyRow cols={5} text="Tambahkan wilayah dulu (di bawah)." />}
              {wilayahSorted.map((w) => (
                <tr key={w.id}>
                  <td>
                    <b>{w.nama}</b>
                  </td>
                  {GRADES.map((g) => {
                    const peti = hargaAktif(harga, w.id, g, 'peti', t)
                    const kg = hargaAktif(harga, w.id, g, 'kg', t)
                    return (
                      <td key={g} className="num">
                        {peti ? <div>{fmtRp(peti.harga)}/peti</div> : null}
                        {kg ? <div>{fmtRp(kg.harga)}/kg</div> : null}
                        {!peti && !kg && <span className="muted">–</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {isOwner && pending.length > 0 && (
        <Panel title={`Menunggu approval (${pending.length})`} className="panel-warning">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Wilayah</th>
                  <th>Grade</th>
                  <th className="num">Harga</th>
                  <th>Berlaku</th>
                  <th>Diajukan</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pending.map((h) => (
                  <tr key={h.id}>
                    <td>{h.wilayahNama}</td>
                    <td>{GRADE_LABEL[h.grade]}</td>
                    <td className="num">
                      {fmtRp(h.harga)}/{h.satuan}
                    </td>
                    <td>{fmtTgl(h.berlakuMulai)}</td>
                    <td>
                      {emailToUsername(h.diajukanOleh)}
                      {h.catatan && <div className="muted small">{h.catatan}</div>}
                    </td>
                    <td className="nowrap">
                      <button className="btn btn-small btn-primary" onClick={() => approve(h, true)}>
                        Setujui
                      </button>{' '}
                      <button className="btn btn-small" onClick={() => approve(h, false)}>
                        Tolak
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel title={editId ? 'Edit harga' : isOwner ? 'Set harga baru' : 'Ajukan harga baru'}>
        <form className="form-grid" onSubmit={submit}>
          <Field label="Wilayah *">
            <select value={f.wilayahId} onChange={(e) => setF({ ...f, wilayahId: e.target.value })}>
              <option value="">— pilih —</option>
              {wilayahSorted.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.nama}
                </option>
              ))}
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
          <Field label="Satuan">
            <select value={f.satuan} onChange={(e) => setF({ ...f, satuan: e.target.value })}>
              {SATUAN.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Harga (Rp) *">
            <NumInput value={f.harga} onChange={(v) => setF({ ...f, harga: v })} />
          </Field>
          <Field label="Berlaku mulai">
            <input type="date" value={f.berlakuMulai} onChange={(e) => setF({ ...f, berlakuMulai: e.target.value })} />
          </Field>
          <Field label="Catatan">
            <input value={f.catatan} onChange={(e) => setF({ ...f, catatan: e.target.value })} placeholder="Alasan perubahan…" />
          </Field>
          <div className="form-actions">
            <button className="btn btn-primary">{editId ? 'Simpan perubahan' : isOwner ? 'Set harga' : 'Ajukan'}</button>
            {editId && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setEditId(null)
                  setF(blank())
                }}
              >
                Batal
              </button>
            )}
          </div>
          <Notice msg={msg} />
        </form>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Berlaku</th>
                <th>Wilayah</th>
                <th>Grade</th>
                <th className="num">Harga</th>
                <th>Status</th>
                <th>Oleh</th>
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {loading && <EmptyRow cols={7} text="Memuat…" />}
              {!loading && !riwayat.length && <EmptyRow cols={7} />}
              {riwayat.map((h) => {
                const bisaUbah = isOwner || h.status === 'pending'
                return (
                  <tr key={h.id} className={editId === h.id ? 'row-editing' : ''}>
                    <td>{fmtTgl(h.berlakuMulai)}</td>
                    <td>{h.wilayahNama}</td>
                    <td>{GRADE_LABEL[h.grade]}</td>
                    <td className="num">
                      {fmtRp(h.harga)}/{h.satuan}
                    </td>
                    <td>
                      <StatusBadge status={h.status} />
                    </td>
                    <td className="small">{emailToUsername(h.diajukanOleh)}</td>
                    <td className="col-actions">
                      <RowActions
                        onEdit={
                          bisaUbah
                            ? () => {
                                setEditId(h.id)
                                setF({
                                  wilayahId: h.wilayahId,
                                  grade: h.grade,
                                  satuan: h.satuan,
                                  harga: String(h.harga),
                                  berlakuMulai: h.berlakuMulai,
                                  catatan: h.catatan || '',
                                })
                                window.scrollTo({ top: 0, behavior: 'smooth' })
                              }
                            : null
                        }
                        onDelete={bisaUbah ? () => removeDoc('hargaJual', h.id) : null}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">Nota menyimpan harga saat transaksi dibuat, jadi perubahan harga tidak mengubah nota lama.</p>
      </Panel>

      <SimpleCrud
        title="Wilayah pelanggan"
        name="wilayah"
        sort={byNama}
        fields={[{ name: 'nama', label: 'Nama wilayah / daerah', required: true }]}
        columns={[{ label: 'Wilayah', render: (r) => r.nama }]}
      />
    </>
  )
}
