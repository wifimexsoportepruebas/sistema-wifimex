import { json } from '../utils/response.js'
import { requireAuth } from '../utils/auth.js'
import { nullableText } from '../utils/validators.js'
import {
  detectCycle,
  detectSpeed,
  findHeaderIndex,
  normalizeDate,
  normalizeHeader,
  parseCsv,
  parseMoney,
  pickCsvValue,
  splitFullName,
} from '../utils/csv.js'

export async function listClientes(request, env, url) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const filters = ["clientes.estado_cliente = 'ACTIVO'"]
  const values = []
  const comunidadId = url.searchParams.get('comunidad_id')
  const velocidad = url.searchParams.get('velocidad')
  const search = String(url.searchParams.get('q') ?? url.searchParams.get('search') ?? '').trim()
  const page = Math.max(Number(url.searchParams.get('page') ?? 1), 1)
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 20), 10), 100)
  const offset = (page - 1) * limit

  if (comunidadId) {
    filters.push('clientes.comunidad_id = ?')
    values.push(comunidadId)
  }

  if (velocidad) {
    filters.push('paquetes.velocidad_megas = ?')
    values.push(Number(velocidad))
  }

  if (search) {
    filters.push(`(
      clientes.numero_cliente LIKE ?
      OR clientes.nombres LIKE ?
      OR clientes.apellido_paterno LIKE ?
      OR clientes.apellido_materno LIKE ?
      OR clientes.telefono LIKE ?
      OR comunidades.nombre LIKE ?
      OR servicios_fibra.alfanumerico_equipo LIKE ?
      OR servicios_fibra.ip_asignada LIKE ?
    )`)
    values.push(...Array(8).fill(`%${search}%`))
  }

  const totalRow = values.length
    ? await env.DB.prepare(
      `SELECT COUNT(*) AS total
       FROM clientes
       JOIN comunidades ON comunidades.id = clientes.comunidad_id
       LEFT JOIN servicios_fibra ON servicios_fibra.cliente_id = clientes.id
       LEFT JOIN paquetes ON paquetes.id = servicios_fibra.paquete_id
       WHERE ${filters.join(' AND ')}`
    ).bind(...values).first()
    : await env.DB.prepare(
      `SELECT COUNT(*) AS total
       FROM clientes
       JOIN comunidades ON comunidades.id = clientes.comunidad_id
       LEFT JOIN servicios_fibra ON servicios_fibra.cliente_id = clientes.id
       LEFT JOIN paquetes ON paquetes.id = servicios_fibra.paquete_id
       WHERE ${filters.join(' AND ')}`
    ).first()

  const statement = env.DB.prepare(
    `SELECT
       clientes.id,
       clientes.comunidad_id,
       clientes.numero_cliente,
       clientes.nombres,
       clientes.apellido_paterno,
       clientes.apellido_materno,
       clientes.telefono,
       clientes.direccion,
       clientes.referencia,
       clientes.estado_cliente,
       clientes.qr_token,
       comunidades.prefijo AS comunidad_prefijo,
       comunidades.nombre AS comunidad_nombre,
       servicios_fibra.id AS servicio_id,
       servicios_fibra.alfanumerico_equipo,
       servicios_fibra.ip_asignada,
       servicios_fibra.fecha_instalacion,
       servicios_fibra.precio_mensual,
       servicios_fibra.estado_servicio,
       cajas_fibra.codigo_caja,
       caja_terminales.numero_terminal AS caja_terminal_numero,
       paquetes.nombre AS paquete_nombre,
       paquetes.velocidad_megas,
       ciclos_corte.nombre AS ciclo_corte_nombre,
       (SELECT id FROM contratos WHERE cliente_id = clientes.id AND estado = 'GENERADO' ORDER BY fecha_generado DESC, id DESC LIMIT 1) AS contrato_id,
       (SELECT r2_key FROM contratos WHERE cliente_id = clientes.id AND estado = 'GENERADO' ORDER BY fecha_generado DESC, id DESC LIMIT 1) AS contrato_r2_key,
       (SELECT COALESCE(origen, 'GENERADO') FROM contratos WHERE cliente_id = clientes.id AND estado = 'GENERADO' ORDER BY fecha_generado DESC, id DESC LIMIT 1) AS contrato_origen,
       (SELECT numero_contrato FROM contratos WHERE cliente_id = clientes.id AND estado = 'GENERADO' ORDER BY fecha_generado DESC, id DESC LIMIT 1) AS contrato_numero
     FROM clientes
     JOIN comunidades ON comunidades.id = clientes.comunidad_id
     LEFT JOIN servicios_fibra ON servicios_fibra.cliente_id = clientes.id
     LEFT JOIN cajas_fibra ON cajas_fibra.id = servicios_fibra.caja_id
     LEFT JOIN caja_terminales ON caja_terminales.id = servicios_fibra.caja_terminal_id
     LEFT JOIN paquetes ON paquetes.id = servicios_fibra.paquete_id
     LEFT JOIN ciclos_corte ON ciclos_corte.id = servicios_fibra.ciclo_corte_id
     WHERE ${filters.join(' AND ')}
     ORDER BY comunidades.nombre ASC,
       CAST(REPLACE(clientes.numero_cliente, comunidades.prefijo || '-', '') AS INTEGER) ASC,
       clientes.numero_cliente ASC
     LIMIT ? OFFSET ?`
  )

  const { results } = await statement.bind(...values, limit, offset).all()

  return json({
    clientes: results,
    pagination: {
      page,
      limit,
      total: totalRow?.total ?? 0,
      total_pages: Math.max(Math.ceil((totalRow?.total ?? 0) / limit), 1),
    },
  })
}

