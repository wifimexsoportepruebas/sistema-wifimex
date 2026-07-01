import { json } from '../utils/response.js'

export async function getPuntoCobroPublic(env, token) {
  const punto = await findPuntoCobro(env, token)
  if (!punto) return json({ ok: false, error: 'Punto de cobro no encontrado o inactivo.' }, 404)

  return json({
    ok: true,
    punto: formatPunto(punto),
  })
}

export async function getClientePuntoCobro(env, token, qrToken) {
  const punto = await findPuntoCobro(env, token)
  if (!punto) return json({ ok: false, error: 'Punto de cobro no encontrado o inactivo.' }, 404)

  const period = currentPeriod()
  const cliente = await findClienteServicioByQr(env, punto, qrToken, period)
  if (!cliente) return json({ ok: false, error: 'Cliente no encontrado, sin servicio activo o fuera de la comunidad del punto.' }, 404)

  return json(formatClientePagoResponse(cliente, period))
}

export async function createPagoPuntoCobro(request, env, token) {
  const punto = await findPuntoCobro(env, token)
  if (!punto) return json({ ok: false, error: 'Punto de cobro no encontrado o inactivo.' }, 404)

  const body = await request.json().catch(() => ({}))
  const period = normalizePeriod(body)
  const clienteId = Number(body?.cliente_id)
  const servicioFibraId = Number(body?.servicio_fibra_id)
  if (!Number.isInteger(clienteId) || clienteId <= 0) return json({ ok: false, error: 'Cliente invalido.' }, 400)
  if (!Number.isInteger(servicioFibraId) || servicioFibraId <= 0) return json({ ok: false, error: 'Servicio invalido.' }, 400)

  const servicio = await findServicioActivo(env, punto, clienteId, servicioFibraId)
  if (!servicio) return json({ ok: false, error: 'El servicio no existe, no esta activo o no pertenece a este punto de cobro.' }, 404)

  const existing = await getPagoServicioMes(env, servicioFibraId, period.anio, period.mes)
  if (existing) {
    return json({
      ok: false,
      error: 'Este cliente ya tiene pago registrado para este mes.',
      pago: existing,
    }, 409)
  }

  const montoPagado = Number(servicio.precio_mensual)
  if (!Number.isFinite(montoPagado) || montoPagado <= 0) return json({ ok: false, error: 'El servicio no tiene mensualidad valida.' }, 400)

  try {
    await env.DB.prepare(
      `INSERT INTO pagos_clientes (
         cliente_id, servicio_fibra_id, punto_cobro_id, comunidad_id,
         anio, mes, ciclo_corte_id, monto_pagado, metodo_pago, estado, observaciones
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'EFECTIVO', 'PAGADO', ?)`
    ).bind(
      servicio.cliente_id,
      servicio.servicio_fibra_id,
      punto.id,
      servicio.comunidad_id,
      period.anio,
      period.mes,
      servicio.ciclo_corte_id,
      montoPagado,
      nullableText(body?.observaciones)
    ).run()
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE')) {
      return json({ ok: false, error: 'Este cliente ya tiene pago registrado para este mes.' }, 409)
    }
    throw error
  }

  const pago = await getPagoServicioMes(env, servicioFibraId, period.anio, period.mes)
  return json({
    ok: true,
    message: 'Pago registrado correctamente.',
    pago,
  }, 201)
}

