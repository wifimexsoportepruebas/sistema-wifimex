import { json } from '../utils/response.js'
import {
  getComunidadesAdmin,
  getComunidadById,
  crearComunidad,
  editarComunidad,
  toggleComunidadEstado
} from '../services/comunidades-admin.service.js'

export async function handleComunidadesAdminRoutes(request, env, url) {
  const parts = url.pathname.split('/').filter(Boolean)

  if (request.method === 'GET' && parts.length === 2 && parts[1] === 'comunidades-admin') {
    return getComunidadesAdmin(request, env, url)
  }

  if (request.method === 'GET' && parts.length === 3 && parts[1] === 'comunidades-admin') {
    const id = Number(parts[2])
    return getComunidadById(request, env, id)
  }

  if (request.method === 'POST' && parts.length === 2 && parts[1] === 'comunidades-admin') {
    return crearComunidad(request, env)
  }

  if (request.method === 'PUT' && parts.length === 3 && parts[1] === 'comunidades-admin') {
    const id = Number(parts[2])
    return editarComunidad(request, env, id)
  }

  if (request.method === 'PATCH' && parts.length === 4 && parts[1] === 'comunidades-admin' && parts[3] === 'estado') {
    const id = Number(parts[2])
    return toggleComunidadEstado(request, env, id)
  }

  return json({ error: 'Ruta no encontrada' }, 404)
}