export async function createCliente(request, env) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  const validation = await validateClientePayload(env, body)
  if (validation.response) return validation.response

  const { data, comunidad } = validation
  const nextNumber = Number(comunidad.siguiente_numero_cliente ?? comunidad.numero_inicial_cliente ?? 0) + 1
  const numeroCliente = comunidad.prefijo ? `${comunidad.prefijo}-${nextNumber}` : String(nextNumber)
  const qrToken = crypto.randomUUID()

  const existing = await env.DB.prepare('SELECT id FROM clientes WHERE numero_cliente = ?').bind(numeroCliente).first()
  if (existing) return json({ error: `El numero de cliente ${numeroCliente} ya esta registrado. Intenta guardar de nuevo.` }, 409)

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO clientes (
         numero_cliente, nombres, apellido_paterno, apellido_materno, telefono,
         direccion, referencia, comunidad_id, estado_cliente, qr_token, fecha_registro
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO', ?, datetime('now'))`
    ).bind(
      numeroCliente,
      data.nombres,
      data.apellido_paterno,
      data.apellido_materno,
      data.telefono,
      data.direccion,
      data.referencia,
      data.comunidad_id,
      qrToken
    ),
    env.DB.prepare(
      `INSERT INTO servicios_fibra (
         cliente_id, paquete_id, ciclo_corte_id, alfanumerico_equipo, ip_asignada,
         fecha_instalacion, precio_mensual, estado_servicio
       ) VALUES ((SELECT id FROM clientes WHERE numero_cliente = ?), ?, ?, ?, ?, ?, ?, 'ACTIVO')`
    ).bind(
      numeroCliente,
      data.paquete_id,
      data.ciclo_corte_id,
      data.alfanumerico_equipo,
      data.ip_asignada,
      data.fecha_instalacion,
      data.precio_mensual
    ),
    env.DB.prepare(
      `UPDATE comunidades
       SET siguiente_numero_cliente = CASE
         WHEN ? > COALESCE(siguiente_numero_cliente, 0) THEN ?
         ELSE siguiente_numero_cliente
       END
       WHERE id = ?`
    ).bind(nextNumber, nextNumber, data.comunidad_id),
  ])

  return json({ ok: true, numero_cliente: numeroCliente }, 201)
}

