import { normalizeDate } from './dates.js'

export function parseCsv(text) {
  const normalized = String(text ?? '').replace(/^\uFEFF/, '')
  const lines = normalized.split(/\r?\n/).filter((line) => line.trim())
  const delimiter = detectDelimiter(lines.slice(0, 5))
  return lines.map((line) => splitCsvLine(line, delimiter))
}

export function detectDelimiter(lines) {
  const delimiters = [',', ';', '\t', '|']
  return delimiters
    .map((delimiter) => ({
      delimiter,
      count: lines.reduce((total, line) => total + line.split(delimiter).length - 1, 0),
    }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ','
}

export function splitCsvLine(line, delimiter) {
  const cells = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index++) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"' && quoted && next === '"') {
      current += '"'
      index++
      continue
    }

    if (char === '"') {
      quoted = !quoted
      continue
    }

    if (char === delimiter && !quoted) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  cells.push(current.trim())
  return cells
}

export function findHeaderIndex(rows) {
  const keywords = ['servicio', 'cliente', 'fecha', 'paquete', 'precio', 'alfa']
  const max = Math.min(rows.length, 10)

  for (let index = 0; index < max; index++) {
    const joined = rows[index].map(normalizeHeader).join(' ')
    const matches = keywords.filter((keyword) => joined.includes(keyword)).length
    if (matches >= 2) return index
  }

  return 0
}

export function normalizeHeader(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function normalizeText(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export function pickCsvValue(headers, row, candidates) {
  const index = headers.findIndex((header) => candidates.some((candidate) => header.includes(candidate)))
  return index >= 0 ? String(row[index] ?? '').trim() : ''
}

export function detectCycleName(value) {
  const text = normalizeText(value)
  if (/1\s*-\s*5/.test(text)) return 'CORTE 1-5'
  if (/15\s*-\s*20/.test(text)) return 'CORTE 15-20'
  return null
}

export function splitFullName(fullName) {
  const clean = String(fullName || '').trim().replace(/\s+/g, ' ').toUpperCase()
  if (!clean) return { nombres: '', apellido_paterno: null, apellido_materno: null }

  const parts = clean.split(' ')
  if (parts.length === 1) return { nombres: parts[0], apellido_paterno: null, apellido_materno: null }
  if (parts.length === 2) return { nombres: parts[0], apellido_paterno: parts[1], apellido_materno: null }

  return {
    nombres: parts.slice(0, -2).join(' '),
    apellido_paterno: parts[parts.length - 2],
    apellido_materno: parts[parts.length - 1],
  }
}

export function detectSpeed(packageText, priceText) {
  const text = normalizeHeader(`${packageText} ${priceText}`)
  const explicit = text.match(/\b(10|20|30)\b/)
  if (explicit) return Number(explicit[1])

  const price = parseMoney(priceText)
  if (price === 299) return 10
  if (price === 349) return 20
  if (price === 449 || price === 469) return 30
  return null
}

export function parseMoney(value) {
  const cleaned = String(value ?? '').replace(/[^0-9.,]/g, '')
  if (!cleaned) return null
  const normalized = cleaned.includes(',') && !cleaned.includes('.') ? cleaned.replace(',', '.') : cleaned.replace(/,/g, '')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function detectCycle(ciclos, value) {
  const cycleName = detectCycleName(value)
  if (cycleName) return ciclos.find((ciclo) => normalizeText(ciclo.nombre) === cycleName)

  const text = normalizeText(value)
  if (!text) return null
  return ciclos.find((ciclo) => normalizeText(ciclo.nombre).includes(text))
}

export { normalizeDate }
