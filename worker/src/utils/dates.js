export function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

export function normalizeDate(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return iso[0]
  const latin = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (!latin) return null
  const day = latin[1].padStart(2, '0')
  const month = latin[2].padStart(2, '0')
  const year = latin[3].length === 2 ? `20${latin[3]}` : latin[3]
  return `${year}-${month}-${day}`
}
