import { json } from '../utils/response.js'
import {
  createUsuario,
  listRoles,
  listTecnicos,
  listUsuarios,
  updateUsuario,
  updateUsuarioEstado,
  updateUsuarioPassword,
} from '../services/usuarios.service.js'

export async function handleUsuariosRoutes(request, env, url) {
  if (request.method === 'GET' && url.pathname === '/api/roles') return listRoles(request, env)

  if (request.method === 'GET' && url.pathname === '/api/usuarios/tecnicos') {
    return listTecnicos(request, env)
  }

  if (request.method === 'GET' && url.pathname === '/api/usuarios') return listUsuarios(request, env)
  if (request.method === 'POST' && url.pathname === '/api/usuarios') return createUsuario(request, env)

  const usuarioMatch = url.pathname.match(/^\/api\/usuarios\/(\d+)$/)
  if (usuarioMatch && request.method === 'PATCH') return updateUsuario(request, env, Number(usuarioMatch[1]))

  const estadoMatch = url.pathname.match(/^\/api\/usuarios\/(\d+)\/estado$/)
  if (estadoMatch && request.method === 'PATCH') return updateUsuarioEstado(request, env, Number(estadoMatch[1]))

  const passwordMatch = url.pathname.match(/^\/api\/usuarios\/(\d+)\/password$/)
  if (passwordMatch && request.method === 'PATCH') return updateUsuarioPassword(request, env, Number(passwordMatch[1]))

  return json({ error: 'Ruta no encontrada' }, 404)
}
