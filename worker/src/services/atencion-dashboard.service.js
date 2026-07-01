import { requireAuth } from '../utils/auth.js'
import { json } from '../utils/response.js'

export async function getAtencionDashboardResumen(request, env, url) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'ATENCION', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const fecha = url.searchParams.get('fecha')
  const dateParam = fecha ? [fecha] : []
  const datePlaceholder = fecha ? 'DATE(?)' : "DATE('now', 'localtime')"

  try {
    const queries = [
      env.DB.prepare(`SELECT COUNT(*) AS total FROM prospectos WHERE DATE(fecha_registro) = ${datePlaceholder}`).bind(...dateParam),
      env.DB.prepare(`SELECT COUNT(*) AS total FROM clientes WHERE DATE(fecha_registro) = ${datePlaceholder}`).bind(...dateParam),
      env.DB.prepare(`SELECT COUNT(*) AS total FROM reportes WHERE DATE(fecha_reportada) = ${datePlaceholder}`).bind(...dateParam),
      env.DB.prepare(`SELECT COUNT(*) AS total FROM reportes WHERE estado = 'COMPLETADO' AND fecha_completado IS NOT NULL AND DATE(fecha_completado) = ${datePlaceholder}`).bind(...dateParam),
      env.DB.prepare(`SELECT COUNT(*) AS total FROM clientes`),
      env.DB.prepare(`SELECT COUNT(*) AS total FROM prospectos`),
      env.DB.prepare(`SELECT COUNT(*) AS total FROM reportes WHERE estado IN ('PENDIENTE', 'ASIGNADO', 'PENDIENTE_CONFIRMACION', 'NO_LOCALIZADO')`),
      env.DB.prepare(`SELECT COUNT(*) AS total FROM reportes WHERE estado = 'EN_PROCESO'`)
    ]

    const results = await env.DB.batch(queries)

    return json({
      ok: true,
      prospectos_hoy: results[0].results[0]?.total ?? 0,
      clientes_hoy: results[1].results[0]?.total ?? 0,
      reportes_creados_hoy: results[2].results[0]?.total ?? 0,
      reportes_completados_hoy: results[3].results[0]?.total ?? 0,
      total_clientes: results[4].results[0]?.total ?? 0,
      total_prospectos: results[5].results[0]?.total ?? 0,
      reportes_pendientes: results[6].results[0]?.total ?? 0,
      reportes_en_proceso: results[7].results[0]?.total ?? 0
    })
  } catch (err) {
    return json({ ok: false, error: err.message || 'Error al obtener resumen de atención' }, 500)
  }
}
