import { requireAuth } from '../utils/auth.js'
import { json } from '../utils/response.js'

// Helper validation functions
function isValidCoordinate(val, min, max) {
  if (val === null || val === undefined || val === '') return true
  const num = Number(val)
  return !isNaN(num) && num >= min && num <= max
}

export async function getComunidadesAdmin(request, env, url) {
  const auth = await requireAuth(request, env, ['ADMIN', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const estado = url.searchParams.get('estado') || 'todas'
  const q = url.searchParams.get('q') || ''

  try {
    // 1. Get summary counts
    const summary = await env.DB.prepare(
      `SELECT 
         COUNT(*) AS total, 
         SUM(CASE WHEN activo = 1 THEN 1 ELSE 0 END) AS activas, 
         SUM(CASE WHEN activo = 0 THEN 1 ELSE 0 END) AS inactivas 
       FROM comunidades`
    ).first()

    const resumen = {
      total: summary?.total ?? 0,
      activas: summary?.activas ?? 0,
      inactivas: summary?.inactivas ?? 0
    }

    // 2. Fetch communities list
    let whereClauses = []
    let params = []

    if (estado === 'activas') {
      whereClauses.push('activo = 1')
    } else if (estado === 'inactivas') {
      whereClauses.push('activo = 0')
    }

    if (q.trim()) {
      whereClauses.push('(UPPER(nombre) LIKE ? OR UPPER(prefijo) LIKE ?)')
      const likeParam = `%${q.trim().toUpperCase()}%`
      params.push(likeParam, likeParam)
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const { results } = await env.DB.prepare(
      `SELECT 
         id,
         nombre,
         prefijo,
         numero_inicial_cliente AS numero_inicial,
         siguiente_numero_cliente AS siguiente_numero,
         vlan,
         olt_ip,
         latitud,
         longitud,
         activo
       FROM comunidades
       ${whereStr}
       ORDER BY 
         CASE WHEN numero_inicial_cliente IS NULL THEN 1 ELSE 0 END,
         numero_inicial_cliente ASC, 
         nombre ASC`
    ).bind(...params).all()

    return json({ ok: true, resumen, comunidades: results || [] })
  } catch (error) {
    return json({ ok: false, error: error.message || 'Error al obtener comunidades' }, 500)
  }
}

export async function getComunidadById(request, env, id) {
  const auth = await requireAuth(request, env, ['ADMIN', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  try {
    const comunidad = await env.DB.prepare(
      `SELECT 
         id,
         nombre,
         prefijo,
         numero_inicial_cliente AS numero_inicial,
         siguiente_numero_cliente AS siguiente_numero,
         vlan,
         olt_ip,
         latitud,
         longitud,
         activo
       FROM comunidades
       WHERE id = ?`
    ).bind(id).first()

    if (!comunidad) {
      return json({ ok: false, error: 'Comunidad no encontrada.' }, 404)
    }

    return json({ ok: true, comunidad })
  } catch (error) {
    return json({ ok: false, error: error.message || 'Error al obtener comunidad' }, 500)
  }
}

export async function crearComunidad(request, env) {
  const auth = await requireAuth(request, env, ['ADMIN', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  try {
    const body = await request.json()
    const nombre = String(body.nombre ?? '').trim().toUpperCase()
    const prefijo = String(body.prefijo ?? '').trim().toUpperCase()
    const numero_inicial = body.numero_inicial !== undefined ? Number(body.numero_inicial) : null
    const siguiente_numero = body.siguiente_numero !== undefined ? Number(body.siguiente_numero) : null
    const latitud = body.latitud !== null && body.latitud !== undefined && body.latitud !== '' ? Number(body.latitud) : null
    const longitud = body.longitud !== null && body.longitud !== undefined && body.longitud !== '' ? Number(body.longitud) : null
    const activo = body.activo !== undefined ? (body.activo ? 1 : 0) : 1
    const vlan = body.vlan !== null && body.vlan !== undefined && body.vlan !== '' ? Number(body.vlan) : null
    const olt_ip = body.olt_ip !== null && body.olt_ip !== undefined && body.olt_ip !== '' ? String(body.olt_ip).trim() : null

    // Validations
    if (!nombre) return json({ ok: false, error: 'El nombre es obligatorio.' }, 400)
    if (!prefijo) return json({ ok: false, error: 'El prefijo es obligatorio.' }, 400)
    if (numero_inicial === null || isNaN(numero_inicial) || numero_inicial < 0) {
      return json({ ok: false, error: 'El número inicial debe ser un entero mayor o igual a 0.' }, 400)
    }
    if (siguiente_numero === null || isNaN(siguiente_numero) || siguiente_numero < numero_inicial) {
      return json({ ok: false, error: 'El siguiente número debe ser mayor o igual al número inicial.' }, 400)
    }
    if (!isValidCoordinate(latitud, -90, 90)) {
      return json({ ok: false, error: 'La latitud debe estar en el rango de -90 a 90.' }, 400)
    }
    if (!isValidCoordinate(longitud, -180, 180)) {
      return json({ ok: false, error: 'La longitud debe estar en el rango de -180 a 180.' }, 400)
    }
    if (vlan !== null && (isNaN(vlan) || !Number.isInteger(vlan) || vlan < 1 || vlan > 4094)) {
      return json({ ok: false, error: 'La VLAN debe ser un número entero entre 1 y 4094.' }, 400)
    }
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    if (olt_ip !== null && !ipv4Regex.test(olt_ip)) {
      return json({ ok: false, error: 'El formato de la IP de la OLT no es una dirección IPv4 válida (ej. 172.18.1.14).' }, 400)
    }

    // Duplicate check globally (rule 8: block duplicates in all communities, active and inactive)
    const duplicateNombre = await env.DB.prepare('SELECT 1 FROM comunidades WHERE UPPER(nombre) = ?').bind(nombre).first()
    if (duplicateNombre) {
      return json({ ok: false, error: `Ya existe una comunidad con el nombre "${nombre}".` }, 400)
    }

    const duplicatePrefijo = await env.DB.prepare('SELECT 1 FROM comunidades WHERE UPPER(prefijo) = ?').bind(prefijo).first()
    if (duplicatePrefijo) {
      return json({ ok: false, error: `Ya existe una comunidad con el prefijo "${prefijo}".` }, 400)
    }

    const result = await env.DB.prepare(
      `INSERT INTO comunidades (nombre, prefijo, numero_inicial_cliente, siguiente_numero_cliente, latitud, longitud, activo, vlan, olt_ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(nombre, prefijo, numero_inicial, siguiente_numero, latitud, longitud, activo, vlan, olt_ip).run()

    return json({
      ok: true,
      id: result.meta.last_row_id || null,
      message: 'Comunidad creada correctamente.'
    }, 21)
  } catch (error) {
    return json({ ok: false, error: error.message || 'Error al crear comunidad' }, 500)
  }
}

export async function editarComunidad(request, env, id) {
  const auth = await requireAuth(request, env, ['ADMIN', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  try {
    const body = await request.json()
    
    // Check existence
    const exists = await env.DB.prepare('SELECT 1 FROM comunidades WHERE id = ?').bind(id).first()
    if (!exists) return json({ ok: false, error: 'Comunidad no encontrada.' }, 404)

    const nombre = String(body.nombre ?? '').trim().toUpperCase()
    const prefijo = String(body.prefijo ?? '').trim().toUpperCase()
    const numero_inicial = body.numero_inicial !== undefined ? Number(body.numero_inicial) : null
    const siguiente_numero = body.siguiente_numero !== undefined ? Number(body.siguiente_numero) : null
    const latitud = body.latitud !== null && body.latitud !== undefined && body.latitud !== '' ? Number(body.latitud) : null
    const longitud = body.longitud !== null && body.longitud !== undefined && body.longitud !== '' ? Number(body.longitud) : null
    const activo = body.activo !== undefined ? (body.activo ? 1 : 0) : 1
    const vlan = body.vlan !== null && body.vlan !== undefined && body.vlan !== '' ? Number(body.vlan) : null
    const olt_ip = body.olt_ip !== null && body.olt_ip !== undefined && body.olt_ip !== '' ? String(body.olt_ip).trim() : null

    // Validations
    if (!nombre) return json({ ok: false, error: 'El nombre es obligatorio.' }, 400)
    if (!prefijo) return json({ ok: false, error: 'El prefijo es obligatorio.' }, 400)
    if (numero_inicial === null || isNaN(numero_inicial) || numero_inicial < 0) {
      return json({ ok: false, error: 'El número inicial debe ser un entero mayor o igual a 0.' }, 400)
    }
    if (siguiente_numero === null || isNaN(siguiente_numero) || siguiente_numero < numero_inicial) {
      return json({ ok: false, error: 'El siguiente número debe ser mayor o igual al número inicial.' }, 400)
    }
    if (!isValidCoordinate(latitud, -90, 90)) {
      return json({ ok: false, error: 'La latitud debe estar en el rango de -90 a 90.' }, 400)
    }
    if (!isValidCoordinate(longitud, -180, 180)) {
      return json({ ok: false, error: 'La longitud debe estar en el rango de -180 a 180.' }, 400)
    }
    if (vlan !== null && (isNaN(vlan) || !Number.isInteger(vlan) || vlan < 1 || vlan > 4094)) {
      return json({ ok: false, error: 'La VLAN debe ser un número entero entre 1 y 4094.' }, 400)
    }
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    if (olt_ip !== null && !ipv4Regex.test(olt_ip)) {
      return json({ ok: false, error: 'El formato de la IP de la OLT no es una dirección IPv4 válida (ej. 172.18.1.14).' }, 400)
    }

    // Duplicate check globally excluding the current community ID
    const duplicateNombre = await env.DB.prepare('SELECT 1 FROM comunidades WHERE UPPER(nombre) = ? AND id != ?').bind(nombre, id).first()
    if (duplicateNombre) {
      return json({ ok: false, error: `Ya existe otra comunidad con el nombre "${nombre}".` }, 400)
    }

    const duplicatePrefijo = await env.DB.prepare('SELECT 1 FROM comunidades WHERE UPPER(prefijo) = ? AND id != ?').bind(prefijo, id).first()
    if (duplicatePrefijo) {
      return json({ ok: false, error: `Ya existe otra comunidad con el prefijo "${prefijo}".` }, 400)
    }

    await env.DB.prepare(
      `UPDATE comunidades 
       SET nombre = ?, prefijo = ?, numero_inicial_cliente = ?, siguiente_numero_cliente = ?, latitud = ?, longitud = ?, activo = ?, vlan = ?, olt_ip = ?
       WHERE id = ?`
    ).bind(nombre, prefijo, numero_inicial, siguiente_numero, latitud, longitud, activo, vlan, olt_ip, id).run()

    return json({ ok: true, message: 'Comunidad actualizada correctamente.' })
  } catch (error) {
    return json({ ok: false, error: error.message || 'Error al editar comunidad' }, 500)
  }
}

export async function toggleComunidadEstado(request, env, id) {
  const auth = await requireAuth(request, env, ['ADMIN', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  try {
    const body = await request.json()
    const activo = body.activo ? 1 : 0

    const exists = await env.DB.prepare('SELECT 1 FROM comunidades WHERE id = ?').bind(id).first()
    if (!exists) return json({ ok: false, error: 'Comunidad no encontrada.' }, 404)

    await env.DB.prepare('UPDATE comunidades SET activo = ? WHERE id = ?').bind(activo, id).run()

    const message = activo === 1 
      ? 'Comunidad reactivada correctamente.' 
      : 'Comunidad desactivada correctamente.'

    return json({ ok: true, message })
  } catch (error) {
    return json({ ok: false, error: error.message || 'Error al cambiar estado' }, 500)
  }
}
