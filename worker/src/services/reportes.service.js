import { json } from '../utils/response.js'
import { requireAuth } from '../utils/auth.js'
import { addFilter } from '../utils/validators.js'
import { todayDate } from '../utils/dates.js'
import { generarContratoParaInstalacion, validarContratoInstalacionDisponible } from './contratos.service.js'

const INSTALLATION_CONFIRMED_COMMENT = 'INSTALACION CONFIRMADA. PROSPECTO CONVERTIDO A CLIENTE Y SERVICIO ACTIVO.'

export async function getRutaReportes(request, env, url) {
  const auth = await requireAuth(request, env, ['ADMIN'])
  if (auth.response) return auth.response

  const fechaParam = url.searchParams.get('fecha_programada') || url.searchParams.get('fecha') || 'todas'
  const tecnicoParam = url.searchParams.get('tecnico_id') || 'todos'
  const comunidadParam = url.searchParams.get('comunidad_id')
  const estadoParam = url.searchParams.get('estado') || 'activos'
  const tipoParam = url.searchParams.get('tipo_reporte')
  const filters = []
  const values = []

  if (fechaParam !== 'todas' && fechaParam !== 'sin_fecha') {
    filters.push('substr(reportes.fecha_programada, 1, 10) = ?')
    values.push(fechaParam)
  } else if (fechaParam === 'sin_fecha') {
    filters.push('(reportes.fecha_programada IS NULL OR reportes.fecha_programada = "" OR reportes.fecha_programada LIKE "0001%")')
  }

  if (tecnicoParam === 'sin_asignar') {
    filters.push('reportes.tecnico_id IS NULL')
  } else if (tecnicoParam !== 'todos') {
    filters.push('reportes.tecnico_id = ?')
    values.push(Number(tecnicoParam))
  }

  addFilter(filters, values, 'reportes.comunidad_id = ?', comunidadParam)
  if (estadoParam === 'activos') {
    filters.push("reportes.estado NOT IN ('CANCELADO', 'COMPLETADO')")
  } else if (estadoParam && estadoParam !== 'todos') {
    addFilter(filters, values, 'reportes.estado = ?', estadoParam)
  }
  addFilter(filters, values, 'reportes.tipo_reporte = ?', tipoParam)

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''

  const statement = env.DB.prepare(
    `SELECT
       reportes.id, reportes.fecha_reportada, reportes.fecha_programada, reportes.tipo_reporte,
       reportes.comentario, reportes.estado, reportes.prioridad, reportes.orden_ruta,
       comunidades.id AS comunidad_id, comunidades.nombre AS comunidad_nombre, comunidades.latitud, comunidades.longitud,
       clientes.numero_cliente,
       trim(clientes.nombres || ' ' || COALESCE(clientes.apellido_paterno, '') || ' ' || COALESCE(clientes.apellido_materno, '')) AS cliente_nombre,
       clientes.telefono AS cliente_telefono,
       trim(prospectos.nombres || ' ' || COALESCE(prospectos.apellido_paterno, '') || ' ' || COALESCE(prospectos.apellido_materno, '')) AS prospecto_nombre,
       prospectos.telefono AS prospecto_telefono,
       tecnico.id AS tecnico_id,
       trim(tecnico.nombres || ' ' || COALESCE(tecnico.apellido_paterno, '') || ' ' || COALESCE(tecnico.apellido_materno, '')) AS tecnico_nombre
     FROM reportes
     JOIN comunidades ON comunidades.id = reportes.comunidad_id
     LEFT JOIN clientes ON clientes.id = reportes.cliente_id
     LEFT JOIN prospectos ON prospectos.id = reportes.prospecto_id
     LEFT JOIN usuarios tecnico ON tecnico.id = reportes.tecnico_id
     ${where}
     ORDER BY
       tecnico_nombre ASC,
       CASE WHEN reportes.orden_ruta IS NULL THEN 1 ELSE 0 END,
       reportes.orden_ruta ASC,
       CASE reportes.prioridad WHEN 'URGENTE' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'NORMAL' THEN 3 WHEN 'BAJA' THEN 4 ELSE 5 END,
       comunidades.nombre ASC, reportes.fecha_reportada ASC, reportes.id ASC`
  )
  const { results } = values.length ? await statement.bind(...values).all() : await statement.all()

  const tecnicosMap = new Map()
  const sinTecnicoMap = new Map()
  const sinCoordenadas = []

  for (const row of results || []) {
    const rawFecha = row.fecha_programada ? String(row.fecha_programada).slice(0, 10) : ''
    const isSinFecha = !rawFecha || rawFecha.startsWith('0001') || rawFecha === 'null'
    const reporteItem = {
      id: row.id,
      fecha_reportada: row.fecha_reportada,
      fecha_programada: isSinFecha ? null : rawFecha,
      tipo_reporte: row.tipo_reporte,
      comentario: row.comentario,
      estado: row.estado,
      prioridad: row.prioridad,
      orden_ruta: row.orden_ruta,
      cliente_nombre: row.cliente_nombre,
      numero_cliente: row.numero_cliente,
      cliente_telefono: row.cliente_telefono,
      prospecto_nombre: row.prospecto_nombre,
      prospecto_telefono: row.prospecto_telefono,
      tecnico_id: row.tecnico_id,
      tecnico_nombre: row.tecnico_nombre,
      comunidad_id: row.comunidad_id,
      comunidad_nombre: row.comunidad_nombre,
    }

    const coords = normalizeCoords(row.latitud, row.longitud)
    if (!coords) {
      sinCoordenadas.push(reporteItem)
      continue
    }

    if (!row.tecnico_id) {
      addReporteToCommunityMap(sinTecnicoMap, row, coords, reporteItem)
      continue
    }

    if (!tecnicosMap.has(row.tecnico_id)) {
      tecnicosMap.set(row.tecnico_id, {
        tecnico_id: row.tecnico_id,
        tecnico_nombre: row.tecnico_nombre || 'Tecnico sin nombre',
        total_reportes: 0,
        comunidadesMap: new Map(),
      })
    }
    const tecnicoRuta = tecnicosMap.get(row.tecnico_id)
    tecnicoRuta.total_reportes += 1
    addReporteToCommunityMap(tecnicoRuta.comunidadesMap, row, coords, reporteItem)
  }

  const tecnicos = Array.from(tecnicosMap.values()).map(formatTecnicoRuta)
  const sinTecnico = Array.from(sinTecnicoMap.values())
  const comunidades = tecnicos.flatMap((tecnico) => tecnico.comunidades)
  comunidades.push(...sinTecnico)

  return json({
    ok: true,
    fecha_programada: fechaParam,
    tecnico_id: tecnicoParam,
    tecnicos,
    sin_tecnico: sinTecnico,
    comunidades,
    sin_coordenadas: sinCoordenadas,
    sin_fecha_programada: fechaParam === 'sin_fecha' ? [...tecnicos.flatMap((t) => t.comunidades.flatMap((c) => c.reportes)), ...sinTecnico.flatMap((c) => c.reportes)] : [],
  })
}

