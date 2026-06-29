import { json } from '../utils/response.js'
import { createProspecto, deleteProspecto, listProspectos, listProspectosDisponibles, updateProspecto } from '../services/prospectos.service.js'

export async function handleProspectosRoutes(request, env, url) {
  if (request.method === 'GET' && url.pathname === '/api/prospectos/disponibles') {
    return listProspectosDisponibles(request, env, url)
  }

  if (request.method === 'GET' && url.pathname === '/api/prospectos') {
    return listProspectos(request, env, url)
  }

  if (request.method === 'POST' && url.pathname === '/api/prospectos') {
    return createProspecto(request, env)
  }

  const prospectoMatch = url.pathname.match(/^\/api\/prospectos\/(\d+)$/)
  if (prospectoMatch && request.method === 'PATCH') {
    return updateProspecto(request, env, Number(prospectoMatch[1]))
  }

  if (prospectoMatch && request.method === 'DELETE') {
    return deleteProspecto(request, env, Number(prospectoMatch[1]))
  }

  return json({ error: 'Ruta no encontrada' }, 404)
}
