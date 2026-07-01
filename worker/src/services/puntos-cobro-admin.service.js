import { requireAuth } from '../utils/auth.js'
import { json } from '../utils/response.js'

export async function listPuntosCobroAdmin(request, env) {
  const auth = await requireAuth(request, env, ['ADMIN'])
  if (auth.response) return auth.response

  try {
    const { results } = await env.DB.prepare(`
      SELECT 
        pc.id, 
        pc.nombre, 
        pc.direccion, 
        pc.telefono, 
        pc.token_acceso, 
        pc.activo, 
        pc.comunidad_id,
        comunidades.nombre AS comunidad_nombre,
        COALESCE((
          SELECT SUM(monto_pagado) 
          FROM pagos_clientes 
          WHERE punto_cobro_id = pc.id 
            AND estado = 'PAGADO' 
            AND date(fecha_pago, 'localtime') = date('now', 'localtime')
        ), 0) AS total_hoy,
        COALESCE((
          SELECT SUM(monto_pagado) 
          FROM pagos_clientes 
          WHERE punto_cobro_id = pc.id 
            AND estado = 'PAGADO' 
            AND strftime('%Y-%m', fecha_pago, 'localtime') = strftime('%Y-%m', 'now', 'localtime')
        ), 0) AS total_mes,
        COALESCE((
          SELECT COUNT(*) 
          FROM pagos_clientes 
          WHERE punto_cobro_id = pc.id 
            AND estado = 'PAGADO' 
            AND strftime('%Y-%m', fecha_pago, 'localtime') = strftime('%Y-%m', 'now', 'localtime')
        ), 0) AS cantidad_pagos_mes
      FROM puntos_cobro pc
      JOIN comunidades ON comunidades.id = pc.comunidad_id
      ORDER BY pc.nombre ASC
    `).all()

    return json({ ok: true, puntos_cobro: results })
  } catch (err) {
    return json({ ok: false, error: err.message }, 500)
  }
}

export async function createPuntoCobroAdmin(request, env) {
  const auth = await requireAuth(request, env, ['ADMIN'])
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  if (!body) return json({ ok: false, error: 'Cuerpo de petición inválido.' }, 400)

  const comunidadId = Number(body.comunidad_id)
  const nombre = String(body.nombre || '').trim()
  const direccion = body.direccion ? String(body.direccion).trim() : null
  const telefono = body.telefono ? String(body.telefono).trim() : null

  if (!comunidadId || !nombre) {
    return json({ ok: false, error: 'La comunidad y el nombre del punto de cobro son obligatorios.' }, 400)
  }

  // Validar comunidad
  const comunidad = await env.DB.prepare('SELECT id FROM comunidades WHERE id = ?').bind(comunidadId).first()
  if (!comunidad) {
    return json({ ok: false, error: 'La comunidad especificada no existe.' }, 404)
  }

  const tokenAcceso = crypto.randomUUID()

  try {
    const result = await env.DB.prepare(`
      INSERT INTO puntos_cobro (comunidad_id, nombre, direccion, telefono, token_acceso, activo)
      VALUES (?, ?, ?, ?, ?, 1)
    `).bind(comunidadId, nombre, direccion, telefono, tokenAcceso).run()

    return json({
      ok: true,
      message: 'Punto de cobro creado correctamente.',
      punto_cobro: {
        id: result.meta?.last_row_id,
        comunidad_id: comunidadId,
        nombre,
        direccion,
        telefono,
        token_acceso: tokenAcceso,
        activo: 1
      }
    }, 201)
  } catch (err) {
    return json({ ok: false, error: err.message }, 500)
  }
}

export async function updatePuntoCobroAdmin(request, env, id) {
  const auth = await requireAuth(request, env, ['ADMIN'])
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  if (!body) return json({ ok: false, error: 'Cuerpo de petición inválido.' }, 400)

  const comunidadId = Number(body.comunidad_id)
  const nombre = String(body.nombre || '').trim()
  const direccion = body.direccion ? String(body.direccion).trim() : null
  const telefono = body.telefono ? String(body.telefono).trim() : null
  const activo = body.activo !== undefined ? (body.activo ? 1 : 0) : 1

  if (!comunidadId || !nombre) {
    return json({ ok: false, error: 'La comunidad y el nombre son obligatorios.' }, 400)
  }

  // Validar comunidad
  const comunidad = await env.DB.prepare('SELECT id FROM comunidades WHERE id = ?').bind(comunidadId).first()
  if (!comunidad) {
    return json({ ok: false, error: 'La comunidad especificada no existe.' }, 404)
  }

  try {
    await env.DB.prepare(`
      UPDATE puntos_cobro
      SET comunidad_id = ?, nombre = ?, direccion = ?, telefono = ?, activo = ?
      WHERE id = ?
    `).bind(comunidadId, nombre, direccion, telefono, activo, id).run()

    return json({ ok: true, message: 'Punto de cobro actualizado correctamente.' })
  } catch (err) {
    return json({ ok: false, error: err.message }, 500)
  }
}