export async function listReportes(request, env, url) {
  const auth = await requireAuth(request, env, ['ADMIN', 'SOPORTE', 'ATENCION_CLIENTE', 'TECNICO', 'TECNICO_FIBRA'])
  if (auth.response) return auth.response

  const filters = []
  const values = []
  const fecha = url.searchParams.get('fecha')
  const confirmacion = url.searchParams.get('confirmacion') === '1'

  if (confirmacion) {
    filters.push("reportes.estado IN ('PENDIENTE_CONFIRMACION', 'NO_LOCALIZADO')")
  } else if (fecha) {
    filters.push('date(reportes.fecha_reportada) = date(?)')
    values.push(fecha)
  } else if (!url.searchParams.get('tecnico_id')) {
    filters.push('date(reportes.fecha_reportada) = date(?)')
    values.push(todayDate())
  }

  addFilter(filters, values, 'reportes.comunidad_id = ?', url.searchParams.get('comunidad_id'))
  addFilter(filters, values, 'reportes.estado = ?', url.searchParams.get('estado'))
  addFilter(filters, values, 'reportes.tipo_reporte = ?', url.searchParams.get('tipo_reporte'))
  addFilter(filters, values, 'reportes.tecnico_id = ?', url.searchParams.get('tecnico_id'))

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
  const statement = env.DB.prepare(
    `SELECT
       reportes.id, reportes.fecha_reportada, reportes.cliente_id, reportes.prospecto_id,
       reportes.tipo_reporte, reportes.comentario, reportes.estado, reportes.prioridad,
       reportes.fecha_programada, reportes.orden_ruta, reportes.fecha_completado,
       reportes.comentario_cierre, reportes.creado_por_usuario_id,
       comunidades.id AS comunidad_id, comunidades.nombre AS comunidad_nombre,
       comunidades.latitud AS comunidad_latitud, comunidades.longitud AS comunidad_longitud,
       clientes.numero_cliente,
       trim(clientes.nombres || ' ' || COALESCE(clientes.apellido_paterno, '') || ' ' || COALESCE(clientes.apellido_materno, '')) AS cliente_nombre,
       clientes.telefono AS cliente_telefono,
       trim(prospectos.nombres || ' ' || COALESCE(prospectos.apellido_paterno, '') || ' ' || COALESCE(prospectos.apellido_materno, '')) AS prospecto_nombre,
       prospectos.telefono AS prospecto_telefono,
       prospectos.nombres AS prospecto_nombres_original,
       prospectos.apellido_paterno AS prospecto_apellido_paterno_original,
       prospectos.apellido_materno AS prospecto_apellido_materno_original,
       prospectos.direccion AS prospecto_direccion,
       prospectos.referencia AS prospecto_referencia,
       prospectos.paquete_interes_id AS prospecto_paquete_interes_id,
       paquete_interes.nombre AS prospecto_paquete_nombre,
       tecnico.id AS tecnico_id,
       trim(tecnico.nombres || ' ' || COALESCE(tecnico.apellido_paterno, '') || ' ' || COALESCE(tecnico.apellido_materno, '')) AS tecnico_nombre,
       trim(creador.nombres || ' ' || COALESCE(creador.apellido_paterno, '') || ' ' || COALESCE(creador.apellido_materno, '')) AS creado_por_nombre,
       instalaciones_fibra.titular_nombres,
       instalaciones_fibra.titular_apellido_paterno,
       instalaciones_fibra.titular_apellido_materno,
       instalaciones_fibra.titular_telefono,
       instalaciones_fibra.titular_direccion,
       instalaciones_fibra.titular_referencia,
       instalaciones_fibra.contrato_marca_equipo,
       instalaciones_fibra.contrato_numero_equipos,
       instalaciones_fibra.contrato_aplica_reconexion,
       instalaciones_fibra.contrato_cantidad_reconexion,
       instalaciones_fibra.contrato_costo_equipo_penalidad,
       instalaciones_fibra.contrato_costo_instalacion,
       instalaciones_fibra.contrato_modalidad_pago,
       instalaciones_fibra.paquete_instalacion_id,
       paquete_instalacion.nombre AS paquete_instalacion_nombre,
       instalaciones_fibra.alfanumerico_equipo,
       instalaciones_fibra.fibra_optica_metros,
       instalaciones_fibra.tensor_gancho,
       instalaciones_fibra.argollas,
       instalaciones_fibra.taquetes,
       instalaciones_fibra.sujetadores,
       instalaciones_fibra.roseta,
       instalaciones_fibra.terminal,
       instalaciones_fibra.puerto,
       instalaciones_fibra.caja_id,
       instalaciones_fibra.caja_terminal_id,
       cajas_fibra.codigo_caja,
       cajas_fibra.nombre AS caja_nombre,
       caja_terminales.numero_terminal AS caja_terminal_numero,
       instalaciones_fibra.potencia,
       instalaciones_fibra.firma_cliente_base64,
       instalaciones_fibra.firma_tecnico_base64,
       instalaciones_fibra.foto_router_r2_key,
       instalaciones_fibra.foto_router_content_type
     FROM reportes
     JOIN comunidades ON comunidades.id = reportes.comunidad_id
     LEFT JOIN clientes ON clientes.id = reportes.cliente_id
     LEFT JOIN prospectos ON prospectos.id = reportes.prospecto_id
     LEFT JOIN paquetes paquete_interes ON paquete_interes.id = prospectos.paquete_interes_id
     LEFT JOIN instalaciones_fibra ON instalaciones_fibra.reporte_id = reportes.id
     LEFT JOIN cajas_fibra ON cajas_fibra.id = instalaciones_fibra.caja_id
     LEFT JOIN caja_terminales ON caja_terminales.id = instalaciones_fibra.caja_terminal_id
     LEFT JOIN paquetes paquete_instalacion ON paquete_instalacion.id = instalaciones_fibra.paquete_instalacion_id
     LEFT JOIN usuarios tecnico ON tecnico.id = reportes.tecnico_id
     LEFT JOIN usuarios creador ON creador.id = reportes.creado_por_usuario_id
     ${where}
     ORDER BY reportes.fecha_programada ASC, reportes.id DESC
     LIMIT 200`
  )
  const { results } = values.length ? await statement.bind(...values).all() : await statement.all()
  return json({ reportes: results })
}

