import { handleAuthRoutes } from './routes/auth.routes.js'
import { handleClientesRoutes } from './routes/clientes.routes.js'
import { handleComunidadesRoutes } from './routes/comunidades.routes.js'
import { handleContratosRoutes } from './routes/contratos.routes.js'
import { handleInfraestructuraRoutes } from './routes/infraestructura.routes.js'
import { handleProspectosRoutes } from './routes/prospectos.routes.js'
import { handleReportesRoutes } from './routes/reportes.routes.js'
import { handleTecnicoRoutes } from './routes/tecnico.routes.js'
import { handleUsuariosRoutes } from './routes/usuarios.routes.js'
import { handleCajasCercanasRoutes } from './routes/cajas-cercanas.routes.js'
import { corsHeaders, withCors } from './utils/cors.js'
import { json } from './utils/response.js'

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    const url = new URL(request.url)

    try {
      if (url.pathname.startsWith('/api/auth') || url.pathname === '/api/login' || url.pathname === '/api/me' || url.pathname === '/api/logout') {
        return withCors(await handleAuthRoutes(request, env, url))
      }

      if (url.pathname === '/api/clientes/paquetes' || url.pathname.startsWith('/api/comunidades') || url.pathname.startsWith('/api/paquetes') || url.pathname.startsWith('/api/ciclos-corte')) {
        return withCors(await handleComunidadesRoutes(request, env, url))
      }

      if (url.pathname.startsWith('/api/usuarios') || url.pathname === '/api/roles') {
        return withCors(await handleUsuariosRoutes(request, env, url))
      }

      if (url.pathname.startsWith('/api/tecnico')) {
        return withCors(await handleTecnicoRoutes(request, env, url))
      }

      if (url.pathname.startsWith('/api/infraestructura')) {
        return withCors(await handleInfraestructuraRoutes(request, env, url))
      }

      if (url.pathname.startsWith('/api/clientes')) {
        return withCors(await handleClientesRoutes(request, env, url))
      }

      if (url.pathname.startsWith('/api/prospectos')) {
        return withCors(await handleProspectosRoutes(request, env, url))
      }

      if (url.pathname.startsWith('/api/reportes')) {
        return withCors(await handleReportesRoutes(request, env, url))
      }

      if (url.pathname.startsWith('/api/contratos')) {
        return withCors(await handleContratosRoutes(request, env, url))
      }

      if (url.pathname.startsWith('/api/cajas-cercanas')) {
        return withCors(await handleCajasCercanasRoutes(request, env, url))
      }

      return withCors(json({ error: 'Ruta no encontrada' }, 404))
    } catch (error) {
      return withCors(json({ error: error.message || 'Error interno' }, 500))
    }
  },
}
