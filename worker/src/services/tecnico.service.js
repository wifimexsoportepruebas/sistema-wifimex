import { requireAuth } from '../utils/auth.js'
import { todayDate } from '../utils/dates.js'
import { json } from '../utils/response.js'
import { insertReporteSeguimiento } from './reportes.service.js'

export async function listReportesTecnicoHoy(request, env) {
  const auth = await requireAuth(request, env, ['TECNICO', 'TECNICO_FIBRA'])
  if (auth.response) return auth.response

  const fecha = todayDate()
  const { results } = await env.DB.prepare(
    `SELECT
       reportes.id, reportes.fecha_reportada, reportes.fecha_programada,
       reportes.tipo_reporte, reportes.comentario, reportes.estado,
       reportes.prioridad, reportes.orden_ruta,
       comunidades.id AS comunidad_id,
       comunidades.nombre AS comunidad_nombre,
       clientes.numero_cliente,
       trim(clientes.nombres || ' ' || COALESCE(clientes.apellido_paterno, '') || ' ' || COALESCE(clientes.apellido_materno, '')) AS cliente_nombre,
       clientes.telefono AS cliente_telefono,
       clientes.direccion AS cliente_direccion,
       trim(prospectos.nombres || ' ' || COALESCE(prospectos.apellido_paterno, '') || ' ' || COALESCE(prospectos.apellido_materno, '')) AS prospecto_nombre,
       prospectos.telefono AS prospecto_telefono,
       prospectos.direccion AS prospecto_direccion
     FROM reportes
     JOIN comunidades ON comunidades.id = reportes.comunidad_id
     LEFT JOIN clientes ON clientes.id = reportes.cliente_id
     LEFT JOIN prospectos ON prospectos.id = reportes.prospecto_id
     WHERE reportes.tecnico_id = ?
       AND substr(reportes.fecha_programada, 1, 10) = ?
       AND reportes.estado IN ('ASIGNADO', 'EN_PROCESO', 'PENDIENTE_CONFIRMACION', 'NO_LOCALIZADO')
     ORDER BY
       CASE reportes.estado
         WHEN 'EN_PROCESO' THEN 1
         WHEN 'ASIGNADO' THEN 2
         WHEN 'PENDIENTE_CONFIRMACION' THEN 3
         WHEN 'NO_LOCALIZADO' THEN 4
         ELSE 5
       END,
       CASE WHEN reportes.orden_ruta IS NULL THEN 1 ELSE 0 END,
       reportes.orden_ruta ASC,
       CASE reportes.prioridad WHEN 'URGENTE' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'NORMAL' THEN 3 WHEN 'BAJA' THEN 4 ELSE 5 END,
       reportes.id ASC`
  ).bind(auth.session.usuario_id, fecha).all()

  return json({ ok: true, fecha, reportes: results ?? [] })
}

export async function iniciarReporteTecnico(request, env, reporteId) {
  const auth = await requireAuth(request, env, ['TECNICO', 'TECNICO_FIBRA'])
  if (auth.response) return auth.response

  const reporte = await getReporteTecnico(env, reporteId, auth.session.usuario_id)
  if (!reporte) return json({ ok: false, error: 'Reporte no encontrado para este tecnico' }, 404)
  if (reporte.estado !== 'ASIGNADO') return json({ ok: false, error: 'Solo puedes iniciar reportes asignados' }, 400)

  const enProceso = await env.DB.prepare(
    `SELECT id
     FROM reportes
     WHERE tecnico_id = ? AND estado = 'EN_PROCESO' AND id <> ?
     LIMIT 1`
  ).bind(auth.session.usuario_id, reporteId).first()
  if (enProceso) {
    return json({ ok: false, error: 'Ya tienes un reporte en proceso. Finalizalo antes de iniciar otro.' }, 400)
  }

  await env.DB.prepare("UPDATE reportes SET estado = 'EN_PROCESO' WHERE id = ?").bind(reporteId).run()
  await insertReporteSeguimiento(env, reporteId, auth.session.usuario_id, 'EN_PROCESO', 'TECNICO INICIO ATENCION')

  return json({ ok: true })
}