export async function getReporteFotoRouter(request, env, reporteId) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const instalacion = await env.DB.prepare(
    `SELECT foto_router_r2_key, foto_router_content_type
     FROM instalaciones_fibra
     WHERE reporte_id = ?
     ORDER BY instalaciones_fibra.id DESC
     LIMIT 1`
  ).bind(reporteId).first()

  if (!instalacion?.foto_router_r2_key) return json({ ok: false, error: 'Foto no encontrada' }, 404)
  if (!env.INSTALACIONES_BUCKET) return json({ ok: false, error: 'Bucket de instalaciones no configurado' }, 500)

  const object = await env.INSTALACIONES_BUCKET.get(instalacion.foto_router_r2_key)
  if (!object) return json({ ok: false, error: 'Foto no encontrada en almacenamiento' }, 404)

  return new Response(object.body, {
    headers: {
      'Content-Type': instalacion.foto_router_content_type || object.httpMetadata?.contentType || 'image/webp',
      'Cache-Control': 'private, max-age=60',
    },
  })
}

export async function createReporte(request, env) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  const validation = await validateReportePayload(env, body)
  if (validation.response) return validation.response

  const info = await env.DB.prepare(
    `INSERT INTO reportes (
       fecha_reportada, comunidad_id, tipo_reporte, cliente_id, prospecto_id,
       comentario, estado, prioridad, creado_por_usuario_id, fecha_programada
     ) VALUES (datetime('now'), ?, ?, ?, ?, ?, 'PENDIENTE', ?, ?, ?)`
  ).bind(
    validation.data.comunidad_id,
    validation.data.tipo_reporte,
    validation.data.cliente_id,
    validation.data.prospecto_id,
    validation.data.comentario,
    validation.data.prioridad,
    auth.session.usuario_id,
    validation.data.fecha_programada
  ).run()

  return json({ ok: true, id: info.meta?.last_row_id }, 201)
}

export async function updateReporte(request, env, reporteId) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  const reporte = await getReporteById(env, reporteId)
  if (!reporte) return json({ ok: false, error: 'Reporte no encontrado' }, 404)
  if (reporte.estado !== 'PENDIENTE' || reporte.tecnico_id !== null) {
    return json({ ok: false, error: 'Este reporte ya fue asignado o esta en proceso. No se puede editar.' }, 400)
  }

  const validation = await validateReportePayload(env, body, { reporteId })
  if (validation.response) return validation.response

  await env.DB.prepare(
    `UPDATE reportes
     SET comunidad_id = ?, tipo_reporte = ?, cliente_id = ?, prospecto_id = ?,
         comentario = ?, prioridad = ?, fecha_programada = ?
     WHERE id = ?`
  ).bind(
    validation.data.comunidad_id,
    validation.data.tipo_reporte,
    validation.data.cliente_id,
    validation.data.prospecto_id,
    validation.data.comentario,
    validation.data.prioridad,
    validation.data.fecha_programada,
    reporteId
  ).run()

  return json({ ok: true })
}

export async function cancelarReporte(request, env, reporteId) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const reporte = await getReporteById(env, reporteId)
  if (!reporte) return json({ ok: false, error: 'Reporte no encontrado' }, 404)
  if (reporte.estado === 'CANCELADO') return json({ ok: false, error: 'El reporte ya esta cancelado.' }, 400)
  if (reporte.estado === 'COMPLETADO') return json({ ok: false, error: 'No se puede cancelar un reporte completado.' }, 400)

  const body = await request.json().catch(() => null)
  const comentarioCierre = String(body?.comentario_cierre || body?.comentario || 'Reporte cancelado').trim()

  await env.DB.prepare(
    `UPDATE reportes
     SET estado = 'CANCELADO', fecha_completado = datetime('now'), comentario_cierre = ?
     WHERE id = ?`
  ).bind(comentarioCierre, reporteId).run()

  await insertReporteSeguimiento(env, reporteId, auth.session.usuario_id, 'CANCELADO', comentarioCierre)
  if (reporte.tipo_reporte === 'INSTALACION') {
    await releaseReservedTerminalForReporte(env, reporteId)
  }
  return json({ ok: true })
}

export async function asignarTecnicoReporte(request, env, reporteId) {
  const auth = await requireAuth(request, env, ['ADMIN'])
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  const tecnicoId = body?.tecnico_id ? Number(body.tecnico_id) : null
  const fechaProgramada = String(body?.fecha_programada ?? '').trim()
  const ordenRuta = body?.orden_ruta ? Number(body.orden_ruta) : null
  const comentario = String(body?.comentario ?? '').trim()

  const reporte = await getReporteById(env, reporteId)
  if (!reporte) return json({ ok: false, error: 'Reporte no encontrado' }, 404)
  if (!tecnicoId) return json({ ok: false, error: 'Selecciona un tecnico' }, 400)
  if (!fechaProgramada) return json({ ok: false, error: 'La fecha programada es obligatoria' }, 400)
  if (ordenRuta !== null && (!Number.isInteger(ordenRuta) || ordenRuta < 1)) {
    return json({ ok: false, error: 'El orden de ruta debe ser un numero mayor a cero' }, 400)
  }

  const tecnico = await env.DB.prepare(
    `SELECT usuarios.id
     FROM usuarios
     JOIN usuario_roles ON usuario_roles.usuario_id = usuarios.id
     JOIN roles ON roles.id = usuario_roles.rol_id
     WHERE usuarios.id = ?
       AND usuarios.activo = 1
       AND roles.activo = 1
       AND roles.nombre IN ('TECNICO', 'TECNICO_FIBRA')`
  ).bind(tecnicoId).first()
  if (!tecnico) return json({ ok: false, error: 'Tecnico no encontrado o sin rol tecnico' }, 404)

  await env.DB.prepare(
    `UPDATE reportes
     SET tecnico_id = ?,
         fecha_programada = ?,
         orden_ruta = ?,
         asignado_por_usuario_id = ?,
         fecha_asignacion = datetime('now'),
         estado = 'ASIGNADO'
     WHERE id = ?`
  ).bind(tecnicoId, fechaProgramada, ordenRuta, auth.session.usuario_id, reporteId).run()

  await insertReporteSeguimiento(
    env,
    reporteId,
    auth.session.usuario_id,
    'ASIGNADO',
    comentario || 'Tecnico asignado para ruta operativa'
  )
  return json({ ok: true })
}

