import SimpleCrud from '../components/SimpleCrud'
import { PageHeader } from '../components/ui'
import { useCol } from '../hooks/useFirestore'
import { sisaTagihan, aging } from '../lib/calc'
import { fmtNum, fmtRp, byNama } from '../lib/format'

export default function Pelanggan() {
  const { data: wilayah } = useCol('wilayah')
  const { data: penjualan } = useCol('penjualan')
  const wNama = (id) => wilayah.find((w) => w.id === id)?.nama || '–'

  const piutang = (pid) => penjualan.filter((p) => p.pelangganId === pid).reduce((s, p) => s + sisaTagihan(p), 0)
  const lewat = (pid) =>
    penjualan.filter((p) => p.pelangganId === pid && aging(p) === 'lewat').reduce((s, p) => s + sisaTagihan(p), 0)

  return (
    <>
      <PageHeader title="Pelanggan" subtitle="Wilayah menentukan harga yang dipakai di nota." />
      <SimpleCrud
        title="Daftar pelanggan"
        name="pelanggan"
        sort={(a, b) => wNama(a.wilayahId).localeCompare(wNama(b.wilayahId)) || byNama(a, b)}
        fields={[
          { name: 'nama', label: 'Nama pelanggan / toko', required: true },
          {
            name: 'wilayahId',
            label: 'Wilayah',
            type: 'select',
            required: true,
            options: [...wilayah].sort(byNama).map((w) => ({ value: w.id, label: w.nama })),
            hint: wilayah.length ? null : 'Tambahkan wilayah dulu di menu Harga jual.',
          },
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
          { name: 'hariTempo', label: 'Lama tempo (hari)', type: 'number', default: '7', show: (f) => f.termin === 'tempo' },
        ]}
        columns={[
          { label: 'Nama', render: (r) => <b>{r.nama}</b> },
          { label: 'Wilayah', render: (r) => wNama(r.wilayahId) },
          { label: 'Kontak', render: (r) => r.kontak || '–' },
          { label: 'Termin', render: (r) => (r.termin === 'tempo' ? `Tempo ${fmtNum(r.hariTempo)} hr` : 'Cash') },
          {
            label: 'Piutang',
            className: 'num',
            render: (r) => {
              const p = piutang(r.id)
              const l = lewat(r.id)
              return p > 0 ? (
                <>
                  {fmtRp(p)}
                  {l > 0 && <div className="text-danger small">lewat tempo {fmtRp(l)}</div>}
                </>
              ) : (
                '–'
              )
            },
          },
        ]}
      />
    </>
  )
}
