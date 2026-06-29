import { json } from '../utils/response.js'
import { login, logout, me } from '../services/auth.service.js'

export async function handleAuthRoutes(request, env, url) {
  if (request.method === 'POST' && (url.pathname === '/api/auth/login' || url.pathname === '/api/login')) {
    return login(request, env)
  }

  if (request.method === 'GET' && url.pathname === '/api/me') {
    return me(request, env)
  }

  if (request.method === 'POST' && url.pathname === '/api/logout') {
    return logout(request, env)
  }

  return json({ error: 'Ruta no encontrada' }, 404)
}
