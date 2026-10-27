import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useCol } from '../hooks/useFirestore'
import { saveWithEffects, deleteWithEffects, statusText } from '../lib/db'
import { opnameEffect } from '../lib/effects'
import { hargaRataBarang } from '../lib/calc'
import { KATEGORI_BARANG, ALERT_SELISIH_OPNAME } from '../lib/constants'
import { today, addDays } from '../lib/dates'
import { num, fmtNum, fmtRp, fmtTgl, byNama } from '../lib/format'
import { PageHeader, Panel, Field, Notice, NumInput, RowActions, EmptyRow, Badge, Stat } from '../components/ui'

const katLabel = (v) => KATEGORI_BARANG.find((k) => k.value === v)?.label || v

export default function StokBarang() {
  const { settings } = useApp()
  const { data: barang, loading } = useCol('barang')
  const { data: stok } = useCol('stokBarang')
  const { data: pembelian } = useCol('pembelian')
  const d7 = addDays(today(), -6)
  const { data: produksi7 } = useCol('produksiHarian', { wheres: [['tanggal', '>=', d7]] })
  const { data: opname } = useCol('opname')

  const stokOf = (id) => num(stok.find((s) => s.id === id)?.jumlah)
  const pakai7 = (id) => produksi7.filter((p) => p.pakanBarangId === id).reduce((s, p) => s + num(p.pakanKg), 0)
  // rata-rata dihitung dari jumlah hari yang benar-benar ada datanya (maks 7)
  const hariData = Math.max(1, new Set(produksi7.map((p) => p.tanggal)).size)

  const rows = [...barang]
    .sort((a, b) => String(a.kategori).localeCompare(String(b.kategori)) || byNama(a, b))
    .map((b) => {
      const jumlah = stokOf(b.id)
      const harga = hargaRataBarang(pembelian, b.id)
      const perHari = b.kategori === 'pakan' ? pakai7(b.id) / hariData : 0
      const sisaHari = perHari > 0 ? jumlah / perHari : null
      return { ...b, jumlah, harga, nilai: jumlah * harga, perHari, sisaHari }
    })
  const totalNilai = rows.reduce((s, r) => s + Math.max(0, r.nilai), 0)
  const totalPakan = rows.filter((r) => r.kategori === 'pakan').reduce((s, r) => s + r.jumlah, 0)
  const perHariPakan = rows.filter((r) => r.kategori === 'pakan').reduce((s, r) => s + r.perHari, 0)

  /* ---- stok opname ---- */
  const [f, setF] = useState({ barangId: '', tanggal: today(), stokFisik: '', alasan: '' })
  const [msg, setMsg] = useState(null)
  const sistem = f.barangId ? stokOf(f.barangId) : 0
  const selisih = f.stokFisik === '' ? 0 : num(f.stokFisik) - sistem

  async function submitOpname(e) {
    e.preventDefault()
    if (!f.barangId || f.stokFisik === '') return setMsg({ type: 'error', text: 'Pilih barang dan isi stok fisik.' })
    const b = barang.find((x) => x.id === f.barangId)
    const { status } = await saveWithEffects(
      'opname',
      null,
      {
        tanggal: f.tanggal,
        barangId: f.barangId,
        barangNama: b?.nama || '',
        satuan: b?.satuanStok || '',
        stokSistem: sistem,
        stokFisik: num(f.stokFisik),
        selisih,
        alasan: f.alasan.trim(),
      },
      opnameEffect,
    )
    setMsg({ type: 'success', text: `${statusText(status)} Stok disesuaikan ${selisih >= 0 ? '+' : ''}${fmtNum(selisih, 2)}.` })
    setF({ barangId: '', tanggal: today(), stokFisik: '', alasan: '' })
  }

  const opnameRows = [...opname].sort((a, b) => b.tanggal.localeCompare(a.tanggal)).slice(0, 50)

  return (
    <>
      <PageHeader
        title="Stok barang"
        subtitle="Saldo gudang: bertambah dari pembelian yang diterima, berkurang dari input harian petugas, disesuaikan lewat stok opname."
      />
      <div className="stats">
        <Stat label="Nilai stok gudang" value={fmtRp(totalNilai)} sub="pakai harga rata-rata tertimbang" />
        <Stat label="Total stok pakan" value={`${fmtNum(totalPakan)} kg`} sub={`≈ ${fmtNum(totalPakan / 50, 1)} karung @50 kg`} />
        <Stat
          label="Pakan cukup untuk"
          value={perHariPakan > 0 ? `${fmtNum(totalPakan / perHariPakan, 1)} hari` : '–'}
          sub={`pemakaian ±${fmtNum(perHariPakan)} kg/hari`}
          tone={perHariPakan > 0 && totalPakan / perHariPakan < settings.batasSisaHariPakan ? 'danger' : null}
        />
      </div>

      <Panel title="Saldo per barang">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Barang</th>
                <th>Kategori</th>
                <th className="num">Stok</th>
                <th className="num">Harga rata-rata</th>
                <th className="num">Nilai stok</th>
                <th className="num">Pakai / hari</th>
                <th className="num">Sisa hari</th>
              </tr>
            </thead>
            <tbody>
              {loading && <EmptyRow cols={7} text="Memuat…" />}
              {!loading && !rows.length && <EmptyRow cols={7} text="Belum ada barang. Tambahkan di menu Barang & supplier." />}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <b>{r.nama}</b>
                  </td>
                  <td>{katLabel(r.kategori)}</td>
                  <td className={`num ${r.jumlah < 0 ? 'text-danger' : ''}`}>
                    {fmtNum(r.jumlah, 2)} {r.satuanStok}
                  </td>
                  <td className="num">
                    {r.harga ? `${fmtRp(r.harga)}/${r.satuanStok}` : '–'}
                  </td>
                  <td className="num">{fmtRp(r.nilai)}</td>
                  <td className="num">{r.perHari ? `${fmtNum(r.perHari, 1)} ${r.satuanStok}` : '–'}</td>
                  <td className="num">
                    {r.sisaHari === null ? (
                      '–'
                    ) : r.sisaHari < settings.batasSisaHariPakan ? (
                      <Badge tone="red">{fmtNum(r.sisaHari, 1)} hari</Badge>
                    ) : (
                      `${fmtNum(r.sisaHari, 1)} hari`
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Stok minus berarti pemakaian sudah dicatat tapi pembeliannya belum. Pemakaian obat/vaksin dicatat lewat stok opname.
        </p>
      </Panel>

      <Panel title="Stok opname (hitung fisik)">
        <form className="form-grid" onSubmit={submitOpname}>
          <Field label="Barang *">
            <select value={f.barangId} onChange={(e) => setF({ ...f, barangId: e.target.value })}>
              <option value="">— pilih —</option>
              {[...barang].sort(byNama).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nama}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tanggal">
            <input type="date" value={f.tanggal} onChange={(e) => setF({ ...f, tanggal: e.target.value })} />
          </Field>
          <Field
            label="Stok fisik *"
            hint={f.barangId ? `Sistem: ${fmtNum(sistem, 2)} · selisih ${selisih >= 0 ? '+' : ''}${fmtNum(selisih, 2)}` : null}
          >
            <NumInput value={f.stokFisik} onChange={(v) => setF({ ...f, stokFisik: v })} />
          </Field>
          <Field label="Alasan selisih">
            <input value={f.alasan} onChange={(e) => setF({ ...f, alasan: e.target.value })} placeholder="Tercecer, rusak, dipakai…" />
          </Field>
          <div className="form-actions">
            <button className="btn btn-primary">Simpan opname</button>
          </div>
          <Notice msg={msg} />
        </form>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Barang</th>
                <th className="num">Sistem</th>
                <th className="num">Fisik</th>
                <th className="num">Selisih</th>
                <th>Alasan</th>
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {!opnameRows.length && <EmptyRow cols={7} />}
              {opnameRows.map((o) => {
                const pct = Math.abs(num(o.selisih)) / Math.max(1, Math.abs(num(o.stokSistem))) * 100
                return (
                  <tr key={o.id}>
                    <td>{fmtTgl(o.tanggal)}</td>
                    <td>{o.barangNama}</td>
                    <td className="num">{fmtNum(o.stokSistem, 2)}</td>
                    <td className="num">{fmtNum(o.stokFisik, 2)}</td>
                    <td className={`num ${pct > ALERT_SELISIH_OPNAME ? 'text-danger' : ''}`}>
                      {o.selisih >= 0 ? '+' : ''}
                      {fmtNum(o.selisih, 2)} {o.satuan}
                    </td>
                    <td>{o.alasan}</td>
                    <td className="col-actions">
                      <RowActions
                        onDelete={() => deleteWithEffects('opname', o.id, opnameEffect)}
                        confirmText="Hapus opname ini? Penyesuaian stoknya dibatalkan."
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
