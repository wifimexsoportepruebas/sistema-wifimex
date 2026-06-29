import { json } from '../utils/response.js'
import { requireAuth } from '../utils/auth.js'

export async function listProspectos(request, env, url) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const search = String(url.searchParams.get('search') ?? '').trim()
  const comunidadId = url.searchParams.get('comunidad_id')
  const conversion = String(url.searchParams.get('conversion') ?? 'no_convertidos').trim().toLowerCase()
  const filters = []
  const values = []

  if (comunidadId) {
    filters.push('p.comunidad_id = ?')
    values.push(Number(comunidadId))
  }

  if (conversion === 'convertidos') {
    filters.push('c.id IS NOT NULL')
  } else if (conversion !== 'todos') {
    filters.push('c.id IS NULL')
  }

  if (search) {
    filters.push(`(
      p.nombres LIKE ?
      OR p.apellido_paterno LIKE ?
      OR p.apellido_materno LIKE ?
      OR p.telefono LIKE ?
      OR co.nombre LIKE ?
      OR c.numero_cliente LIKE ?
    )`)
    values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
  const statement = env.DB.prepare(
    `SELECT
       p.id,
       p.nombres,
       p.apellido_paterno,
       p.apellido_materno,
       p.telefono,
       p.direccion,
       p.referencia,
       p.comunidad_id,
       p.paquete_interes_id,
       p.fecha_registro,
       co.nombre AS comunidad_nombre,
       pq.nombre AS paquete_nombre,
       pq.precio_mensual AS paquete_precio,
       c.id AS cliente_id,
       c.numero_cliente
     FROM prospectos p
     JOIN comunidades co ON co.id = p.comunidad_id
     LEFT JOIN paquetes pq ON pq.id = p.paquete_interes_id
     LEFT JOIN clientes c ON c.prospecto_id = p.id
     ${where}
     ORDER BY p.fecha_registro DESC, p.id DESC
     LIMIT 200`
  )
  const { results } = values.length ? await statement.bind(...values).all() : await statement.all()
  return json({ prospectos: results })
}

export async function listProspectosDisponibles(request, env, url) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const search = String(url.searchParams.get('q') ?? url.searchParams.get('search') ?? '').trim()
  const comunidadId = url.searchParams.get('comunidad_id')
  const filters = [
    'clientes.id IS NULL',
    'reporte_activo.id IS NULL',
  ]
  const values = []

  if (comunidadId) {
    filters.push('prospectos.comunidad_id = ?')
    values.push(Number(comunidadId))
  }

  if (search) {
    filters.push(`(
      prospectos.nombres LIKE ?
      OR prospectos.apellido_paterno LIKE ?
      OR prospectos.apellido_materno LIKE ?
      OR prospectos.telefono LIKE ?
      OR comunidades.nombre LIKE ?
    )`)
    values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
  }

  const statement = env.DB.prepare(
    `SELECT
       prospectos.id,
       prospectos.nombres,
       prospectos.apellido_paterno,
       prospectos.apellido_materno,
       prospectos.telefono,
       prospectos.direccion,
       prospectos.referencia,
       prospectos.comunidad_id,
       prospectos.paquete_interes_id,
       prospectos.comentario,
       prospectos.fecha_registro,
       comunidades.nombre AS comunidad_nombre,
       paquetes.nombre AS paquete_nombre,
       paquetes.precio_mensual AS paquete_precio
     FROM prospectos
     JOIN comunidades ON comunidades.id = prospectos.comunidad_id
     LEFT JOIN paquetes ON paquetes.id = prospectos.paquete_interes_id
     LEFT JOIN clientes ON clientes.prospecto_id = prospectos.id
     LEFT JOIN reportes reporte_activo ON reporte_activo.prospecto_id = prospectos.id
       AND reporte_activo.tipo_reporte = 'INSTALACION'
       AND reporte_activo.estado IN ('PENDIENTE', 'ASIGNADO', 'EN_PROCESO', 'PENDIENTE_CONFIRMACION')
     WHERE ${filters.join(' AND ')}
     ORDER BY prospectos.fecha_registro DESC, prospectos.id DESC
     LIMIT 50`
  )
  const { results } = values.length ? await statement.bind(...values).all() : await statement.all()
  return json({ prospectos: results })
}

export async function createProspecto(request, env) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return json({ ok: false, error: 'No tienes permiso para registrar prospectos.' }, 403)

  const body = await request.json().catch(() => null)
  const validation = await validateProspecto(env, body)
  if (validation.error) return json({ ok: false, error: validation.error }, 400)

  await env.DB.prepare(
    `INSERT INTO prospectos (
       nombres, apellido_paterno, apellido_materno, telefono, direccion,
       referencia, comunidad_id, paquete_interes_id, comentario
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    validation.data.nombres,
    validation.data.apellido_paterno,
    validation.data.apellido_materno,
    validation.data.telefono,
    validation.data.direccion,
    validation.data.referencia,
    validation.data.comunidad_id,
    validation.data.paquete_interes_id,
    null
  ).run()

  return json({ ok: true }, 201)
}

export async function updateProspecto(request, env, prospectoId) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return json({ ok: false, error: 'No tienes permiso para registrar prospectos.' }, 403)

  const body = await request.json().catch(() => null)
  const validation = await validateProspecto(env, body)
  if (validation.error) return json({ ok: false, error: validation.error }, 400)

  await env.DB.prepare(
    `UPDATE prospectos
     SET nombres = ?, apellido_paterno = ?, apellido_materno = ?, telefono = ?,
         direccion = ?, referencia = ?, comunidad_id = ?, paquete_interes_id = ?
     WHERE id = ?`
  ).bind(
    validation.data.nombres,
    validation.data.apellido_paterno,
    validation.data.apellido_materno,
    validation.data.telefono,
    validation.data.direccion,
    validation.data.referencia,
    validation.data.comunidad_id,
    validation.data.paquete_interes_id,
    prospectoId
  ).run()

  return json({ ok: true })
}

export async function deleteProspecto(request, env, prospectoId) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE'])
  if (auth.response) return auth.response

  await env.DB.prepare('DELETE FROM prospectos WHERE id = ?').bind(prospectoId).run()
  return json({ ok: true })
}

export async function validateProspecto(env, body) {
  const data = {
    nombres: normalizeUpper(body?.nombres),
    apellido_paterno: nullableUpper(body?.apellido_paterno),
    apellido_materno: nullableUpper(body?.apellido_materno),
    telefono: String(body?.telefono ?? '').trim(),
    direccion: nullableUpper(body?.direccion),
    referencia: nullableUpper(body?.referencia),
    comunidad_id: Number(body?.comunidad_id),
    paquete_interes_id: body?.paquete_interes_id ? Number(body.paquete_interes_id) : null,
    comentario: null,
  }

  if (!data.nombres || !data.telefono || !data.comunidad_id) {
    return { error: 'Nombres, telefono y comunidad son obligatorios' }
  }

  if (!/^\d{10}$/.test(data.telefono)) {
    return { error: 'El telefono debe tener exactamente 10 digitos.' }
  }

  if (data.paquete_interes_id) {
    const paquete = await env.DB.prepare(
      'SELECT id FROM paquetes WHERE id = ? AND comunidad_id = ? AND activo = 1'
    ).bind(data.paquete_interes_id, data.comunidad_id).first()
    if (!paquete) return { error: 'El paquete seleccionado no pertenece a la comunidad.' }
  }

  return { data }
}

function normalizeUpper(value) {
  return String(value ?? '').trim().toUpperCase()
}

function nullableUpper(value) {
  const text = normalizeUpper(value)
  return text || null
}