export async function noEncontradoReporteTecnico(request, env, reporteId) {
  const auth = await requireAuth(request, env, ['TECNICO', 'TECNICO_FIBRA'])
  if (auth.response) return auth.response

  const reporte = await getReporteTecnico(env, reporteId, auth.session.usuario_id)
  if (!reporte) return json({ ok: false, error: 'Reporte no encontrado para este tecnico' }, 404)
  if (!['ASIGNADO', 'EN_PROCESO'].includes(reporte.estado)) return json({ ok: false, error: 'Este reporte ya no puede marcarse como no localizado' }, 400)

  await env.DB.prepare(
    "UPDATE reportes SET estado = 'NO_LOCALIZADO', comentario_cierre = NULL WHERE id = ?"
  ).bind(reporteId).run()
  await insertReporteSeguimiento(env, reporteId, auth.session.usuario_id, 'NO_LOCALIZADO', 'NO SE ENCONTRO AL CLIENTE')

  return json({ ok: true })
}

export async function getInstalacionReporteTecnico(request, env, reporteId) {
  const auth = await requireAuth(request, env, ['TECNICO', 'TECNICO_FIBRA'])
  if (auth.response) return auth.response

  const reporte = await getReporteTecnico(env, reporteId, auth.session.usuario_id)
  if (!reporte) return json({ ok: false, error: 'Reporte no encontrado para este tecnico' }, 404)
  if (reporte.tipo_reporte !== 'INSTALACION') return json({ ok: false, error: 'Este reporte no es una instalacion' }, 400)

  const instalacion = await getInstalacionByReporte(env, reporteId)
  const paquetes = await getPaquetesComunidad(env, reporte.comunidad_id)
  const paqueteDefaultId = instalacion?.paquete_instalacion_id ?? reporte.paquete_interes_id ?? null

  return json({
    ok: true,
    paquete_default_id: paqueteDefaultId,
    paquetes,
    prospecto: {
      nombres: reporte.prospecto_nombres,
      apellido_paterno: reporte.prospecto_apellido_paterno,
      apellido_materno: reporte.prospecto_apellido_materno,
      telefono: reporte.prospecto_telefono,
      direccion: reporte.prospecto_direccion,
      referencia: reporte.prospecto_referencia,
      paquete_interes_id: reporte.paquete_interes_id,
    },
    instalacion,
  })
}

export async function solicitarCierreReporteTecnico(request, env, reporteId) {
  const auth = await requireAuth(request, env, ['TECNICO', 'TECNICO_FIBRA'])
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  const solucion = String(body?.solucion ?? body?.comentario ?? '').trim().toUpperCase()
  if (!solucion) return json({ ok: false, error: 'La solucion es obligatoria' }, 400)

  const reporte = await getReporteTecnico(env, reporteId, auth.session.usuario_id)
  if (!reporte) return json({ ok: false, error: 'Reporte no encontrado para este tecnico' }, 404)
  if (reporte.estado !== 'EN_PROCESO') return json({ ok: false, error: 'Solo puedes solicitar cierre de reportes en proceso' }, 400)

  if (reporte.tipo_reporte === 'INSTALACION') {
    const validation = await validateInstalacionPayload(env, body, reporte)
    if (validation.response) return validation.response

    await saveInstalacionFibra(env, reporte, auth.session.usuario_id, validation.data, solucion)
  }

  await env.DB.prepare(
    `UPDATE reportes
     SET estado = 'PENDIENTE_CONFIRMACION',
         comentario_cierre = ?
     WHERE id = ?`
  ).bind(solucion, reporteId).run()
  await insertReporteSeguimiento(env, reporteId, auth.session.usuario_id, 'PENDIENTE_CONFIRMACION', solucion)

  return json({ ok: true })
}