export async function updateReporteEstado(request, env, reporteId) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  const estado = String(body?.estado ?? '').trim().toUpperCase()
  const estadosPermitidos = ['PENDIENTE', 'ASIGNADO', 'EN_PROCESO', 'PENDIENTE_CONFIRMACION', 'NO_LOCALIZADO', 'CANCELADO']
  if (!estadosPermitidos.includes(estado)) return json({ ok: false, error: 'Estado invalido' }, 400)

  await env.DB.prepare('UPDATE reportes SET estado = ? WHERE id = ?').bind(estado, reporteId).run()
  await insertReporteSeguimiento(env, reporteId, auth.session.usuario_id, estado, `Estado actualizado a ${estado}`)
  return json({ ok: true })
}

export async function cerrarReporte(request, env, reporteId) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const reporte = await getReporteById(env, reporteId)
  if (!reporte) return json({ ok: false, error: 'Reporte no encontrado' }, 404)
  if (reporte.estado !== 'PENDIENTE_CONFIRMACION') {
    return json({ ok: false, error: 'Solo se puede cerrar un reporte pendiente de confirmacion.' }, 400)
  }

  const body = await request.json().catch(() => null)
  const solucion = String(body?.solucion ?? '').trim()
  if (!solucion) return json({ error: 'La solucion es obligatoria para cerrar el reporte' }, 400)

  await env.DB.prepare(
    `UPDATE reportes
     SET estado = 'COMPLETADO', fecha_completado = datetime('now'), comentario_cierre = ?
     WHERE id = ?`
  ).bind(solucion, reporteId).run()

  await insertReporteSeguimiento(env, reporteId, auth.session.usuario_id, 'COMPLETADO', solucion)
  return json({ ok: true })
}

export async function programarReporte(request, env, reporteId) {
  const auth = await requireAuth(request, env, ['ADMIN'])
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  const fechaProgramada = String(body?.fecha_programada ?? '').trim()
  const estado = String(body?.estado ?? '').trim()
  if (!fechaProgramada) return json({ error: 'La fecha programada es obligatoria' }, 400)
  if (estado && !['ASIGNADO', 'EN_PROCESO', 'PENDIENTE_CONFIRMACION', 'NO_LOCALIZADO', 'CANCELADO'].includes(estado)) return json({ error: 'Estado de programacion invalido' }, 400)

  await env.DB.prepare(
    `UPDATE reportes
     SET fecha_programada = ?, estado = COALESCE(NULLIF(?, ''), estado), orden_ruta = COALESCE(?, orden_ruta)
     WHERE id = ?`
  ).bind(fechaProgramada, estado, body?.orden_ruta ? Number(body.orden_ruta) : null, reporteId).run()

  return json({ ok: true })
}

export async function confirmarCierreReporte(request, env, reporteId) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const reporte = await getReporteById(env, reporteId)
  if (!reporte) return json({ ok: false, error: 'Reporte no encontrado' }, 404)
  if (reporte.estado !== 'PENDIENTE_CONFIRMACION') {
    return json({ ok: false, error: 'Solo se puede confirmar un reporte pendiente de confirmacion' }, 400)
  }

  await env.DB.prepare(
    `UPDATE reportes
     SET estado = 'COMPLETADO', fecha_completado = datetime('now')
     WHERE id = ?`
  ).bind(reporteId).run()
  await insertReporteSeguimiento(env, reporteId, auth.session.usuario_id, 'COMPLETADO', 'CIERRE CONFIRMADO POR ATENCION/SOPORTE')

  return json({ ok: true })
}