export async function getResumenPuntoCobro(env, token, url) {
  const punto = await findPuntoCobro(env, token)
  if (!punto) return json({ ok: false, error: 'Punto de cobro no encontrado o inactivo.' }, 404)

  const period = normalizePeriod({
    anio: url.searchParams.get('anio'),
    mes: url.searchParams.get('mes'),
  })

  const resumenHoy = await env.DB.prepare(
    `SELECT COUNT(*) AS total_pagos, COALESCE(SUM(monto_pagado), 0) AS total_cobrado
     FROM pagos_clientes
     WHERE punto_cobro_id = ?
       AND estado = 'PAGADO'
       AND date(fecha_pago) = date('now')`
  ).bind(punto.id).first()

  const resumenMes = await env.DB.prepare(
    `SELECT COUNT(*) AS total_pagos, COALESCE(SUM(monto_pagado), 0) AS total_cobrado
     FROM pagos_clientes
     WHERE punto_cobro_id = ?
       AND estado = 'PAGADO'
       AND anio = ?
       AND mes = ?`
  ).bind(punto.id, period.anio, period.mes).first()

  const { results: porCiclo } = await env.DB.prepare(
    `SELECT
       cc.id AS ciclo_corte_id,
       cc.nombre AS ciclo,
       COUNT(pc.id) AS total_pagos,
       COALESCE(SUM(pc.monto_pagado), 0) AS total_cobrado
     FROM pagos_clientes pc
     JOIN ciclos_corte cc ON cc.id = pc.ciclo_corte_id
     WHERE pc.punto_cobro_id = ?
       AND pc.estado = 'PAGADO'
       AND pc.anio = ?
       AND pc.mes = ?
     GROUP BY cc.id, cc.nombre
     ORDER BY cc.dia_inicio ASC, cc.id ASC`
  ).bind(punto.id, period.anio, period.mes).all()

  return json({
    ok: true,
    resumen_hoy: {
      total_pagos: Number(resumenHoy?.total_pagos ?? 0),
      total_cobrado: Number(resumenHoy?.total_cobrado ?? 0),
    },
    resumen_mes: {
      anio: period.anio,
      mes: period.mes,
      total_pagos: Number(resumenMes?.total_pagos ?? 0),
      total_cobrado: Number(resumenMes?.total_cobrado ?? 0),
      por_ciclo: (porCiclo ?? []).map((item) => ({
        ciclo_corte_id: item.ciclo_corte_id,
        ciclo: item.ciclo,
        total_pagos: Number(item.total_pagos ?? 0),
        total_cobrado: Number(item.total_cobrado ?? 0),
      })),
    },
  })
}

async function findPuntoCobro(env, token) {
  const tokenAcceso = String(token ?? '').trim()
  if (!tokenAcceso) return null

  return env.DB.prepare(
    `SELECT
       pc.id,
       pc.nombre,
       pc.direccion,
       pc.telefono,
       pc.token_acceso,
       pc.activo,
       co.id AS comunidad_id,
       co.nombre AS comunidad_nombre
     FROM puntos_cobro pc
     JOIN comunidades co ON co.id = pc.comunidad_id
     WHERE pc.token_acceso = ?
       AND pc.activo = 1
     LIMIT 1`
  ).bind(tokenAcceso).first()
}

async function findClienteServicioByQr(env, punto, qrToken, period) {
  const token = String(qrToken ?? '').trim()
  if (!token) return null

  return env.DB.prepare(
    `SELECT
       c.id AS cliente_id,
       c.numero_cliente,
       trim(c.nombres || ' ' || COALESCE(c.apellido_paterno, '') || ' ' || COALESCE(c.apellido_materno, '')) AS cliente_nombre,
       co.id AS comunidad_id,
       co.nombre AS comunidad_nombre,
       sf.id AS servicio_fibra_id,
       sf.precio_mensual,
       sf.ciclo_corte_id,
       p.nombre AS paquete_nombre,
       cc.nombre AS ciclo_corte,
       pc.id AS pago_id,
       pc.fecha_pago,
       pc.monto_pagado,
       pc.metodo_pago,
       punto_pago.nombre AS punto_cobro_nombre
     FROM clientes c
     JOIN comunidades co ON co.id = c.comunidad_id
     JOIN servicios_fibra sf ON sf.cliente_id = c.id
     JOIN paquetes p ON p.id = sf.paquete_id
     JOIN ciclos_corte cc ON cc.id = sf.ciclo_corte_id
     LEFT JOIN pagos_clientes pc ON pc.servicio_fibra_id = sf.id
       AND pc.anio = ?
       AND pc.mes = ?
       AND pc.estado = 'PAGADO'
     LEFT JOIN puntos_cobro punto_pago ON punto_pago.id = pc.punto_cobro_id
     WHERE c.qr_token = ?
       AND c.comunidad_id = ?
       AND sf.estado_servicio = 'ACTIVO'
     ORDER BY sf.id DESC
     LIMIT 1`
  ).bind(period.anio, period.mes, token, punto.comunidad_id).first()
}

