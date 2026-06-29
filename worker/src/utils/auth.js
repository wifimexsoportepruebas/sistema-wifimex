import { json } from './response.js'
import { verifyAuthToken } from './crypto.js'

export async function getSession(request, env) {
  const token = getBearerToken(request)
  if (!token) return null

  const payload = await verifyAuthToken(env, token)
  if (!payload) return null

  const user = await env.DB.prepare(
    `SELECT id, numero_empleado, nombres, apellido_paterno, apellido_materno, activo
     FROM usuarios
     WHERE id = ? AND activo = 1`
  )
    .bind(payload.sub)
    .first()

  if (!user) return null

  return { ...user, usuario_id: user.id }
}

export async function requireAuth(request, env, allowedRoles = []) {
  const session = await getSession(request, env)

  if (!session) {
    return { response: json({ error: 'Sesion invalida o expirada' }, 401) }
  }

  const roles = await getUserRoles(env, session.usuario_id)

  if (allowedRoles.length && !roles.includes('ADMIN')) {
    const allowed = allowedRoles.some((role) => roles.includes(role))
    if (!allowed) {
      return { response: json({ error: 'No tienes permiso para esta accion' }, 403) }
    }
  }

  return { session, roles }
}

export async function getUserRoles(env, userId) {
  const { results } = await env.DB.prepare(
    `SELECT roles.nombre
     FROM usuario_roles
     JOIN roles ON roles.id = usuario_roles.rol_id
     WHERE usuario_roles.usuario_id = ? AND roles.activo = 1
     ORDER BY roles.nombre`
  )
    .bind(userId)
    .all()

  return results.map((role) => role.nombre)
}

export function getBearerToken(request) {
  const header = request.headers.get('Authorization') ?? ''
  const [type, token] = header.split(' ')
  return type === 'Bearer' && token ? token : null
}

export function publicUser(user) {
  const nombreCompleto = [user.nombres, user.apellido_paterno, user.apellido_materno].filter(Boolean).join(' ')

  return {
    id: user.id,
    numero_empleado: user.numero_empleado,
    nombre: nombreCompleto || user.numero_empleado,
    nombres: user.nombres,
    apellido_paterno: user.apellido_paterno,
    apellido_materno: user.apellido_materno,
  }
}
