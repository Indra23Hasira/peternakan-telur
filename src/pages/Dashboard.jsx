import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useCol, useDocData } from '../hooks/useFirestore'
import { patchDoc } from '../lib/db'
import {
  umurMinggu,
  populasiKini,
  hdp,
  makePopulasiAt,
  aggByBatchDate,
  kandangOfBatch,
  hargaRataBarang,
  sisaTagihan,
  aging,
  kgTerjual,
  totalKg,
} from '../lib/calc'
import { GRADES, GRADE_LABEL, ALERT_HDP_TURUN, ALERT_MORTALITAS, ALERT_SELISIH_OPNAME } from '../lib/constants'
import { today, addDays, monthStart, monthKey, monthLabel, diffDays } from '../lib/dates'
import { num, fmtNum, fmtRp, fmtPct, fmtTgl, byNama } from '../lib/format'
import { emailToUsername } from '../lib/auth'
import { biayaTrip } from './Pengiriman'
import { PageHeader, Panel, Stat, EmptyRow } from '../components/ui'

export default function Dashboard() {
  const { isOwner, settings, user } = useApp()
  const t = today()
  const bulan = monthStart(t)
  const d30 = addDays(t, -29)
  const mulai = bulan < d30 ? bulan : d30

  const { data: kandang } = useCol('kandang')
  const { data: blok } = useCol('blok')
  const { data: batch } = useCol('batch')
  const { data: barang } = useCol('barang')
  const { data: stokBarang } = useCol('stokBarang')
  const { data: produksi, loading } = useCol('produksiHarian', { wheres: [['tanggal', '>=', mulai]] })
  const { data: saldoTelur } = useDocData('stokTelur', 'saldo')
  const { data: pembelian } = useCol('pembelian')
  const { data: penjualan } = useCol('penjualan')
  const { data: harga } = useCol('hargaJual', { enabled: isOwner })
  const { data: kas } = useCol('kas', { wheres: [['tanggal', '>=', bulan]] })
  const { data: trip } = useCol('trip', { wheres: [['tanggal', '>=', bulan]] })
  const { data: opname } = useCol('opname', { wheres: [['tanggal', '>=', d30]] })

  /* ---------------- Produksi ---------------- */
  const aktif = batch.filter((b) => b.status !== 'afkir').sort(byNama)
  const popAt = makePopulasiAt(batch, produksi)
  const agg = aggByBatchDate(produksi)
  const tglData = [...new Set(produksi.map((p) => p.tanggal))].sort()
  const tLast = tglData.length ? tglData[tglData.length - 1] : t
  const get = (bid, tgl) => agg[`${bid}|${tgl}`]
  const hdpB = (bid, tgl) => {
    const a = get(bid, tgl)
    return a ? hdp(a.butir, popAt(bid, tgl)) : null
  }
  const last7 = (end) => Array.from({ length: 7 }, (_, i) => addDays(end, -i))
  const avg = (arr) => {
    const v = arr.filter((x) => x !== null && Number.isFinite(x))
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null
  }

  const batchRows = aktif.map((b) => {
    const a = get(b.id, tLast)
    const pop = popAt(b.id, tLast)
    const prev7 = avg(last7(addDays(tLast, -1)).map((d) => hdpB(b.id, d)))
    const sum7 = last7(tLast).reduce(
      (s, d) => {
        const x = get(b.id, d)
        return x ? { pakan: s.pakan + x.pakan, kg: s.kg + x.kg } : s
      },
      { pakan: 0, kg: 0 },
    )
    return {
      b,
      kandangId: kandangOfBatch(b, blok),
      pop,
      popKini: populasiKini(b),
      butir: a?.butir || 0,
      kg: a?.kg || 0,
      hdp: a ? hdp(a.butir, pop) : null,
      prev7,
      gram: a && pop > 0 ? (a.pakan / pop) * 1000 : null,
      deplesi: a ? a.mati + a.afkir : 0,
      mati: a?.mati || 0,
      fcr7: sum7.kg > 0 ? sum7.pakan / sum7.kg : null,
    }
  })

  const kandangRows = [...kandang].sort(byNama).map((k) => {
    const rs = batchRows.filter((r) => r.kandangId === k.id)
    const pop = rs.reduce((s, r) => s + r.pop, 0)
    const butir = rs.reduce((s, r) => s + r.butir, 0)
    const ids = rs.map((r) => r.b.id)
    const s7 = last7(tLast).reduce(
      (s, d) => {
        for (const id of ids) {
          const x = get(id, d)
          if (x) {
            s.pakan += x.pakan
            s.kg += x.kg
          }
        }
        return s
      },
      { pakan: 0, kg: 0 },
    )
    return { k, pop, popKini: rs.reduce((s, r) => s + r.popKini, 0), butir, hdp: hdp(butir, pop), fcr7: s7.kg > 0 ? s7.pakan / s7.kg : null }
  })
  const totPop = batchRows.reduce((s, r) => s + r.pop, 0)
  const totButir = batchRows.reduce((s, r) => s + r.butir, 0)
  const totKgHari = batchRows.reduce((s, r) => s + r.kg, 0)
  const totPopKini = aktif.reduce((s, b) => s + populasiKini(b), 0)

  // tren HDP total 14 hari
  const tren = Array.from({ length: 14 }, (_, i) => addDays(tLast, -13 + i)).map((d) => {
    let butir = 0
    let pop = 0
    for (const b of batch) {
      const a = get(b.id, d)
      if (a) {
        butir += a.butir
        pop += popAt(b.id, d)
      }
    }
    return { d, hdp: pop ? hdp(butir, pop) : null }
  })
  const trenMax = Math.max(100, ...tren.map((x) => x.hdp || 0))

  /* ---------------- Stok ---------------- */
  const pakan = barang
    .filter((b) => b.kategori === 'pakan')
    .sort(byNama)
    .map((b) => {
      const stok = num(stokBarang.find((s) => s.id === b.id)?.jumlah)
      const pakai = produksi.filter((p) => p.pakanBarangId === b.id && p.tanggal > addDays(t, -7)).reduce((s, p) => s + num(p.pakanKg), 0)
      const hari = Math.max(1, Math.min(7, tglData.filter((d) => d > addDays(t, -7)).length))
      const perHari = pakai / hari
      return { b, stok, perHari, sisaHari: perHari > 0 ? stok / perHari : null }
    })
  const totalTelur = GRADES.reduce((s, g) => s + num(saldoTelur?.[g]), 0)

  /* ---------------- Penjualan & tagihan ---------------- */
  const pjHari = penjualan.filter((p) => p.tanggal === t)
  const pjBulan = penjualan.filter((p) => p.tanggal >= bulan)
  const perWilayah = {}
  for (const p of pjBulan) {
    const w = (perWilayah[p.wilayahNama || '–'] = perWilayah[p.wilayahNama || '–'] || { kg: 0, rp: 0, nota: 0 })
    w.kg += kgTerjual(p)
    w.rp += num(p.total)
    w.nota += 1
  }
  const sumRp = (arr) => arr.reduce((s, p) => s + num(p.total), 0)
  const sumKg = (arr) => arr.reduce((s, p) => s + kgTerjual(p), 0)

  const tagihan = (list) => {
    const open = list.filter((p) => sisaTagihan(p) > 0)
    const s = (f) => open.filter(f).reduce((a, p) => a + sisaTagihan(p), 0)
    return {
      open,
      total: s(() => true),
      lewat: s((p) => aging(p) === 'lewat'),
      nLewat: open.filter((p) => aging(p) === 'lewat').length,
      minggu: s((p) => aging(p) === 'minggu_ini'),
      jatuhTempo: open
        .filter((p) => aging(p) === 'lewat' || aging(p) === 'minggu_ini')
        .sort((a, b) => String(a.jatuhTempo).localeCompare(String(b.jatuhTempo)))
        .slice(0, 8),
    }
  }
  const piutang = tagihan(penjualan)
  const hutang = tagihan(pembelian)

  /* ---------------- Keuangan bulan ini (owner) ---------------- */
  const prodBulan = produksi.filter((p) => p.tanggal >= bulan)
  const hargaRata = {}
  for (const b of barang) hargaRata[b.id] = hargaRataBarang(pembelian, b.id)
  const biayaPakan = prodBulan.reduce((s, p) => s + num(p.pakanKg) * (hargaRata[p.pakanBarangId] || 0), 0)
  const biayaBarangLain = pembelian
    .filter((p) => p.tanggal >= bulan)
    .reduce(
      (s, p) =>
        s +
        (p.items || []).filter((i) => i.kategori !== 'pakan').reduce((a, i) => a + num(i.qtyDiterima) * num(i.hargaPerSatuan), 0),
      0,
    )
  const biayaKas = kas.filter((k) => k.tipe === 'pengeluaran').reduce((s, k) => s + num(k.jumlah), 0)
  const biayaTripBulan = trip.reduce((s, x) => s + biayaTrip(x), 0)
  const biayaOps = biayaKas + biayaTripBulan + biayaBarangLain
  const pemasukanLain = kas.filter((k) => k.tipe === 'pemasukan').reduce((s, k) => s + num(k.jumlah), 0)
  const pendapatanTelur = sumRp(pjBulan)
  const kgProduksiBulan = prodBulan.reduce((s, p) => s + totalKg(p), 0)
  const kgJualBulan = sumKg(pjBulan)
  const hpp = kgProduksiBulan > 0 ? (biayaPakan + biayaOps) / kgProduksiBulan : null
  const hargaJualRata = kgJualBulan > 0 ? pendapatanTelur / kgJualBulan : null
  const labaKasar = pendapatanTelur + pemasukanLain - biayaPakan - biayaOps

  const pending = (harga || []).filter((h) => h.status === 'pending')
  const approve = (h, ok) => patchDoc('hargaJual', h.id, { status: ok ? 'aktif' : 'ditolak', disetujuiOleh: user.email })

  /* ---------------- Alert ---------------- */
  const alerts = []
  if (!loading && tLast < t && produksi.length)
    alerts.push({ tone: 'warning', text: `Input harian terakhir ${fmtTgl(tLast)} — hari ini belum ada data.` })
  for (const r of batchRows) {
    if (r.hdp !== null && r.prev7 !== null && r.prev7 - r.hdp >= ALERT_HDP_TURUN)
      alerts.push({
        tone: 'danger',
        text: `HDP ${r.b.nama} turun ke ${fmtPct(r.hdp)} (rata-rata 7 hari sebelumnya ${fmtPct(r.prev7)}). Cek kesehatan & pakan.`,
      })
    if (r.pop > 0 && (r.mati / r.pop) * 100 >= ALERT_MORTALITAS)
      alerts.push({ tone: 'danger', text: `Mortalitas ${r.b.nama} tinggi: ${fmtNum(r.mati)} ekor mati (${fmtPct((r.mati / r.pop) * 100, 2)}) pada ${fmtTgl(tLast)}.` })
  }
  for (const p of pakan)
    if (p.sisaHari !== null && p.sisaHari < settings.batasSisaHariPakan)
      alerts.push({ tone: 'danger', text: `Stok ${p.b.nama} tinggal ±${fmtNum(p.sisaHari, 1)} hari (${fmtNum(p.stok)} kg). Segera order.` })
  if (piutang.nLewat) alerts.push({ tone: 'warning', text: `${piutang.nLewat} nota pelanggan lewat jatuh tempo, total ${fmtRp(piutang.lewat)}.` })
  if (hutang.nLewat) alerts.push({ tone: 'warning', text: `${hutang.nLewat} hutang supplier lewat jatuh tempo, total ${fmtRp(hutang.lewat)}.` })
  for (const o of opname) {
    const pct = (Math.abs(num(o.selisih)) / Math.max(1, Math.abs(num(o.stokSistem)))) * 100
    if (pct > ALERT_SELISIH_OPNAME)
      alerts.push({ tone: 'warning', text: `Selisih opname ${o.barangNama} ${fmtTgl(o.tanggal)}: ${fmtNum(o.selisih, 1)} ${o.satuan} (${fmtPct(pct)}).` })
  }
  if (isOwner && pending.length) alerts.push({ tone: 'info', text: `${pending.length} usulan harga menunggu approval Anda.` })
  for (const g of GRADES) if (num(saldoTelur?.[g]) < -0.5) alerts.push({ tone: 'warning', text: `Stok telur ${GRADE_LABEL[g].toLowerCase()} minus — cek input produksi / penjualan.` })

  const kNama = (id) => kandang.find((k) => k.id === id)?.nama || '–'

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Data produksi terakhir: ${fmtTgl(tLast)}`} />

      {alerts.length > 0 && (
        <div className="alerts">
          {alerts.map((a, i) => (
            <div key={i} className={`notice notice-${a.tone === 'danger' ? 'error' : a.tone}`}>
              {a.text}
            </div>
          ))}
        </div>
      )}

      <div className="stats">
        <Stat label="Populasi hidup" value={`${fmtNum(totPopKini)} ekor`} sub={`${aktif.length} batch aktif`} />
        <Stat label={`HDP ${fmtTgl(tLast)}`} value={fmtPct(hdp(totButir, totPop))} sub={`${fmtNum(totButir)} butir · ${fmtNum(totKgHari, 1)} kg`} />
        <Stat label="Stok telur gudang" value={`${fmtNum(totalTelur, 1)} kg`} sub={`≈ ${fmtNum(totalTelur / settings.kgPerPeti, 1)} peti`} />
        <Stat label="Penjualan hari ini" value={fmtRp(sumRp(pjHari))} sub={`${fmtNum(sumKg(pjHari), 1)} kg · ${pjHari.length} nota`} />
      </div>

      <Panel title="Produksi per kandang" actions={<Link to="/produksi">Riwayat →</Link>}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Kandang</th>
                <th className="num">Populasi</th>
                <th className="num">Butir</th>
                <th className="num">HDP</th>
                <th className="num">FCR 7 hari</th>
              </tr>
            </thead>
            <tbody>
              {!kandangRows.length && <EmptyRow cols={5} text="Belum ada kandang. Atur di menu Kandang & batch." />}
              {kandangRows.map((r) => (
                <tr key={r.k.id}>
                  <td>
                    <b>{r.k.nama}</b>
                  </td>
                  <td className="num">{fmtNum(r.popKini)}</td>
                  <td className="num">{fmtNum(r.butir)}</td>
                  <td className="num">
                    <b>{fmtPct(r.hdp)}</b>
                  </td>
                  <td className="num">{r.fcr7 ? fmtNum(r.fcr7, 2) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="sub-title">Per batch</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Batch</th>
                <th>Kandang</th>
                <th className="num">Umur</th>
                <th className="num">Populasi</th>
                <th className="num">HDP</th>
                <th className="num">HDP rata 7h sebelumnya</th>
                <th className="num">Pakan g/ekor</th>
                <th className="num">FCR 7h</th>
                <th className="num">Deplesi</th>
              </tr>
            </thead>
            <tbody>
              {!batchRows.length && <EmptyRow cols={9} text="Belum ada batch aktif." />}
              {batchRows.map((r) => (
                <tr key={r.b.id}>
                  <td>
                    <b>{r.b.nama}</b>
                  </td>
                  <td>{kNama(r.kandangId)}</td>
                  <td className="num">{fmtNum(umurMinggu(r.b), 1)} mgg</td>
                  <td className="num">{fmtNum(r.popKini)}</td>
                  <td className={`num ${r.hdp !== null && r.prev7 !== null && r.prev7 - r.hdp >= ALERT_HDP_TURUN ? 'text-danger' : ''}`}>
                    <b>{fmtPct(r.hdp)}</b>
                  </td>
                  <td className="num">{fmtPct(r.prev7)}</td>
                  <td className="num">{r.gram ? fmtNum(r.gram) : '–'}</td>
                  <td className="num">{r.fcr7 ? fmtNum(r.fcr7, 2) : '–'}</td>
                  <td className="num">{fmtNum(r.deplesi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="sub-title">Tren HDP 14 hari</h3>
        <div className="spark">
          {tren.map((x) => (
            <div key={x.d} className="spark-col" title={`${fmtTgl(x.d)}: ${fmtPct(x.hdp)}`}>
              <div className="spark-val">{x.hdp !== null ? fmtNum(x.hdp, 0) : ''}</div>
              <div className="spark-bar" style={{ height: `${x.hdp ? (x.hdp / trenMax) * 100 : 0}%` }} />
              <div className="spark-lbl">{x.d.slice(8)}</div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid-2">
        <Panel title="Stok telur" actions={<Link to="/gudang-telur">Gudang →</Link>}>
          <table className="mini-table">
            <tbody>
              {GRADES.map((g) => (
                <tr key={g}>
                  <td>{GRADE_LABEL[g]}</td>
                  <td className="num">{fmtNum(saldoTelur?.[g], 1)} kg</td>
                  <td className="num muted">≈ {fmtNum(num(saldoTelur?.[g]) / settings.kgPerPeti, 1)} peti</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Stok pakan" actions={<Link to="/stok">Stok →</Link>}>
          <table className="mini-table">
            <tbody>
              {!pakan.length && <EmptyRow cols={3} text="Belum ada barang kategori pakan." />}
              {pakan.map((p) => (
                <tr key={p.b.id}>
                  <td>{p.b.nama}</td>
                  <td className="num">{fmtNum(p.stok)} kg</td>
                  <td className={`num ${p.sisaHari !== null && p.sisaHari < settings.batasSisaHariPakan ? 'text-danger' : 'muted'}`}>
                    {p.sisaHari !== null ? `±${fmtNum(p.sisaHari, 1)} hari` : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title={`Penjualan ${monthLabel(monthKey(t))}`} actions={<Link to="/penjualan">Penjualan →</Link>}>
        <div className="stats">
          <Stat label="Omzet bulan ini" value={fmtRp(pendapatanTelur)} sub={`${pjBulan.length} nota`} />
          <Stat label="Terjual" value={`${fmtNum(kgJualBulan, 1)} kg`} sub={`≈ ${fmtNum(kgJualBulan / settings.kgPerPeti, 1)} peti`} />
          <Stat label="Harga rata-rata" value={hargaJualRata ? `${fmtRp(hargaJualRata)}/kg` : '–'} />
        </div>
        <table className="mini-table">
          <thead>
            <tr>
              <th>Wilayah</th>
              <th className="num">Nota</th>
              <th className="num">Kg</th>
              <th className="num">Rp</th>
            </tr>
          </thead>
          <tbody>
            {!Object.keys(perWilayah).length && <EmptyRow cols={4} />}
            {Object.entries(perWilayah)
              .sort((a, b) => b[1].rp - a[1].rp)
              .map(([w, v]) => (
                <tr key={w}>
                  <td>{w}</td>
                  <td className="num">{v.nota}</td>
                  <td className="num">{fmtNum(v.kg, 1)}</td>
                  <td className="num">{fmtRp(v.rp)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </Panel>

      <div className="grid-2">
        <Panel title="Piutang pelanggan">
          <div className="stats stats-compact">
            <Stat label="Total" value={fmtRp(piutang.total)} />
            <Stat label="Lewat tempo" value={fmtRp(piutang.lewat)} tone={piutang.lewat ? 'danger' : null} />
            <Stat label="≤ 7 hari" value={fmtRp(piutang.minggu)} tone={piutang.minggu ? 'warning' : null} />
          </div>
          <TagihanList rows={piutang.jatuhTempo} nama={(p) => p.pelangganNama} link={(p) => `/penjualan/${p.id}`} />
        </Panel>
        <Panel title="Hutang supplier">
          <div className="stats stats-compact">
            <Stat label="Total" value={fmtRp(hutang.total)} />
            <Stat label="Lewat tempo" value={fmtRp(hutang.lewat)} tone={hutang.lewat ? 'danger' : null} />
            <Stat label="≤ 7 hari" value={fmtRp(hutang.minggu)} tone={hutang.minggu ? 'warning' : null} />
          </div>
          <TagihanList rows={hutang.jatuhTempo} nama={(p) => p.supplierNama} link={() => '/pembelian'} />
        </Panel>
      </div>

      {isOwner && (
        <Panel title={`Keuangan ${monthLabel(monthKey(t))} (estimasi)`}>
          <div className="stats">
            <Stat label="Pendapatan telur" value={fmtRp(pendapatanTelur)} />
            <Stat label="Pemasukan lain" value={fmtRp(pemasukanLain)} />
            <Stat label="Biaya pakan terpakai" value={fmtRp(biayaPakan)} />
            <Stat label="Biaya operasional" value={fmtRp(biayaOps)} sub={`kas ${fmtRp(biayaKas)} · trip ${fmtRp(biayaTripBulan)} · barang lain ${fmtRp(biayaBarangLain)}`} />
            <Stat label="Laba kasar" value={fmtRp(labaKasar)} tone={labaKasar < 0 ? 'danger' : 'success'} />
            <Stat
              label="HPP per kg"
              value={hpp ? fmtRp(hpp) : '–'}
              sub={hpp && hargaJualRata ? `margin ${fmtRp(hargaJualRata - hpp)}/kg vs harga jual rata-rata` : `produksi ${fmtNum(kgProduksiBulan, 1)} kg`}
              tone={hpp && hargaJualRata && hargaJualRata < hpp ? 'danger' : null}
            />
          </div>
          <p className="muted small">
            Biaya pakan = kg pakan terpakai × harga rata-rata pembelian. Obat, vaksin, peti dihitung saat dibeli. Pembayaran
            hutang tidak dihitung lagi (sudah masuk saat pembelian). Penyusutan kandang & ayam belum termasuk.
          </p>
        </Panel>
      )}

      {isOwner && pending.length > 0 && (
        <Panel title="Usulan harga menunggu approval" className="panel-warning">
          <table className="mini-table">
            <tbody>
              {pending.map((h) => (
                <tr key={h.id}>
                  <td>
                    {h.wilayahNama} · {GRADE_LABEL[h.grade]}
                    <div className="muted small">
                      dari {emailToUsername(h.diajukanOleh)}, berlaku {fmtTgl(h.berlakuMulai)}
                    </div>
                  </td>
                  <td className="num">
                    {fmtRp(h.harga)}/{h.satuan}
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
        </Panel>
      )}
    </>
  )
}

function TagihanList({ rows, nama, link }) {
  if (!rows.length) return <p className="muted small">Tidak ada yang jatuh tempo dalam 7 hari.</p>
  const t = today()
  return (
    <table className="mini-table">
      <tbody>
        {rows.map((p) => {
          const d = diffDays(t, p.jatuhTempo || t)
          return (
            <tr key={p.id}>
              <td>
                <Link to={link(p)}>{nama(p)}</Link>
                <div className="muted small">{p.noNota || fmtTgl(p.tanggal)}</div>
              </td>
              <td className="num">{fmtRp(sisaTagihan(p))}</td>
              <td className={`num small ${d < 0 ? 'text-danger' : ''}`}>
                {d < 0 ? `lewat ${-d} hari` : d === 0 ? 'hari ini' : `${d} hari lagi`}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