async function findServicioActivo(env, punto, clienteId, servicioFibraId) {
  return env.DB.prepare(
    `SELECT
       c.id AS cliente_id,
       c.comunidad_id,
       sf.id AS servicio_fibra_id,
       sf.precio_mensual,
       sf.ciclo_corte_id
     FROM servicios_fibra sf
     JOIN clientes c ON c.id = sf.cliente_id
     WHERE sf.id = ?
       AND c.id = ?
       AND c.comunidad_id = ?
       AND sf.estado_servicio = 'ACTIVO'
     LIMIT 1`
  ).bind(servicioFibraId, clienteId, punto.comunidad_id).first()
}

async function getPagoServicioMes(env, servicioFibraId, anio, mes) {
  return env.DB.prepare(
    `SELECT
       pc.id,
       pc.cliente_id,
       pc.servicio_fibra_id,
       pc.punto_cobro_id,
       pc.anio,
       pc.mes,
       pc.ciclo_corte_id,
       pc.monto_pagado,
       pc.metodo_pago,
       pc.estado,
       pc.fecha_pago,
       pc.observaciones,
       pco.nombre AS punto_cobro_nombre
     FROM pagos_clientes pc
     JOIN puntos_cobro pco ON pco.id = pc.punto_cobro_id
     WHERE pc.servicio_fibra_id = ?
       AND pc.anio = ?
       AND pc.mes = ?
       AND pc.estado = 'PAGADO'
     LIMIT 1`
  ).bind(servicioFibraId, anio, mes).first()
}

function formatClientePagoResponse(row, period) {
  const pago = row.pago_id ? {
    id: row.pago_id,
    fecha_pago: row.fecha_pago,
    monto_pagado: row.monto_pagado,
    metodo_pago: row.metodo_pago,
    punto_cobro: row.punto_cobro_nombre,
  } : null

  return {
    ok: true,
    cliente: {
      id: row.cliente_id,
      nombre: row.cliente_nombre,
      numero_cliente: row.numero_cliente,
      comunidad: row.comunidad_nombre,
    },
    servicio: {
      id: row.servicio_fibra_id,
      paquete: row.paquete_nombre,
      precio_mensual: row.precio_mensual,
      ciclo_corte: row.ciclo_corte,
      ciclo_corte_id: row.ciclo_corte_id,
    },
    pago_mes: {
      anio: period.anio,
      mes: period.mes,
      pagado: Boolean(pago),
      pago,
    },
  }
}

function formatPunto(punto) {
  return {
    id: punto.id,
    nombre: punto.nombre,
    comunidad: punto.comunidad_nombre,
    comunidad_id: punto.comunidad_id,
    activo: punto.activo,
  }
}

function normalizePeriod(body) {
  const fallback = currentPeriod()
  const anio = Number(body?.anio) || fallback.anio
  const mes = Number(body?.mes) || fallback.mes
  return {
    anio: Number.isInteger(anio) && anio >= 2020 && anio <= 2100 ? anio : fallback.anio,
    mes: Number.isInteger(mes) && mes >= 1 && mes <= 12 ? mes : fallback.mes,
  }
}

function currentPeriod() {
  const date = new Date()
  return {
    anio: date.getFullYear(),
    mes: date.getMonth() + 1,
  }
}

function nullableText(value) {
  const text = String(value ?? '').trim()
  return text || null
}
