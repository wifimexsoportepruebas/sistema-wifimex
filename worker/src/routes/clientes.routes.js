import { json } from '../utils/response.js'
import {
  bulkCreateClientes,
  createCliente,
  eliminarCliente,
  importClientes,
  listClientes,
  updateCliente,
} from '../services/clientes.service.js'

export async function handleClientesRoutes(request, env, url) {
  if (request.method === 'GET' && url.pathname === '/api/clientes/buscar') {
    return listClientes(request, env, url)
  }

  if (request.method === 'GET' && url.pathname === '/api/clientes') {
    return listClientes(request, env, url)
  }

  if (request.method === 'POST' && url.pathname === '/api/clientes') {
    return createCliente(request, env)
  }

  if (request.method === 'POST' && url.pathname === '/api/clientes/bulk') {
    return bulkCreateClientes(request, env)
  }

  if (request.method === 'POST' && url.pathname === '/api/clientes/importar') {
    return importClientes(request, env)
  }

  const clienteMatch = url.pathname.match(/^\/api\/clientes\/(\d+)$/)
  if (clienteMatch && request.method === 'PATCH') {
    return updateCliente(request, env, Number(clienteMatch[1]))
  }

  const deleteMatch = url.pathname.match(/^\/api\/clientes\/(\d+)\/eliminar$/)
  if (deleteMatch && request.method === 'PATCH') {
    return eliminarCliente(request, env, Number(deleteMatch[1]))
  }

  return json({ error: 'Ruta no encontrada' }, 404)
}
