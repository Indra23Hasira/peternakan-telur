import { useState } from 'react'
import SimpleCrud from '../components/SimpleCrud'
import { PageHeader, Stat } from '../components/ui'
import { useCol } from '../hooks/useFirestore'
import { KAS_PENGELUARAN, KAS_PEMASUKAN } from '../lib/constants'
import { today, monthKey, recentMonths, monthLabel } from '../lib/dates'
import { num, fmtRp, fmtTgl } from '../lib/format'
import { biayaTrip } from './Pengiriman'

const katLabel = (r) =>
  (r.tipe === 'pemasukan' ? KAS_PEMASUKAN : KAS_PENGELUARAN).find((k) => k.value === r.kategori)?.label || r.kategori

export default function Kas() {
  const [bulan, setBulan] = useState(monthKey(today()))
  const { data: kas } = useCol('kas')
  const { data: trip } = useCol('trip')
  const inBulan = (r) => bulan === 'semua' || monthKey(r.tanggal) === bulan
  const keluar = kas.filter((r) => inBulan(r) && r.tipe === 'pengeluaran').reduce((s, r) => s + num(r.jumlah), 0)
  const masuk = kas.filter((r) => inBulan(r) && r.tipe === 'pemasukan').reduce((s, r) => s + num(r.jumlah), 0)
  const tripBiaya = trip.filter(inBulan).reduce((s, t) => s + biayaTrip(t), 0)

  return (
    <>
      <PageHeader
        title="Kas operasional"
        subtitle="Pengeluaran di luar pembelian barang (gaji, listrik, perawatan…) dan pemasukan selain penjualan telur."
      />
      <div className="stats">
        <Stat label="Pengeluaran operasional" value={fmtRp(keluar)} sub={bulan === 'semua' ? 'semua waktu' : monthLabel(bulan)} />
        <Stat label="Biaya trip pengiriman" value={fmtRp(tripBiaya)} sub="dari menu Pengiriman" />
        <Stat label="Pemasukan lain" value={fmtRp(masuk)} sub="ayam afkir, kotoran, dll." />
      </div>
      <SimpleCrud
        title="Catatan kas"
        name="kas"
        filterRows={inBulan}
        sort={(a, b) => b.tanggal.localeCompare(a.tanggal)}
        toolbar={
          <select value={bulan} onChange={(e) => setBulan(e.target.value)}>
            <option value="semua">Semua bulan</option>
            {recentMonths().map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        }
        fields={[
          { name: 'tanggal', label: 'Tanggal', type: 'date', required: true, default: today },
          {
            name: 'tipe',
            label: 'Jenis',
            type: 'select',
            required: true,
            default: 'pengeluaran',
            options: [
              { value: 'pengeluaran', label: 'Pengeluaran' },
              { value: 'pemasukan', label: 'Pemasukan' },
            ],
          },
          {
            name: 'kategori',
            label: 'Kategori',
            type: 'select',
            required: true,
            options: (f) => (f.tipe === 'pemasukan' ? KAS_PEMASUKAN : KAS_PENGELUARAN),
          },
          { name: 'jumlah', label: 'Jumlah (Rp)', type: 'number', required: true },
          { name: 'keterangan', label: 'Keterangan' },
        ]}
        beforeSave={(d) => {
          if (d.jumlah <= 0) throw new Error('Jumlah harus lebih dari 0.')
          return d
        }}
        columns={[
          { label: 'Tanggal', render: (r) => fmtTgl(r.tanggal) },
          { label: 'Jenis', render: (r) => (r.tipe === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran') },
          { label: 'Kategori', render: katLabel },
          {
            label: 'Jumlah',
            className: 'num',
            render: (r) => <span className={r.tipe === 'pemasukan' ? 'text-success' : ''}>{fmtRp(r.jumlah)}</span>,
          },
          { label: 'Keterangan', render: (r) => r.keterangan || '' },
        ]}
      />
    </>
  )
}
