export function nullableText(value) {
  const text = String(value ?? '').trim()
  return text || null
}

export function cleanText(value) {
  return String(value ?? '').trim()
}

export function addFilter(filters, values, condition, value) {
  if (!value) return
  filters.push(condition)
  values.push(value)
}
