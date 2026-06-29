import { requireAuth } from '../utils/auth.js'
import { json } from '../utils/response.js'

const INFRA_ROLES = ['ADMIN', 'SOPORTE', 'SOPORTE_FIBRA']
const INFRA_READ_ROLES = ['ADMIN', 'SOPORTE', 'SOPORTE_FIBRA', 'TECNICO', 'TECNICO_FIBRA']

export async function listCajasFibra(request, env, url) {
  const auth = await requireAuth(request, env, INFRA_ROLES)
  if (auth.response) return auth.response

  const filters = []
  const values = []
  const comunidadId = url.searchParams.get('comunidad_id')
  const estado = url.searchParams.get('estado')
  const search = String(url.searchParams.get('q') ?? '').trim()

  if (comunidadId) {
    filters.push('cf.comunidad_id = ?')
    values.push(Number(comunidadId))
  }
  if (estado === 'activo') filters.push('cf.activo = 1')
  if (estado === 'inactivo') filters.push('cf.activo = 0')
  if (search) {
    filters.push(`(
      cf.nombre LIKE ?
      OR cf.codigo_caja LIKE ?
      OR cf.nombre_original_kml LIKE ?
      OR co.nombre LIKE ?
    )`)
    values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
  const statement = env.DB.prepare(
    `SELECT
       cf.id AS id,
       cf.id AS caja_id,
       cf.comunidad_id,
       co.nombre AS comunidad_nombre,
       cf.tipo, cf.nombre_original_kml, cf.nombre,
       cf.pon, cf.numero_caja, cf.codigo_caja,
       cf.latitud, cf.longitud,
       cf.activo, cf.creado_en, cf.actualizado_en,
       COALESCE(SUM(CASE WHEN ct.estado = 'LIBRE' THEN 1 ELSE 0 END), 0) AS terminales_libres,
       COALESCE(SUM(CASE WHEN ct.estado = 'OCUPADO' THEN 1 ELSE 0 END), 0) AS terminales_ocupadas,
       COALESCE(COUNT(ct.id), 0) AS terminales_total
     FROM cajas_fibra cf
     JOIN comunidades co ON co.id = cf.comunidad_id
     LEFT JOIN caja_terminales ct ON ct.caja_id = cf.id
     ${where}
     GROUP BY cf.id
     ORDER BY co.nombre, cf.tipo DESC, cf.pon, cf.numero_caja, cf.nombre`
  )
  const { results } = values.length ? await statement.bind(...values).all() : await statement.all()
  return json({ ok: true, cajas: results ?? [] })
}

export async function getCajaFibra(request, env, cajaId) {
  const auth = await requireAuth(request, env, INFRA_ROLES)
  if (auth.response) return auth.response

  const caja = await getCajaById(env, cajaId)
  if (!caja) return json({ ok: false, error: 'Caja no encontrada' }, 404)
  const terminales = await getTerminalesByCaja(env, cajaId)
  return json({ ok: true, caja, terminales })
}

export async function listCajasDisponibles(request, env, url) {
  const auth = await requireAuth(request, env, INFRA_READ_ROLES)
  if (auth.response) return auth.response

  const comunidadId = Number(url.searchParams.get('comunidad_id'))
  if (!comunidadId) return json({ ok: false, error: 'Comunidad obligatoria' }, 400)

  const { results } = await env.DB.prepare(
    `SELECT
       cf.id AS id,
       cf.id AS caja_id,
       cf.comunidad_id,
       cf.tipo,
       cf.nombre_original_kml,
       cf.nombre,
       cf.codigo_caja,
       cf.latitud,
       cf.longitud,
       COALESCE(SUM(CASE WHEN ct.estado = 'LIBRE' THEN 1 ELSE 0 END), 0) AS terminales_libres,
       COALESCE(SUM(CASE WHEN ct.estado = 'OCUPADO' THEN 1 ELSE 0 END), 0) AS terminales_ocupadas,
       COALESCE(SUM(CASE WHEN ct.estado = 'RESERVADO' THEN 1 ELSE 0 END), 0) AS terminales_reservadas,
       COALESCE(SUM(CASE WHEN ct.estado = 'DA\u00d1ADO' THEN 1 ELSE 0 END), 0) AS terminales_danadas
     FROM cajas_fibra cf
     LEFT JOIN caja_terminales ct ON ct.caja_id = cf.id
     WHERE cf.comunidad_id = ?
       AND cf.tipo = 'CAJA'
       AND cf.activo = 1
     GROUP BY cf.id
     ORDER BY cf.pon, cf.numero_caja, cf.nombre`
  ).bind(comunidadId).all()

  return json({ ok: true, cajas: results ?? [] })
}

export async function listCajaTerminalesDisponibles(request, env, url, cajaId) {
  const auth = await requireAuth(request, env, INFRA_READ_ROLES)
  if (auth.response) return auth.response

  const reporteId = Number(url.searchParams.get('reporte_id') || 0)
  const values = [cajaId]
  let ownReservedClause = ''
  if (reporteId) {
    ownReservedClause = `OR caja_terminales.id = (
      SELECT instalaciones_fibra.caja_terminal_id
      FROM instalaciones_fibra
      WHERE instalaciones_fibra.reporte_id = ?
      ORDER BY instalaciones_fibra.id DESC
      LIMIT 1
    )`
    values.push(reporteId)
  }

  const { results } = await env.DB.prepare(
    `SELECT
       caja_terminales.id AS id,
       caja_terminales.id AS caja_terminal_id,
       caja_terminales.caja_id,
       caja_terminales.numero_terminal,
       caja_terminales.estado,
       caja_terminales.servicio_fibra_id,
       caja_terminales.observaciones
     FROM caja_terminales
     WHERE caja_terminales.caja_id = ?
       AND (caja_terminales.estado = 'LIBRE' ${ownReservedClause})
     ORDER BY caja_terminales.numero_terminal`
  ).bind(...values).all()

  return json({ ok: true, terminales: results ?? [] })
}

export async function createCajaFibra(request, env) {
  const auth = await requireAuth(request, env, INFRA_ROLES)
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  const validation = await validateCajaPayload(env, body)
  if (validation.response) return validation.response

  const cajaId = await insertCajaFibra(env, validation.data)
  if (validation.data.tipo === 'CAJA') await ensureTerminalesCaja(env, cajaId)
  return json({ ok: true, id: cajaId }, 201)
}

export async function updateCajaFibra(request, env, cajaId) {
  const auth = await requireAuth(request, env, INFRA_ROLES)
  if (auth.response) return auth.response

  const existing = await getCajaById(env, cajaId)
  if (!existing) return json({ ok: false, error: 'Caja no encontrada' }, 404)

  const body = await request.json().catch(() => null)
  const validation = await validateCajaPayload(env, body, { cajaId })
  if (validation.response) return validation.response

  await env.DB.prepare(
    `UPDATE cajas_fibra
     SET comunidad_id = ?, tipo = ?, nombre = ?, pon = ?, numero_caja = ?,
         codigo_caja = ?, latitud = ?, longitud = ?, activo = ?,
         actualizado_en = datetime('now')
     WHERE id = ?`
  ).bind(
    validation.data.comunidad_id,
    validation.data.tipo,
    validation.data.nombre,
    validation.data.pon,
    validation.data.numero_caja,
    validation.data.codigo_caja,
    validation.data.latitud,
    validation.data.longitud,
    validation.data.activo,
    cajaId
  ).run()

  if (validation.data.tipo === 'CAJA') await ensureTerminalesCaja(env, cajaId)
  return json({ ok: true })
}

export async function updateCajaEstado(request, env, cajaId) {
  const auth = await requireAuth(request, env, INFRA_ROLES)
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  const activo = Number(body?.activo) ? 1 : 0
  await env.DB.prepare(
    "UPDATE cajas_fibra SET activo = ?, actualizado_en = datetime('now') WHERE id = ?"
  ).bind(activo, cajaId).run()
  return json({ ok: true })
}

export async function listCajaTerminales(request, env, cajaId) {
  const auth = await requireAuth(request, env, INFRA_ROLES)
  if (auth.response) return auth.response

  const terminales = await getTerminalesByCaja(env, cajaId)
  return json({ ok: true, terminales })
}

export async function updateCajaTerminal(request, env, terminalId) {
  const auth = await requireAuth(request, env, INFRA_ROLES)
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  const estado = normalizeTerminalEstado(body?.estado)
  if (!['LIBRE', 'DA\u00d1ADO'].includes(estado)) return json({ ok: false, error: 'Estado de terminal invalido' }, 400)

  const terminal = await getTerminalWithCaja(env, terminalId)
  if (!terminal) return json({ ok: false, error: 'Terminal no encontrada' }, 404)
  if (normalizeTerminalEstado(terminal.estado) === 'OCUPADO') return json({ ok: false, error: 'Primero desvincula el cliente antes de liberar la terminal.' }, 409)

  await env.DB.prepare(
    `UPDATE caja_terminales
     SET estado = ?, servicio_fibra_id = NULL, actualizado_en = datetime('now')
     WHERE id = ?`
  ).bind(estado, terminalId).run()
  return json({ ok: true })
}
export async function buscarServiciosFibra(request, env, url) {
  const auth = await requireAuth(request, env, INFRA_ROLES)
  if (auth.response) return auth.response

  const comunidadId = Number(url.searchParams.get('comunidad_id'))
  const search = String(url.searchParams.get('q') ?? url.searchParams.get('search') ?? '').trim()
  if (!comunidadId) return json({ ok: false, error: 'Comunidad obligatoria' }, 400)

  const like = `%${search}%`
  const { results } = await env.DB.prepare(
    `SELECT
       sf.id AS servicio_fibra_id,
       sf.alfanumerico_equipo,
       sf.estado_servicio,
       sf.caja_id,
       sf.caja_terminal_id,
       c.id AS cliente_id,
       c.numero_cliente,
       c.nombres,
       c.apellido_paterno,
       c.apellido_materno,
       c.telefono,
       co.id AS comunidad_id,
       co.nombre AS comunidad_nombre,
       p.id AS paquete_id,
       p.nombre AS paquete_nombre
     FROM servicios_fibra sf
     JOIN clientes c ON c.id = sf.cliente_id
     LEFT JOIN comunidades co ON co.id = c.comunidad_id
     LEFT JOIN paquetes p ON p.id = sf.paquete_id
     WHERE sf.estado_servicio = 'ACTIVO'
       AND c.comunidad_id = ?
       AND (
         c.numero_cliente LIKE ?
         OR c.nombres LIKE ?
         OR c.apellido_paterno LIKE ?
         OR c.apellido_materno LIKE ?
         OR c.telefono LIKE ?
         OR sf.alfanumerico_equipo LIKE ?
       )
     ORDER BY c.numero_cliente ASC
     LIMIT 30`
  ).bind(comunidadId, like, like, like, like, like, like).all()

  return json({ ok: true, servicios: results ?? [] })
}

export async function vincularServicioTerminal(request, env, terminalId) {
  const auth = await requireAuth(request, env, INFRA_ROLES)
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  const servicioFibraId = Number(body?.servicio_fibra_id)
  if (!Number.isInteger(servicioFibraId) || servicioFibraId < 1) return json({ ok: false, error: 'Selecciona un servicio.' }, 400)

  const terminal = await getTerminalWithCaja(env, terminalId)
  if (!terminal) return json({ ok: false, error: 'Terminal no encontrada' }, 404)
  const terminalEstado = normalizeTerminalEstado(terminal.estado)
  if (terminalEstado === 'OCUPADO' || terminal.servicio_fibra_id) return json({ ok: false, error: 'Esta terminal ya esta ocupada por otro cliente.' }, 409)
  if (terminalEstado === 'DA\u00d1ADO') return json({ ok: false, error: 'No se puede vincular cliente en una terminal danada.' }, 409)

  const servicio = await getServicioForLink(env, servicioFibraId)
  if (!servicio) return json({ ok: false, error: 'Servicio no encontrado.' }, 404)
  if (Number(servicio.comunidad_id) !== Number(terminal.comunidad_id)) {
    return json({ ok: false, error: 'Este cliente no pertenece a la comunidad de esta caja.' }, 409)
  }
  if (servicio.caja_id || servicio.caja_terminal_id) {
    return json({ ok: false, error: 'Este servicio ya esta vinculado a otra caja/terminal.' }, 409)
  }

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE caja_terminales
       SET estado = 'OCUPADO', servicio_fibra_id = ?, actualizado_en = datetime('now')
       WHERE id = ?`
    ).bind(servicioFibraId, terminalId),
    env.DB.prepare(
      `UPDATE servicios_fibra
       SET caja_id = ?, caja_terminal_id = ?
       WHERE id = ?`
    ).bind(terminal.caja_id, terminalId, servicioFibraId),
  ])

  return json({ ok: true, message: 'Cliente vinculado correctamente.' })
}
export async function desvincularServicioTerminal(request, env, terminalId) {
  const auth = await requireAuth(request, env, INFRA_ROLES)
  if (auth.response) return auth.response

  const terminal = await getTerminalWithCaja(env, terminalId)
  if (!terminal) return json({ ok: false, error: 'Terminal no encontrada' }, 404)
  if (!terminal.servicio_fibra_id) return json({ ok: false, error: 'La terminal no tiene servicio vinculado.' }, 400)

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE caja_terminales
       SET estado = 'LIBRE', servicio_fibra_id = NULL, actualizado_en = datetime('now')
       WHERE id = ?`
    ).bind(terminalId),
    env.DB.prepare(
      `UPDATE servicios_fibra
       SET caja_id = NULL, caja_terminal_id = NULL
       WHERE id = ?`
    ).bind(terminal.servicio_fibra_id),
  ])

  return json({ ok: true })
}

