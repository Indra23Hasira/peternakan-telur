export const GRADES = ['utuh', 'retak', 'pecah', 'kotor']
export const GRADE_LABEL = { utuh: 'Utuh', retak: 'Retak', pecah: 'Pecah', kotor: 'Kotor' }

export const ROLES = ['owner', 'admin', 'petugas']
export const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', petugas: 'Petugas kandang' }

export const KATEGORI_BARANG = [
  { value: 'pakan', label: 'Pakan' },
  { value: 'obat', label: 'Obat / vitamin' },
  { value: 'vaksin', label: 'Vaksin' },
  { value: 'peti', label: 'Peti / tray' },
  { value: 'lainnya', label: 'Lainnya' },
]

export const KAS_PENGELUARAN = [
  { value: 'gaji', label: 'Gaji / upah' },
  { value: 'listrik', label: 'Listrik & air' },
  { value: 'bbm', label: 'BBM (di luar trip)' },
  { value: 'perawatan', label: 'Perawatan kandang' },
  { value: 'kendaraan', label: 'Servis kendaraan' },
  { value: 'lainnya', label: 'Lainnya' },
]

export const KAS_PEMASUKAN = [
  { value: 'ayam_afkir', label: 'Jual ayam afkir' },
  { value: 'kotoran', label: 'Jual kotoran ayam' },
  { value: 'lainnya', label: 'Lainnya' },
]

export const ALASAN_MUTASI_TELUR = [
  'Pecah di gudang',
  'Rusak / busuk',
  'Konsumsi / sampel',
  'Koreksi timbang',
  'Lainnya',
]

// Ambang alert dashboard
export const ALERT_HDP_TURUN = 5 // poin persen vs rata-rata 7 hari sebelumnya
export const ALERT_MORTALITAS = 0.1 // % populasi per hari
export const ALERT_SELISIH_OPNAME = 2 // % dari stok sistem
