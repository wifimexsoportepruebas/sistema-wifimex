import bcrypt from 'bcryptjs'
import { requireAuth } from '../utils/auth.js'
import { json } from '../utils/response.js'

const ADMIN_ROLES = ['ADMIN']

export async function listUsuarios(request, env) {
  const auth = await requireAuth(request, env, ADMIN_ROLES)
  if (auth.response) return auth.response

  const { results } = await env.DB.prepare(
    `SELECT
       u.id,
       u.numero_empleado,
       u.nombres,
       u.apellido_paterno,
       u.apellido_materno,
       u.activo,
       u.fecha_registro,
       r.id AS rol_id,
       r.nombre AS rol_nombre
     FROM usuarios u
     LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
     LEFT JOIN roles r ON r.id = ur.rol_id
     ORDER BY u.fecha_registro DESC, u.id DESC`
  ).all()

  return json({ ok: true, usuarios: results ?? [] })
}

export async function listRoles(request, env) {
  const auth = await requireAuth(request, env, ADMIN_ROLES)
  if (auth.response) return auth.response

  const { results } = await env.DB.prepare(
    `SELECT id, nombre, descripcion
     FROM roles
     WHERE activo = 1
     ORDER BY id ASC`
  ).all()

  return json({ ok: true, roles: results ?? [] })
}

export async function listTecnicos(request, env) {
  const auth = await requireAuth(request, env)
  if (auth.response) return auth.response

  const { results } = await env.DB.prepare(
    `SELECT DISTINCT
       usuarios.id,
       trim(usuarios.nombres || ' ' || COALESCE(usuarios.apellido_paterno, '') || ' ' || COALESCE(usuarios.apellido_materno, '')) AS nombre,
       usuarios.numero_empleado
     FROM usuarios
     JOIN usuario_roles ON usuario_roles.usuario_id = usuarios.id
     JOIN roles ON roles.id = usuario_roles.rol_id
     WHERE usuarios.activo = 1
       AND roles.activo = 1
       AND roles.nombre IN ('TECNICO', 'TECNICO_FIBRA')
     ORDER BY usuarios.nombres`
  ).all()

  return json({ tecnicos: results ?? [] })
}

export async function createUsuario(request, env) {
  const auth = await requireAuth(request, env, ADMIN_ROLES)
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  const validation = await validateUsuarioPayload(env, body, { creating: true })
  if (validation.response) return validation.response

  const existing = await env.DB.prepare(
    'SELECT id FROM usuarios WHERE lower(numero_empleado) = ? LIMIT 1'
  ).bind(validation.data.numero_empleado.toLowerCase()).first()
  if (existing) return json({ ok: false, error: 'El numero de empleado ya existe' }, 409)

  const passwordHash = await bcrypt.hash(validation.data.password, 10)
  const info = await env.DB.prepare(
    `INSERT INTO usuarios (
       numero_empleado, nombres, apellido_paterno, apellido_materno, password_hash, activo, fecha_registro
     ) VALUES (?, ?, ?, ?, ?, 1, datetime('now'))`
  ).bind(
    validation.data.numero_empleado,
    validation.data.nombres,
    validation.data.apellido_paterno,
    validation.data.apellido_materno,
    passwordHash
  ).run()

  const usuarioId = info.meta?.last_row_id
  await setUsuarioRol(env, usuarioId, validation.data.rol_id)

  return json({ ok: true, id: usuarioId }, 201)
}

