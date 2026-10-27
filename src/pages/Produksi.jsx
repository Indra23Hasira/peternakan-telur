import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useCol } from '../hooks/useFirestore'
import { deleteWithEffects } from '../lib/db'
import { produksiEffect } from '../lib/effects'
import { totalButir, totalKg, hdp, makePopulasiAt, aggByBatchDate } from '../lib/calc'
import { today, addDays } from '../lib/dates'
import { num, fmtNum, fmtPct, fmtTgl } from '../lib/format'
import { PageHeader, Panel, Field, RowActions, EmptyRow } from '../components/ui'

export default function Produksi() {
  const { isAdmin } = useApp()
  const nav = useNavigate()
  const [dari, setDari] = useState(addDays(today(), -13))
  // data selalu diambil sampai hari ini supaya populasi historis bisa dihitung mundur dengan tepat
  const { data: produksi, loading } = useCol('produksiHarian', { wheres: [['tanggal', '>=', dari]] })
  const { data: batch } = useCol('batch')
  const { data: blok } = useCol('blok')
  const { data: kandang } = useCol('kandang')

  const popAt = makePopulasiAt(batch, produksi)
  const agg = aggByBatchDate(produksi)
  const hdpBatch = (bid, tgl) => {
    const a = agg[`${bid}|${tgl}`]
    return a ? hdp(a.butir, popAt(bid, tgl)) : null
  }

  // ringkasan per tanggal
  const tanggalList = [...new Set(produksi.map((p) => p.tanggal))].sort().reverse()
  const ringkas = tanggalList.map((t) => {
    const rows = produksi.filter((p) => p.tanggal === t)
    const batchIds = [...new Set(rows.map((p) => p.batchId).filter(Boolean))]
    const pop = batchIds.reduce((s, b) => s + popAt(b, t), 0)
    const butir = rows.reduce((s, p) => s + totalButir(p), 0)
    const kg = rows.reduce((s, p) => s + totalKg(p), 0)
    const pakan = rows.reduce((s, p) => s + num(p.pakanKg), 0)
    const mati = rows.reduce((s, p) => s + num(p.mati), 0)
    const afkir = rows.reduce((s, p) => s + num(p.afkir), 0)
    return { t, blok: rows.length, pop, butir, kg, pakan, mati, afkir, hdp: hdp(butir, pop), fcr: kg > 0 ? pakan / kg : null }
  })

  const kandangNama = (id) => kandang.find((k) => k.id === id)?.nama || '–'
  const blokNama = (id) => blok.find((b) => b.id === id)?.nama || '–'
  const batchNama = (id) => batch.find((b) => b.id === id)?.nama || '–'

  const detail = [...produksi].sort(
    (a, b) =>
      b.tanggal.localeCompare(a.tanggal) ||
      kandangNama(a.kandangId).localeCompare(kandangNama(b.kandangId)) ||
      blokNama(a.blokId).localeCompare(blokNama(b.blokId), 'id', { numeric: true }),
  )

  return (
    <>
      <PageHeader title="Riwayat produksi">
        <Field label="Tampilkan sejak">
          <input type="date" value={dari} max={today()} onChange={(e) => setDari(e.target.value || addDays(today(), -13))} />
        </Field>
      </PageHeader>

      <Panel title="Ringkasan harian (semua kandang)">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th className="num">Blok terisi</th>
                <th className="num">Populasi</th>
                <th className="num">Butir</th>
                <th className="num">Kg telur</th>
                <th className="num">HDP</th>
                <th className="num">Pakan (kg)</th>
                <th className="num">FCR</th>
                <th className="num">Mati</th>
                <th className="num">Afkir</th>
              </tr>
            </thead>
            <tbody>
              {loading && <EmptyRow cols={10} text="Memuat…" />}
              {!loading && !ringkas.length && <EmptyRow cols={10} />}
              {ringkas.map((r) => (
                <tr key={r.t}>
                  <td>{fmtTgl(r.t)}</td>
                  <td className="num">{r.blok}</td>
                  <td className="num">{fmtNum(r.pop)}</td>
                  <td className="num">{fmtNum(r.butir)}</td>
                  <td className="num">{fmtNum(r.kg, 2)}</td>
                  <td className="num">
                    <b>{fmtPct(r.hdp)}</b>
                  </td>
                  <td className="num">{fmtNum(r.pakan, 1)}</td>
                  <td className="num">{r.fcr ? fmtNum(r.fcr, 2) : '–'}</td>
                  <td className="num">{fmtNum(r.mati)}</td>
                  <td className="num">{fmtNum(r.afkir)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          FCR harian hanya gambaran kasar; angka yang lebih stabil ada di dashboard (rata-rata 7 hari).
        </p>
      </Panel>

      <Panel title="Detail per blok">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Kandang · blok</th>
                <th>Batch</th>
                <th className="num">Butir</th>
                <th className="num">Kg</th>
                <th className="num">HDP batch</th>
                <th className="num">Pakan</th>
                <th className="num">Mati/afkir</th>
                <th>Catatan</th>
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {!loading && !detail.length && <EmptyRow cols={10} />}
              {detail.map((p) => (
                <tr key={p.id}>
                  <td>{fmtTgl(p.tanggal)}</td>
                  <td>
                    {kandangNama(p.kandangId)} · {blokNama(p.blokId)}
                  </td>
                  <td>{batchNama(p.batchId)}</td>
                  <td className="num">{fmtNum(totalButir(p))}</td>
                  <td className="num">{fmtNum(totalKg(p), 2)}</td>
                  <td className="num">{fmtPct(hdpBatch(p.batchId, p.tanggal))}</td>
                  <td className="num">{fmtNum(p.pakanKg, 1)}</td>
                  <td className="num">
                    {fmtNum(p.mati)}/{fmtNum(p.afkir)}
                  </td>
                  <td className="wrap">{p.catatan || ''}</td>
                  <td className="col-actions">
                    <RowActions
                      onEdit={() => nav(`/harian?tanggal=${p.tanggal}&blok=${p.blokId}`)}
                      onDelete={isAdmin ? () => deleteWithEffects('produksiHarian', p.id, produksiEffect) : null}
                      confirmText="Hapus data harian ini? Stok telur, stok pakan, dan deplesi batch ikut dikoreksi."
                    />
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
