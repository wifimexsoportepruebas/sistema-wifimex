import {
  createPagoPuntoCobro,
  getClientePuntoCobro,
  getPuntoCobroPublic,
  getResumenPuntoCobro,
} from '../services/puntos-cobro-public.service.js'
import { json } from '../utils/response.js'

export async function handlePuntosCobroPublicRoutes(request, env, url) {
  const tokenMatch = url.pathname.match(/^\/api\/punto-cobro\/([^/]+)$/)
  if (tokenMatch && request.method === 'GET') {
    return getPuntoCobroPublic(env, decodeURIComponent(tokenMatch[1]))
  }

  const clienteMatch = url.pathname.match(/^\/api\/punto-cobro\/([^/]+)\/cliente\/([^/]+)$/)
  if (clienteMatch && request.method === 'GET') {
    return getClientePuntoCobro(env, decodeURIComponent(clienteMatch[1]), decodeURIComponent(clienteMatch[2]))
  }

  const pagosMatch = url.pathname.match(/^\/api\/punto-cobro\/([^/]+)\/pagos$/)
  if (pagosMatch && request.method === 'POST') {
    return createPagoPuntoCobro(request, env, decodeURIComponent(pagosMatch[1]))
  }

  const resumenMatch = url.pathname.match(/^\/api\/punto-cobro\/([^/]+)\/resumen$/)
  if (resumenMatch && request.method === 'GET') {
    return getResumenPuntoCobro(env, decodeURIComponent(resumenMatch[1]), url)
  }

  return json({ ok: false, error: 'Ruta de punto de cobro no encontrada' }, 404)
}
