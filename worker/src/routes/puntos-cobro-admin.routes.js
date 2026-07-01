import { json } from '../utils/response.js'
import {
  listPuntosCobroAdmin,
  createPuntoCobroAdmin,
  updatePuntoCobroAdmin,
  togglePuntoCobroAdmin,
  regeneratePuntoCobroTokenAdmin,
  getResumenMensualGeneralAdmin,
  getDetallePagosAdmin
} from '../services/puntos-cobro-admin.service.js'

export async function handlePuntosCobroAdminRoutes(request, env, url) {
  // GET /api/admin/puntos-cobro/resumen (must be checked before /:id because of route matching priority)
  if (request.method === 'GET' && url.pathname === '/api/admin/puntos-cobro/resumen') {
    return getResumenMensualGeneralAdmin(env, url, request)
  }

  // GET /api/admin/puntos-cobro/pagos
  if (request.method === 'GET' && url.pathname === '/api/admin/puntos-cobro/pagos') {
    return getDetallePagosAdmin(env, url, request)
  }

  // GET /api/admin/puntos-cobro
  if (request.method === 'GET' && url.pathname === '/api/admin/puntos-cobro') {
    return listPuntosCobroAdmin(request, env)
  }

  // POST /api/admin/puntos-cobro
  if (request.method === 'POST' && url.pathname === '/api/admin/puntos-cobro') {
    return createPuntoCobroAdmin(request, env)
  }

  // PUT /api/admin/puntos-cobro/:id
  const putMatch = url.pathname.match(/^\/api\/admin\/puntos-cobro\/(\d+)$/)
  if (putMatch && request.method === 'PUT') {
    return updatePuntoCobroAdmin(request, env, Number(putMatch[1]))
  }

  // PATCH /api/admin/puntos-cobro/:id/activo
  const patchMatch = url.pathname.match(/^\/api\/admin\/puntos-cobro\/(\d+)\/activo$/)
  if (patchMatch && request.method === 'PATCH') {
    return togglePuntoCobroAdmin(request, env, Number(patchMatch[1]))
  }

  // POST /api/admin/puntos-cobro/:id/regenerar-token
  const regenMatch = url.pathname.match(/^\/api\/admin\/puntos-cobro\/(\d+)\/regenerar-token$/)
  if (regenMatch && request.method === 'POST') {
    return regeneratePuntoCobroTokenAdmin(request, env, Number(regenMatch[1]))
  }

  return json({ ok: false, error: 'Ruta administrativa de punto de cobro no encontrada' }, 404)
}
