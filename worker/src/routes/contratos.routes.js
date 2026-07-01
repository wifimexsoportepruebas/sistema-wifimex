import { json } from '../utils/response.js'
import {
  descargarContrato,
  generarContratoDesdeInstalacion,
  getContrato,
  getContratoUrl,
  listContratosCliente,
  getContratosSugeridos,
  vincularContratoExistente,
  cambiarVinculoContrato,
  verContratoR2,
} from '../services/contratos.service.js'

export async function handleContratosRoutes(request, env, url) {
  if (request.method === 'POST' && url.pathname === '/api/contratos/generar-desde-instalacion') {
    return generarContratoDesdeInstalacion(request, env)
  }

  if (request.method === 'POST' && url.pathname === '/api/contratos/cambiar-vinculo') {
    return cambiarVinculoContrato(request, env)
  }

  if (request.method === 'GET' && url.pathname === '/api/contratos/r2/sugerencias') {
    return getContratosSugeridos(request, env, url)
  }

  if (request.method === 'POST' && url.pathname === '/api/contratos/r2/ver') {
    return verContratoR2(request, env)
  }

  if (request.method === 'POST' && url.pathname === '/api/contratos/vincular-existente') {
    return vincularContratoExistente(request, env)
  }

  const clienteMatch = url.pathname.match(/^\/api\/contratos\/cliente\/(\d+)$/)
  if (clienteMatch && request.method === 'GET') return listContratosCliente(request, env, Number(clienteMatch[1]))

  const archivoMatch = url.pathname.match(/^\/api\/contratos\/(\d+)\/archivo$/)
  if (archivoMatch && request.method === 'GET') return descargarContrato(request, env, Number(archivoMatch[1]))

  const urlMatch = url.pathname.match(/^\/api\/contratos\/(\d+)\/url$/)
  if (urlMatch && request.method === 'GET') return getContratoUrl(request, env, url, Number(urlMatch[1]))

  const contratoMatch = url.pathname.match(/^\/api\/contratos\/(\d+)$/)
  if (contratoMatch && request.method === 'GET') return getContrato(request, env, Number(contratoMatch[1]))

  return json({ error: 'Ruta no encontrada' }, 404)
}