export async function updateCliente(request, env, clienteId) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  const validation = await validateClientePayload(env, body, { partial: true })
  if (validation.response) return validation.response

  const existing = await env.DB.prepare('SELECT id FROM clientes WHERE id = ?').bind(clienteId).first()
  if (!existing) return json({ error: 'Cliente no encontrado' }, 404)

  const { data } = validation
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE clientes
       SET nombres = ?, apellido_paterno = ?, apellido_materno = ?, telefono = ?,
           direccion = ?, referencia = ?, comunidad_id = ?
       WHERE id = ?`
    ).bind(
      data.nombres,
      data.apellido_paterno,
      data.apellido_materno,
      data.telefono,
      data.direccion,
      data.referencia,
      data.comunidad_id,
      clienteId
    ),
    env.DB.prepare(
      `UPDATE servicios_fibra
       SET paquete_id = ?, ciclo_corte_id = ?, alfanumerico_equipo = ?, ip_asignada = ?,
           fecha_instalacion = ?, precio_mensual = ?
       WHERE cliente_id = ?`
    ).bind(
      data.paquete_id,
      data.ciclo_corte_id,
      data.alfanumerico_equipo,
      data.ip_asignada,
      data.fecha_instalacion,
      data.precio_mensual,
      clienteId
    ),
  ])

  return json({ ok: true })
}

export async function eliminarCliente(request, env, clienteId) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  await env.DB.batch([
    env.DB.prepare("UPDATE clientes SET estado_cliente = 'INACTIVO' WHERE id = ?").bind(clienteId),
    env.DB.prepare("UPDATE servicios_fibra SET estado_servicio = 'INACTIVO' WHERE cliente_id = ?").bind(clienteId),
  ])

  return json({ ok: true })
}

export async function bulkCreateClientes(request, env) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  return json({ ok: false, error: 'Usa /api/clientes/importar para importacion masiva con la estructura actual.' }, 400)
}

export async function importClientes(request, env) {
  const auth = await requireAuth(request, env, ['ADMIN', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const formData = await request.formData().catch(() => null)
  const comunidadId = Number(formData?.get('comunidad_id'))
  const file = formData?.get('file')

  if (!comunidadId || !file || typeof file.text !== 'function') {
    return json({ error: 'Comunidad y archivo CSV son obligatorios' }, 400)
  }

  const comunidad = await env.DB.prepare(
    'SELECT id, nombre, prefijo, numero_inicial_cliente, siguiente_numero_cliente FROM comunidades WHERE id = ?'
  ).bind(comunidadId).first()
  if (!comunidad) return json({ error: 'La comunidad seleccionada no existe' }, 404)

  const { results: paquetes } = await env.DB.prepare(
    'SELECT id, nombre, velocidad_megas, precio_mensual FROM paquetes WHERE comunidad_id = ? AND activo = 1'
  ).bind(comunidadId).all()
  const { results: ciclos } = await env.DB.prepare('SELECT id, nombre, dia_inicio, dia_fin FROM ciclos_corte WHERE activo = 1').all()

  const rows = parseCsv(await file.text())
  if (rows.length < 2) return json({ error: 'El archivo CSV no contiene filas suficientes' }, 400)

  const headerIndex = findHeaderIndex(rows)
  const headers = rows[headerIndex].map(normalizeHeader)
  const dataRows = rows.slice(headerIndex + 1)
  let nextNumber = Number(comunidad.siguiente_numero_cliente ?? comunidad.numero_inicial_cliente ?? 0) + 1
  let maxNumber = Number(comunidad.siguiente_numero_cliente ?? comunidad.numero_inicial_cliente ?? 0)
  const summary = { rows: 0, imported: 0, duplicates: 0, errors: 0, sin_paquete: 0, sin_ciclo: 0, sin_alfanumerico: 0 }
  const errors = []

  // Pre-load R2 Objects if bucket exists
  const comunidadFolder = slugPath(comunidad.nombre || '') + '/'
  let r2Objects = []
  if (env.CONTRATOS_BUCKET) {
    try {
      const listResult = await env.CONTRATOS_BUCKET.list({ prefix: comunidadFolder })
      r2Objects = listResult.objects || []
    } catch (err) {
      console.error('Error listing R2 bucket in importClientes:', err)
    }
  }

  // Pre-load existing links and numbers from contratos table to avoid duplicates/conflicts
  const linkedKeysQuery = await env.DB.prepare(
    "SELECT r2_key FROM contratos WHERE estado IN ('GENERADO', 'REGENERADO') AND r2_key IS NOT NULL"
  ).all()
  const linkedKeys = new Set((linkedKeysQuery.results || []).map(r => r.r2_key))

  const existingNumbersQuery = await env.DB.prepare(
    "SELECT numero_contrato FROM contratos"
  ).all()
  const existingNumbers = new Set((existingNumbersQuery.results || []).map(r => r.numero_contrato))

  // Pre-calculate normalized names count in the CSV to detect duplicate names
  const normalizedNamesCount = {}
  for (const row of dataRows) {
    if (!row.some((cell) => String(cell ?? '').trim())) continue
    const nombre = pickCsvValue(headers, row, ['servicio', 'nombre', 'titular', 'cliente'])
    if (nombre) {
      const norm = slugPath(nombre)
      normalizedNamesCount[norm] = (normalizedNamesCount[norm] || 0) + 1
    }
  }

  const autoVinculadosList = []
  const sugerenciasList = []
  const sinContratoList = []
  const conflictosList = []

  for (let index = 0; index < dataRows.length; index++) {
    const row = dataRows[index]
    if (!row.some((cell) => String(cell ?? '').trim())) continue
    summary.rows++

    const nombre = pickCsvValue(headers, row, ['servicio', 'nombre', 'titular', 'cliente'])
    const numeroRaw = pickCsvValue(headers, row, ['num cliente', 'numcliente', 'numero cliente', 'cliente'])
    const paqueteText = pickCsvValue(headers, row, ['paquete', 'plan', 'servicio'])
    const precioText = pickCsvValue(headers, row, ['precio', 'costo', 'valor'])
    const cicloText = pickCsvValue(headers, row, ['fecha pago', 'pago', 'corte'])
    const fechaInstalacion = normalizeDate(pickCsvValue(headers, row, ['fecha instalacion', 'instalacion']))
    const alfanumerico = nullableText(pickCsvValue(headers, row, ['alfanumerico', 'alfa', 'codigo', 'equipo']))
    const telefono = nullableText(pickCsvValue(headers, row, ['telefono', 'tel', 'celular']))
    if (!alfanumerico) summary.sin_alfanumerico++

    const paquete = paquetes.find((item) => Number(item.velocidad_megas) === detectSpeed(paqueteText, precioText))
    if (!paquete) {
      summary.sin_paquete++; summary.errors++
      errors.push({ row: index + headerIndex + 2, error: 'No se encontro paquete para la velocidad detectada', value: paqueteText || precioText })
      continue
    }

    const ciclo = detectCycle(ciclos, cicloText)
    if (!ciclo) {
      summary.sin_ciclo++; summary.errors++
      errors.push({ row: index + headerIndex + 2, error: 'No se encontro ciclo de corte', value: cicloText })
      continue
    }

    const explicitNumber = Number(String(numeroRaw ?? '').replace(/\D/g, ''))
    const numericNumber = Number.isFinite(explicitNumber) && explicitNumber > 0 ? explicitNumber : nextNumber
    const numeroCliente = comunidad.prefijo ? `${comunidad.prefijo}-${numericNumber}` : String(numericNumber)
    const existing = await env.DB.prepare('SELECT id FROM clientes WHERE numero_cliente = ?').bind(numeroCliente).first()
    if (existing) {
      summary.duplicates++
      errors.push({ row: index + headerIndex + 2, error: 'Numero de cliente duplicado', value: numeroCliente })
      continue
    }

    const nameParts = splitFullName(nombre || `CLIENTE ${numeroCliente}`)
    const precioMensual = Number(paquete.precio_mensual ?? parseMoney(precioText) ?? 0)
    const qrToken = crypto.randomUUID()

    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO clientes (
             numero_cliente, nombres, apellido_paterno, apellido_materno, telefono,
             direccion, referencia, comunidad_id, estado_cliente, qr_token, fecha_registro
           ) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, 'ACTIVO', ?, datetime('now'))`
        ).bind(numeroCliente, nameParts.nombres, nameParts.apellido_paterno, nameParts.apellido_materno, telefono, comunidadId, qrToken),
        env.DB.prepare(
          `INSERT INTO servicios_fibra (
             cliente_id, paquete_id, ciclo_corte_id, alfanumerico_equipo, ip_asignada,
             fecha_instalacion, precio_mensual, estado_servicio
           ) VALUES ((SELECT id FROM clientes WHERE numero_cliente = ?), ?, ?, ?, NULL, ?, ?, 'ACTIVO')`
        ).bind(numeroCliente, paquete.id, ciclo.id, alfanumerico, fechaInstalacion, precioMensual),
      ])

      summary.imported++
      maxNumber = Math.max(maxNumber, numericNumber)
      if (!explicitNumber) nextNumber++

      // Match and link old contracts from R2
      const insertedClient = await env.DB.prepare(
        'SELECT id FROM clientes WHERE numero_cliente = ?'
      ).bind(numeroCliente).first()

      const insertedService = await env.DB.prepare(
        "SELECT id FROM servicios_fibra WHERE cliente_id = ? AND estado_servicio = 'ACTIVO' LIMIT 1"
      ).bind(insertedClient.id).first()

      const fullName = [nameParts.nombres, nameParts.apellido_paterno, nameParts.apellido_materno].filter(Boolean).join(' ')
      const clientNormalized = slugPath(fullName)
      const clientWords = clientNormalized.split('_').filter(Boolean)

      let candidates = []
      for (const obj of r2Objects) {
        if (!obj.key.toLowerCase().endsWith('.pdf')) continue
        const filename = obj.key.substring(obj.key.lastIndexOf('/') + 1)
        const fileNormalized = slugPath(filename.replace(/\.pdf$/i, ''))
        const fileNormalizedNoNums = fileNormalized.replace(/(_\d+)+$/, '')

        let score = 0
        if (fileNormalizedNoNums.includes(clientNormalized) || clientNormalized.includes(fileNormalizedNoNums)) {
          score = 100
        } else {
          let wordsFound = 0
          for (const word of clientWords) {
            if (fileNormalizedNoNums.includes(word)) {
              wordsFound++
            }
          }
          if (clientWords.length > 0) {
            score = Math.round((wordsFound / clientWords.length) * 80)
          }
        }

        if (score >= 80) {
          const matchNum = filename.match(/_(\d+)\.pdf$/i) || filename.match(/(\d+)\.pdf$/i)
          candidates.push({
            r2_key: obj.key,
            filename,
            score,
            numero_detectado: matchNum ? matchNum[1] : null
          })
        }
      }

      candidates.sort((a, b) => b.score - a.score || a.filename.localeCompare(b.filename))

      if (candidates.length === 0) {
        sinContratoList.push({
          cliente_nombre: fullName
        })
      } else {
        const bestCandidate = candidates[0]
        const isDuplicateNameInCsv = normalizedNamesCount[clientNormalized] > 1
        const isAlreadyLinked = linkedKeys.has(bestCandidate.r2_key)
        const hasMultipleCandidates = candidates.length > 1
        const hasNoService = !insertedService

        if (isDuplicateNameInCsv || isAlreadyLinked || hasMultipleCandidates || hasNoService) {
          let reason = ''
          if (isDuplicateNameInCsv) reason = 'Nombre duplicado en archivo CSV.'
          else if (isAlreadyLinked) reason = 'Contrato ya vinculado a otro cliente.'
          else if (hasMultipleCandidates) reason = 'Múltiples contratos sugeridos (ambigüedad).'
          else if (hasNoService) reason = 'Cliente sin servicio activo.'

          conflictosList.push({
            cliente_nombre: fullName,
            filename: bestCandidate.filename,
            r2_key: bestCandidate.r2_key,
            razon: reason
          })
        } else {
          if (bestCandidate.score === 100) {
            let numeroContrato = ''
            if (bestCandidate.numero_detectado) {
              numeroContrato = `R2-${bestCandidate.numero_detectado}`
            } else {
              numeroContrato = `R2-${getShortHash(bestCandidate.r2_key)}`
            }

            if (existingNumbers.has(numeroContrato)) {
              numeroContrato = `${numeroContrato}-${getShortHash(bestCandidate.r2_key)}`
            }

            await env.DB.prepare(
              `INSERT INTO contratos (
                 numero_contrato, cliente_id, servicio_fibra_id, instalacion_fibra_id,
                 r2_key, content_type, estado, origen, aplica_reconexion,
                 cantidad_reconexion, marca_equipo, numero_equipos, costo_equipo_penalidad,
                 costo_instalacion, vigencia_contrato, nombre_instalador,
                 generado_por_usuario_id, fecha_generado
               ) VALUES (?, ?, ?, NULL, ?, 'application/pdf', 'GENERADO', 'EXISTENTE_R2', 'SI', 350, 'HUAWEI', 1, 800, 0, 'SIN PLAZO FORZOSO', 'SISTEMA', ?, datetime('now'))`
            ).bind(
              numeroContrato,
              insertedClient.id,
              insertedService.id,
              bestCandidate.r2_key,
              auth.session.usuario_id
            ).run()

            linkedKeys.add(bestCandidate.r2_key)
            existingNumbers.add(numeroContrato)

            autoVinculadosList.push({
              cliente_nombre: fullName,
              filename: bestCandidate.filename,
              r2_key: bestCandidate.r2_key,
              numero_contrato: numeroContrato
            })
          } else {
            sugerenciasList.push({
              cliente_nombre: fullName,
              filename: bestCandidate.filename,
              r2_key: bestCandidate.r2_key,
              score: bestCandidate.score,
              razon: 'Coincidencia parcial de nombre'
            })
          }
        }
      }

    } catch (err) {
      summary.errors++
      errors.push({ row: index + headerIndex + 2, error: err.message, value: numeroCliente })
    }
  }

  if (summary.imported > 0) {
    await env.DB.prepare(
      `UPDATE comunidades
       SET siguiente_numero_cliente = CASE
         WHEN ? > COALESCE(siguiente_numero_cliente, 0) THEN ?
         ELSE siguiente_numero_cliente
       END
       WHERE id = ?`
    ).bind(maxNumber, maxNumber, comunidadId).run()
  }

  const isPartial = summary.imported > 0 && summary.errors > 0
  const isAllErrors = summary.imported === 0 && summary.errors > 0
  let finalMessage = 'Importacion completada correctamente.'
  if (isAllErrors) finalMessage = 'No se importo ningun cliente. Revisa los errores.'
  else if (isPartial) finalMessage = 'Importacion parcial.'

  return json({
    ok: !isAllErrors,
    partial: isPartial,
    message: finalMessage,
    summary,
    errors,
    clientes_importados: summary.imported,
    contratos_auto_vinculados: autoVinculadosList.length,
    contratos_sugeridos: sugerenciasList.length,
    sin_contrato: sinContratoList.length,
    conflictos: conflictosList.length,
    detalle: {
      auto_vinculados: autoVinculadosList,
      sugerencias: sugerenciasList,
      sin_contrato: sinContratoList,
      conflictos: conflictosList
    }
  })
}

