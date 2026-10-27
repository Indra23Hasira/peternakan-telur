import SimpleCrud from '../components/SimpleCrud'
import { PageHeader, StatusBadge } from '../components/ui'
import { useCol } from '../hooks/useFirestore'
import { umurMinggu, populasiKini } from '../lib/calc'
import { today } from '../lib/dates'
import { fmtNum, fmtTgl, byNama } from '../lib/format'

export default function KandangBatch() {
  const { data: kandang } = useCol('kandang')
  const { data: blok } = useCol('blok')
  const { data: barang } = useCol('barang')

  const kandangNama = (id) => kandang.find((k) => k.id === id)?.nama || '–'
  const blokLabel = (b) => `${kandangNama(b.kandangId)} · ${b.nama}`
  const blokOptions = [...blok]
    .sort((a, b) => blokLabel(a).localeCompare(blokLabel(b), 'id', { numeric: true }))
    .map((b) => ({ value: b.id, label: blokLabel(b) }))
  const pakanOptions = barang
    .filter((b) => b.kategori === 'pakan')
    .sort(byNama)
    .map((b) => ({ value: b.id, label: b.nama }))

  return (
    <>
      <PageHeader
        title="Kandang & batch"
        subtitle="Kandang dibagi blok/baris. Satu batch (kelompok ayam seumur) menempati satu atau beberapa blok."
      />

      <div className="grid-2">
        <SimpleCrud
          title="Kandang"
          name="kandang"
          sort={byNama}
          fields={[{ name: 'nama', label: 'Nama kandang', required: true, placeholder: 'Kandang A' }]}
          columns={[{ label: 'Nama', render: (r) => r.nama }]}
        />
        <SimpleCrud
          title="Blok / baris"
          name="blok"
          sort={(a, b) => blokLabel(a).localeCompare(blokLabel(b), 'id', { numeric: true })}
          fields={[
            {
              name: 'kandangId',
              label: 'Kandang',
              type: 'select',
              required: true,
              options: [...kandang].sort(byNama).map((k) => ({ value: k.id, label: k.nama })),
            },
            { name: 'nama', label: 'Nama blok', required: true, placeholder: 'Blok 1' },
          ]}
          columns={[
            { label: 'Kandang', render: (r) => kandangNama(r.kandangId) },
            { label: 'Blok', render: (r) => r.nama },
          ]}
        />
      </div>

      <SimpleCrud
        title="Batch ayam"
        name="batch"
        sort={(a, b) => (a.status === 'afkir') - (b.status === 'afkir') || byNama(a, b)}
        fields={[
          { name: 'nama', label: 'Nama batch', required: true, placeholder: 'Batch Jan 2026' },
          {
            name: 'blokIds',
            label: 'Blok yang ditempati',
            type: 'multicheck',
            required: true,
            options: blokOptions,
            emptyText: 'Buat kandang & blok dulu',
            wide: true,
          },
          { name: 'tanggalMasuk', label: 'Tanggal masuk', type: 'date', required: true, default: today },
          { name: 'umurMasukMinggu', label: 'Umur saat masuk (minggu)', type: 'number', required: true },
          { name: 'jumlahAwal', label: 'Jumlah ekor awal', type: 'number', required: true },
          { name: 'strain', label: 'Strain', placeholder: 'Isa Brown, Lohmann…' },
          {
            name: 'jenisPakanId',
            label: 'Pakan default',
            type: 'select',
            options: pakanOptions,
            hint: 'Otomatis terpilih di form harian petugas.',
          },
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            required: true,
            default: 'aktif',
            options: [
              { value: 'aktif', label: 'Aktif' },
              { value: 'afkir', label: 'Sudah afkir (selesai)' },
            ],
          },
        ]}
        beforeSave={(d, editing, all) => {
          if (d.status === 'aktif') {
            for (const other of all) {
              if (other.id === editing?.id || other.status === 'afkir') continue
              const bentrok = (other.blokIds || []).filter((x) => d.blokIds.includes(x))
              if (bentrok.length) {
                const nm = bentrok.map((id) => blokLabel(blok.find((b) => b.id === id) || {})).join(', ')
                throw new Error(`Blok ${nm} sudah dipakai batch aktif "${other.nama}".`)
              }
            }
          }
          return d
        }}
        columns={[
          { label: 'Batch', render: (r) => <b>{r.nama}</b> },
          {
            label: 'Blok',
            render: (r) =>
              (r.blokIds || [])
                .map((id) => blok.find((b) => b.id === id))
                .filter(Boolean)
                .map(blokLabel)
                .join(', ') || '–',
          },
          { label: 'Masuk', render: (r) => fmtTgl(r.tanggalMasuk) },
          { label: 'Umur', className: 'num', render: (r) => `${fmtNum(umurMinggu(r), 1)} mgg` },
          { label: 'Awal', className: 'num', render: (r) => fmtNum(r.jumlahAwal) },
          { label: 'Mati', className: 'num', render: (r) => fmtNum(r.totalMati) },
          { label: 'Afkir', className: 'num', render: (r) => fmtNum(r.totalAfkir) },
          { label: 'Populasi', className: 'num', render: (r) => <b>{fmtNum(populasiKini(r))}</b> },
          { label: 'Status', render: (r) => <StatusBadge status={r.status || 'aktif'} /> },
        ]}
      />
    </>
  )
}
