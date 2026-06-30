import { json } from '../utils/response.js'
import { getCajasCercanas } from '../services/cajas-cercanas.service.js'

export async function handleCajasCercanasRoutes(request, env, url) {
  if (request.method === 'GET' && url.pathname === '/api/cajas-cercanas') {
    return getCajasCercanas(request, env)
  }

  return json({ error: 'Ruta no encontrada' }, 404)
}
