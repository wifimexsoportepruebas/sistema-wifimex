import { requireAuth } from '../utils/auth.js'
import { json } from '../utils/response.js'

const ESTADOS_TERMINADOS = ['PENDIENTE_CONFIRMACION', 'COMPLETADO', 'FINALIZADO', 'CERRADO']
const ESTADOS_CONFIRMADOS = ['COMPLETADO', 'FINALIZADO', 'CERRADO']

export async function getListaTecnicos(request, env) {
  const auth = await requireAuth(request, env, ['ADMIN', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  try {
    const { results } = await env.DB.prepare(
      `SELECT DISTINCT
         u.id,
         trim(u.nombres || ' ' || COALESCE(u.apellido_paterno, '') || ' ' || COALESCE(u.apellido_materno, '')) AS nombre_completo
       FROM usuarios u
       JOIN usuario_roles ur ON ur.usuario_id = u.id
       JOIN roles r ON r.id = ur.rol_id
       WHERE r.nombre IN ('TECNICO', 'TECNICO_FIBRA') AND u.activo = 1
       ORDER BY u.nombres ASC, u.apellido_paterno ASC`
    ).all()

    return json({ ok: true, usuarios: results ?? [] })
  } catch (error) {
    return json({ ok: false, error: error.message || 'Error al obtener tecnicos' }, 500)
  }
}

export async function getBitacoraTecnicos(request, env, url) {
  const auth = await requireAuth(request, env, ['ADMIN', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const fecha = url.searchParams.get('fecha') || todayDate()
  const tecnicoParam = url.searchParams.get('tecnico_id') || 'todos'
  const estadoParam = url.searchParams.get('estado') || 'todos'

  try {
    const { whereEstado, estadoValues } = buildEstadoFilter(estadoParam)
    const filters = [
      `r.estado IN (${ESTADOS_TERMINADOS.map(() => '?').join(', ')})`,
      'r.tecnico_id IS NOT NULL',
      `date(
        CASE
          WHEN r.estado IN ('COMPLETADO', 'FINALIZADO', 'CERRADO') THEN COALESCE(r.fecha_completado, cierre.fecha_registro)
          ELSE COALESCE(cierre.fecha_registro, r.fecha_completado)
        END
      ) = date(?)`,
    ]
    const values = [...ESTADOS_TERMINADOS, fecha]

    if (whereEstado) {
      filters.push(whereEstado)
      values.push(...estadoValues)
    }

    if (tecnicoParam !== 'todos') {
      filters.push('r.tecnico_id = ?')
      values.push(Number(tecnicoParam))
    }

    const { results: trabajosRaw } = await env.DB.prepare(
      `WITH cierre AS (
         SELECT *
         FROM (
           SELECT
             rs.id,
             rs.reporte_id,
             rs.usuario_id,
             rs.estado,
             rs.comentario,
             rs.fecha_registro,
             ROW_NUMBER() OVER (
               PARTITION BY rs.reporte_id
               ORDER BY rs.fecha_registro DESC, rs.id DESC
             ) AS rn
           FROM reportes_seguimiento rs
           WHERE rs.estado IN ('PENDIENTE_CONFIRMACION', 'COMPLETADO', 'FINALIZADO', 'CERRADO')
         )
         WHERE rn = 1
       )
       SELECT
         r.id AS reporte_id,
         r.tipo_reporte,
         COALESCE(r.origen, 'PROSPECTO') AS origen,
         r.estado,
         r.comentario,
         r.prioridad,
         r.fecha_reportada,
         r.fecha_asignacion,
         r.fecha_programada,
         r.fecha_completado,
         r.comentario_cierre,
         r.tecnico_id,
         trim(t.nombres || ' ' || COALESCE(t.apellido_paterno, '') || ' ' || COALESCE(t.apellido_materno, '')) AS tecnico_nombre,
         com.id AS comunidad_id,
         com.nombre AS comunidad_nombre,
         r.cliente_id,
         cl.numero_cliente,
         trim(cl.nombres || ' ' || COALESCE(cl.apellido_paterno, '') || ' ' || COALESCE(cl.apellido_materno, '')) AS cliente_nombre,
         cl.telefono AS cliente_telefono,
         cl.direccion AS cliente_direccion,
         r.prospecto_id,
         trim(pr.nombres || ' ' || COALESCE(pr.apellido_paterno, '') || ' ' || COALESCE(pr.apellido_materno, '')) AS prospecto_nombre,
         pr.telefono AS prospecto_telefono,
         pr.direccion AS prospecto_direccion,
         pr.referencia AS prospecto_referencia,
         inst.id AS instalacion_fibra_id,
         inst.fecha_instalacion,
         inst.fibra_optica_metros,
         inst.tensor_gancho,
         inst.argollas,
         inst.taquetes,
         inst.sujetadores,
         inst.roseta,
         inst.terminal,
         inst.puerto,
         inst.potencia,
         inst.alfanumerico_equipo,
         inst.comentario_tecnico,
         inst.titular_nombres,
         inst.titular_apellido_paterno,
         inst.titular_apellido_materno,
         inst.titular_telefono,
         inst.titular_direccion,
         inst.contrato_costo_instalacion,
         cajas.id AS caja_id,
         cajas.codigo_caja,
         cajas.nombre AS caja_nombre,
         ct.id AS caja_terminal_id,
         ct.numero_terminal AS caja_terminal_numero,
         paquete.nombre AS paquete_nombre,
         con.id AS contrato_id,
         con.numero_contrato AS contrato_numero,
         cierre.id AS cierre_seguimiento_id,
         cierre.usuario_id AS cierre_usuario_id,
         cierre.estado AS cierre_estado,
         cierre.comentario AS cierre_comentario,
         cierre.fecha_registro AS cierre_fecha,
         CASE
           WHEN r.estado IN ('COMPLETADO', 'FINALIZADO', 'CERRADO') THEN COALESCE(r.fecha_completado, cierre.fecha_registro)
           ELSE COALESCE(cierre.fecha_registro, r.fecha_completado)
         END AS fecha_evento
       FROM reportes r
       JOIN usuarios t ON t.id = r.tecnico_id
       JOIN comunidades com ON com.id = r.comunidad_id
       LEFT JOIN clientes cl ON cl.id = r.cliente_id
       LEFT JOIN prospectos pr ON pr.id = r.prospecto_id
       LEFT JOIN instalaciones_fibra inst ON inst.reporte_id = r.id
       LEFT JOIN cajas_fibra cajas ON cajas.id = inst.caja_id
       LEFT JOIN caja_terminales ct ON ct.id = inst.caja_terminal_id
       LEFT JOIN paquetes paquete ON paquete.id = inst.paquete_instalacion_id
       LEFT JOIN contratos con ON con.instalacion_fibra_id = inst.id AND con.estado = 'GENERADO'
       LEFT JOIN cierre ON cierre.reporte_id = r.id
       WHERE ${filters.join(' AND ')}
       ORDER BY tecnico_nombre ASC, fecha_evento ASC, r.id ASC`
    ).bind(...values).all()

    const trabajos = trabajosRaw ?? []
    const logsByReporte = await getLogsByReporte(env, trabajos.map((item) => item.reporte_id))
    const tecnicosMap = new Map()

    for (const row of trabajos) {
      const tecnicoId = Number(row.tecnico_id)
      if (!tecnicosMap.has(tecnicoId)) {
        tecnicosMap.set(tecnicoId, {
          tecnico_id: tecnicoId,
          tecnico_nombre: row.tecnico_nombre || 'Tecnico sin nombre',
          resumen: {
            total_terminados: 0,
            pendientes_confirmacion: 0,
            confirmados: 0,
            total_costo_instalacion: 0,
          },
          trabajos: [],
        })
      }

      const trabajo = buildTrabajo(row, logsByReporte.get(row.reporte_id) ?? [])
      const tecnico = tecnicosMap.get(tecnicoId)
      tecnico.trabajos.push(trabajo)
      tecnico.resumen.total_terminados += 1
      if (row.estado === 'PENDIENTE_CONFIRMACION') tecnico.resumen.pendientes_confirmacion += 1
      if (ESTADOS_CONFIRMADOS.includes(row.estado)) tecnico.resumen.confirmados += 1
      tecnico.resumen.total_costo_instalacion += trabajo.contrato_costo_instalacion
    }

    if (tecnicoParam !== 'todos' && tecnicosMap.size === 0) {
      const tecnico = await getTecnicoById(env, Number(tecnicoParam))
      if (tecnico) {
        tecnicosMap.set(Number(tecnicoParam), {
          tecnico_id: Number(tecnicoParam),
          tecnico_nombre: tecnico.nombre_completo,
          resumen: {
            total_terminados: 0,
            pendientes_confirmacion: 0,
            confirmados: 0,
            total_costo_instalacion: 0,
          },
          trabajos: [],
        })
      }
    }

    const tecnicos = Array.from(tecnicosMap.values()).map((tecnico) => ({
      ...tecnico,
      trabajos: tecnico.trabajos.sort((a, b) => String(a.fecha_evento || '').localeCompare(String(b.fecha_evento || ''))),
    }))

    const resumen = tecnicos.reduce((acc, tecnico) => {
      acc.total_terminados += tecnico.resumen.total_terminados
      acc.pendientes_confirmacion += tecnico.resumen.pendientes_confirmacion
      acc.confirmados += tecnico.resumen.confirmados
      acc.total_costo_instalacion += tecnico.resumen.total_costo_instalacion
      if (tecnico.resumen.total_terminados > 0) acc.tecnicos_con_actividad += 1
      return acc
    }, {
      total_terminados: 0,
      pendientes_confirmacion: 0,
      confirmados: 0,
      tecnicos_con_actividad: 0,
      total_costo_instalacion: 0,
    })

    return json({
      ok: true,
      fecha,
      estado: estadoParam,
      resumen,
      tecnicos,
    })
  } catch (error) {
    return json({ ok: false, error: error.message || 'Error al obtener bitacora' }, 500)
  }
}

function buildEstadoFilter(estadoParam) {
  if (estadoParam === 'pendientes_confirmacion') {
    return { whereEstado: "r.estado = 'PENDIENTE_CONFIRMACION'", estadoValues: [] }
  }
  if (estadoParam === 'confirmados') {
    return {
      whereEstado: `r.estado IN (${ESTADOS_CONFIRMADOS.map(() => '?').join(', ')})`,
      estadoValues: ESTADOS_CONFIRMADOS,
    }
  }
  return { whereEstado: '', estadoValues: [] }
}

async function getLogsByReporte(env, reporteIds) {
  const ids = [...new Set(reporteIds.map(Number).filter(Boolean))]
  const logsMap = new Map()
  if (ids.length === 0) return logsMap

  const placeholders = ids.map(() => '?').join(', ')
  const { results } = await env.DB.prepare(
    `SELECT
       rs.id AS seguimiento_id,
       rs.reporte_id,
       rs.usuario_id,
       trim(u.nombres || ' ' || COALESCE(u.apellido_paterno, '') || ' ' || COALESCE(u.apellido_materno, '')) AS usuario_nombre,
       rs.estado,
       rs.comentario,
       rs.fecha_registro
     FROM reportes_seguimiento rs
     LEFT JOIN usuarios u ON u.id = rs.usuario_id
     WHERE rs.reporte_id IN (${placeholders})
     ORDER BY rs.fecha_registro ASC, rs.id ASC`
  ).bind(...ids).all()

  for (const log of results ?? []) {
    if (!logsMap.has(log.reporte_id)) logsMap.set(log.reporte_id, [])
    logsMap.get(log.reporte_id).push({
      seguimiento_id: log.seguimiento_id,
      estado: log.estado,
      comentario: log.comentario,
      usuario: log.usuario_nombre || 'Sistema',
      fecha: log.fecha_registro,
      hora: extractTime(log.fecha_registro),
    })
  }

  return logsMap
}

async function getTecnicoById(env, tecnicoId) {
  if (!Number.isFinite(tecnicoId)) return null
  return env.DB.prepare(
    `SELECT
       id,
       trim(nombres || ' ' || COALESCE(apellido_paterno, '') || ' ' || COALESCE(apellido_materno, '')) AS nombre_completo
     FROM usuarios
     WHERE id = ?`
  ).bind(tecnicoId).first()
}

function buildTrabajo(row, logs) {
  const cliente = buildNombreCliente(row)
  const telefono = row.titular_telefono || row.cliente_telefono || row.prospecto_telefono || 'N/A'
  const direccion = row.titular_direccion || row.cliente_direccion || row.prospecto_direccion || 'N/A'
  const contratoCostoInstalacion = safeNumber(row.contrato_costo_instalacion)

  return {
    reporte_id: row.reporte_id,
    tipo_reporte: row.tipo_reporte,
    estado: row.estado,
    estado_label: getEstadoLabel(row.estado),
    hora: extractTime(row.fecha_evento),
    fecha_evento: row.fecha_evento,
    cliente,
    telefono,
    comunidad: row.comunidad_nombre || 'N/A',
    direccion,
    es_imprevista: row.origen === 'DIRECTA_TECNICO',
    contrato_id: row.contrato_id ?? null,
    contrato_numero: row.contrato_numero ?? null,
    contrato_costo_instalacion: contratoCostoInstalacion,
    detalle: {
      reporte_id: row.reporte_id,
      tipo_reporte: row.tipo_reporte,
      estado_actual: row.estado,
      estado_label: getEstadoLabel(row.estado),
      tecnico: row.tecnico_nombre || 'Tecnico sin nombre',
      cliente,
      telefono,
      comunidad: row.comunidad_nombre || 'N/A',
      direccion,
      referencia: row.prospecto_referencia || 'N/A',
      fecha_reportada: row.fecha_reportada,
      fecha_asignacion: row.fecha_asignacion,
      fecha_programada: row.fecha_programada,
      fecha_inicio: findLogDate(logs, 'EN_PROCESO'),
      fecha_cierre_tecnico: findLogDate(logs, 'PENDIENTE_CONFIRMACION') || row.cierre_fecha,
      fecha_confirmacion: row.fecha_completado || findFirstConfirmacion(logs),
      comentario_reporte: row.comentario || 'N/A',
      comentario_cierre: row.comentario_cierre || row.cierre_comentario || row.comentario_tecnico || 'N/A',
      caja: row.caja_nombre || row.codigo_caja || 'N/A',
      terminal: row.caja_terminal_numero ?? row.terminal ?? 'N/A',
      puerto: row.puerto ?? 'N/A',
      potencia: row.potencia ?? null,
      alfanumerico_equipo: row.alfanumerico_equipo || 'N/A',
      paquete: row.paquete_nombre || 'N/A',
      contrato_costo_instalacion: contratoCostoInstalacion,
      materiales: {
        fibra_optica_metros: row.fibra_optica_metros ?? 0,
        tensor_gancho: row.tensor_gancho ?? 0,
        argollas: row.argollas ?? 0,
        taquetes: row.taquetes ?? 0,
        sujetadores: row.sujetadores ?? 0,
        roseta: row.roseta ?? 0,
      },
      contrato_id: row.contrato_id ?? null,
      contrato_numero: row.contrato_numero ?? null,
      es_imprevista: row.origen === 'DIRECTA_TECNICO',
      logs,
    },
  }
}

function buildNombreCliente(row) {
  const titular = [
    row.titular_nombres,
    row.titular_apellido_paterno,
    row.titular_apellido_materno,
  ].filter(Boolean).join(' ').trim()

  return titular || row.cliente_nombre || row.prospecto_nombre || 'N/A'
}

function getEstadoLabel(estado) {
  if (estado === 'PENDIENTE_CONFIRMACION') return 'Terminado por tecnico'
  if (estado === 'COMPLETADO') return 'Confirmado por soporte'
  if (estado === 'FINALIZADO' || estado === 'CERRADO') return 'Completado'
  return estado || 'N/A'
}

function findLogDate(logs, estado) {
  return logs.find((log) => log.estado === estado)?.fecha || null
}

function findFirstConfirmacion(logs) {
  return logs.find((log) => ESTADOS_CONFIRMADOS.includes(log.estado))?.fecha || null
}

function safeNumber(value) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

function extractTime(dateStr) {
  if (!dateStr || String(dateStr).length < 16) return 'N/A'
  return String(dateStr).slice(11, 16)
}

function todayDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
}
