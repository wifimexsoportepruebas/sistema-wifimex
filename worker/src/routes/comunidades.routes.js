import { json } from '../utils/response.js'
import { requireAuth } from '../utils/auth.js'

export async function handleComunidadesRoutes(request, env, url) {
  if (request.method === 'GET' && url.pathname === '/api/comunidades') {
    return listComunidades(request, env)
  }

  if (request.method === 'GET' && (url.pathname === '/api/paquetes' || url.pathname === '/api/clientes/paquetes')) {
    return listPaquetes(request, env)
  }

  if (request.method === 'GET' && url.pathname === '/api/ciclos-corte') {
    return listCiclosCorte(request, env)
  }

  return json({ error: 'Ruta no encontrada' }, 404)
}

async function listComunidades(request, env) {
  const auth = await requireAuth(request, env)
  if (auth.response) return auth.response

  const { results } = await env.DB.prepare(
    `SELECT id, UPPER(nombre) AS nombre, prefijo, numero_inicial_cliente, siguiente_numero_cliente, latitud, longitud
     FROM comunidades
     WHERE activo = 1
     ORDER BY nombre`
  ).all()

  return json({ comunidades: results })
}

async function listPaquetes(request, env) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const url = new URL(request.url)
  const comunidadId = url.searchParams.get('comunidad_id')
  const filters = ['paquetes.activo = 1']
  const values = []

  if (comunidadId) {
    filters.push('paquetes.comunidad_id = ?')
    values.push(Number(comunidadId))
  }

  const statement = env.DB.prepare(
    `SELECT paquetes.id, paquetes.comunidad_id, paquetes.nombre, paquetes.velocidad_megas,
       paquetes.precio_mensual, comunidades.nombre AS comunidad_nombre
     FROM paquetes
     JOIN comunidades ON comunidades.id = paquetes.comunidad_id
     WHERE ${filters.join(' AND ')}
     ORDER BY comunidades.nombre, paquetes.nombre`
  )

  const { results } = values.length ? await statement.bind(...values).all() : await statement.all()

  if (url.pathname === '/api/clientes/paquetes') {
    return json({ paquetes: [...new Set(results.map((paquete) => paquete.nombre))] })
  }

  return json({ paquetes: results })
}

async function listCiclosCorte(request, env) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const { results } = await env.DB.prepare(
    `SELECT id, nombre, dia_inicio, dia_fin
     FROM ciclos_corte
     WHERE activo = 1
     ORDER BY dia_inicio, dia_fin`
  ).all()

  return json({ ciclos: results })
}
