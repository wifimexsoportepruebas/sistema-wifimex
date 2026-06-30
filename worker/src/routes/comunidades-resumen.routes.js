import { requireAuth } from '../utils/auth.js'
import { json } from '../utils/response.js'

export async function handleComunidadesResumenRoute(request, env) {
  // Allowed roles: ADMIN, SOPORTE, SOPORTE_FIBRA, ATENCION_CLIENTE
  const auth = await requireAuth(request, env, ['ADMIN', 'SOPORTE', 'SOPORTE_FIBRA', 'ATENCION_CLIENTE'])
  if (auth.response) return auth.response

  try {
    const { results } = await env.DB.prepare(
      `SELECT 
         id, 
         nombre, 
         prefijo, 
         vlan, 
         olt_ip, 
         activo 
       FROM comunidades 
       WHERE activo = 1 
       ORDER BY 
         CASE WHEN numero_inicial_cliente IS NULL THEN 1 ELSE 0 END, 
         numero_inicial_cliente ASC, 
         nombre ASC`
    ).all()

    return json({ ok: true, comunidades: results || [] })
  } catch (error) {
    return json({ ok: false, error: error.message || 'Error al obtener resumen de comunidades' }, 500)
  }
}
