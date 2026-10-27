const pad = (n) => String(n).padStart(2, '0')

export const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => toStr(new Date())
export const parse = (s) => new Date(`${s}T00:00:00`)

export const addDays = (s, n) => {
  const d = parse(s)
  d.setDate(d.getDate() + n)
  return toStr(d)
}

export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000)
export const monthStart = (s) => `${s.slice(0, 7)}-01`
export const monthKey = (s) => (s || '').slice(0, 7)

export const monthLabel = (key) => {
  if (!key) return ''
  const d = parse(`${key}-01`)
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

// daftar 12 bulan terakhir, terbaru dulu: ['2026-10', '2026-09', ...]
export const recentMonths = (n = 12) => {
  const d = new Date()
  const out = []
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`)
    d.setMonth(d.getMonth() - 1)
  }
  return out
}
