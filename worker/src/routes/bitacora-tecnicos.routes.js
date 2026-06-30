import { json } from '../utils/response.js'
import { getBitacoraTecnicos, getListaTecnicos } from '../services/bitacora-tecnicos.service.js'

export async function handleBitacoraTecnicosRoutes(request, env, url) {
  if (request.method === 'GET' && url.pathname === '/api/bitacora-tecnicos/tecnicos') {
    return getListaTecnicos(request, env)
  }

  if (request.method === 'GET' && url.pathname === '/api/bitacora-tecnicos') {
    return getBitacoraTecnicos(request, env, url)
  }

  return json({ error: 'Ruta no encontrada' }, 404)
}