export async function confirmarInstalacionReporte(request, env, reporteId) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  const cicloCorteId = Number(body?.ciclo_corte_id)
  const ipAsignada = nullableText(body?.ip_asignada)
  if (!cicloCorteId) return json({ ok: false, error: 'Selecciona el ciclo de corte.' }, 400)
  if (!ipAsignada) return json({ ok: false, error: 'Captura la IP asignada.' }, 400)

  const reporte = await getReporteById(env, reporteId)
  if (!reporte) return json({ ok: false, error: 'Reporte no encontrado' }, 404)
  if (reporte.tipo_reporte !== 'INSTALACION') return json({ ok: false, error: 'Este reporte no es una instalacion.' }, 400)
  if (!reporte.prospecto_id || reporte.cliente_id) {
    return json({ ok: false, error: 'El reporte de instalacion debe conservar prospecto y no tener cliente asignado.' }, 400)
  }
  if (reporte.estado !== 'PENDIENTE_CONFIRMACION') {
    return json({ ok: false, error: 'Solo se puede confirmar una instalacion pendiente de confirmacion.' }, 400)
  }

  const validation = await validateInstalacionConfirmacion(env, reporteId, cicloCorteId)
  if (validation.response) return validation.response

  const contratoValidation = await validarContratoInstalacionDisponible(env, validation.instalacion.id)
  if (contratoValidation.response) return contratoValidation.response

  const { instalacion, prospecto, paquete, comunidad, nextNumber, numeroCliente, alreadyConverted } = validation
  let clienteId = instalacion.cliente_id ? Number(instalacion.cliente_id) : null
  let servicioId = instalacion.servicio_fibra_id ? Number(instalacion.servicio_fibra_id) : null

  if (!alreadyConverted) {
    const qrToken = crypto.randomUUID()
    const batchResults = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO clientes (
           numero_cliente, nombres, apellido_paterno, apellido_materno, telefono,
           direccion, referencia, comunidad_id, prospecto_id, estado_cliente, qr_token, fecha_registro
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO', ?, datetime('now'))`
      ).bind(
        numeroCliente,
        normalizeUpper(instalacion.titular_nombres),
        normalizeOptionalUpper(instalacion.titular_apellido_paterno),
        normalizeOptionalUpper(instalacion.titular_apellido_materno),
        nullableText(instalacion.titular_telefono),
        nullableText(instalacion.titular_direccion),
        nullableText(prospecto?.referencia),
        instalacion.comunidad_id,
        instalacion.prospecto_id,
        qrToken
      ),
      env.DB.prepare(
        `INSERT INTO servicios_fibra (
           cliente_id, paquete_id, ciclo_corte_id, alfanumerico_equipo, ip_asignada,
           fecha_instalacion, precio_mensual, estado_servicio, caja_id, caja_terminal_id
         ) VALUES ((SELECT id FROM clientes WHERE numero_cliente = ?), ?, ?, ?, ?, ?, ?, 'ACTIVO', ?, ?)`
      ).bind(
        numeroCliente,
        instalacion.paquete_instalacion_id,
        cicloCorteId,
        normalizeUpper(instalacion.alfanumerico_equipo),
        ipAsignada,
        nullableText(instalacion.fecha_instalacion),
        Number(paquete.precio_mensual ?? 0),
        instalacion.caja_id,
        instalacion.caja_terminal_id
      ),
      env.DB.prepare(
        `UPDATE instalaciones_fibra
         SET cliente_id = (SELECT id FROM clientes WHERE numero_cliente = ?),
             servicio_fibra_id = (
               SELECT servicios_fibra.id
               FROM servicios_fibra
               JOIN clientes ON clientes.id = servicios_fibra.cliente_id
               WHERE clientes.numero_cliente = ?
               ORDER BY servicios_fibra.id DESC
               LIMIT 1
             )
         WHERE id = ?`
      ).bind(numeroCliente, numeroCliente, instalacion.id),
      env.DB.prepare(
        `UPDATE caja_terminales
         SET estado = 'OCUPADO',
             servicio_fibra_id = (
               SELECT servicios_fibra.id
               FROM servicios_fibra
               JOIN clientes ON clientes.id = servicios_fibra.cliente_id
               WHERE clientes.numero_cliente = ?
               ORDER BY servicios_fibra.id DESC
               LIMIT 1
             ),
             actualizado_en = datetime('now')
         WHERE id = ?`
      ).bind(numeroCliente, instalacion.caja_terminal_id),
      env.DB.prepare(
        `UPDATE comunidades
         SET siguiente_numero_cliente = CASE
           WHEN ? > COALESCE(siguiente_numero_cliente, 0) THEN ?
           ELSE siguiente_numero_cliente
         END
         WHERE id = ?`
      ).bind(nextNumber, nextNumber, comunidad.id),
    ])

    clienteId = batchResults?.[0]?.meta?.last_row_id
    servicioId = batchResults?.[1]?.meta?.last_row_id
  }

  if (!clienteId || !servicioId) {
    return json({ ok: false, error: 'No se pudo obtener cliente y servicio para generar el contrato.' }, 500)
  }

  const contrato = await generarContratoParaInstalacion(env, {
    instalacionId: instalacion.id,
    clienteId,
    servicioFibraId: servicioId,
    usuarioId: auth.session.usuario_id,
  })

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE reportes
       SET estado = 'COMPLETADO',
           fecha_completado = datetime('now'),
           comentario_cierre = ?
       WHERE id = ?`
    ).bind(INSTALLATION_CONFIRMED_COMMENT, reporteId),
    env.DB.prepare(
      `INSERT INTO reportes_seguimiento (reporte_id, usuario_id, estado, comentario, fecha_registro)
       VALUES (?, ?, 'COMPLETADO', ?, datetime('now'))`
    ).bind(reporteId, auth.session.usuario_id, INSTALLATION_CONFIRMED_COMMENT),
  ])

  return json({
    ok: true,
    cliente: { id: clienteId, numero_cliente: numeroCliente ?? instalacion.numero_cliente },
    servicio: { id: servicioId },
    cliente_id: clienteId,
    servicio_fibra_id: servicioId,
    contrato,
    message: 'Instalacion confirmada y contrato generado correctamente.',
  })
}

export async function regresarReporteTecnico(request, env, reporteId) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const reporte = await getReporteById(env, reporteId)
  if (!reporte) return json({ ok: false, error: 'Reporte no encontrado' }, 404)
  if (!['PENDIENTE_CONFIRMACION', 'NO_LOCALIZADO'].includes(reporte.estado)) {
    return json({ ok: false, error: 'Este reporte no esta en revision de oficina' }, 400)
  }

  if (reporte.tecnico_id) {
    const enProceso = await env.DB.prepare(
      `SELECT id
       FROM reportes
       WHERE tecnico_id = ? AND estado = 'EN_PROCESO' AND id <> ?
       LIMIT 1`
    ).bind(reporte.tecnico_id, reporteId).first()

    if (enProceso) {
      return json({ ok: false, error: 'El tecnico ya tiene otro reporte en proceso.' }, 400)
    }
  }

  const comentarioSeguimiento = reporte.tipo_reporte === 'INSTALACION'
    ? 'REPORTE REGRESADO AL TECNICO PARA CORRECCION DE INSTALACION'
    : 'REPORTE REGRESADO AL TECNICO PARA REVISION'

  await env.DB.prepare("UPDATE reportes SET estado = 'EN_PROCESO' WHERE id = ?").bind(reporteId).run()
  await insertReporteSeguimiento(env, reporteId, auth.session.usuario_id, 'EN_PROCESO', comentarioSeguimiento)

  return json({ ok: true })
}

export async function reagendarReporte(request, env, reporteId) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  const fechaProgramada = String(body?.fecha_programada ?? '').trim()
  if (!fechaProgramada) return json({ ok: false, error: 'La fecha programada es obligatoria' }, 400)

  const reporte = await getReporteById(env, reporteId)
  if (!reporte) return json({ ok: false, error: 'Reporte no encontrado' }, 404)
  if (!['NO_LOCALIZADO', 'PENDIENTE_CONFIRMACION', 'EN_PROCESO', 'ASIGNADO'].includes(reporte.estado)) {
    return json({ ok: false, error: 'Este reporte no se puede reagendar' }, 400)
  }

  await env.DB.prepare(
    `UPDATE reportes
     SET fecha_programada = ?,
         tecnico_id = NULL,
         orden_ruta = NULL,
         fecha_asignacion = NULL,
         asignado_por_usuario_id = NULL,
         estado = 'PENDIENTE'
     WHERE id = ?`
  ).bind(fechaProgramada, reporteId).run()
  await insertReporteSeguimiento(
    env,
    reporteId,
    auth.session.usuario_id,
    'ASIGNADO',
    'REPORTE REAGENDADO POR ATENCION/SOPORTE. PENDIENTE DE NUEVA ASIGNACION.'
  )

  return json({ ok: true })
}

export async function validateReportePayload(env, body, options = {}) {
  const estado = String(body?.estado ?? 'PENDIENTE').trim().toUpperCase()
  const prioridad = String(body?.prioridad ?? 'NORMAL').trim().toUpperCase()
  const tipoReporte = String(body?.tipo_reporte ?? '').trim().toUpperCase()
  const estadosPermitidos = ['PENDIENTE', 'ASIGNADO', 'EN_PROCESO', 'PENDIENTE_CONFIRMACION', 'NO_LOCALIZADO', 'COMPLETADO', 'CANCELADO']
  const prioridadesPermitidas = ['BAJA', 'NORMAL', 'ALTA', 'URGENTE']
  const tiposPermitidos = ['DETALLE', 'INSTALACION']

  if ((body?.estado && !estadosPermitidos.includes(estado)) || !prioridadesPermitidas.includes(prioridad) || !tiposPermitidos.includes(tipoReporte)) {
    return { response: json({ ok: false, error: 'Estado, prioridad o tipo de reporte invalido' }, 400) }
  }

  const fechaProgramada = String(body?.fecha_programada ?? '').trim()
  const data = {
    comunidad_id: Number(body?.comunidad_id),
    tipo_reporte: tipoReporte,
    cliente_id: body?.cliente_id ? Number(body.cliente_id) : null,
    prospecto_id: body?.prospecto_id ? Number(body.prospecto_id) : null,
    comentario: String(body?.comentario ?? '').trim().toUpperCase(),
    prioridad,
    estado: 'PENDIENTE',
    fecha_programada: fechaProgramada || null,
  }

  if (!data.comunidad_id || !data.comentario) return { response: json({ error: 'Comunidad y comentario son obligatorios' }, 400) }
  const comunidad = await env.DB.prepare('SELECT id FROM comunidades WHERE id = ?').bind(data.comunidad_id).first()
  if (!comunidad) return { response: json({ error: 'Comunidad no encontrada' }, 404) }

  if (data.tipo_reporte === 'DETALLE') {
    data.prospecto_id = null
    if (!data.cliente_id) return { response: json({ error: 'Selecciona un cliente para reportes de detalle' }, 400) }
    const cliente = await env.DB.prepare('SELECT id FROM clientes WHERE id = ? AND comunidad_id = ?').bind(data.cliente_id, data.comunidad_id).first()
    if (!cliente) return { response: json({ error: 'Cliente no encontrado en la comunidad seleccionada' }, 404) }
  }

  if (data.tipo_reporte === 'INSTALACION') {
    data.cliente_id = null
    if (!data.prospecto_id) return { response: json({ error: 'Selecciona un prospecto para reportes de instalacion' }, 400) }
    const prospecto = await env.DB.prepare('SELECT id FROM prospectos WHERE id = ? AND comunidad_id = ?').bind(data.prospecto_id, data.comunidad_id).first()
    if (!prospecto) return { response: json({ error: 'Prospecto no encontrado en la comunidad seleccionada' }, 404) }

    const converted = await env.DB.prepare('SELECT id FROM clientes WHERE prospecto_id = ? LIMIT 1').bind(data.prospecto_id).first()
    if (converted) {
      return { response: json({ ok: false, error: 'Este prospecto ya fue convertido a cliente. No se puede generar otra instalacion.' }, 409) }
    }

    const activeValues = [data.prospecto_id]
    let activeQuery = `
      SELECT id, estado
      FROM reportes
      WHERE tipo_reporte = 'INSTALACION'
        AND prospecto_id = ?
        AND estado IN ('PENDIENTE', 'ASIGNADO', 'EN_PROCESO', 'PENDIENTE_CONFIRMACION')
    `
    if (options.reporteId) {
      activeQuery += ' AND id <> ?'
      activeValues.push(options.reporteId)
    }
    activeQuery += ' LIMIT 1'
    const activeReport = await env.DB.prepare(activeQuery).bind(...activeValues).first()
    if (activeReport) {
      return { response: json({ ok: false, error: 'Este prospecto ya tiene una instalacion en curso o pendiente de confirmacion.' }, 409) }
    }
  }

  return { data }
}

async function validateInstalacionConfirmacion(env, reporteId, cicloCorteId) {
  const instalacion = await env.DB.prepare(
    `SELECT
       instalaciones_fibra.*,
        reportes.prospecto_id AS reporte_prospecto_id,
        reportes.comunidad_id AS reporte_comunidad_id,
        clientes.numero_cliente AS numero_cliente
      FROM instalaciones_fibra
      JOIN reportes ON reportes.id = instalaciones_fibra.reporte_id
      LEFT JOIN clientes ON clientes.id = instalaciones_fibra.cliente_id
      WHERE instalaciones_fibra.reporte_id = ?
      ORDER BY instalaciones_fibra.id DESC
      LIMIT 1`
  ).bind(reporteId).first()

  if (!instalacion) return { response: json({ ok: false, error: 'No se encontro la instalacion capturada por el tecnico.' }, 404) }
  if ((instalacion.cliente_id && !instalacion.servicio_fibra_id) || (!instalacion.cliente_id && instalacion.servicio_fibra_id)) {
    return { response: json({ ok: false, error: 'La instalacion tiene una conversion incompleta. Revisa cliente y servicio antes de confirmar.' }, 409) }
  }
  const alreadyConverted = Boolean(instalacion.cliente_id && instalacion.servicio_fibra_id)

  const requiredFields = [
    ['titular_nombres', 'Falta el nombre final del titular.'],
    ['titular_telefono', 'Falta el telefono final del titular.'],
    ['titular_direccion', 'Falta la direccion final del titular.'],
    ['paquete_instalacion_id', 'Falta el paquete final de la instalacion.'],
    ['alfanumerico_equipo', 'Falta el alfanumerico del equipo.'],
    ['terminal', 'Falta la terminal.'],
    ['puerto', 'Falta la caja.'],
    ['caja_id', 'Falta seleccionar caja de fibra.'],
    ['caja_terminal_id', 'Falta seleccionar terminal de caja.'],
    ['potencia', 'Falta la potencia.'],
    ['firma_cliente_base64', 'Falta la firma del cliente.'],
    ['firma_tecnico_base64', 'Falta la firma del tecnico.'],
    ['contrato_marca_equipo', 'Falta la marca del equipo para contrato.'],
    ['contrato_numero_equipos', 'Falta el numero de equipos para contrato.'],
    ['contrato_aplica_reconexion', 'Falta indicar tarifa de reconexion para contrato.'],
    ['contrato_cantidad_reconexion', 'Falta la cantidad de reconexion para contrato.'],
    ['contrato_costo_equipo_penalidad', 'Falta el costo equipo / penalidad para contrato.'],
    ['contrato_costo_instalacion', 'Falta el costo de instalacion para contrato.'],
    ['contrato_modalidad_pago', 'Falta la modalidad de pago para contrato.'],
  ]

  for (const [field, message] of requiredFields) {
    if (instalacion[field] === null || instalacion[field] === undefined || String(instalacion[field]).trim() === '') {
      return { response: json({ ok: false, error: message }, 400) }
    }
  }

  instalacion.prospecto_id = instalacion.prospecto_id ?? instalacion.reporte_prospecto_id
  instalacion.comunidad_id = instalacion.comunidad_id ?? instalacion.reporte_comunidad_id
  if (!instalacion.comunidad_id) return { response: json({ ok: false, error: 'La instalacion no tiene comunidad vinculada.' }, 400) }
  if (!instalacion.prospecto_id) return { response: json({ ok: false, error: 'La instalacion no tiene prospecto vinculado.' }, 400) }
  if (Number(instalacion.contrato_numero_equipos) < 1 || Number(instalacion.contrato_numero_equipos) > 5) {
    return { response: json({ ok: false, error: 'El numero de equipos para contrato debe estar entre 1 y 5.' }, 400) }
  }
  for (const field of ['contrato_cantidad_reconexion', 'contrato_costo_equipo_penalidad', 'contrato_costo_instalacion']) {
    const value = Number(instalacion[field])
    if (!Number.isFinite(value) || value < 0) {
      return { response: json({ ok: false, error: 'Los importes del contrato no pueden ser negativos.' }, 400) }
    }
  }

  const ciclo = await env.DB.prepare('SELECT id FROM ciclos_corte WHERE id = ? AND activo = 1').bind(cicloCorteId).first()
  if (!ciclo) return { response: json({ ok: false, error: 'El ciclo de corte seleccionado no existe.' }, 400) }

  const paquete = await env.DB.prepare(
    `SELECT id, precio_mensual
     FROM paquetes
     WHERE id = ? AND comunidad_id = ? AND activo = 1`
  ).bind(instalacion.paquete_instalacion_id, instalacion.comunidad_id).first()
  if (!paquete) return { response: json({ ok: false, error: 'El paquete final no pertenece a la comunidad o no esta activo.' }, 400) }

  const comunidad = await env.DB.prepare(
    'SELECT id, prefijo, numero_inicial_cliente, siguiente_numero_cliente FROM comunidades WHERE id = ?'
  ).bind(instalacion.comunidad_id).first()
  if (!comunidad) return { response: json({ ok: false, error: 'La comunidad de la instalacion no existe.' }, 404) }

  const prospecto = instalacion.prospecto_id
    ? await env.DB.prepare('SELECT id, referencia FROM prospectos WHERE id = ?').bind(instalacion.prospecto_id).first()
    : null
  if (!prospecto) return { response: json({ ok: false, error: 'El prospecto de la instalacion no existe.' }, 404) }

  const terminalValidation = await validateInstalacionTerminalConfirmacion(env, instalacion)
  if (terminalValidation.response) return terminalValidation

  const nextClient = alreadyConverted
    ? { nextNumber: null, numeroCliente: instalacion.numero_cliente }
    : await generateNextClientNumber(env, comunidad)
  return { instalacion, prospecto, paquete, comunidad, ...nextClient, alreadyConverted }
}

async function validateInstalacionTerminalConfirmacion(env, instalacion) {
  const caja = await env.DB.prepare(
    `SELECT id, comunidad_id, tipo, activo
     FROM cajas_fibra
     WHERE id = ?`
  ).bind(instalacion.caja_id).first()
  if (!caja || caja.tipo !== 'CAJA' || Number(caja.comunidad_id) !== Number(instalacion.comunidad_id)) {
    return { response: json({ ok: false, error: 'La caja de la instalacion no es valida.' }, 400) }
  }

  const terminal = await env.DB.prepare(
    `SELECT id, caja_id, estado, servicio_fibra_id
     FROM caja_terminales
     WHERE id = ?`
  ).bind(instalacion.caja_terminal_id).first()
  if (!terminal || Number(terminal.caja_id) !== Number(instalacion.caja_id)) {
    return { response: json({ ok: false, error: 'La terminal no pertenece a la caja seleccionada.' }, 400) }
  }
  if (terminal.estado === 'OCUPADO' && terminal.servicio_fibra_id && Number(terminal.servicio_fibra_id) !== Number(instalacion.servicio_fibra_id)) {
    return { response: json({ ok: false, error: 'Esta terminal ya fue ocupada o reservada. Selecciona otra.' }, 409) }
  }
  if (terminal.estado === 'DAÑADO') {
    return { response: json({ ok: false, error: 'Esta terminal ya fue ocupada o reservada. Selecciona otra.' }, 409) }
  }
  if (terminal.estado === 'RESERVADO') {
    const own = await env.DB.prepare(
      `SELECT id
       FROM instalaciones_fibra
       WHERE id = ? AND caja_terminal_id = ?
       LIMIT 1`
    ).bind(instalacion.id, instalacion.caja_terminal_id).first()
    if (!own) {
      return { response: json({ ok: false, error: 'Esta terminal ya fue ocupada o reservada. Selecciona otra.' }, 409) }
    }
  }

  return {}
}

async function releaseReservedTerminalForReporte(env, reporteId) {
  const instalacion = await env.DB.prepare(
    `SELECT instalaciones_fibra.id, instalaciones_fibra.caja_terminal_id
     FROM instalaciones_fibra
     WHERE instalaciones_fibra.reporte_id = ?
     ORDER BY instalaciones_fibra.id DESC
     LIMIT 1`
  ).bind(reporteId).first()
  if (!instalacion?.caja_terminal_id) return

  await env.DB.prepare(
    `UPDATE caja_terminales
     SET estado = 'LIBRE', servicio_fibra_id = NULL, actualizado_en = datetime('now')
     WHERE id = ? AND estado = 'RESERVADO' AND servicio_fibra_id IS NULL`
  ).bind(instalacion.caja_terminal_id).run()
}

async function generateNextClientNumber(env, comunidad) {
  const { results } = await env.DB.prepare('SELECT numero_cliente FROM clientes WHERE comunidad_id = ?').bind(comunidad.id).all()
  const prefix = nullableText(comunidad.prefijo)
  let maxNumber = Number(comunidad.siguiente_numero_cliente ?? comunidad.numero_inicial_cliente ?? 0)

  for (const cliente of results ?? []) {
    const number = extractClientNumber(cliente.numero_cliente, prefix)
    if (Number.isFinite(number)) maxNumber = Math.max(maxNumber, number)
  }

  let nextNumber = maxNumber + 1
  let numeroCliente = formatClientNumber(prefix, nextNumber)
  for (let attempts = 0; attempts < 10; attempts += 1) {
    const existing = await env.DB.prepare('SELECT id FROM clientes WHERE numero_cliente = ?').bind(numeroCliente).first()
    if (!existing) return { nextNumber, numeroCliente }
    nextNumber += 1
    numeroCliente = formatClientNumber(prefix, nextNumber)
  }

  throw new Error('No se pudo generar un numero de cliente disponible. Intenta de nuevo.')
}

function extractClientNumber(numeroCliente, prefix) {
  const raw = String(numeroCliente ?? '').trim().toUpperCase()
  const prefixText = String(prefix ?? '').trim().toUpperCase()
  if (prefixText && raw.startsWith(`${prefixText}-`)) {
    const number = Number(raw.slice(prefixText.length + 1).replace(/\D/g, ''))
    return number > 0 ? number : NaN
  }
  const number = Number(raw.replace(/\D/g, ''))
  return number > 0 ? number : NaN
}

function formatClientNumber(prefix, nextNumber) {
  return prefix ? `${prefix}-${nextNumber}` : String(nextNumber)
}

function normalizeUpper(value) {
  return String(value ?? '').trim().toUpperCase()
}

function normalizeOptionalUpper(value) {
  const text = normalizeUpper(value)
  return text || null
}

function nullableText(value) {
  const text = String(value ?? '').trim()
  return text || null
}

export async function getReporteById(env, reporteId) {
  return env.DB.prepare('SELECT id, estado, tecnico_id, tipo_reporte, prospecto_id, cliente_id FROM reportes WHERE id = ?').bind(reporteId).first()
}

export async function insertReporteSeguimiento(env, reporteId, usuarioId, estado, comentario) {
  const estadosPermitidosSeguimiento = ['ASIGNADO', 'EN_PROCESO', 'PENDIENTE_CONFIRMACION', 'NO_LOCALIZADO', 'COMPLETADO', 'CANCELADO']
  if (!estadosPermitidosSeguimiento.includes(estado)) return

  await env.DB.prepare(
    `INSERT INTO reportes_seguimiento (reporte_id, usuario_id, estado, comentario, fecha_registro)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).bind(reporteId, usuarioId, estado, comentario).run()
}

