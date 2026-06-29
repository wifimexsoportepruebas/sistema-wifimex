import { json } from '../utils/response.js'
import {
  asignarTecnicoReporte,
  cancelarReporte,
  cerrarReporte,
  confirmarCierreReporte,
  confirmarInstalacionReporte,
  createReporte,
  getReporteFotoRouter,
  getRutaReportes,
  listReportes,
  programarReporte,
  reagendarReporte,
  regresarReporteTecnico,
  updateReporte,
  updateReporteEstado,
} from '../services/reportes.service.js'

export async function handleReportesRoutes(request, env, url) {
  if (request.method === 'GET' && url.pathname === '/api/reportes/ruta') return getRutaReportes(request, env, url)
  if (request.method === 'GET' && url.pathname === '/api/reportes') return listReportes(request, env, url)
  if (request.method === 'POST' && url.pathname === '/api/reportes') return createReporte(request, env)

  const fotoRouterMatch = url.pathname.match(/^\/api\/reportes\/(\d+)\/foto-router$/)
  if (fotoRouterMatch && request.method === 'GET') return getReporteFotoRouter(request, env, Number(fotoRouterMatch[1]))

  const reporteMatch = url.pathname.match(/^\/api\/reportes\/(\d+)$/)
  if (reporteMatch && (request.method === 'PUT' || request.method === 'PATCH')) {
    return updateReporte(request, env, Number(reporteMatch[1]))
  }

  const estadoMatch = url.pathname.match(/^\/api\/reportes\/(\d+)\/estado$/)
  if (estadoMatch && request.method === 'PATCH') return updateReporteEstado(request, env, Number(estadoMatch[1]))

  const cerrarMatch = url.pathname.match(/^\/api\/reportes\/(\d+)\/cerrar$/)
  if (cerrarMatch && request.method === 'PATCH') return cerrarReporte(request, env, Number(cerrarMatch[1]))

  const programacionMatch = url.pathname.match(/^\/api\/reportes\/(\d+)\/programacion$/)
  if (programacionMatch && request.method === 'PATCH') return programarReporte(request, env, Number(programacionMatch[1]))

  const asignarMatch = url.pathname.match(/^\/api\/reportes\/(\d+)\/asignar-tecnico$/)
  if (asignarMatch && request.method === 'PATCH') return asignarTecnicoReporte(request, env, Number(asignarMatch[1]))

  const cancelarMatch = url.pathname.match(/^\/api\/reportes\/(\d+)\/(cancelar|eliminar)$/)
  if (cancelarMatch && request.method === 'PATCH') return cancelarReporte(request, env, Number(cancelarMatch[1]))

  const confirmarMatch = url.pathname.match(/^\/api\/reportes\/(\d+)\/confirmar-cierre$/)
  if (confirmarMatch && request.method === 'PATCH') return confirmarCierreReporte(request, env, Number(confirmarMatch[1]))

  const confirmarInstalacionMatch = url.pathname.match(/^\/api\/reportes\/(\d+)\/confirmar-instalacion$/)
  if (confirmarInstalacionMatch && request.method === 'POST') return confirmarInstalacionReporte(request, env, Number(confirmarInstalacionMatch[1]))

  const regresarMatch = url.pathname.match(/^\/api\/reportes\/(\d+)\/regresar-tecnico$/)
  if (regresarMatch && request.method === 'PATCH') return regresarReporteTecnico(request, env, Number(regresarMatch[1]))

  const reagendarMatch = url.pathname.match(/^\/api\/reportes\/(\d+)\/reagendar$/)
  if (reagendarMatch && request.method === 'PATCH') return reagendarReporte(request, env, Number(reagendarMatch[1]))

  return json({ error: 'Ruta no encontrada' }, 404)
}