async function getReporteTecnico(env, reporteId, usuarioId) {
  return env.DB.prepare(
    `SELECT
       reportes.id, reportes.estado, reportes.tecnico_id, reportes.tipo_reporte,
       reportes.prospecto_id, reportes.cliente_id, reportes.comunidad_id,
       prospectos.paquete_interes_id,
       prospectos.nombres AS prospecto_nombres,
       prospectos.apellido_paterno AS prospecto_apellido_paterno,
       prospectos.apellido_materno AS prospecto_apellido_materno,
       prospectos.telefono AS prospecto_telefono,
       prospectos.direccion AS prospecto_direccion,
       prospectos.referencia AS prospecto_referencia
     FROM reportes
     LEFT JOIN prospectos ON prospectos.id = reportes.prospecto_id
     WHERE reportes.id = ? AND reportes.tecnico_id = ?`
  ).bind(reporteId, usuarioId).first()
}

async function getInstalacionByReporte(env, reporteId) {
  return env.DB.prepare(
    `SELECT
       instalaciones_fibra.id,
       instalaciones_fibra.reporte_id,
       instalaciones_fibra.prospecto_id,
       instalaciones_fibra.cliente_id,
       instalaciones_fibra.servicio_fibra_id,
       instalaciones_fibra.comunidad_id,
       instalaciones_fibra.tecnico_id,
       instalaciones_fibra.paquete_instalacion_id,
       instalaciones_fibra.alfanumerico_equipo,
       instalaciones_fibra.fibra_optica_metros,
       instalaciones_fibra.tensor_gancho,
       instalaciones_fibra.argollas,
       instalaciones_fibra.taquetes,
       instalaciones_fibra.sujetadores,
       instalaciones_fibra.roseta,
       instalaciones_fibra.terminal,
       instalaciones_fibra.puerto,
       instalaciones_fibra.potencia,
       instalaciones_fibra.firma_cliente_base64,
       instalaciones_fibra.caja_id,
       instalaciones_fibra.caja_terminal_id,
       cajas_fibra.codigo_caja,
       cajas_fibra.nombre AS caja_nombre,
       caja_terminales.numero_terminal AS caja_terminal_numero,
       instalaciones_fibra.firma_tecnico_base64,
       instalaciones_fibra.foto_router_r2_key,
       instalaciones_fibra.foto_router_content_type,
       instalaciones_fibra.titular_nombres,
       instalaciones_fibra.titular_apellido_paterno,
       instalaciones_fibra.titular_apellido_materno,
       instalaciones_fibra.titular_telefono,
       instalaciones_fibra.titular_direccion,
       instalaciones_fibra.titular_referencia,
       instalaciones_fibra.comentario_tecnico,
       instalaciones_fibra.fecha_instalacion,
       instalaciones_fibra.creado_en
     FROM instalaciones_fibra
     LEFT JOIN cajas_fibra ON cajas_fibra.id = instalaciones_fibra.caja_id
     LEFT JOIN caja_terminales ON caja_terminales.id = instalaciones_fibra.caja_terminal_id
     WHERE instalaciones_fibra.reporte_id = ?
     ORDER BY instalaciones_fibra.id DESC
     LIMIT 1`
  ).bind(reporteId).first()
}

async function getPaquetesComunidad(env, comunidadId) {
  const { results } = await env.DB.prepare(
    `SELECT id, comunidad_id, nombre, velocidad_megas, precio_mensual
     FROM paquetes
     WHERE comunidad_id = ? AND activo = 1
     ORDER BY precio_mensual ASC, nombre ASC`
  ).bind(comunidadId).all()
  return results ?? []
}

