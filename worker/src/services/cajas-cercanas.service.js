import { requireAuth } from '../utils/auth.js'
import { json } from '../utils/response.js'

export async function getCajasCercanas(request, env) {
  // Validate role (TECNICO, TECNICO_FIBRA, ADMIN)
  const auth = await requireAuth(request, env, ['TECNICO', 'TECNICO_FIBRA', 'ADMIN'])
  if (auth.response) return auth.response

  try {
    // 1. Get active boxes and count terminals by state
    const { results: cajas } = await env.DB.prepare(
      `SELECT 
         cf.id,
         cf.nombre,
         cf.codigo_caja,
         cf.nombre_original_kml,
         cf.latitud,
         cf.longitud,
         c.nombre AS comunidad,
         (SELECT COUNT(*) FROM caja_terminales WHERE caja_id = cf.id) AS terminales_total,
         (SELECT COUNT(*) FROM caja_terminales WHERE caja_id = cf.id AND estado = 'LIBRE') AS terminales_libres,
         (SELECT COUNT(*) FROM caja_terminales WHERE caja_id = cf.id AND estado = 'OCUPADO') AS terminales_ocupadas,
         (SELECT COUNT(*) FROM caja_terminales WHERE caja_id = cf.id AND estado = 'RESERVADO') AS terminales_reservadas,
         (SELECT COUNT(*) FROM caja_terminales WHERE caja_id = cf.id AND estado = 'DAÑADO') AS terminales_danadas
       FROM cajas_fibra cf
       JOIN comunidades c ON c.id = cf.comunidad_id
       WHERE cf.activo = 1`
    ).all()

    // 2. Get individual terminals to build structured response in a single go
    const { results: terminales } = await env.DB.prepare(
      `SELECT 
         id,
         caja_id,
         numero_terminal,
         estado
       FROM caja_terminales
       WHERE caja_id IN (SELECT id FROM cajas_fibra WHERE activo = 1)
       ORDER BY caja_id, numero_terminal`
    ).all()

    const terminalsMap = new Map()
    for (const t of (terminales || [])) {
      if (!terminalsMap.has(t.caja_id)) {
        terminalsMap.set(t.caja_id, [])
      }
      terminalsMap.get(t.caja_id).push({
        id: t.id,
        numero_terminal: t.numero_terminal,
        estado: t.estado
      })
    }

    const results = (cajas || []).map(cf => ({
      id: cf.id,
      nombre: cf.nombre,
      codigo: cf.codigo_caja,
      nombre_original_kml: cf.nombre_original_kml,
      comunidad: cf.comunidad,
      latitud: cf.latitud,
      longitud: cf.longitud,
      terminales_total: cf.terminales_total,
      terminales_libres: cf.terminales_libres,
      terminales_ocupadas: cf.terminales_ocupadas,
      terminales_reservadas: cf.terminales_reservadas,
      terminales_danadas: cf.terminales_danadas,
      terminales: terminalsMap.get(cf.id) || []
    }))

    return json({ ok: true, cajas: results })
  } catch (error) {
    return json({ ok: false, error: error.message || 'Error al obtener cajas cercanas' }, 500)
  }
}