export async function togglePuntoCobroAdmin(request, env, id) {
  const auth = await requireAuth(request, env, ['ADMIN'])
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  if (body?.activo === undefined) {
    return json({ ok: false, error: 'El campo activo es obligatorio.' }, 400)
  }
  const activo = body.activo ? 1 : 0

  try {
    await env.DB.prepare(`
      UPDATE puntos_cobro
      SET activo = ?
      WHERE id = ?
    `).bind(activo, id).run()

    return json({ ok: true, message: 'Estado del punto de cobro actualizado correctamente.' })
  } catch (err) {
    return json({ ok: false, error: err.message }, 500)
  }
}

export async function regeneratePuntoCobroTokenAdmin(request, env, id) {
  const auth = await requireAuth(request, env, ['ADMIN'])
  if (auth.response) return auth.response

  const tokenAcceso = crypto.randomUUID()

  try {
    await env.DB.prepare(`
      UPDATE puntos_cobro
      SET token_acceso = ?
      WHERE id = ?
    `).bind(tokenAcceso, id).run()

    return json({ ok: true, message: 'Token de acceso regenerado correctamente.', token_acceso: tokenAcceso })
  } catch (err) {
    return json({ ok: false, error: err.message }, 500)
  }
}

export async function getResumenMensualGeneralAdmin(env, url, request) {
  const auth = await requireAuth(request, env, ['ADMIN'])
  if (auth.response) return auth.response

  const anio = Number(url.searchParams.get('anio') ?? new Date().getFullYear())
  const mes = Number(url.searchParams.get('mes') ?? (new Date().getMonth() + 1))
  const cicloCorteId = url.searchParams.get('ciclo_corte_id')
  const comunidadId = url.searchParams.get('comunidad_id')
  const puntoCobroId = url.searchParams.get('punto_cobro_id')

  // Dynamic filter array
  const filters = ["p.estado = 'PAGADO'", "p.anio = ?", "p.mes = ?"]
  const params = [anio, mes]

  if (cicloCorteId) {
    filters.push("p.ciclo_corte_id = ?")
    params.push(Number(cicloCorteId))
  }
  if (comunidadId) {
    filters.push("p.comunidad_id = ?")
    params.push(Number(comunidadId))
  }
  if (puntoCobroId) {
    filters.push("p.punto_cobro_id = ?")
    params.push(Number(puntoCobroId))
  }

  try {
    // 1. Total general y cantidad
    const general = await env.DB.prepare(`
      SELECT 
        COALESCE(SUM(p.monto_pagado), 0) AS total_general,
        COUNT(p.id) AS cantidad_pagos
      FROM pagos_clientes p
      WHERE ${filters.join(' AND ')}
    `).bind(...params).first()

    // 2. Total por punto de cobro (LEFT JOIN to show all PC for the month)
    const pcParams = [anio, mes]
    if (cicloCorteId) pcParams.push(Number(cicloCorteId))
    if (comunidadId) pcParams.push(Number(comunidadId))
    if (puntoCobroId) pcParams.push(Number(puntoCobroId))

    const totalPorPunto = await env.DB.prepare(`
      SELECT 
        pc.id AS punto_cobro_id,
        pc.nombre AS punto_cobro,
        COALESCE(SUM(p.monto_pagado), 0) AS total,
        COUNT(p.id) AS cantidad_pagos
      FROM puntos_cobro pc
      LEFT JOIN pagos_clientes p ON p.punto_cobro_id = pc.id AND p.estado = 'PAGADO' AND p.anio = ? AND p.mes = ?
        ${cicloCorteId ? ' AND p.ciclo_corte_id = ?' : ''}
        ${comunidadId ? ' AND p.comunidad_id = ?' : ''}
        ${puntoCobroId ? ' AND p.punto_cobro_id = ?' : ''}
      GROUP BY pc.id, pc.nombre
      ORDER BY total DESC
    `).bind(...pcParams).all()

    // 3. Total por comunidad (only active/paid communities to avoid empty lists)
    const totalPorComunidad = await env.DB.prepare(`
      SELECT 
        c.id AS comunidad_id,
        c.nombre AS comunidad,
        COALESCE(SUM(p.monto_pagado), 0) AS total,
        COUNT(p.id) AS cantidad_pagos
      FROM comunidades c
      JOIN pagos_clientes p ON p.comunidad_id = c.id
      WHERE ${filters.join(' AND ')}
      GROUP BY c.id, c.nombre
      ORDER BY total DESC
    `).bind(...params).all()

    // 4. Total por ciclo de corte
    const totalPorCiclo = await env.DB.prepare(`
      SELECT 
        cc.id AS ciclo_corte_id,
        cc.nombre AS ciclo_corte,
        COALESCE(SUM(p.monto_pagado), 0) AS total,
        COUNT(p.id) AS cantidad_pagos
      FROM ciclos_corte cc
      LEFT JOIN pagos_clientes p ON p.ciclo_corte_id = cc.id AND p.estado = 'PAGADO' AND p.anio = ? AND p.mes = ?
        ${cicloCorteId ? ' AND p.ciclo_corte_id = ?' : ''}
        ${comunidadId ? ' AND p.comunidad_id = ?' : ''}
        ${puntoCobroId ? ' AND p.punto_cobro_id = ?' : ''}
      GROUP BY cc.id, cc.nombre
      ORDER BY cc.id ASC
    `).bind(...pcParams).all()

    // 5. Total por día del mes
    const totalPorDia = await env.DB.prepare(`
      SELECT 
        date(p.fecha_pago, 'localtime') AS dia,
        COALESCE(SUM(p.monto_pagado), 0) AS total,
        COUNT(p.id) AS cantidad_pagos
      FROM pagos_clientes p
      WHERE ${filters.join(' AND ')}
      GROUP BY dia
      ORDER BY dia ASC
    `).bind(...params).all()

    // 6. Total hoy (día calendario local)
    const totalHoyResult = await env.DB.prepare(`
      SELECT COALESCE(SUM(monto_pagado), 0) AS total_hoy
      FROM pagos_clientes
      WHERE estado = 'PAGADO'
        AND date(fecha_pago, 'localtime') = date('now', 'localtime')
    `).first()

    return json({
      ok: true,
      resumen: {
        total_general: general.total_general,
        cantidad_pagos: general.cantidad_pagos,
        total_hoy: totalHoyResult.total_hoy,
        total_por_punto: totalPorPunto.results || [],
        total_por_comunidad: totalPorComunidad.results || [],
        total_por_ciclo: totalPorCiclo.results || [],
        total_por_dia: totalPorDia.results || []
      }
    })
  } catch (err) {
    return json({ ok: false, error: err.message }, 500)
  }
}

