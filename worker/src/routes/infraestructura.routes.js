import { json } from '../utils/response.js'
import {
  buscarServiciosFibra,
  createCajaFibra,
  desvincularServicioTerminal,
  getCajaFibra,
  importCajasKml,
  listCajasDisponibles,
  listCajasFibra,
  listCajaTerminales,
  listCajaTerminalesDisponibles,
  previewCajasKml,
  updateCajaEstado,
  updateCajaFibra,
  updateCajaTerminal,
  vincularServicioTerminal,
} from '../services/infraestructura.service.js'

export async function handleInfraestructuraRoutes(request, env, url) {
  if (request.method === 'GET' && url.pathname === '/api/infraestructura/servicios-buscar') return buscarServiciosFibra(request, env, url)

  if (request.method === 'GET' && url.pathname === '/api/infraestructura/cajas') return listCajasFibra(request, env, url)
  if (request.method === 'GET' && url.pathname === '/api/infraestructura/cajas/disponibles') return listCajasDisponibles(request, env, url)
  if (request.method === 'POST' && url.pathname === '/api/infraestructura/cajas') return createCajaFibra(request, env)
  if (request.method === 'POST' && url.pathname === '/api/infraestructura/cajas/preview-kml') return previewCajasKml(request, env)
  if (request.method === 'POST' && url.pathname === '/api/infraestructura/cajas/importar-kml') return importCajasKml(request, env)

  const cajaMatch = url.pathname.match(/^\/api\/infraestructura\/cajas\/(\d+)$/)
  if (cajaMatch && request.method === 'GET') return getCajaFibra(request, env, Number(cajaMatch[1]))
  if (cajaMatch && request.method === 'PATCH') return updateCajaFibra(request, env, Number(cajaMatch[1]))

  const estadoMatch = url.pathname.match(/^\/api\/infraestructura\/cajas\/(\d+)\/estado$/)
  if (estadoMatch && request.method === 'PATCH') return updateCajaEstado(request, env, Number(estadoMatch[1]))

  const terminalesMatch = url.pathname.match(/^\/api\/infraestructura\/cajas\/(\d+)\/terminales$/)
  if (terminalesMatch && request.method === 'GET') return listCajaTerminales(request, env, Number(terminalesMatch[1]))

  const terminalesDisponiblesMatch = url.pathname.match(/^\/api\/infraestructura\/cajas\/(\d+)\/terminales-disponibles$/)
  if (terminalesDisponiblesMatch && request.method === 'GET') return listCajaTerminalesDisponibles(request, env, url, Number(terminalesDisponiblesMatch[1]))

  const terminalMatch = url.pathname.match(/^\/api\/infraestructura\/terminales\/(\d+)$/)
  if (terminalMatch && request.method === 'PATCH') return updateCajaTerminal(request, env, Number(terminalMatch[1]))

  const terminalEstadoMatch = url.pathname.match(/^\/api\/infraestructura\/terminales\/(\d+)\/estado$/)
  if (terminalEstadoMatch && request.method === 'PATCH') return updateCajaTerminal(request, env, Number(terminalEstadoMatch[1]))

  const vincularMatch = url.pathname.match(/^\/api\/infraestructura\/terminales\/(\d+)\/vincular-servicio$/)
  if (vincularMatch && request.method === 'POST') return vincularServicioTerminal(request, env, Number(vincularMatch[1]))

  const desvincularMatch = url.pathname.match(/^\/api\/infraestructura\/terminales\/(\d+)\/desvincular-servicio$/)
  if (desvincularMatch && request.method === 'POST') return desvincularServicioTerminal(request, env, Number(desvincularMatch[1]))

  return json({ error: 'Ruta no encontrada' }, 404)
}