export async function previewCajasKml(request, env) {
  const auth = await requireAuth(request, env, INFRA_ROLES)
  if (auth.response) return auth.response

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file') || formData?.get('archivo')
  const validation = validateKmlFile(file)
  if (validation.response) return validation.response

  const kmlText = await file.text()
  return json({ ok: true, ...parseKmlPlacemarks(kmlText) })
}

export async function importCajasKml(request, env) {
  const auth = await requireAuth(request, env, INFRA_ROLES)
  if (auth.response) return auth.response

  const formData = await request.formData().catch(() => null)
  const comunidadId = Number(formData?.get('comunidad_id'))
  const file = formData?.get('file') || formData?.get('archivo')
  if (!comunidadId) return json({ ok: false, error: 'Selecciona una comunidad' }, 400)

  const comunidad = await env.DB.prepare('SELECT id FROM comunidades WHERE id = ?').bind(comunidadId).first()
  if (!comunidad) return json({ ok: false, error: 'Comunidad no encontrada' }, 404)

  const validation = validateKmlFile(file)
  if (validation.response) return validation.response

  const parsed = parseKmlPlacemarks(await file.text())
  const summary = { detected: parsed.detected.length, inserted: 0, duplicates: 0, ignored: parsed.ignored.length }
  const imported = []
  const duplicates = []

  for (const item of parsed.detected) {
    const data = {
      comunidad_id: comunidadId,
      tipo: item.tipo,
      nombre_original_kml: item.nombre_original_kml,
      nombre: item.nombre,
      pon: item.pon,
      numero_caja: item.numero_caja,
      codigo_caja: item.codigo_caja,
      latitud: item.latitud,
      longitud: item.longitud,
      activo: 1,
    }

    if (data.codigo_caja) {
      const existing = await env.DB.prepare(
        'SELECT id FROM cajas_fibra WHERE comunidad_id = ? AND codigo_caja = ? LIMIT 1'
      ).bind(data.comunidad_id, data.codigo_caja).first()
      if (existing) {
        summary.duplicates += 1
        duplicates.push({ ...item, id: existing.id })
        continue
      }
    }

    const cajaId = await insertCajaFibra(env, data)
    if (data.tipo === 'CAJA') await ensureTerminalesCaja(env, cajaId)
    summary.inserted += 1
    imported.push({ ...item, id: cajaId })
  }

  return json({ ok: true, message: 'Importacion procesada', summary, imported, duplicates, ignored: parsed.ignored })
}