async function saveInstalacionFibra(env, reporte, usuarioId, data, solucion) {
  const photoInfo = data.foto_router_base64
    ? await saveRouterPhoto(env, reporte, data.foto_router_base64)
    : null

  const existing = await env.DB.prepare(
    `SELECT instalaciones_fibra.id, instalaciones_fibra.caja_terminal_id
     FROM instalaciones_fibra
     WHERE instalaciones_fibra.reporte_id = ?
     ORDER BY instalaciones_fibra.id DESC
     LIMIT 1`
  ).bind(reporte.id).first()

  if (existing) {
    await env.DB.prepare(
      `UPDATE instalaciones_fibra
       SET prospecto_id = ?,
           cliente_id = ?,
           comunidad_id = ?,
           tecnico_id = ?,
           titular_nombres = ?,
           titular_apellido_paterno = ?,
           titular_apellido_materno = ?,
           titular_telefono = ?,
           titular_direccion = ?,
           titular_referencia = ?,
           paquete_instalacion_id = ?,
           alfanumerico_equipo = ?,
           fibra_optica_metros = ?,
           tensor_gancho = ?,
           argollas = ?,
           taquetes = ?,
           sujetadores = ?,
           roseta = ?,
           terminal = ?,
           puerto = ?,
           caja_id = ?,
           caja_terminal_id = ?,
           potencia = ?,
           firma_cliente_base64 = ?,
           firma_tecnico_base64 = ?,
           foto_router_r2_key = COALESCE(?, foto_router_r2_key),
           foto_router_content_type = COALESCE(?, foto_router_content_type),
           comentario_tecnico = ?,
           fecha_instalacion = datetime('now')
       WHERE id = ?`
    ).bind(
      reporte.prospecto_id,
      reporte.cliente_id,
      reporte.comunidad_id,
      usuarioId,
      data.titular_nombres,
      data.titular_apellido_paterno,
      data.titular_apellido_materno,
      data.titular_telefono,
      data.titular_direccion,
      data.titular_referencia,
      data.paquete_instalacion_id,
      data.alfanumerico_equipo,
      data.fibra_optica_metros,
      data.tensor_gancho,
      data.argollas,
      data.taquetes,
      data.sujetadores,
      data.roseta,
      data.terminal,
      data.puerto,
      data.caja_id,
      data.caja_terminal_id,
      data.potencia,
      data.firma_cliente_base64,
      data.firma_tecnico_base64,
      photoInfo?.key ?? null,
      photoInfo?.contentType ?? null,
      solucion,
      existing.id
    ).run()
    await reserveInstallationTerminal(env, existing, data)
    return
  }

  await env.DB.prepare(
    `INSERT INTO instalaciones_fibra (
       reporte_id, prospecto_id, cliente_id, servicio_fibra_id, comunidad_id, tecnico_id,
       titular_nombres, titular_apellido_paterno, titular_apellido_materno,
       titular_telefono, titular_direccion, titular_referencia,
       paquete_instalacion_id, alfanumerico_equipo, fibra_optica_metros, tensor_gancho, argollas, taquetes,
       sujetadores, roseta, terminal, puerto, caja_id, caja_terminal_id, potencia, firma_cliente_base64,
       firma_tecnico_base64, foto_router_r2_key, foto_router_content_type, comentario_tecnico
     ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    reporte.id,
    reporte.prospecto_id,
    reporte.cliente_id,
    reporte.comunidad_id,
    usuarioId,
    data.titular_nombres,
    data.titular_apellido_paterno,
    data.titular_apellido_materno,
    data.titular_telefono,
    data.titular_direccion,
    data.titular_referencia,
    data.paquete_instalacion_id,
    data.alfanumerico_equipo,
    data.fibra_optica_metros,
    data.tensor_gancho,
    data.argollas,
    data.taquetes,
    data.sujetadores,
    data.roseta,
    data.terminal,
    data.puerto,
    data.caja_id,
    data.caja_terminal_id,
    data.potencia,
    data.firma_cliente_base64,
    data.firma_tecnico_base64,
    photoInfo?.key ?? null,
    photoInfo?.contentType ?? null,
    solucion
  ).run()
  await reserveInstallationTerminal(env, null, data)
}

async function validateInstalacionPayload(env, body, reporte) {
  const paqueteInstalacionId = body?.paquete_instalacion_id ? Number(body.paquete_instalacion_id) : Number(reporte.paquete_interes_id || 0) || null
  const data = {
    titular_nombres: normalizeUpper(body?.titular_nombres),
    titular_apellido_paterno: nullableUpper(body?.titular_apellido_paterno),
    titular_apellido_materno: nullableUpper(body?.titular_apellido_materno),
    titular_telefono: String(body?.titular_telefono ?? '').trim().replace(/\D/g, ''),
    titular_direccion: normalizeUpper(body?.titular_direccion),
    titular_referencia: nullableUpper(body?.titular_referencia),
    paquete_instalacion_id: paqueteInstalacionId,
    alfanumerico_equipo: String(body?.alfanumerico_equipo ?? '').trim().toUpperCase(),
    fibra_optica_metros: parseNonNegativeNumber(body?.fibra_optica_metros),
    tensor_gancho: parseNonNegativeInteger(body?.tensor_gancho),
    argollas: parseNonNegativeInteger(body?.argollas),
    taquetes: parseNonNegativeInteger(body?.taquetes),
    sujetadores: parseNonNegativeInteger(body?.sujetadores),
    roseta: parseNonNegativeInteger(body?.roseta),
    terminal: null,
    puerto: null,
    caja_id: Number(body?.caja_id),
    caja_terminal_id: Number(body?.caja_terminal_id),
    potencia: Number(body?.potencia),
    firma_cliente_base64: String(body?.firma_cliente_base64 ?? '').trim(),
    firma_tecnico_base64: String(body?.firma_tecnico_base64 ?? '').trim(),
    foto_router_base64: String(body?.foto_router_base64 ?? '').trim(),
  }

  if (!data.titular_nombres) {
    return { response: json({ ok: false, error: 'El nombre del titular es obligatorio' }, 400) }
  }

  if (!data.titular_telefono) {
    return { response: json({ ok: false, error: 'El telefono del titular es obligatorio' }, 400) }
  }

  if (data.titular_telefono.length !== 10) {
    return { response: json({ ok: false, error: 'El telefono del titular debe tener 10 digitos' }, 400) }
  }

  if (!data.titular_direccion) {
    return { response: json({ ok: false, error: 'La direccion del titular es obligatoria' }, 400) }
  }

  if (!Number.isInteger(data.paquete_instalacion_id) || data.paquete_instalacion_id < 1) {
    return { response: json({ ok: false, error: 'Selecciona el paquete final solicitado' }, 400) }
  }

  if (!data.alfanumerico_equipo) {
    return { response: json({ ok: false, error: 'El alfanumerico del equipo es obligatorio' }, 400) }
  }

  if (!/^[A-Z0-9]+$/.test(data.alfanumerico_equipo)) {
    return { response: json({ ok: false, error: 'El alfanumerico solo puede contener letras y numeros' }, 400) }
  }

  const paquete = await env.DB.prepare(
    `SELECT id
     FROM paquetes
     WHERE id = ? AND comunidad_id = ? AND activo = 1`
  ).bind(data.paquete_instalacion_id, reporte.comunidad_id).first()
  if (!paquete) {
    return { response: json({ ok: false, error: 'El paquete final no pertenece a la comunidad del reporte' }, 400) }
  }

  if (!Number.isInteger(data.caja_id) || data.caja_id < 1) {
    return { response: json({ ok: false, error: 'Selecciona una caja de fibra.' }, 400) }
  }

  if (!Number.isInteger(data.caja_terminal_id) || data.caja_terminal_id < 1) {
    return { response: json({ ok: false, error: 'Selecciona una terminal libre.' }, 400) }
  }

  const terminalValidation = await validateCajaTerminalDisponible(env, reporte, data)
  if (terminalValidation.response) return terminalValidation
  data.terminal = String(terminalValidation.terminal.numero_terminal)
  data.puerto = terminalValidation.caja.codigo_caja || terminalValidation.caja.nombre || null

  if (!Number.isFinite(data.potencia) || data.potencia < -30 || data.potencia > -12) {
    return { response: json({ ok: false, error: 'La potencia debe estar entre -12 y -30.' }, 400) }
  }

  for (const field of ['fibra_optica_metros', 'tensor_gancho', 'argollas', 'taquetes', 'sujetadores', 'roseta']) {
    if (data[field] === null) return { response: json({ ok: false, error: 'Los materiales no pueden ser negativos' }, 400) }
  }

  if (!data.firma_cliente_base64.startsWith('data:image/png;base64,')) {
    return { response: json({ ok: false, error: 'Falta la firma del cliente.' }, 400) }
  }

  if (!data.firma_tecnico_base64.startsWith('data:image/png;base64,')) {
    return { response: json({ ok: false, error: 'Falta la firma del tecnico.' }, 400) }
  }

  if (data.foto_router_base64 && !/^data:image\/(webp|jpeg|jpg|png);base64,/.test(data.foto_router_base64)) {
    return { response: json({ ok: false, error: 'La foto del router debe ser una imagen valida' }, 400) }
  }

  return { data }
}

async function validateCajaTerminalDisponible(env, reporte, data) {
  const caja = await env.DB.prepare(
    `SELECT id, comunidad_id, tipo, activo, codigo_caja, nombre
     FROM cajas_fibra
     WHERE id = ?`
  ).bind(data.caja_id).first()
  if (!caja || caja.tipo !== 'CAJA' || !Number(caja.activo)) {
    return { response: json({ ok: false, error: 'La caja seleccionada no esta disponible.' }, 400) }
  }
  if (Number(caja.comunidad_id) !== Number(reporte.comunidad_id)) {
    return { response: json({ ok: false, error: 'La caja no pertenece a la comunidad del reporte.' }, 400) }
  }

  const terminal = await env.DB.prepare(
    `SELECT id, caja_id, numero_terminal, estado, servicio_fibra_id
     FROM caja_terminales
     WHERE id = ?`
  ).bind(data.caja_terminal_id).first()
  if (!terminal || Number(terminal.caja_id) !== Number(data.caja_id)) {
    return { response: json({ ok: false, error: 'La terminal no pertenece a la caja seleccionada.' }, 400) }
  }

  if (terminal.estado === 'LIBRE') return { caja, terminal }

  if (terminal.estado === 'RESERVADO') {
    const ownInstallation = await env.DB.prepare(
      `SELECT id
       FROM instalaciones_fibra
       WHERE reporte_id = ? AND caja_terminal_id = ? AND servicio_fibra_id IS NULL
       LIMIT 1`
    ).bind(reporte.id, data.caja_terminal_id).first()
    if (ownInstallation) return { caja, terminal }
  }

  return { response: json({ ok: false, error: 'Esta terminal ya fue ocupada o reservada. Selecciona otra.' }, 409) }
}

async function reserveInstallationTerminal(env, existing, data) {
  if (existing?.caja_terminal_id && Number(existing.caja_terminal_id) !== Number(data.caja_terminal_id)) {
    await env.DB.prepare(
      `UPDATE caja_terminales
       SET estado = 'LIBRE', servicio_fibra_id = NULL, actualizado_en = datetime('now')
       WHERE id = ? AND estado = 'RESERVADO' AND servicio_fibra_id IS NULL`
    ).bind(existing.caja_terminal_id).run()
  }

  await env.DB.prepare(
    `UPDATE caja_terminales
     SET estado = 'RESERVADO', servicio_fibra_id = NULL, actualizado_en = datetime('now')
     WHERE id = ? AND estado IN ('LIBRE', 'RESERVADO')`
  ).bind(data.caja_terminal_id).run()
}

async function saveRouterPhoto(env, reporte, dataUrl) {
  if (!env.INSTALACIONES_BUCKET) return null

  const match = dataUrl.match(/^data:(image\/(?:webp|jpeg|jpg|png));base64,(.+)$/)
  if (!match) return null

  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const key = `instalaciones/${year}/${month}/comunidad-${reporte.comunidad_id}/reporte-${reporte.id}/router.webp`
  const bytes = base64ToBytes(match[2])
  const contentType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1]

  await env.INSTALACIONES_BUCKET.put(key, bytes, {
    httpMetadata: { contentType },
  })

  return { key, contentType }
}

function base64ToBytes(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function normalizeUpper(value) {
  return String(value ?? '').trim().toUpperCase()
}

function nullableUpper(value) {
  const normalized = normalizeUpper(value)
  return normalized || null
}

function parseNonNegativeNumber(value) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function parseNonNegativeInteger(value) {
  const number = Number(value ?? 0)
  return Number.isInteger(number) && number >= 0 ? number : null
}
