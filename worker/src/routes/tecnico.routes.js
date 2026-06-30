import { json } from '../utils/response.js'
import {
  iniciarReporteTecnico,
  getInstalacionReporteTecnico,
  listPaquetesInstalacionTecnico,
  listReportesTecnicoHoy,
  noEncontradoReporteTecnico,
  registrarInstalacionImprevistaTecnico,
  solicitarCierreReporteTecnico,
} from '../services/tecnico.service.js'

export async function handleTecnicoRoutes(request, env, url) {
  if (request.method === 'GET' && url.pathname === '/api/tecnico/reportes/hoy') {
    return listReportesTecnicoHoy(request, env)
  }

  const paquetesMatch = url.pathname.match(/^\/api\/tecnico\/comunidades\/(\d+)\/paquetes$/)
  if (paquetesMatch && request.method === 'GET') return listPaquetesInstalacionTecnico(request, env, Number(paquetesMatch[1]))

  if (request.method === 'POST' && url.pathname === '/api/tecnico/instalaciones-imprevistas') {
    return registrarInstalacionImprevistaTecnico(request, env)
  }

  const instalacionMatch = url.pathname.match(/^\/api\/tecnico\/reportes\/(\d+)\/instalacion$/)
  if (instalacionMatch && request.method === 'GET') return getInstalacionReporteTecnico(request, env, Number(instalacionMatch[1]))

  const iniciarMatch = url.pathname.match(/^\/api\/tecnico\/reportes\/(\d+)\/iniciar$/)
  if (iniciarMatch && request.method === 'PATCH') return iniciarReporteTecnico(request, env, Number(iniciarMatch[1]))

  const noEncontradoMatch = url.pathname.match(/^\/api\/tecnico\/reportes\/(\d+)\/no-encontrado$/)
  if (noEncontradoMatch && request.method === 'PATCH') return noEncontradoReporteTecnico(request, env, Number(noEncontradoMatch[1]))

  const solicitarCierreMatch = url.pathname.match(/^\/api\/tecnico\/reportes\/(\d+)\/solicitar-cierre$/)
  if (solicitarCierreMatch && request.method === 'PATCH') return solicitarCierreReporteTecnico(request, env, Number(solicitarCierreMatch[1]))

  return json({ error: 'Ruta no encontrada' }, 404)
}