async function validateCajaPayload(env, body, options = {}) {
  const tipo = String(body?.tipo ?? 'CAJA').trim().toUpperCase()
  const comunidadId = Number(body?.comunidad_id)
  const pon = body?.pon ? Number(body.pon) : null
  const numeroCaja = body?.numero_caja ? Number(body.numero_caja) : null
  const codigoCaja = tipo === 'CAJA' ? generateCajaCode(pon, numeroCaja) : null
  const data = {
    comunidad_id: comunidadId,
    tipo,
    nombre_original_kml: nullableText(body?.nombre_original_kml),
    nombre: normalizeUpper(body?.nombre || codigoCaja || 'OLT'),
    pon: tipo === 'CAJA' ? pon : null,
    numero_caja: tipo === 'CAJA' ? numeroCaja : null,
    codigo_caja: codigoCaja,
    latitud: parseCoordinate(body?.latitud, 'latitud'),
    longitud: parseCoordinate(body?.longitud, 'longitud'),
    activo: body?.activo === undefined ? 1 : Number(body.activo) ? 1 : 0,
  }

  if (!data.comunidad_id) return { response: json({ ok: false, error: 'Comunidad obligatoria' }, 400) }
  if (!['CAJA', 'OLT'].includes(data.tipo)) return { response: json({ ok: false, error: 'Tipo invalido' }, 400) }
  if (data.tipo === 'CAJA' && (!data.pon || !data.numero_caja)) {
    return { response: json({ ok: false, error: 'PON y numero de caja son obligatorios' }, 400) }
  }
  if (data.latitud === null || data.longitud === null) return { response: json({ ok: false, error: 'Latitud y longitud son obligatorias' }, 400) }
  if (data.latitud < -90 || data.latitud > 90 || data.longitud < -180 || data.longitud > 180) {
    return { response: json({ ok: false, error: 'Coordenadas invalidas' }, 400) }
  }

  const comunidad = await env.DB.prepare('SELECT id FROM comunidades WHERE id = ?').bind(data.comunidad_id).first()
  if (!comunidad) return { response: json({ ok: false, error: 'Comunidad no encontrada' }, 404) }

  if (data.codigo_caja) {
    const values = [data.comunidad_id, data.codigo_caja]
    let query = 'SELECT id FROM cajas_fibra WHERE comunidad_id = ? AND codigo_caja = ?'
    if (options.cajaId) {
      query += ' AND id <> ?'
      values.push(options.cajaId)
    }
    const existing = await env.DB.prepare(`${query} LIMIT 1`).bind(...values).first()
    if (existing) return { response: json({ ok: false, error: 'Esta caja ya existe en la comunidad' }, 409) }
  }

  return { data }
}

