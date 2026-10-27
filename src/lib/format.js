export const num = (v) => {
  if (v === null || v === undefined || v === '') return 0
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export const fmtNum = (n, d = 0) =>
  (Number(n) || 0).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: d })

export const fmtRp = (n) => {
  const v = Math.round(Number(n) || 0)
  return (v < 0 ? '-Rp ' : 'Rp ') + Math.abs(v).toLocaleString('id-ID')
}

export const fmtKg = (n) => `${fmtNum(n, 2)} kg`

export const fmtPct = (n, d = 1) =>
  n === null || n === undefined || !Number.isFinite(n) ? '–' : `${fmtNum(n, d)}%`

export const fmtTgl = (s) =>
  s
    ? new Date(`${s}T00:00:00`).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '–'

export const round = (n, d = 3) => {
  const f = 10 ** d
  return Math.round((Number(n) || 0) * f) / f
}

// Nomor WA: 0812xxx -> 62812xxx
export const waNumber = (s = '') => {
  let d = String(s).replace(/\D/g, '')
  if (d.startsWith('0')) d = `62${d.slice(1)}`
  return d
}

export const waLink = (phone, text) =>
  `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`

export const byNama = (a, b) =>
  String(a.nama || '').localeCompare(String(b.nama || ''), 'id', { numeric: true })
