import { requireAuth } from '../utils/auth.js'
import { json } from '../utils/response.js'

export async function getListaTecnicos(request, env) {
  // Validate that user is ADMIN, SOPORTE, or SOPORTE_FIBRA
  const auth = await requireAuth(request, env, ['ADMIN', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  try {
    const { results } = await env.DB.prepare(
      `SELECT DISTINCT u.id, u.nombres || ' ' || COALESCE(u.apellido_paterno, '') || ' ' || COALESCE(u.apellido_materno, '') AS nombre_completo
       FROM usuarios u
       JOIN usuario_roles ur ON ur.usuario_id = u.id
       JOIN roles r ON r.id = ur.rol_id
       WHERE r.nombre IN ('TECNICO', 'TECNICO_FIBRA') AND u.activo = 1
       ORDER BY u.nombres`
    ).all()

    return json({ ok: true, usuarios: results || [] })
  } catch (error) {
    return json({ ok: false, error: error.message || 'Error al obtener técnicos' }, 500)
  }
}

function isRescheduled(text) {
  if (!text) return false
  const t = String(text).toUpperCase()
  return t.includes('REAGEND') || t.includes('RESTABLEC') || t.includes('REASIGN')
}

function extractTime(dateStr) {
  if (!dateStr || dateStr.length < 16) return 'N/A'
  // Date format: YYYY-MM-DD HH:MM:SS
  return dateStr.slice(11, 16)
}

export async function getBitacoraTecnicos(request, env, url) {
  const auth = await requireAuth(request, env, ['ADMIN', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const fecha = url.searchParams.get('fecha') || new Date().toISOString().slice(0, 10)
  const tecnicoParam = url.searchParams.get('tecnico_id') || 'todos'

  try {
    // 1. Fetch reports with active transitions on selected date
    const reportsQuery = `
      SELECT 
        r.id AS reporte_id,
        r.tipo_reporte,
        r.estado AS reporte_estado,
        r.origen AS reporte_origen,
        r.comentario AS reporte_comentario,
        r.prioridad AS reporte_prioridad,
        r.fecha_reportada,
        r.fecha_asignacion,
        r.fecha_programada,
        r.fecha_completado,
        r.comentario_cierre,
        r.tecnico_id,
        t.nombres || ' ' || COALESCE(t.apellido_paterno, '') || ' ' || COALESCE(t.apellido_materno, '') AS tecnico_nombre,
        com.nombre AS comunidad_nombre,
        r.cliente_id,
        cl.nombres || ' ' || COALESCE(cl.apellido_paterno, '') || ' ' || COALESCE(cl.apellido_materno, '') AS cliente_nombre,
        cl.telefono AS cliente_telefono,
        cl.direccion AS cliente_direccion,
        r.prospecto_id,
        pr.nombres || ' ' || COALESCE(pr.apellido_paterno, '') || ' ' || COALESCE(pr.apellido_materno, '') AS prospecto_nombre,
        pr.telefono AS prospecto_telefono,
        pr.direccion AS prospecto_direccion,
        inst.puerto AS inst_caja,
        inst.terminal AS inst_terminal,
        inst.potencia AS inst_potencia,
        inst.fibra_optica_metros AS inst_metros,
        p.nombre AS paquete_nombre,
        con.id AS contrato_id,
        con.numero_contrato AS contrato_numero
      FROM reportes r
      LEFT JOIN usuarios t ON t.id = r.tecnico_id
      LEFT JOIN comunidades com ON com.id = r.comunidad_id
      LEFT JOIN clientes cl ON cl.id = r.cliente_id
      LEFT JOIN prospectos pr ON pr.id = r.prospecto_id
      LEFT JOIN instalaciones_fibra inst ON inst.reporte_id = r.id
      LEFT JOIN paquetes p ON p.id = inst.paquete_instalacion_id
      LEFT JOIN contratos con ON con.instalacion_fibra_id = inst.id AND con.estado = 'GENERADO'
      WHERE r.id IN (
        SELECT DISTINCT r2.id
        FROM reportes r2
        LEFT JOIN reportes_seguimiento rs2 ON rs2.reporte_id = r2.id
        WHERE (
          date(r2.fecha_reportada) = date(?)
          OR date(r2.fecha_asignacion) = date(?)
          OR date(r2.fecha_completado) = date(?)
          OR (rs2.id IS NOT NULL AND date(rs2.fecha_registro) = date(?))
        )
      )
      ${tecnicoParam !== 'todos' ? 'AND r.tecnico_id = ?' : ''}
    `

    const params = [fecha, fecha, fecha, fecha]
    if (tecnicoParam !== 'todos') {
      params.push(Number(tecnicoParam))
    }

    const { results: reports } = await env.DB.prepare(reportsQuery).bind(...params).all()

    // 2. Fetch tracking logs on that date
    const logsQuery = `
      SELECT 
        rs.id AS seguimiento_id,
        rs.reporte_id,
        rs.usuario_id AS actor_id,
        u.nombres || ' ' || COALESCE(u.apellido_paterno, '') || ' ' || COALESCE(u.apellido_materno, '') AS actor_nombre,
        rs.estado AS evento_estado,
        rs.comentario AS evento_comentario,
        rs.fecha_registro AS evento_fecha
      FROM reportes_seguimiento rs
      JOIN usuarios u ON u.id = rs.usuario_id
      WHERE rs.reporte_id IN (
        SELECT DISTINCT r2.id
        FROM reportes r2
        LEFT JOIN reportes_seguimiento rs2 ON rs2.reporte_id = r2.id
        WHERE (
          date(r2.fecha_reportada) = date(?)
          OR date(r2.fecha_asignacion) = date(?)
          OR date(r2.fecha_completado) = date(?)
          OR (rs2.id IS NOT NULL AND date(rs2.fecha_registro) = date(?))
        )
      )
      AND date(rs.fecha_registro) = date(?)
      ORDER BY rs.fecha_registro ASC
    `
    const logParams = [fecha, fecha, fecha, fecha, fecha]
    const { results: logs } = await env.DB.prepare(logsQuery).bind(...logParams).all()

    const tecnicosMap = new Map()

    for (const r of (reports || [])) {
      const tecnicoId = r.tecnico_id || 0
      const tecnicoNombre = r.tecnico_id ? r.tecnico_nombre : 'Sin Asignar'

      // Filter by selected technician if requested (in case tecnico_id is 0 but we want specific)
      if (tecnicoParam !== 'todos' && Number(tecnicoParam) !== tecnicoId) {
        continue
      }

      if (!tecnicosMap.has(tecnicoId)) {
        tecnicosMap.set(tecnicoId, {
          tecnico_id: tecnicoId,
          tecnico_nombre: tecnicoNombre,
          actividades: [],
          resumen: {
            total: 0,
            completadas: 0,
            pendientes_confirmacion: 0,
            en_proceso: 0,
            reagendadas: 0
          }
        })
      }

      const tObj = tecnicosMap.get(tecnicoId)
      const rLogs = (logs || []).filter(l => l.reporte_id === r.reporte_id)

      const events = []

      // Add real logs
      for (const log of rLogs) {
        let descripcion = log.evento_comentario
        if (log.evento_estado === 'PENDIENTE_CONFIRMACION') {
          descripcion = 'Técnico envió a confirmación' + (log.evento_comentario ? ` - ${log.evento_comentario}` : '')
        } else if (log.evento_estado === 'COMPLETADO') {
          descripcion = 'Confirmado por soporte (Completado)' + (log.evento_comentario ? ` - ${log.evento_comentario}` : '')
        } else if (log.evento_estado === 'EN_PROCESO') {
          descripcion = 'Técnico inició el reporte' + (log.evento_comentario ? ` - ${log.evento_comentario}` : '')
        } else if (log.evento_estado === 'ASIGNADO') {
          descripcion = 'Reporte asignado al técnico' + (log.evento_comentario ? ` - ${log.evento_comentario}` : '')
        } else if (log.evento_estado === 'CANCELADO') {
          descripcion = 'Reporte cancelado' + (log.evento_comentario ? ` - ${log.evento_comentario}` : '')
        } else if (log.evento_estado === 'NO_LOCALIZADO') {
          descripcion = 'Técnico reportó cliente no localizado' + (log.evento_comentario ? ` - ${log.evento_comentario}` : '')
        }

        events.push({
          seguimiento_id: log.seguimiento_id,
          reporte_id: r.reporte_id,
          hora: extractTime(log.evento_fecha),
          raw_fecha: log.evento_fecha,
          tipo: r.tipo_reporte,
          estado: log.evento_estado,
          actor: log.actor_nombre,
          descripcion,
          cliente: r.cliente_nombre || r.prospecto_nombre || 'N/A',
          telefono: r.cliente_telefono || r.prospecto_telefono || 'N/A',
          direccion: r.cliente_direccion || r.prospecto_direccion || 'N/A',
          comunidad: r.comunidad_nombre || 'N/A',
          caja: r.inst_caja || null,
          terminal: r.inst_terminal || null,
          potencia: r.inst_potencia || null,
          metros: r.inst_metros || null,
          paquete: r.paquete_nombre || null,
          contrato_id: r.contrato_id || null,
          contrato_numero: r.contrato_numero || null,
          origen: r.reporte_origen,
          observaciones: r.reporte_comentario || 'N/A'
        })
      }

      // If no logs, synthesize events based on dates
      if (events.length === 0) {
        if (r.fecha_completado && r.fecha_completado.startsWith(fecha)) {
          events.push({
            reporte_id: r.reporte_id,
            hora: extractTime(r.fecha_completado),
            raw_fecha: r.fecha_completado,
            tipo: r.tipo_reporte,
            estado: 'COMPLETADO',
            actor: 'Sistema',
            descripcion: 'Confirmado por soporte (Completado)' + (r.comentario_cierre ? ` - ${r.comentario_cierre}` : ''),
            cliente: r.cliente_nombre || r.prospecto_nombre || 'N/A',
            telefono: r.cliente_telefono || r.prospecto_telefono || 'N/A',
            direccion: r.cliente_direccion || r.prospecto_direccion || 'N/A',
            comunidad: r.comunidad_nombre || 'N/A',
            caja: r.inst_caja || null,
            terminal: r.inst_terminal || null,
            potencia: r.inst_potencia || null,
            metros: r.inst_metros || null,
            paquete: r.paquete_nombre || null,
            contrato_id: r.contrato_id || null,
            contrato_numero: r.contrato_numero || null,
            origen: r.reporte_origen,
            observaciones: r.reporte_comentario || 'N/A'
          })
        } else if (r.fecha_asignacion && r.fecha_asignacion.startsWith(fecha)) {
          events.push({
            reporte_id: r.reporte_id,
            hora: extractTime(r.fecha_asignacion),
            raw_fecha: r.fecha_asignacion,
            tipo: r.tipo_reporte,
            estado: 'ASIGNADO',
            actor: 'Sistema',
            descripcion: 'Reporte asignado al técnico',
            cliente: r.cliente_nombre || r.prospecto_nombre || 'N/A',
            telefono: r.cliente_telefono || r.prospecto_telefono || 'N/A',
            direccion: r.cliente_direccion || r.prospecto_direccion || 'N/A',
            comunidad: r.comunidad_nombre || 'N/A',
            caja: r.inst_caja || null,
            terminal: r.inst_terminal || null,
            potencia: r.inst_potencia || null,
            metros: r.inst_metros || null,
            paquete: r.paquete_nombre || null,
            contrato_id: r.contrato_id || null,
            contrato_numero: r.contrato_numero || null,
            origen: r.reporte_origen,
            observaciones: r.reporte_comentario || 'N/A'
          })
        } else if (r.fecha_reportada && r.fecha_reportada.startsWith(fecha)) {
          events.push({
            reporte_id: r.reporte_id,
            hora: extractTime(r.fecha_reportada),
            raw_fecha: r.fecha_reportada,
            tipo: r.tipo_reporte,
            estado: 'PENDIENTE',
            actor: 'Sistema',
            descripcion: 'Reporte creado en el sistema',
            cliente: r.cliente_nombre || r.prospecto_nombre || 'N/A',
            telefono: r.cliente_telefono || r.prospecto_telefono || 'N/A',
            direccion: r.cliente_direccion || r.prospecto_direccion || 'N/A',
            comunidad: r.comunidad_nombre || 'N/A',
            caja: r.inst_caja || null,
            terminal: r.inst_terminal || null,
            potencia: r.inst_potencia || null,
            metros: r.inst_metros || null,
            paquete: r.paquete_nombre || null,
            contrato_id: r.contrato_id || null,
            contrato_numero: r.contrato_numero || null,
            origen: r.reporte_origen,
            observaciones: r.reporte_comentario || 'N/A'
          })
        }
      }

      tObj.actividades.push(...events)
    }

    // Force add selected technician with empty state if filtered and not present
    if (tecnicoParam !== 'todos' && !tecnicosMap.has(Number(tecnicoParam))) {
      const techUser = await env.DB.prepare(
        `SELECT nombres || ' ' || COALESCE(apellido_paterno, '') || ' ' || COALESCE(apellido_materno, '') AS name 
         FROM usuarios WHERE id = ?`
      ).bind(Number(tecnicoParam)).first()

      if (techUser) {
        tecnicosMap.set(Number(tecnicoParam), {
          tecnico_id: Number(tecnicoParam),
          tecnico_nombre: techUser.name,
          actividades: [],
          resumen: { total: 0, completadas: 0, pendientes_confirmacion: 0, en_proceso: 0, reagendadas: 0 }
        })
      }
    }

    // Calculate summaries and sort chronologically
    const globalResumen = {
      total_actividades: 0,
      completadas: 0,
      pendientes_confirmacion: 0,
      en_proceso: 0,
      reagendadas: 0
    }

    for (const tObj of tecnicosMap.values()) {
      tObj.actividades.sort((a, b) => (a.raw_fecha || '').localeCompare(b.raw_fecha || ''))

      const reportIds = new Set(tObj.actividades.map(a => a.reporte_id))
      tObj.resumen.total = reportIds.size

      const completed = new Set()
      const pendingConf = new Set()
      const inProcess = new Set()
      const rescheduled = new Set()

      for (const act of tObj.actividades) {
        if (act.estado === 'COMPLETADO') completed.add(act.reporte_id)
        if (act.estado === 'PENDIENTE_CONFIRMACION') pendingConf.add(act.reporte_id)
        if (act.estado === 'EN_PROCESO') inProcess.add(act.reporte_id)
        if (isRescheduled(act.descripcion) || isRescheduled(act.observaciones)) {
          rescheduled.add(act.reporte_id)
        }
      }

      tObj.resumen.completadas = completed.size
      tObj.resumen.pendientes_confirmacion = pendingConf.size
      tObj.resumen.en_proceso = inProcess.size
      tObj.resumen.reagendadas = rescheduled.size

      globalResumen.total_actividades += tObj.resumen.total
      globalResumen.completadas += tObj.resumen.completadas
      globalResumen.pendientes_confirmacion += tObj.resumen.pendientes_confirmacion
      globalResumen.en_proceso += tObj.resumen.en_proceso
      globalResumen.reagendadas += tObj.resumen.reagendadas
    }

    return json({
      ok: true,
      fecha,
      resumen: globalResumen,
      tecnicos: Array.from(tecnicosMap.values())
    })
  } catch (error) {
    return json({ ok: false, error: error.message || 'Error al obtener bitácora' }, 500)
  }
}