function normalizeCoords(latitud, longitud) {
  let lat = latitud != null ? Number(latitud) : null
  let lng = longitud != null ? Number(longitud) : null
  if (lat === null || lng === null || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return null
  if (lat < 0 && lng > 0) {
    const temp = lat
    lat = lng
    lng = temp
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

function addReporteToCommunityMap(map, row, coords, reporteItem) {
  if (!map.has(row.comunidad_id)) {
    map.set(row.comunidad_id, {
      comunidad_id: row.comunidad_id,
      comunidad: row.comunidad_nombre,
      latitud: coords.lat,
      longitud: coords.lng,
      total_reportes: 0,
      reportes: [],
    })
  }

  const itemComunidad = map.get(row.comunidad_id)
  itemComunidad.total_reportes += 1
  itemComunidad.reportes.push(reporteItem)
}

function formatTecnicoRuta(tecnicoRuta) {
  const comunidades = Array.from(tecnicoRuta.comunidadesMap.values())
  const stats = calculateRouteStats(comunidades)
  return {
    tecnico_id: tecnicoRuta.tecnico_id,
    tecnico_nombre: tecnicoRuta.tecnico_nombre,
    total_reportes: tecnicoRuta.total_reportes,
    comunidades,
    distancia_aproximada_km: stats.distanceKm,
    tiempo_aproximado_min: stats.timeMin,
  }
}

function calculateRouteStats(comunidades) {
  if (comunidades.length < 2) return { distanceKm: 0, timeMin: 0 }
  let distanceKm = 0
  for (let i = 0; i < comunidades.length - 1; i += 1) {
    distanceKm += haversineDistance(
      comunidades[i].latitud,
      comunidades[i].longitud,
      comunidades[i + 1].latitud,
      comunidades[i + 1].longitud
    )
  }
  distanceKm = Math.round(distanceKm * 10) / 10
  return { distanceKm, timeMin: Math.round((distanceKm / 35) * 60) }
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const earthRadiusKm = 6371
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusKm * c
}

function toRadians(value) {
  return (value * Math.PI) / 180
}
