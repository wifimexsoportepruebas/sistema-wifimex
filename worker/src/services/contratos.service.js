import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { requireAuth } from '../utils/auth.js'
import { json } from '../utils/response.js'

const CONTRATO_ESTADO_GENERADO = 'GENERADO'
const CONTRATO_COUNTER_KEY = 'contador-contratos'
const PDF_CONTENT_TYPE = 'application/pdf'

export async function validarContratoInstalacionDisponible(env, instalacionId) {
  validarBindingsContratos(env)

  const existing = await env.DB.prepare(
    `SELECT id, numero_contrato, r2_key
     FROM contratos
     WHERE instalacion_fibra_id = ?
       AND estado = 'GENERADO'
     LIMIT 1`
  ).bind(instalacionId).first()

  if (existing) {
    return {
      response: json({
        ok: false,
        error: 'Esta instalacion ya tiene contrato generado.',
        contrato: existing,
      }, 409),
    }
  }

  return {}
}

export async function generarContratoParaInstalacion(env, options) {
  validarBindingsContratos(env)

  const { instalacionId, clienteId, servicioFibraId, usuarioId } = options
  const duplicate = await env.DB.prepare(
    `SELECT id, numero_contrato, r2_key
     FROM contratos
     WHERE instalacion_fibra_id = ?
       AND estado = 'GENERADO'
     LIMIT 1`
  ).bind(instalacionId).first()
  if (duplicate) throw new Error('Esta instalacion ya tiene contrato generado.')

  const data = await getContratoData(env, instalacionId, clienteId, servicioFibraId)
  if (!data) throw new Error('No se encontraron datos completos para generar el contrato.')

  const numeroContrato = await generarNumeroContrato(env)
  const vigenciaContrato = getVigenciaContrato(data.comunidad_nombre)
  const nombreInstalador = getNombreInstalador(data)
  const clienteSlug = slugPath([data.cliente_nombres, data.cliente_apellido_paterno, data.cliente_apellido_materno].filter(Boolean).join(' '))
  const comunidadFolder = slugPath(data.comunidad_nombre)
  const r2Key = `${comunidadFolder}/${numeroContrato}-${clienteSlug || 'CLIENTE'}.pdf`
  const pdfBytes = await buildContratoPdf({ ...data, numero_contrato: numeroContrato, vigencia_contrato: vigenciaContrato, nombre_instalador: nombreInstalador })

  if (!pdfBytes?.byteLength) throw new Error('No se pudo generar el PDF del contrato.')

  await env.CONTRATOS_BUCKET.put(r2Key, pdfBytes, {
    httpMetadata: { contentType: PDF_CONTENT_TYPE },
  })

  const result = await env.DB.prepare(
    `INSERT INTO contratos (
       numero_contrato, cliente_id, servicio_fibra_id, instalacion_fibra_id,
       r2_key, content_type, estado, modalidad_pago, aplica_reconexion,
       cantidad_reconexion, marca_equipo, numero_equipos, costo_equipo_penalidad,
       costo_instalacion, vigencia_contrato, nombre_instalador,
       generado_por_usuario_id, fecha_generado
     ) VALUES (?, ?, ?, ?, ?, ?, 'GENERADO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    numeroContrato,
    clienteId,
    servicioFibraId,
    instalacionId,
    r2Key,
    PDF_CONTENT_TYPE,
    data.contrato_modalidad_pago || 'SIN DEFINIR',
    data.contrato_aplica_reconexion || 'SI',
    Number(data.contrato_cantidad_reconexion ?? 350),
    data.contrato_marca_equipo || 'HUAWEI',
    Number(data.contrato_numero_equipos ?? 1),
    Number(data.contrato_costo_equipo_penalidad ?? 800),
    Number(data.contrato_costo_instalacion ?? 0),
    vigenciaContrato,
    nombreInstalador,
    usuarioId ?? null
  ).run()

  return {
    id: result.meta?.last_row_id,
    numero_contrato: numeroContrato,
    r2_key: r2Key,
  }
}

export async function generarContratoDesdeInstalacion(request, env) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  const instalacionId = Number(body?.instalacion_fibra_id ?? body?.instalacion_id)
  if (!Number.isInteger(instalacionId) || instalacionId < 1) return json({ ok: false, error: 'Instalacion obligatoria.' }, 400)

  const instalacion = await env.DB.prepare(
    `SELECT id, cliente_id, servicio_fibra_id
     FROM instalaciones_fibra
     WHERE id = ?`
  ).bind(instalacionId).first()

  if (!instalacion?.cliente_id || !instalacion?.servicio_fibra_id) {
    return json({ ok: false, error: 'La instalacion todavia no tiene cliente y servicio creados.' }, 400)
  }

  const contrato = await generarContratoParaInstalacion(env, {
    instalacionId,
    clienteId: instalacion.cliente_id,
    servicioFibraId: instalacion.servicio_fibra_id,
    usuarioId: auth.session.usuario_id,
  })

  return json({ ok: true, contrato }, 201)
}

export async function listContratosCliente(request, env, clienteId) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const { results } = await env.DB.prepare(
    `SELECT id, numero_contrato, cliente_id, servicio_fibra_id, instalacion_fibra_id,
            r2_key, content_type, estado, modalidad_pago, aplica_reconexion,
            cantidad_reconexion, marca_equipo, numero_equipos, costo_equipo_penalidad,
            costo_instalacion, vigencia_contrato, nombre_instalador, fecha_generado
     FROM contratos
     WHERE cliente_id = ?
     ORDER BY id DESC`
  ).bind(clienteId).all()

  return json({ ok: true, contratos: results ?? [] })
}

export async function getContrato(request, env, contratoId) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const contrato = await getContratoById(env, contratoId)
  if (!contrato) return json({ ok: false, error: 'Contrato no encontrado.' }, 404)
  return json({ ok: true, contrato })
}

export async function getContratoUrl(request, env, url, contratoId) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response

  const contrato = await getContratoById(env, contratoId)
  if (!contrato) return json({ ok: false, error: 'Contrato no encontrado.' }, 404)

  return json({
    ok: true,
    url: `${url.origin}/api/contratos/${contratoId}/archivo`,
    r2_key: contrato.r2_key,
  })
}

export async function descargarContrato(request, env, contratoId) {
  const auth = await requireAuth(request, env, ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'])
  if (auth.response) return auth.response
  if (!env.CONTRATOS_BUCKET) return json({ ok: false, error: 'Falta configurar CONTRATOS_BUCKET.' }, 500)

  const contrato = await getContratoById(env, contratoId)
  if (!contrato) return json({ ok: false, error: 'Contrato no encontrado.' }, 404)

  const object = await env.CONTRATOS_BUCKET.get(contrato.r2_key)
  if (!object) return json({ ok: false, error: 'El archivo del contrato no existe en R2.' }, 404)

  return new Response(object.body, {
    headers: {
      'Content-Type': contrato.content_type || PDF_CONTENT_TYPE,
      'Content-Disposition': `inline; filename="${contrato.numero_contrato}.pdf"`,
    },
  })
}

async function getContratoById(env, contratoId) {
  return env.DB.prepare(
    `SELECT id, numero_contrato, cliente_id, servicio_fibra_id, instalacion_fibra_id,
            r2_key, content_type, estado, modalidad_pago, aplica_reconexion,
            cantidad_reconexion, marca_equipo, numero_equipos, costo_equipo_penalidad,
            costo_instalacion, vigencia_contrato, nombre_instalador,
            generado_por_usuario_id, fecha_generado
     FROM contratos
     WHERE id = ?`
  ).bind(contratoId).first()
}

async function getContratoData(env, instalacionId, clienteId, servicioFibraId) {
  return env.DB.prepare(
    `SELECT
       instalaciones_fibra.id AS instalacion_fibra_id,
       instalaciones_fibra.reporte_id,
       instalaciones_fibra.fecha_instalacion,
       instalaciones_fibra.fibra_optica_metros,
       instalaciones_fibra.tensor_gancho,
       instalaciones_fibra.argollas,
       instalaciones_fibra.taquetes,
       instalaciones_fibra.sujetadores,
       instalaciones_fibra.roseta,
       instalaciones_fibra.potencia,
       instalaciones_fibra.firma_cliente_base64,
       instalaciones_fibra.firma_tecnico_base64,
       instalaciones_fibra.comentario_tecnico,
       instalaciones_fibra.contrato_marca_equipo,
       instalaciones_fibra.contrato_numero_equipos,
       instalaciones_fibra.contrato_aplica_reconexion,
       instalaciones_fibra.contrato_cantidad_reconexion,
       instalaciones_fibra.contrato_costo_equipo_penalidad,
       instalaciones_fibra.contrato_costo_instalacion,
       instalaciones_fibra.contrato_modalidad_pago,
       clientes.id AS cliente_id,
       clientes.numero_cliente,
       clientes.nombres AS cliente_nombres,
       clientes.apellido_paterno AS cliente_apellido_paterno,
       clientes.apellido_materno AS cliente_apellido_materno,
       clientes.telefono AS cliente_telefono,
       clientes.direccion AS cliente_direccion,
       comunidades.nombre AS comunidad_nombre,
       servicios_fibra.id AS servicio_fibra_id,
       servicios_fibra.ip_asignada,
       servicios_fibra.alfanumerico_equipo,
       servicios_fibra.precio_mensual,
       servicios_fibra.fecha_instalacion AS servicio_fecha_instalacion,
       paquetes.nombre AS paquete_nombre,
       paquetes.velocidad_megas,
       ciclos_corte.nombre AS ciclo_corte_nombre,
       cajas_fibra.codigo_caja,
       cajas_fibra.nombre AS caja_nombre,
       caja_terminales.numero_terminal AS caja_terminal_numero,
       reportes.fecha_completado,
       reportes.comentario_cierre,
       trim(tecnico.nombres || ' ' || COALESCE(tecnico.apellido_paterno, '') || ' ' || COALESCE(tecnico.apellido_materno, '')) AS tecnico_nombre,
       tecnico.numero_empleado AS tecnico_numero_empleado
     FROM instalaciones_fibra
     JOIN clientes ON clientes.id = ?
     JOIN comunidades ON comunidades.id = clientes.comunidad_id
     JOIN servicios_fibra ON servicios_fibra.id = ?
     LEFT JOIN paquetes ON paquetes.id = servicios_fibra.paquete_id
     LEFT JOIN ciclos_corte ON ciclos_corte.id = servicios_fibra.ciclo_corte_id
     LEFT JOIN cajas_fibra ON cajas_fibra.id = instalaciones_fibra.caja_id
     LEFT JOIN caja_terminales ON caja_terminales.id = instalaciones_fibra.caja_terminal_id
     LEFT JOIN reportes ON reportes.id = instalaciones_fibra.reporte_id
     LEFT JOIN usuarios tecnico ON tecnico.id = instalaciones_fibra.tecnico_id
     WHERE instalaciones_fibra.id = ?`
  ).bind(clienteId, servicioFibraId, instalacionId).first()
}

async function generarNumeroContrato(env) {
  if (!env.CONTRATOS_KV) throw new Error('Falta configurar CONTRATOS_KV.')

  const currentValue = await env.CONTRATOS_KV.get(CONTRATO_COUNTER_KEY)
  const current = Number.parseInt(currentValue || '0', 10)
  const next = Number.isFinite(current) ? current + 1 : 1
  await env.CONTRATOS_KV.put(CONTRATO_COUNTER_KEY, String(next))
  return `CON-${new Date().getFullYear()}-${String(next).padStart(6, '0')}`
}

async function buildContratoPdf(data) {
  const pdfDoc = await PDFDocument.create()
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  let page = pdfDoc.addPage([595.28, 841.89])
  const margin = 42
  const width = page.getWidth()
  let y = page.getHeight() - margin

  const drawText = (text, x, yy, options = {}) => {
    page.drawText(safeText(text), {
      x,
      y: yy,
      size: options.size ?? 10,
      font: options.bold ? bold : regular,
      color: options.color ?? rgb(0.06, 0.09, 0.16),
    })
  }

  const ensureSpace = (height) => {
    if (y - height > margin) return
    page = pdfDoc.addPage([595.28, 841.89])
    y = page.getHeight() - margin
  }

  const title = (text) => {
    ensureSpace(38)
    page.drawRectangle({ x: margin, y: y - 22, width: width - margin * 2, height: 22, color: rgb(0.16, 0.21, 0.51) })
    drawText(text, margin + 10, y - 15, { size: 10, bold: true, color: rgb(1, 1, 1) })
    y -= 34
  }

  const row = (label, value) => {
    ensureSpace(18)
    drawText(`${label}:`, margin, y, { bold: true })
    drawWrappedText(page, value || 'N/A', margin + 150, y, width - margin * 2 - 150, regular, 10)
    y -= 18
  }

  drawText('WiFiMex Fibra Central', margin, y, { size: 18, bold: true, color: rgb(0.16, 0.21, 0.51) })
  drawText('CONTRATO DE SERVICIO DE INTERNET', margin, y - 24, { size: 15, bold: true })
  drawText(`Contrato: ${data.numero_contrato}`, margin, y - 46, { size: 11, bold: true })
  drawText(`Fecha: ${formatDate(new Date())}`, width - margin - 150, y - 46, { size: 10 })
  y -= 76

  title('Datos del cliente')
  row('Numero de cliente', data.numero_cliente)
  row('Nombre completo', fullName(data, 'cliente'))
  row('Telefono movil', data.cliente_telefono)
  row('Telefono fijo', data.cliente_telefono)
  row('Direccion', data.cliente_direccion)
  row('Comunidad', data.comunidad_nombre)
  row('Vigencia', data.vigencia_contrato)

  title('Datos del servicio')
  row('Paquete', packageName(data))
  row('Precio mensual', formatCurrency(data.precio_mensual))
  row('Ciclo de corte', data.ciclo_corte_nombre)
  row('IP asignada', data.ip_asignada)
  row('Alfanumerico del equipo', data.alfanumerico_equipo)
  row('Fecha de instalacion', data.servicio_fecha_instalacion || data.fecha_instalacion)

  title('Datos tecnicos de instalacion')
  row('Instalador', data.nombre_instalador)
  row('Marca del equipo', data.contrato_marca_equipo)
  row('Numero de equipos', data.contrato_numero_equipos)
  row('Costo equipo / penalidad', formatCurrency(data.contrato_costo_equipo_penalidad))
  row('Costo de instalacion', formatCurrency(data.contrato_costo_instalacion))
  row('Aplica reconexion', data.contrato_aplica_reconexion)
  row('Cantidad reconexion', formatCurrency(data.contrato_cantidad_reconexion))
  row('Modalidad de pago', data.contrato_modalidad_pago)
  row('Caja', data.codigo_caja || data.caja_nombre)
  row('Terminal', data.caja_terminal_numero ? `Terminal ${data.caja_terminal_numero}` : null)
  row('Potencia', data.potencia != null ? `${data.potencia} dBm` : null)
  row('Fibra optica usada', `${data.fibra_optica_metros ?? 0} m`)
  row('Tensor gancho', data.tensor_gancho)
  row('Argollas', data.argollas)
  row('Taquetes', data.taquetes)
  row('Sujetadores', data.sujetadores)
  row('Roseta', data.roseta)

  title('Reporte')
  row('Numero de reporte', data.reporte_id)
  row('Fecha de cierre', data.fecha_completado)
  row('Comentario de cierre', data.comentario_cierre || data.comentario_tecnico)

  ensureSpace(150)
  title('Firmas')
  await drawSignature(pdfDoc, page, data.firma_cliente_base64, margin, y - 72, 220, 62, 'Firma del cliente', bold, regular)
  await drawSignature(pdfDoc, page, data.firma_tecnico_base64, margin + 270, y - 72, 220, 62, 'Firma del tecnico', bold, regular)
  y -= 118

  drawWrappedText(
    page,
    'Documento generado automaticamente por el Sistema WiFiMex Fibra Central al confirmar la instalacion.',
    margin,
    margin,
    width - margin * 2,
    regular,
    8
  )

  return pdfDoc.save()
}

async function drawSignature(pdfDoc, page, dataUrl, x, y, width, height, label, bold, regular) {
  page.drawText(label, { x, y: y + height + 10, size: 9, font: bold, color: rgb(0.06, 0.09, 0.16) })
  page.drawRectangle({ x, y, width, height, borderColor: rgb(0.75, 0.8, 0.86), borderWidth: 1 })

  const imageInfo = parseImageDataUrl(dataUrl)
  if (!imageInfo) {
    page.drawText('Firma no disponible', { x: x + 10, y: y + 26, size: 8, font: regular, color: rgb(0.39, 0.45, 0.55) })
    return
  }

  try {
    const image = imageInfo.mime === 'image/png'
      ? await pdfDoc.embedPng(imageInfo.bytes)
      : await pdfDoc.embedJpg(imageInfo.bytes)
    const scaled = image.scaleToFit(width - 14, height - 12)
    page.drawImage(image, {
      x: x + (width - scaled.width) / 2,
      y: y + (height - scaled.height) / 2,
      width: scaled.width,
      height: scaled.height,
    })
  } catch {
    page.drawText('Firma guardada en sistema', { x: x + 10, y: y + 26, size: 8, font: regular, color: rgb(0.39, 0.45, 0.55) })
  }
}

function drawWrappedText(page, text, x, y, maxWidth, font, size) {
  const words = safeText(text || 'N/A').split(/\s+/)
  let line = ''
  let offset = 0
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(testLine, size) <= maxWidth) {
      line = testLine
      continue
    }
    page.drawText(safeText(line), { x, y: y - offset, size, font, color: rgb(0.06, 0.09, 0.16) })
    offset += size + 3
    line = word
  }
  if (line) page.drawText(safeText(line), { x, y: y - offset, size, font, color: rgb(0.06, 0.09, 0.16) })
}

function parseImageDataUrl(value) {
  const match = String(value ?? '').match(/^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/)
  if (!match) return null
  return {
    mime: match[1] === 'image/jpg' ? 'image/jpeg' : match[1],
    bytes: base64ToBytes(match[2]),
  }
}

function base64ToBytes(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function validarBindingsContratos(env) {
  if (!env.CONTRATOS_BUCKET) throw new Error('Falta configurar el binding CONTRATOS_BUCKET con el bucket R2 real de contratos.')
  if (!env.CONTRATOS_KV) throw new Error('Falta configurar el binding CONTRATOS_KV con el KV contador de contratos.')
}

function fullName(data, prefix) {
  return [
    data[`${prefix}_nombres`],
    data[`${prefix}_apellido_paterno`],
    data[`${prefix}_apellido_materno`],
  ].filter(Boolean).join(' ')
}

function getNombreInstalador(data) {
  return String(data.tecnico_nombre || data.tecnico_numero_empleado || 'TECNICO WIFIMEX').trim() || 'TECNICO WIFIMEX'
}

function getVigenciaContrato(comunidadNombre) {
  const comunidad = String(comunidadNombre || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (['ATETETLA', 'PALAPA'].includes(comunidad)) return 'MINIMO 6 MESES / INSTALACION $1500'
  return 'SIN PLAZO FORZOSO'
}

function packageName(data) {
  if (!data.paquete_nombre && !data.velocidad_megas) return null
  return [data.paquete_nombre, data.velocidad_megas ? `${data.velocidad_megas} Mbps` : null].filter(Boolean).join(' - ')
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

function formatDate(date) {
  return new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function safeText(value) {
  return String(value ?? '').replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, '')
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