async function insertCajaFibra(env, data) {
  const result = await env.DB.prepare(
    `INSERT INTO cajas_fibra (
       comunidad_id, tipo, nombre_original_kml, nombre, pon, numero_caja,
       codigo_caja, latitud, longitud, activo
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    data.comunidad_id,
    data.tipo,
    data.nombre_original_kml,
    data.nombre,
    data.pon,
    data.numero_caja,
    data.codigo_caja,
    data.latitud,
    data.longitud,
    data.activo
  ).run()
  return result.meta?.last_row_id
}

async function ensureTerminalesCaja(env, cajaId) {
  const statements = []
  for (let terminal = 1; terminal <= 8; terminal += 1) {
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO caja_terminales (caja_id, numero_terminal, estado)
         VALUES (?, ?, 'LIBRE')`
      ).bind(cajaId, terminal)
    )
  }
  await env.DB.batch(statements)
}

async function getCajaById(env, cajaId) {
  return env.DB.prepare(
    `SELECT
       cf.id AS id,
       cf.id AS caja_id,
       cf.comunidad_id,
       co.nombre AS comunidad_nombre,
       cf.tipo,
       cf.nombre_original_kml,
       cf.nombre,
       cf.pon,
       cf.numero_caja,
       cf.codigo_caja,
       cf.latitud,
       cf.longitud,
       cf.activo,
       cf.creado_en,
       cf.actualizado_en
     FROM cajas_fibra cf
     JOIN comunidades co ON co.id = cf.comunidad_id
     WHERE cf.id = ?`
  ).bind(cajaId).first()
}

