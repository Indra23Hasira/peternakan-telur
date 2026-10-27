import { useParams, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useCol, useDocData } from '../hooks/useFirestore'
import { sisaTagihan } from '../lib/calc'
import { GRADE_LABEL } from '../lib/constants'
import { num, fmtNum, fmtRp, fmtTgl } from '../lib/format'
import { Panel, Loading } from '../components/ui'

// Surat jalan per trip (cetak / bagikan via WA)
export default function TripDetail() {
  const { id } = useParams()
  const { settings } = useApp()
  const { data: trip, loading } = useDocData('trip', id)
  const { data: nota } = useCol('penjualan', { wheres: [['tanggal', '==', trip?.tanggal || '']], enabled: !!trip })

  if (loading) return <Loading />
  if (!trip)
    return (
      <Panel>
        Trip tidak ditemukan. <Link to="/pengiriman">Kembali</Link>
      </Panel>
    )

  const list = (trip.penjualanIds || []).map((nid) => nota.find((n) => n.id === nid)).filter(Boolean)
  const totalKg = list.reduce((s, n) => s + (n.items || []).reduce((a, i) => a + num(i.kg), 0), 0)
  const totalPeti = list.reduce(
    (s, n) => s + (n.items || []).filter((i) => i.satuan === 'peti').reduce((a, i) => a + num(i.qty), 0),
    0,
  )

  const waText = [
    `*Surat jalan ${settings.nama}*`,
    `${fmtTgl(trip.tanggal)} · ${trip.armadaNama}${trip.sopir ? ` · sopir ${trip.sopir}` : ''}`,
    '',
    ...list.map(
      (n, i) =>
        `${i + 1}. ${n.pelangganNama} (${n.wilayahNama}) — ${(n.items || [])
          .map((it) => `${GRADE_LABEL[it.grade]} ${fmtNum(it.qty, 2)} ${it.satuan}`)
          .join(', ')}${sisaTagihan(n) > 0 && n.termin === 'cash' ? ` · tagih ${fmtRp(sisaTagihan(n))}` : ''}`,
    ),
    '',
    `Total: ${fmtNum(totalKg, 1)} kg${totalPeti ? ` (${fmtNum(totalPeti)} peti)` : ''}`,
  ].join('\n')

  return (
    <>
      <div className="page-header no-print">
        <div>
          <Link to="/pengiriman" className="muted">
            ← Pengiriman
          </Link>
          <h1>Surat jalan</h1>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => window.print()}>
            🖨️ Cetak
          </button>
          <a className="btn btn-primary" href={`https://wa.me/?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer">
            Bagikan WA
          </a>
        </div>
      </div>

      <div className="print-area nota">
        <div className="nota-head">
          <div>
            <div className="nota-farm">{settings.nama}</div>
            <div className="muted">Surat jalan</div>
          </div>
          <div className="nota-meta">
            <div>{fmtTgl(trip.tanggal)}</div>
            <div>{trip.armadaNama}</div>
            {trip.sopir && <div>Sopir: {trip.sopir}</div>}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Pelanggan / alamat</th>
              <th>Muatan</th>
              <th className="num">Kg</th>
              <th>Nota</th>
              <th>Paraf</th>
            </tr>
          </thead>
          <tbody>
            {list.map((n, i) => (
              <tr key={n.id}>
                <td>{i + 1}</td>
                <td>
                  <b>{n.pelangganNama}</b> · {n.wilayahNama}
                  {n.alamat && <div className="muted small">{n.alamat}</div>}
                  {n.kontak && <div className="muted small">{n.kontak}</div>}
                </td>
                <td>
                  {(n.items || []).map((it, k) => (
                    <div key={k}>
                      {GRADE_LABEL[it.grade]} {fmtNum(it.qty, 2)} {it.satuan}
                    </div>
                  ))}
                </td>
                <td className="num">{fmtNum((n.items || []).reduce((a, it) => a + num(it.kg), 0), 1)}</td>
                <td>
                  {n.noNota}
                  {sisaTagihan(n) > 0 && (
                    <div className="small">
                      {n.termin === 'tempo' ? `Tempo s/d ${fmtTgl(n.jatuhTempo)}` : `Tagih ${fmtRp(sisaTagihan(n))}`}
                    </div>
                  )}
                </td>
                <td className="sign-cell" />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="nota-total">
              <td colSpan={3}>
                Total {list.length} pelanggan{totalPeti ? ` · ${fmtNum(totalPeti)} peti` : ''}
              </td>
              <td className="num">{fmtNum(totalKg, 1)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
        {trip.catatan && <p className="muted">Catatan: {trip.catatan}</p>}
        <div className="sign-row">
          <div>Sopir</div>
          <div>Admin gudang</div>
        </div>
      </div>
    </>
  )
}
