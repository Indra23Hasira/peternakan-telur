import { GRADES } from './constants'
import { num } from './format'
import { today, diffDays } from './dates'

/* ---------------- Populasi & produksi ---------------- */

export const umurMinggu = (batch, tgl = today()) =>
  batch?.tanggalMasuk ? num(batch.umurMasukMinggu) + diffDays(batch.tanggalMasuk, tgl) / 7 : null

export const populasiKini = (b) => num(b?.jumlahAwal) - num(b?.totalMati) - num(b?.totalAfkir)

export const totalButir = (p) => GRADES.reduce((s, g) => s + num(p?.butir?.[g]), 0)
export const totalKg = (p) => GRADES.reduce((s, g) => s + num(p?.kg?.[g]), 0)

export const hdp = (butir, pop) => (pop > 0 ? (butir / pop) * 100 : null)

/**
 * Populasi batch pada awal suatu tanggal (sebelum deplesi hari itu).
 * = populasi sekarang + deplesi yang terjadi sejak tanggal itu.
 * `produksi` harus mencakup data dari tanggal paling awal yang dihitung s/d hari ini.
 */
export function makePopulasiAt(batches, produksi) {
  const map = {}
  for (const p of produksi) if (p.batchId) (map[p.batchId] = map[p.batchId] || []).push(p)
  return (batchId, tgl) => {
    const b = batches.find((x) => x.id === batchId)
    if (!b) return 0
    let pop = populasiKini(b)
    for (const p of map[batchId] || []) if (p.tanggal >= tgl) pop += num(p.mati) + num(p.afkir)
    return pop
  }
}

/** Agregat produksi per batch per tanggal: key `${batchId}|${tanggal}` */
export function aggByBatchDate(produksi) {
  const out = {}
  for (const p of produksi) {
    if (!p.batchId) continue
    const k = `${p.batchId}|${p.tanggal}`
    const a = (out[k] = out[k] || { butir: 0, kg: 0, pakan: 0, mati: 0, afkir: 0 })
    a.butir += totalButir(p)
    a.kg += totalKg(p)
    a.pakan += num(p.pakanKg)
    a.mati += num(p.mati)
    a.afkir += num(p.afkir)
  }
  return out
}

export const kandangOfBatch = (batch, blok) =>
  blok.find((b) => (batch?.blokIds || []).includes(b.id))?.kandangId || null

/* ---------------- Harga ---------------- */

/** Harga rata-rata tertimbang per satuan stok (mis. per kg) dari seluruh pembelian yang diterima. */
export function hargaRataBarang(pembelian, barangId) {
  let nilai = 0
  let jml = 0
  for (const p of pembelian) {
    const items = p.items || []
    const totalItem = items.reduce((s, i) => s + num(i.qty) * num(i.hargaPerSatuan), 0)
    for (const i of items) {
      if (i.barangId !== barangId) continue
      const q = num(i.qtyDiterima)
      const share = totalItem > 0 ? (num(p.ongkir) * num(i.qty) * num(i.hargaPerSatuan)) / totalItem : 0
      const unitCost = num(i.qty) > 0 ? (num(i.qty) * num(i.hargaPerSatuan) + share) / num(i.qty) : 0
      nilai += q * unitCost
      jml += q * (num(i.isiPerSatuan) || 1)
    }
  }
  return jml > 0 ? nilai / jml : 0
}

/** Harga jual aktif terbaru untuk wilayah × grade × satuan per tanggal. */
export function hargaAktif(list, wilayahId, grade, satuan, tgl = today()) {
  let best = null
  for (const h of list) {
    if (h.status !== 'aktif') continue
    if (h.wilayahId !== wilayahId || h.grade !== grade || h.satuan !== satuan) continue
    if (h.berlakuMulai > tgl) continue
    if (
      !best ||
      h.berlakuMulai > best.berlakuMulai ||
      (h.berlakuMulai === best.berlakuMulai &&
        (h.createdAt?.seconds || 0) > (best.createdAt?.seconds || 0))
    )
      best = h
  }
  return best
}

/* ---------------- Tagihan (piutang & hutang) ---------------- */

export const sumBayar = (d) => (d.pembayaran || []).reduce((s, x) => s + num(x.jumlah), 0)
export const sisaTagihan = (d) => Math.max(0, num(d.total) - sumBayar(d))

export function statusBayar(d) {
  if (sisaTagihan(d) < 1) return 'lunas'
  return sumBayar(d) > 0 ? 'sebagian' : 'belum'
}

/** 'lunas' | 'lewat' | 'minggu_ini' | 'belum_jt' */
export function aging(d, tgl = today()) {
  if (statusBayar(d) === 'lunas') return 'lunas'
  if (!d.jatuhTempo || d.jatuhTempo < tgl) return 'lewat'
  return diffDays(tgl, d.jatuhTempo) <= 7 ? 'minggu_ini' : 'belum_jt'
}

export const AGING_LABEL = {
  lunas: 'Lunas',
  lewat: 'Lewat tempo',
  minggu_ini: 'Jatuh tempo ≤ 7 hari',
  belum_jt: 'Belum jatuh tempo',
}

export const kgTerjual = (pj) =>
  (pj.items || []).reduce((s, i) => s + num(i.kg), 0) -
  (pj.potongan || []).filter((p) => p.jenis === 'retur').reduce((s, p) => s + num(p.kg), 0)
