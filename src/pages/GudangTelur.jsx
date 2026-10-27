import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useCol, useDocData } from '../hooks/useFirestore'
import { saveWithEffects, deleteWithEffects, statusText } from '../lib/db'
import { mutasiTelurEffect } from '../lib/effects'
import { GRADES, GRADE_LABEL, ALASAN_MUTASI_TELUR } from '../lib/constants'
import { today, addDays } from '../lib/dates'
import { num, fmtNum, fmtTgl } from '../lib/format'
import { PageHeader, Panel, Field, Notice, NumInput, RowActions, EmptyRow, Stat } from '../components/ui'

export default function GudangTelur() {
  const { settings } = useApp()
  const { data: saldo } = useDocData('stokTelur', 'saldo')
  const t = today()
  const d7 = addDays(t, -6)
  const { data: produksi } = useCol('produksiHarian', { wheres: [['tanggal', '>=', d7]] })
  const { data: penjualan } = useCol('penjualan', { wheres: [['tanggal', '>=', d7]] })
  const { data: mutasi } = useCol('mutasiTelur')

  const masuk = (g, tgl) => produksi.filter((p) => !tgl || p.tanggal === tgl).reduce((s, p) => s + num(p.kg?.[g]), 0)
  const keluar = (g, tgl) =>
    penjualan
      .filter((p) => !tgl || p.tanggal === tgl)
      .reduce((s, p) => s + (p.items || []).filter((i) => i.grade === g).reduce((a, i) => a + num(i.kg), 0), 0)
  const pecahJalan7 = penjualan.reduce(
    (s, p) => s + (p.potongan || []).filter((x) => x.jenis === 'pecah').reduce((a, x) => a + num(x.kg), 0),
    0,
  )
  const totalKg = GRADES.reduce((s, g) => s + num(saldo?.[g]), 0)

  const [f, setF] = useState({ tanggal: t, grade: 'utuh', arah: 'kurang', kg: '', alasan: ALASAN_MUTASI_TELUR[0], catatan: '' })
  const [msg, setMsg] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (num(f.kg) <= 0) return setMsg({ type: 'error', text: 'Isi berat (kg).' })
    const { status } = await saveWithEffects('mutasiTelur', null, { ...f, kg: num(f.kg), catatan: f.catatan.trim() }, mutasiTelurEffect)
    setMsg({ type: 'success', text: statusText(status) })
    setF({ ...f, kg: '', catatan: '' })
  }

  const mutasiRows = [...mutasi].sort((a, b) => b.tanggal.localeCompare(a.tanggal)).slice(0, 60)

  return (
    <>
      <PageHeader
        title="Gudang telur"
        subtitle="Masuk otomatis dari input harian, keluar otomatis dari penjualan. Susut & koreksi dicatat di sini."
      />
      <div className="stats">
        <Stat label="Total stok" value={`${fmtNum(totalKg, 1)} kg`} sub={`≈ ${fmtNum(totalKg / settings.kgPerPeti, 1)} peti @${fmtNum(settings.kgPerPeti, 1)} kg`} />
        {GRADES.map((g) => (
          <Stat
            key={g}
            label={GRADE_LABEL[g]}
            value={`${fmtNum(saldo?.[g], 1)} kg`}
            sub={`≈ ${fmtNum(num(saldo?.[g]) / settings.kgPerPeti, 1)} peti`}
            tone={num(saldo?.[g]) < 0 ? 'danger' : null}
          />
        ))}
      </div>

      <Panel title="Arus 7 hari terakhir">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Grade</th>
                <th className="num">Masuk hari ini</th>
                <th className="num">Keluar hari ini</th>
                <th className="num">Masuk 7 hari</th>
                <th className="num">Keluar 7 hari</th>
              </tr>
            </thead>
            <tbody>
              {GRADES.map((g) => (
                <tr key={g}>
                  <td>{GRADE_LABEL[g]}</td>
                  <td className="num">{fmtNum(masuk(g, t), 1)} kg</td>
                  <td className="num">{fmtNum(keluar(g, t), 1)} kg</td>
                  <td className="num">{fmtNum(masuk(g), 1)} kg</td>
                  <td className="num">{fmtNum(keluar(g), 1)} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">Pecah di jalan 7 hari terakhir (dari potongan nota): {fmtNum(pecahJalan7, 1)} kg.</p>
      </Panel>

      <Panel title="Catat susut / koreksi">
        <form className="form-grid" onSubmit={submit}>
          <Field label="Tanggal">
            <input type="date" value={f.tanggal} onChange={(e) => setF({ ...f, tanggal: e.target.value })} />
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
          <Field label="Arah">
            <select value={f.arah} onChange={(e) => setF({ ...f, arah: e.target.value })}>
              <option value="kurang">Kurangi stok</option>
              <option value="tambah">Tambah stok</option>
            </select>
          </Field>
          <Field label="Berat (kg) *">
            <NumInput value={f.kg} onChange={(v) => setF({ ...f, kg: v })} />
          </Field>
          <Field label="Alasan">
            <select value={f.alasan} onChange={(e) => setF({ ...f, alasan: e.target.value })}>
              {ALASAN_MUTASI_TELUR.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </Field>
          <Field label="Catatan">
            <input value={f.catatan} onChange={(e) => setF({ ...f, catatan: e.target.value })} />
          </Field>
          <div className="form-actions">
            <button className="btn btn-primary">Simpan</button>
          </div>
          <Notice msg={msg} />
        </form>
        <p className="muted small">
          Tip: kalau telur retak/kotor dipindah jadi grade lain, catat dua baris: kurangi di grade asal, tambah di grade tujuan.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Grade</th>
                <th className="num">Perubahan</th>
                <th>Alasan</th>
                <th>Catatan</th>
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {!mutasiRows.length && <EmptyRow cols={6} />}
              {mutasiRows.map((m) => (
                <tr key={m.id}>
                  <td>{fmtTgl(m.tanggal)}</td>
                  <td>{GRADE_LABEL[m.grade]}</td>
                  <td className={`num ${m.arah === 'kurang' ? 'text-danger' : 'text-success'}`}>
                    {m.arah === 'kurang' ? '−' : '+'}
                    {fmtNum(m.kg, 2)} kg
                  </td>
                  <td>{m.alasan}</td>
                  <td>{m.catatan}</td>
                  <td className="col-actions">
                    <RowActions onDelete={() => deleteWithEffects('mutasiTelur', m.id, mutasiTelurEffect)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