async function getTerminalesByCaja(env, cajaId) {
  const { results } = await env.DB.prepare(
    `SELECT
       ct.id AS id,
       ct.id AS caja_terminal_id,
       ct.caja_id,
       ct.numero_terminal,
       ct.estado,
       ct.servicio_fibra_id,
       sf.alfanumerico_equipo,
       c.id AS cliente_id,
       c.numero_cliente,
       c.nombres,
       c.apellido_paterno,
       c.apellido_materno,
       c.telefono,
       p.nombre AS paquete_nombre,
       ct.observaciones,
       ct.creado_en,
       ct.actualizado_en
     FROM caja_terminales ct
     LEFT JOIN servicios_fibra sf ON sf.id = ct.servicio_fibra_id
     LEFT JOIN clientes c ON c.id = sf.cliente_id
     LEFT JOIN paquetes p ON p.id = sf.paquete_id
     WHERE ct.caja_id = ?
     ORDER BY ct.numero_terminal`
  ).bind(cajaId).all()
  return results ?? []
}

async function getTerminalWithCaja(env, terminalId) {
  return env.DB.prepare(
    `SELECT
       ct.id,
       ct.caja_id,
       ct.numero_terminal,
       ct.estado,
       ct.servicio_fibra_id,
       cf.comunidad_id
     FROM caja_terminales ct
     JOIN cajas_fibra cf ON cf.id = ct.caja_id
     WHERE ct.id = ?`
  ).bind(terminalId).first()
}

