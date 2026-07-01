import { json } from '../utils/response.js'
import { getAtencionDashboardResumen } from '../services/atencion-dashboard.service.js'

export async function handleAtencionDashboardRoutes(request, env, url) {
  if (request.method === 'GET' && url.pathname === '/api/atencion/dashboard-resumen') {
    return getAtencionDashboardResumen(request, env, url)
  }

  return json({ ok: false, error: 'Ruta no encontrada' }, 404)
}
