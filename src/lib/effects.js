import { GRADES } from './constants'
import { num } from './format'

// Input harian petugas: telur masuk gudang, pakan keluar gudang, deplesi ke batch
export function produksiEffect(d) {
  const e = {}
  const telur = {}
  for (const g of GRADES) telur[g] = num(d.kg?.[g])
  e['stokTelur/saldo'] = telur
  if (d.pakanBarangId && num(d.pakanKg)) {
    e[`stokBarang/${d.pakanBarangId}`] = { jumlah: -num(d.pakanKg) }
  }
  if (d.batchId) {
    e[`batch/${d.batchId}`] = { totalMati: num(d.mati), totalAfkir: num(d.afkir) }
  }
  return e
}

// Pembelian: stok bertambah sebesar jumlah yang DITERIMA × isi per satuan beli
export function pembelianEffect(d) {
  const e = {}
  for (const it of d.items || []) {
    if (!it.barangId) continue
    const key = `stokBarang/${it.barangId}`
    e[key] = e[key] || { jumlah: 0 }
    e[key].jumlah += num(it.qtyDiterima) * (num(it.isiPerSatuan) || 1)
  }
  return e
}

// Penjualan: stok telur keluar per grade (kg aktual timbang); retur masuk kembali
export function penjualanEffect(d) {
  const t = {}
  for (const it of d.items || []) t[it.grade] = (t[it.grade] || 0) - num(it.kg)
  for (const p of d.potongan || []) {
    if (p.jenis === 'retur') t[p.grade] = (t[p.grade] || 0) + num(p.kg)
  }
  return { 'stokTelur/saldo': t }
}

// Stok opname: selisih fisik − sistem
export function opnameEffect(d) {
  return d.barangId ? { [`stokBarang/${d.barangId}`]: { jumlah: num(d.selisih) } } : {}
}

// Mutasi gudang telur manual (susut / koreksi)
export function mutasiTelurEffect(d) {
  const kg = num(d.kg)
  return { 'stokTelur/saldo': { [d.grade]: d.arah === 'tambah' ? kg : -kg } }
}