export async function updateUsuario(request, env, usuarioId) {
  const auth = await requireAuth(request, env, ADMIN_ROLES)
  if (auth.response) return auth.response

  const usuario = await getUsuarioById(env, usuarioId)
  if (!usuario) return json({ ok: false, error: 'Usuario no encontrado' }, 404)

  const body = await request.json().catch(() => null)
  const validation = await validateUsuarioPayload(env, body, { creating: false })
  if (validation.response) return validation.response

  const existing = await env.DB.prepare(
    'SELECT id FROM usuarios WHERE lower(numero_empleado) = ? AND id <> ? LIMIT 1'
  ).bind(validation.data.numero_empleado.toLowerCase(), usuarioId).first()
  if (existing) return json({ ok: false, error: 'El numero de empleado ya existe' }, 409)

  await env.DB.prepare(
    `UPDATE usuarios
     SET numero_empleado = ?,
         nombres = ?,
         apellido_paterno = ?,
         apellido_materno = ?,
         activo = ?
     WHERE id = ?`
  ).bind(
    validation.data.numero_empleado,
    validation.data.nombres,
    validation.data.apellido_paterno,
    validation.data.apellido_materno,
    validation.data.activo,
    usuarioId
  ).run()

  await setUsuarioRol(env, usuarioId, validation.data.rol_id)
  return json({ ok: true })
}

export async function updateUsuarioEstado(request, env, usuarioId) {
  const auth = await requireAuth(request, env, ADMIN_ROLES)
  if (auth.response) return auth.response

  const usuario = await getUsuarioById(env, usuarioId)
  if (!usuario) return json({ ok: false, error: 'Usuario no encontrado' }, 404)

  const body = await request.json().catch(() => null)
  const activo = body?.activo === true || body?.activo === 1 || body?.activo === '1' ? 1 : 0

  await env.DB.prepare('UPDATE usuarios SET activo = ? WHERE id = ?').bind(activo, usuarioId).run()
  return json({ ok: true })
}

export async function updateUsuarioPassword(request, env, usuarioId) {
  const auth = await requireAuth(request, env, ADMIN_ROLES)
  if (auth.response) return auth.response

  const usuario = await getUsuarioById(env, usuarioId)
  if (!usuario) return json({ ok: false, error: 'Usuario no encontrado' }, 404)

  const body = await request.json().catch(() => null)
  const password = String(body?.password ?? '').trim()
  if (password.length < 6) return json({ ok: false, error: 'La contrasena debe tener al menos 6 caracteres' }, 400)

  const passwordHash = await bcrypt.hash(password, 10)
  await env.DB.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').bind(passwordHash, usuarioId).run()
  return json({ ok: true })
}

async function validateUsuarioPayload(env, body, { creating }) {
  const data = {
    numero_empleado: String(body?.numero_empleado ?? '').trim().toUpperCase(),
    nombres: String(body?.nombres ?? '').trim().toUpperCase(),
    apellido_paterno: body?.apellido_paterno ? String(body.apellido_paterno).trim().toUpperCase() : null,
    apellido_materno: body?.apellido_materno ? String(body.apellido_materno).trim().toUpperCase() : null,
    rol_id: Number(body?.rol_id),
    activo: body?.activo === false || body?.activo === 0 || body?.activo === '0' ? 0 : 1,
    password: String(body?.password ?? '').trim(),
  }

  if (!data.numero_empleado || !data.nombres || !data.rol_id) {
    return { response: json({ ok: false, error: 'Numero de empleado, nombre y rol son obligatorios' }, 400) }
  }

  if (creating && data.password.length < 6) {
    return { response: json({ ok: false, error: 'La contrasena debe tener al menos 6 caracteres' }, 400) }
  }

  const rol = await env.DB.prepare('SELECT id FROM roles WHERE id = ? AND activo = 1').bind(data.rol_id).first()
  if (!rol) return { response: json({ ok: false, error: 'Rol no valido' }, 400) }

  return { data }
}

async function setUsuarioRol(env, usuarioId, rolId) {
  await env.DB.prepare('DELETE FROM usuario_roles WHERE usuario_id = ?').bind(usuarioId).run()
  await env.DB.prepare('INSERT INTO usuario_roles (usuario_id, rol_id) VALUES (?, ?)').bind(usuarioId, rolId).run()
}

async function getUsuarioById(env, usuarioId) {
  return env.DB.prepare('SELECT id FROM usuarios WHERE id = ?').bind(usuarioId).first()
}