export async function getDetallePagosAdmin(env, url, request) {
  const auth = await requireAuth(request, env, ['ADMIN'])
  if (auth.response) return auth.response

  const anio = Number(url.searchParams.get('anio') ?? new Date().getFullYear())
  const mes = Number(url.searchParams.get('mes') ?? (new Date().getMonth() + 1))
  const cicloCorteId = url.searchParams.get('ciclo_corte_id')
  const comunidadId = url.searchParams.get('comunidad_id')
  const puntoCobroId = url.searchParams.get('punto_cobro_id')

  const filters = ["p.estado = 'PAGADO'", "p.anio = ?", "p.mes = ?"]
  const params = [anio, mes]

  if (cicloCorteId) {
    filters.push("p.ciclo_corte_id = ?")
    params.push(Number(cicloCorteId))
  }
  if (comunidadId) {
    filters.push("p.comunidad_id = ?")
    params.push(Number(comunidadId))
  }
  if (puntoCobroId) {
    filters.push("p.punto_cobro_id = ?")
    params.push(Number(puntoCobroId))
  }

  try {
    const { results } = await env.DB.prepare(`
      SELECT 
        p.id AS pago_id,
        p.fecha_pago,
        p.cliente_id,
        clientes.numero_cliente,
        (clientes.nombres || ' ' || COALESCE(clientes.apellido_paterno, '') || ' ' || COALESCE(clientes.apellido_materno, '')) AS cliente_nombre,
        comunidades.nombre AS comunidad,
        puntos_cobro.nombre AS punto_cobro,
        paquetes.nombre AS paquete,
        ciclos_corte.nombre AS ciclo_corte,
        p.anio,
        p.mes,
        p.monto_pagado,
        p.metodo_pago,
        p.estado,
        p.observaciones
      FROM pagos_clientes p
      JOIN clientes ON clientes.id = p.cliente_id
      JOIN comunidades ON comunidades.id = p.comunidad_id
      JOIN puntos_cobro ON puntos_cobro.id = p.punto_cobro_id
      JOIN servicios_fibra ON servicios_fibra.id = p.servicio_fibra_id
      JOIN paquetes ON paquetes.id = servicios_fibra.paquete_id
      JOIN ciclos_corte ON ciclos_corte.id = p.ciclo_corte_id
      WHERE ${filters.join(' AND ')}
      ORDER BY p.fecha_pago DESC
    `).bind(...params).all()

    return json({ ok: true, pagos: results })
  } catch (err) {
    return json({ ok: false, error: err.message }, 500)
  }
}