async function validateClientePayload(env, body) {
  const data = {
    comunidad_id: Number(body?.comunidad_id),
    nombres: String(body?.nombres ?? '').trim().toUpperCase(),
    apellido_paterno: body?.apellido_paterno ? String(body.apellido_paterno).trim().toUpperCase() : null,
    apellido_materno: body?.apellido_materno ? String(body.apellido_materno).trim().toUpperCase() : null,
    telefono: nullableText(body?.telefono),
    direccion: nullableText(body?.direccion),
    referencia: nullableText(body?.referencia),
    paquete_id: Number(body?.paquete_id),
    ciclo_corte_id: Number(body?.ciclo_corte_id),
    precio_mensual: Number(body?.precio_mensual ?? 0),
    alfanumerico_equipo: nullableText(body?.alfanumerico_equipo),
    ip_asignada: nullableText(body?.ip_asignada),
    fecha_instalacion: nullableText(body?.fecha_instalacion),
  }

  if (!data.comunidad_id || !data.nombres || !data.paquete_id || !data.ciclo_corte_id) {
    return { response: json({ error: 'Comunidad, nombre, paquete y ciclo de corte son obligatorios' }, 400) }
  }

  const comunidad = await env.DB.prepare(
    'SELECT id, prefijo, numero_inicial_cliente, siguiente_numero_cliente FROM comunidades WHERE id = ?'
  ).bind(data.comunidad_id).first()
  if (!comunidad) return { response: json({ error: 'La comunidad seleccionada no existe' }, 404) }

  const paquete = await env.DB.prepare('SELECT id, precio_mensual FROM paquetes WHERE id = ? AND comunidad_id = ? AND activo = 1')
    .bind(data.paquete_id, data.comunidad_id).first()
  if (!paquete) return { response: json({ error: 'El paquete seleccionado no pertenece a la comunidad' }, 400) }

  const ciclo = await env.DB.prepare('SELECT id FROM ciclos_corte WHERE id = ? AND activo = 1').bind(data.ciclo_corte_id).first()
  if (!ciclo) return { response: json({ error: 'El ciclo de corte seleccionado no existe' }, 400) }

  data.precio_mensual = Number.isFinite(data.precio_mensual) && data.precio_mensual > 0 ? data.precio_mensual : Number(paquete.precio_mensual ?? 0)
  return { data, comunidad }
}

function slugPath(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\/\\:*?"<>|]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function getShortHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36).substring(0, 6).toUpperCase()
}