async function getServicioForLink(env, servicioFibraId) {
  return env.DB.prepare(
    `SELECT
       sf.id AS servicio_fibra_id,
       sf.caja_id,
       sf.caja_terminal_id,
       sf.estado_servicio,
       c.comunidad_id
     FROM servicios_fibra sf
     JOIN clientes c ON c.id = sf.cliente_id
     WHERE sf.id = ? AND sf.estado_servicio = 'ACTIVO'`
  ).bind(servicioFibraId).first()
}

function normalizeTerminalEstado(value) {
  const estado = String(value ?? '').trim().toUpperCase()
  if (estado === 'DA\u00d1ADO' || estado === 'DA\u00c3\u2018ADO' || estado === 'DA\u00c3\u0192\u00e2\u20ac\u02dcADO') return 'DA\u00d1ADO'
  return estado
}
function validateKmlFile(file) {
  if (!file || typeof file.text !== 'function') return { response: json({ ok: false, error: 'Archivo KML obligatorio' }, 400) }
  const fileName = String(file.name ?? '').toLowerCase()
  if (fileName.endsWith('.kmz')) return { response: json({ ok: false, error: 'Por ahora solo se admite archivo .kml' }, 400) }
  if (!fileName.endsWith('.kml')) return { response: json({ ok: false, error: 'Selecciona un archivo .kml' }, 400) }
  return {}
}

function parseKmlPlacemarks(kmlText) {
  const placemarks = [...String(kmlText ?? '').matchAll(/<Placemark\b[\s\S]*?<\/Placemark>/gi)]
  const detected = []
  const ignored = []

  for (const match of placemarks) {
    const placemark = match[0]
    if (/<LineString\b|<Polygon\b|<MultiGeometry\b/i.test(placemark)) {
      ignored.push({ nombre: extractTagText(placemark, 'name') || 'Sin nombre', reason: 'No es punto de caja u OLT' })
      continue
    }

    const nombreOriginal = decodeXml(extractTagText(placemark, 'name') || '')
    const coords = extractCoordinates(placemark)
    if (!coords) {
      ignored.push({ nombre: nombreOriginal || 'Sin nombre', reason: 'Sin coordenadas validas' })
      continue
    }

    const cajaMatch = nombreOriginal.match(/pon\s*(\d+)\s*caja\s*(\d+)/i)
    if (cajaMatch) {
      const pon = Number(cajaMatch[1])
      const numeroCaja = Number(cajaMatch[2])
      const codigoCaja = generateCajaCode(pon, numeroCaja)
      if (!codigoCaja) {
        ignored.push({ nombre: nombreOriginal, reason: 'PON fuera de rango' })
        continue
      }
      detected.push({
        tipo: 'CAJA',
        nombre_original_kml: nombreOriginal,
        nombre: `CAJA ${codigoCaja}`,
        pon,
        numero_caja: numeroCaja,
        codigo_caja: codigoCaja,
        latitud: coords.latitud,
        longitud: coords.longitud,
      })
      continue
    }

    if (/olt/i.test(nombreOriginal)) {
      detected.push({
        tipo: 'OLT',
        nombre_original_kml: nombreOriginal,
        nombre: normalizeUpper(nombreOriginal || 'OLT'),
        pon: null,
        numero_caja: null,
        codigo_caja: null,
        latitud: coords.latitud,
        longitud: coords.longitud,
      })
      continue
    }

    ignored.push({ nombre: nombreOriginal || 'Sin nombre', reason: 'No es punto de caja u OLT' })
  }

  return { detected, ignored }
}

function extractCoordinates(placemark) {
  const raw = extractTagText(placemark, 'coordinates')
  if (!raw) return null
  const first = raw.trim().split(/\s+/)[0]
  const [lng, lat] = first.split(',').map(Number)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { latitud: lat, longitud: lng }
}

function extractTagText(source, tagName) {
  const match = String(source).match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'))
  return match ? match[1].trim() : ''
}

function generateCajaCode(pon, numeroCaja) {
  if (!Number.isInteger(pon) || !Number.isInteger(numeroCaja) || pon < 1 || pon > 26 || numeroCaja < 1) return null
  return `${String.fromCharCode(64 + pon)}${numeroCaja}`
}

function parseCoordinate(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeUpper(value) {
  return String(value ?? '').trim().toUpperCase()
}

function nullableUpper(value) {
  const text = normalizeUpper(value)
  return text || null
}

function nullableText(value) {
  const text = String(value ?? '').trim()
  return text || null
}

function decodeXml(value) {
  return String(value ?? '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
}
