import SimpleCrud from '../components/SimpleCrud'
import { PageHeader } from '../components/ui'
import { KATEGORI_BARANG } from '../lib/constants'
import { fmtNum, byNama } from '../lib/format'

const katLabel = (v) => KATEGORI_BARANG.find((k) => k.value === v)?.label || v

export default function Barang() {
  return (
    <>
      <PageHeader
        title="Barang & supplier"
        subtitle="Daftar barang yang dibeli (pakan, obat, vaksin, peti) dan supplier-nya."
      />
      <SimpleCrud
        title="Barang"
        name="barang"
        sort={(a, b) => String(a.kategori).localeCompare(String(b.kategori)) || byNama(a, b)}
        fields={[
          { name: 'nama', label: 'Nama barang', required: true, placeholder: 'Pakan layer merk X' },
          { name: 'kategori', label: 'Kategori', type: 'select', required: true, options: KATEGORI_BARANG, default: 'pakan' },
          { name: 'satuanBeli', label: 'Satuan beli', required: true, placeholder: 'karung', default: 'karung' },
          {
            name: 'isiPerSatuan',
            label: 'Isi per satuan beli',
            type: 'number',
            required: true,
            default: '50',
            hint: 'Mis. 1 karung = 50 (kg). Untuk obat per botol isi 1.',
          },
          {
            name: 'satuanStok',
            label: 'Satuan stok',
            required: true,
            default: 'kg',
            hint: 'Pakan wajib "kg" supaya bisa dipotong dari input harian.',
          },
        ]}
        beforeSave={(d) => {
          if (d.isiPerSatuan <= 0) throw new Error('Isi per satuan harus lebih dari 0.')
          return d
        }}
        columns={[
          { label: 'Nama', render: (r) => <b>{r.nama}</b> },
          { label: 'Kategori', render: (r) => katLabel(r.kategori) },
          {
            label: 'Satuan',
            render: (r) => `1 ${r.satuanBeli} = ${fmtNum(r.isiPerSatuan, 2)} ${r.satuanStok}`,
          },
        ]}
      />
      <SimpleCrud
        title="Supplier"
        name="supplier"
        sort={byNama}
        fields={[
          { name: 'nama', label: 'Nama supplier', required: true },
          { name: 'kontak', label: 'No. HP / WA' },
          { name: 'alamat', label: 'Alamat' },
          {
            name: 'termin',
            label: 'Termin default',
            type: 'select',
            required: true,
            default: 'cash',
            options: [
              { value: 'cash', label: 'Cash' },
              { value: 'tempo', label: 'Tempo' },
            ],
          },
          {
            name: 'hariTempo',
            label: 'Lama tempo (hari)',
            type: 'number',
            default: '14',
            show: (f) => f.termin === 'tempo',
          },
        ]}
        columns={[
          { label: 'Nama', render: (r) => <b>{r.nama}</b> },
          { label: 'Kontak', render: (r) => r.kontak || '–' },
          { label: 'Termin', render: (r) => (r.termin === 'tempo' ? `Tempo ${fmtNum(r.hariTempo)} hari` : 'Cash') },
          { label: 'Alamat', render: (r) => r.alamat || '–' },
        ]}
      />
    </>
  )
}
