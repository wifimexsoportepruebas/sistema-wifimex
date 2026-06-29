import { json } from '../utils/response.js'
import { createAuthToken, verifyPassword } from '../utils/crypto.js'
import { getSession, getUserRoles, publicUser } from '../utils/auth.js'

export async function login(request, env) {
  const body = await request.json().catch(() => null)
  const numeroEmpleado = String(body?.numero_empleado ?? body?.identifier ?? '').trim()
  const password = String(body?.password ?? '')
  const remember = Boolean(body?.remember)

  if (!numeroEmpleado || !password) {
    return json({ error: 'Numero de empleado y contrasena son obligatorios' }, 400)
  }

  const user = await env.DB.prepare(
    `SELECT id, numero_empleado, nombres, apellido_paterno, apellido_materno, password_hash, activo
     FROM usuarios
     WHERE activo = 1
       AND lower(numero_empleado) = ?`
  )
    .bind(numeroEmpleado.toLowerCase())
    .first()

  if (!user) return json({ error: 'Credenciales invalidas' }, 401)

  const passwordOk = await verifyPassword(password, user.password_hash)
  if (!passwordOk) return json({ error: 'Credenciales invalidas' }, 401)

  const roles = await getUserRoles(env, user.id)
  const token = await createAuthToken(env, user.id, remember)

  return json({ token, usuario: publicUser(user), roles })
}

export async function me(request, env) {
  const session = await getSession(request, env)
  if (!session) return json({ error: 'Sesion invalida o expirada' }, 401)

  const roles = await getUserRoles(env, session.usuario_id)
  return json({ usuario: publicUser(session), roles })
}

export async function logout() {
  return json({ ok: true })
}
