import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { requireAuth } from '../utils/auth.js'
import { json } from '../utils/response.js'
import { LOGO_BASE64 } from '../utils/logo.js'

const CONTRATO_ESTADO_GENERADO = 'GENERADO'
const CONTRATO_COUNTER_KEY = 'contador-contratos'
const PDF_CONTENT_TYPE = 'application/pdf'
const COMUNIDADES_VIGENCIA_ESPECIAL = ['PALAPA', 'COEXCONTLAN', 'ATETETLA']
const CONTRATO_VIGENCIAS_ESPECIALES = ['MINIMO 6 MESES', 'INSTALACION DE 1500']
const CONTRATO_VIGENCIA_NORMAL = 'SIN PLAZO FORZOSO'

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
      contrato: existing,
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
  if (duplicate) return duplicate

  const data = await getContratoData(env, instalacionId, clienteId, servicioFibraId)
  if (!data) throw new Error('No se encontraron datos completos para generar el contrato.')

  const numeroContrato = await generarNumeroContrato(env)
  const vigenciaContrato = getVigenciaContrato(data.comunidad_nombre, data.contrato_vigencia)
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
       r2_key, content_type, estado, aplica_reconexion,
       cantidad_reconexion, marca_equipo, numero_equipos, costo_equipo_penalidad,
       costo_instalacion, vigencia_contrato, nombre_instalador,
       generado_por_usuario_id, fecha_generado
     ) VALUES (?, ?, ?, ?, ?, ?, 'GENERADO', ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    numeroContrato,
    clienteId,
    servicioFibraId,
    instalacionId,
    r2Key,
    PDF_CONTENT_TYPE,
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
            r2_key, content_type, estado, aplica_reconexion,
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
            r2_key, content_type, estado, aplica_reconexion,
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
       instalaciones_fibra.contrato_vigencia,
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
  
  // Page 1: Carátula (Letter size: 612 x 792 pt)
  let page1 = pdfDoc.addPage([612, 792])
  
  // Embed logo
  let logoImage = null
  try {
    const logoBytes = base64ToBytes(LOGO_BASE64)
    logoImage = await pdfDoc.embedPng(logoBytes)
  } catch (err) {
    console.error('Error embedding logo:', err)
  }
  
  // Colors
  const black = rgb(0, 0, 0)
  const darkBlue = rgb(0.11, 0.32, 0.63)
  const grayText = rgb(0.39, 0.45, 0.55)
  const lightGrayBg = rgb(0.93, 0.95, 0.98)
  const lightGrayBorder = rgb(0.8, 0.82, 0.85)
  const redText = rgb(0.85, 0.1, 0.1)

  // 1. Header (Logo, Title, Contract Number)
  if (logoImage) {
    page1.drawImage(logoImage, { x: 36, y: 720, width: 95, height: 35.8 })
  }
  
  page1.drawText('CONTRATO DE SERVICIO', {
    x: 155,
    y: 735,
    size: 18,
    font: bold,
    color: darkBlue
  })
  
  page1.drawText(`N. de contrato: ${safeText(data.numero_contrato)}`, {
    x: 440,
    y: 715,
    size: 11,
    font: bold,
    color: black
  })

  // 2. Personal Data
  // Name
  page1.drawText('NOMBRE:', { x: 36, y: 685, size: 9, font: bold, color: darkBlue })
  page1.drawRectangle({
    x: 100,
    y: 679,
    width: 476,
    height: 18,
    color: lightGrayBg,
    borderColor: lightGrayBorder,
    borderWidth: 0.5
  })
  const clientName = fullName(data, 'cliente')
  page1.drawText(safeText(clientName), { x: 105, y: 684, size: 9, font: regular, color: black })

  // Address
  page1.drawText('DIRECCIÓN:', { x: 36, y: 659, size: 9, font: bold, color: darkBlue })
  page1.drawRectangle({
    x: 100,
    y: 653,
    width: 476,
    height: 18,
    color: lightGrayBg,
    borderColor: lightGrayBorder,
    borderWidth: 0.5
  })
  page1.drawText(safeText(data.cliente_direccion), { x: 105, y: 658, size: 9, font: regular, color: black })
  
  // Sub-labels for address
  page1.drawText('CALLE                 N. EXT               N. INT               COLONIA               ALCALDIA/MUNICIPIO', {
    x: 105,
    y: 643,
    size: 6.5,
    font: regular,
    color: grayText
  })

  // Phones
  page1.drawText('Teléfono móvil:', { x: 36, y: 622, size: 9, font: regular, color: black })
  page1.drawLine({ start: { x: 105, y: 621 }, end: { x: 250, y: 621 }, color: black, thickness: 0.5 })
  page1.drawText(safeText(data.cliente_telefono || 'N/A'), { x: 115, y: 623, size: 9, font: regular, color: black })

  page1.drawText('Teléfono fijo:', { x: 320, y: 622, size: 9, font: regular, color: black })
  page1.drawLine({ start: { x: 385, y: 621 }, end: { x: 530, y: 621 }, color: black, thickness: 0.5 })
  page1.drawText(safeText(data.cliente_telefono || 'N/A'), { x: 395, y: 623, size: 9, font: regular, color: black })

  // 3. Service Box
  page1.drawRectangle({
    x: 36,
    y: 515,
    width: 540,
    height: 90,
    borderColor: black,
    borderWidth: 1.2
  })
  // Header of box
  page1.drawRectangle({
    x: 36,
    y: 587,
    width: 540,
    height: 18,
    color: lightGrayBg,
    borderColor: black,
    borderWidth: 1
  })
  page1.drawText('SERVICIO DE INTERNET FIJO EN CASA/NEGOCIO', {
    x: 170,
    y: 592,
    size: 10,
    font: bold,
    color: darkBlue
  })
  // Vertical line division
  page1.drawLine({ start: { x: 306, y: 515 }, end: { x: 306, y: 587 }, color: black, thickness: 1 })

  // Left col: Description
  page1.drawText('DESCRIPCIÓN PAQUETE/OFERTA', {
    x: 46,
    y: 568,
    size: 9,
    font: bold,
    color: darkBlue
  })
  const packName = packageName(data) || 'N/A'
  page1.drawText(safeText(packName), {
    x: 46,
    y: 540,
    size: 10,
    font: bold,
    color: black
  })

  // Right col: Prices
  page1.drawText('TOTAL MENSUALIDAD:', { x: 316, y: 568, size: 8.5, font: bold, color: black })
  page1.drawLine({ start: { x: 435, y: 567 }, end: { x: 515, y: 567 }, color: black, thickness: 0.5 })
  page1.drawText(formatCurrency(data.precio_mensual), { x: 440, y: 569, size: 9, font: bold, color: black })

  page1.drawText('FECHA DE PAGO:', { x: 316, y: 548, size: 8.5, font: bold, color: black })
  const paymentDateStr = formatCicloCorte(data.ciclo_corte_nombre)
  page1.drawText(safeText(paymentDateStr), { x: 405, y: 548, size: 9, font: bold, color: darkBlue })

  page1.drawText('MODALIDAD DE PAGO:', { x: 316, y: 528, size: 8.5, font: bold, color: black })
  page1.drawLine({ start: { x: 435, y: 527 }, end: { x: 535, y: 527 }, color: black, thickness: 0.5 })

  // 4. Vigencia Row
  page1.drawText('VIGENCIA DEL CONTRATO:', { x: 36, y: 492, size: 8.5, font: bold, color: black })
  page1.drawText(safeText(data.vigencia_contrato || CONTRATO_VIGENCIA_NORMAL), { x: 165, y: 492, size: 8, font: bold, color: redText })

  page1.drawText('APLICA TARIFA POR RECONEXION:', { x: 36, y: 472, size: 8.5, font: bold, color: black })
  page1.drawLine({ start: { x: 202, y: 471 }, end: { x: 240, y: 471 }, color: black, thickness: 0.5 })
  page1.drawText(safeText(data.contrato_aplica_reconexion || 'SI'), { x: 214, y: 473, size: 8.5, font: bold, color: black })

  page1.drawText('CANTIDAD:', { x: 316, y: 472, size: 8.5, font: bold, color: black })
  page1.drawLine({ start: { x: 372, y: 471 }, end: { x: 475, y: 471 }, color: black, thickness: 0.5 })
  page1.drawText(formatCurrency(data.contrato_cantidad_reconexion ?? 350), { x: 382, y: 473, size: 8.5, font: bold, color: black })

  // 5. Equipment and Installation Box
  page1.drawRectangle({
    x: 36,
    y: 390,
    width: 540,
    height: 90,
    borderColor: black,
    borderWidth: 1.2
  })
  page1.drawLine({ start: { x: 306, y: 390 }, end: { x: 306, y: 480 }, color: black, thickness: 1 })

  // Left col: Equipment
  page1.drawText('DATOS DEL EQUIPO', { x: 105, y: 465, size: 9.5, font: bold, color: darkBlue })
  
  page1.drawText('MARCA:', { x: 46, y: 446, size: 8.5, font: bold, color: black })
  page1.drawLine({ start: { x: 92, y: 445 }, end: { x: 210, y: 445 }, color: black, thickness: 0.5 })
  page1.drawText(safeText(data.contrato_marca_equipo || 'HUAWEI'), { x: 105, y: 447, size: 8.5, font: bold, color: black })

  page1.drawText('NÚMERO DE SERIE:', { x: 46, y: 428, size: 8.5, font: bold, color: black })
  page1.drawLine({ start: { x: 142, y: 427 }, end: { x: 290, y: 427 }, color: black, thickness: 0.5 })
  page1.drawText(safeText(data.alfanumerico_equipo || 'N/A'), { x: 147, y: 429, size: 8.5, font: bold, color: black })

  page1.drawText('NÚMERO DE EQUIPOS:', { x: 46, y: 410, size: 8.5, font: bold, color: black })
  page1.drawLine({ start: { x: 158, y: 409 }, end: { x: 210, y: 409 }, color: black, thickness: 0.5 })
  page1.drawText(String(data.contrato_numero_equipos ?? 1), { x: 178, y: 411, size: 8.5, font: bold, color: black })

  page1.drawText('COSTO EQUIPO/PENALIDAD:', { x: 46, y: 392, size: 8.5, font: bold, color: black })
  page1.drawLine({ start: { x: 182, y: 391 }, end: { x: 250, y: 391 }, color: black, thickness: 0.5 })
  page1.drawText(formatCurrency(data.contrato_costo_equipo_penalidad), { x: 187, y: 393, size: 8.5, font: bold, color: black })

  // Right col: Installation
  page1.drawText('INSTALACIÓN', { x: 385, y: 465, size: 9.5, font: bold, color: darkBlue })
  
  const { date: installDate, time: installTime } = getInstalacionDateTime(data.servicio_fecha_instalacion || data.fecha_instalacion)
  
  page1.drawText('FECHA:', { x: 316, y: 446, size: 8.5, font: bold, color: black })
  page1.drawLine({ start: { x: 358, y: 445 }, end: { x: 450, y: 445 }, color: black, thickness: 0.5 })
  page1.drawText(safeText(installDate), { x: 368, y: 447, size: 8.5, font: bold, color: black })

  page1.drawText('HORA:', { x: 316, y: 428, size: 8.5, font: bold, color: black })
  page1.drawLine({ start: { x: 352, y: 427 }, end: { x: 440, y: 427 }, color: black, thickness: 0.5 })
  page1.drawText(safeText(installTime), { x: 362, y: 429, size: 8.5, font: bold, color: black })

  page1.drawText('COSTO DE INSTALACIÓN:', { x: 316, y: 410, size: 8.5, font: bold, color: black })
  page1.drawLine({ start: { x: 442, y: 409 }, end: { x: 510, y: 409 }, color: black, thickness: 0.5 })
  page1.drawText(formatCurrency(data.contrato_costo_instalacion), { x: 452, y: 411, size: 8.5, font: bold, color: black })

  // 6. Red Warning Text
  const warningText = 'EL PROVEEDOR DEBERÁ EFECTUAR LAS INSTALACIONES Y EMPEZAR A PRESTAR EL SERVICIO EN UN PLAZO QUE NO EXCEDA DE 10 DÍAS NATURALES POSTERIORES A LA FIRMA DE CONTRATO.'
  page1.drawText(warningText, {
    x: 55,
    y: 368,
    size: 6,
    font: bold,
    color: redText
  })

  // 7. Signatures Area
  page1.drawLine({ start: { x: 60, y: 298 }, end: { x: 240, y: 298 }, color: black, thickness: 0.8 })
  page1.drawText('FIRMA CLIENTE', { x: 110, y: 286, size: 8, font: bold, color: black })
  await drawSignaturePdfLib(pdfDoc, page1, data.firma_cliente_base64, 70, 300, 160, 50, 'firma cliente')

  page1.drawLine({ start: { x: 372, y: 298 }, end: { x: 552, y: 298 }, color: black, thickness: 0.8 })
  const techLabel = `FIRMA TÉCNICO: ${data.nombre_instalador || 'TECNICO WIFIMEX'}`
  page1.drawText(safeText(techLabel), { x: 372, y: 286, size: 8, font: bold, color: black })
  await drawSignaturePdfLib(pdfDoc, page1, data.firma_tecnico_base64, 382, 300, 160, 50, 'firma tecnico')

  // 8. Materials Section
  drawMaterialRow(page1, 36, 238, 'FIBRA OPTICA', data.fibra_optica_metros, bold)
  drawMaterialRow(page1, 36, 226, 'TENSOR GANCHO', data.tensor_gancho, bold)
  drawMaterialRow(page1, 36, 214, 'ARGOLLAS', data.argollas, bold)
  // Table 2
  drawMaterialRow(page1, 216, 238, 'TAQUETES', data.taquetes, bold)
  drawMaterialRow(page1, 216, 226, 'SUJETADORES', data.sujetadores, bold)
  drawMaterialRow(page1, 216, 214, 'ROSETA', data.roseta, bold)
  // Table 3
  drawMaterialRow(page1, 396, 238, 'TERMINAL', data.caja_terminal_numero, bold)
  drawMaterialRow(page1, 396, 226, 'PUERTO', data.codigo_caja || data.caja_nombre, bold)
  drawMaterialRow(page1, 396, 214, 'POTENCIA', data.potencia !== null && data.potencia !== undefined ? `${data.potencia} dBm` : 'N/A', bold)

  // 9. Footer
  page1.drawLine({ start: { x: 36, y: 155 }, end: { x: 576, y: 155 }, color: grayText, thickness: 0.5 })
  
  // Left footer
  page1.drawText('Horario de atención:', { x: 36, y: 140, size: 7.5, font: bold, color: black })
  page1.drawText('Lunes a Viernes: 8:00 AM A 6:00 PM', { x: 36, y: 128, size: 7.5, font: regular, color: black })
  page1.drawText('Sábado: 8:00 AM A 2:00 PM', { x: 36, y: 116, size: 7.5, font: regular, color: black })

  // Right footer
  page1.drawText('WIFI-MEX SERVICIO DE INTERNET', { x: 350, y: 140, size: 7.5, font: bold, color: black })
  page1.drawText('74-71-24-03-27', { x: 350, y: 128, size: 7.5, font: regular, color: black })
  page1.drawText('AGUA POTABLE, PRINCIPAL S/N C.P. 39070', { x: 350, y: 116, size: 7.5, font: regular, color: black })
  page1.drawText('CHILPANCINGO DE LOS BRAVO, GRO. MÉXICO', { x: 350, y: 104, size: 7.5, font: regular, color: black })
  page1.drawText('wifimexatencionaclientes@gmail.com', { x: 350, y: 92, size: 7.5, font: regular, color: black })

  // ==========================================
  // PAGE 2: Texto legal (Declaraciones y Cláusulas)
  // ==========================================
  let page2 = pdfDoc.addPage([612, 792])

  // Small Logo top left
  if (logoImage) {
    page2.drawImage(logoImage, { x: 36, y: 745, width: 70, height: 26.3 })
  }

  // Top right header page 2
  page2.drawText('WIFI-MEX SERVICIO DE INTERNET', { x: 440, y: 765, size: 6.5, font: bold, color: black })
  page2.drawText('74-71-24-03-27', { x: 440, y: 757, size: 6.5, font: regular, color: black })
  page2.drawText('AGUA POTABLE, PRINCIPAL S/N C.P. 39070', { x: 440, y: 749, size: 6.5, font: regular, color: black })
  page2.drawText('CHILPANCINGO DE LOS BRAVO, GRO, MÉXICO.', { x: 440, y: 741, size: 6.5, font: regular, color: black })

  // Large center title page 2
  const mainTitle2_1 = 'CONTRATO DE PRESTACIÒN DE SERVICIOS DE INTERNET FIJO EN CASA QUE CELEBRARA POR UNA PARTE'
  const mainTitle2_2 = 'DE WIFI-MEX Y POR OTRA PARTE EL CLIENTE AL TENOR DE SIGUIENTE.'
  page2.drawText(mainTitle2_1, { x: 90, y: 715, size: 7.5, font: bold, color: black })
  page2.drawText(mainTitle2_2, { x: 150, y: 705, size: 7.5, font: bold, color: black })

  // Declaraciones Header
  page2.drawText('DECLARACIONES', { x: 265, y: 685, size: 7.5, font: bold, color: black })

  // Declaraciones texts
  let decY = 672
  const decA = 'A) QUE LOS DATOS CONSISTENTES EN EL DOMICILIO Y DATOS DE LOCALIZACIÓN DEL DOMICILIO SON CIERTOS Y SE ENCUENTRAN ESTABLECIDOS EN LA CARÁTULA DEL PRESENTE CONTRATO.'
  const decB = 'B) QUE TIENEN PLENO GOCE DE SUS DERECHOS Y CAPACIDAD LEGAL PARA CONTRATAR Y OBLIGARSE EN TÉRMINOS DEL PRESENTE CONTRATO.'
  const decC = 'C) QUE LA MANIFESTACIÓN DE LA VOLUNTAD PARA ADHERIRSE AL PRESENTE CONTRATO DE ADHESIÓN Y SU CARÁTULA (LA CUAL FORMA PARTE INTEGRANTE DEL REFERIDO CONTRATO) SE TOMARAN EN CUENTA LAS FIRMAS QUE PLASMEN AMBAS PARTES EN LA CARÁTULA.'
  const decD = 'D) QUE ES SU VOLUNTAD CELEBRAR EL PRESENTE CONTRATO SUJETÁNDOSE A LAS SIGUIENTES:'

  decY = drawTextColumn(page2, decA, 36, decY, 540, regular, 6.5, 1.25)
  decY -= 2
  decY = drawTextColumn(page2, decB, 36, decY, 540, regular, 6.5, 1.25)
  decY -= 2
  decY = drawTextColumn(page2, decC, 36, decY, 540, regular, 6.5, 1.25)
  decY -= 2
  decY = drawTextColumn(page2, decD, 36, decY, 540, regular, 6.5, 1.25)

  // Cláusulas Header
  page2.drawText('CLÁUSULAS', { x: 280, y: decY - 14, size: 7.5, font: bold, color: black })
  
  // Left Column clauses (x=36, width=260)
  let col1Y = decY - 30
  
  const c1_1 = 'PRIMERA: OBJETO DEL CONTRATO. Wifi-Mex se obliga a prestar el servicio de internet fijo en casa, (en adelante el servicio), de manera continua, uniforme, regular y eficiente, a cambio del pago de la tarifa, plan o paquete que el CLIENTE haya seleccionado en la carátula del presente contrato.'
  const c1_2 = 'El presente contrato se regirá bajo una instalación gratis y bajo el esquema de Prepago, cuando el usuario paga por los servicios de telecomunicaciones, antes de utilizarlos, se regirá por una renta mensual.'
  const c1_3 = 'Wifi-Mex es el único responsable frente al CLIENTE por la prestación del SERVICIO, así como, de los bienes o servicios adicionales contratados.'
  const c1_4 = 'Todo lo pactado o contratado entre el CLIENTE y Wifi-Mex de manera verbal o electrónica se le debe confirmar por escrito al CLIENTE a través del medio que él elija, en un plazo máximo de diez días hábiles, contados a partir del momento en que se realice el pacto o contratación.'
  const c2_1 = 'SEGUNDA: SIN PLAZO FORZOSO. Sí el cliente decide cancelar tendrá que notificar con un mes de anticipación, a través del mismo medio en el cual contrató el servicio o por los medios de contacto señalados en la carátula.'
  const c2_2 = 'El CLIENTE puede negarse, sin responsabilidad alguna para él, a la instalación o activación del servicio ante la negativa del personal de Wifi-Mex a identificarse y/o a mostrar la orden de trabajo. Situación que debe informar a Wifi-Mex en ese momento.'
  const c2_3 = 'Los planes, paquetes, cobertura donde Wifi-Mex puede prestar el servicio y tarifas se pueden consultar por los medios establecidos en la carátula del presente contrato.'
  const c2_4 = 'La fecha, forma y lugares de pago se pueden consultar por los medios señalados en la carátula del presente contrato.'
  const c3_1 = 'TERCERA: MODIFICACIONES. Wifi-Mex dará aviso al CLIENTE, cuando menos con 15 días naturales de anticipación, de cualquier cambio en los términos y condiciones originalmente contratados. Dicho aviso deberá ser notificado, a través de medios físicos o electrónicos o digitales o de cualquier otra nueva tecnología que lo permita.'

  col1Y = drawTextColumn(page2, c1_1, 36, col1Y, 260, regular, 6.5, 1.2)
  col1Y -= 4
  col1Y = drawTextColumn(page2, c1_2, 36, col1Y, 260, regular, 6.5, 1.2)
  col1Y -= 4
  col1Y = drawTextColumn(page2, c1_3, 36, col1Y, 260, regular, 6.5, 1.2)
  col1Y -= 4
  col1Y = drawTextColumn(page2, c1_4, 36, col1Y, 260, regular, 6.5, 1.2)
  col1Y -= 8
  col1Y = drawTextColumn(page2, c2_1, 36, col1Y, 260, regular, 6.5, 1.2)
  col1Y -= 4
  col1Y = drawTextColumn(page2, c2_2, 36, col1Y, 260, regular, 6.5, 1.2)
  col1Y -= 4
  col1Y = drawTextColumn(page2, c2_3, 36, col1Y, 260, regular, 6.5, 1.2)
  col1Y -= 4
  col1Y = drawTextColumn(page2, c2_4, 36, col1Y, 260, regular, 6.5, 1.2)
  col1Y -= 8
  col1Y = drawTextColumn(page2, c3_1, 36, col1Y, 260, regular, 6.5, 1.2)

  // Right Column clauses (x=316, width=260)
  let col2Y = decY - 30

  const c4_1 = 'CUARTA: SUSPENSIÓN DEL SERVICIO. Wifi-Mex podrá suspender el Servicio, previa notificación por escrito al CLIENTE, si este último incurre en cualquiera de los siguientes supuestos:'
  const c4_2 = '1.- Por pagos parciales de la tarifa aplicable al SERVICIO.'
  const c4_3 = '2.- Por falta de pago del SERVICIO después de 1 día natural posteriores a la fecha de pago señalada en la carátula del presente contrato.'
  const c5_1 = 'QUINTA: TERMINACIÓN Y CANCELACIÓN DEL CONTRATO. El Presente contrato se podrá cancelar por cualquiera de las partes sin responsabilidad para ellas en los siguientes casos: a) Por la imposibilidad permanente de Wifi-Mex para continuar con la prestación del SERVICIO, ya sea por caso fortuito o fuerza mayor. b) Si el CLIENTE no subsana en un término de 30 días naturales cualquiera de las causas que dieron origen a la suspensión del SERVICIO.'
  const c5_2 = 'El CLIENTE podrá dar por terminado el contrato en cualquier momento con 30 (treinta) días naturales de anticipación al hecho, dando únicamente el aviso al proveedor a través del mismo medio por el cual contrató el servicio, o a través los medios físicos o electrónicos o digitales o de cualquier otra nueva tecnología que lo permita. La cancelación o terminación del Contrato no exime al CLIENTE de pagar a Wifi-MEX los adeudos generados por el/los Servicio(s) efectivamente recibido(s), y hasta en tanto no realice el proceso de cancelación y/o terminación el servicio se seguirá facturando.'
  const c5_3 = 'Es responsabilidad del CLIENTE llevar a cabo las medidas requeridas para cuidar y salvaguardar su información, datos y/o software de su propiedad, de accesos desde internet a sus dispositivos o, en su caso, evitar una contaminación por virus o ataques de usuarios de internet, por lo que Wifi-MEX no será responsable de cualquier daño y perjuicio causado al CLIENTE por los hechos antes mencionados.'
  const c6_1 = 'SEXTA: EL CLIENTE podrá presentar sus quejas por fallas y/o deficiencias en el servicio y/o equipos; así como consultas, contrataciones, cancelaciones, sugerencias y reclamaciones a Wifi-Mex de manera gratuita por los medios señalados en la carátula.'

  col2Y = drawTextColumn(page2, c4_1, 316, col2Y, 260, regular, 6.5, 1.2)
  col2Y -= 4
  col2Y = drawTextColumn(page2, c4_2, 316, col2Y, 260, regular, 6.5, 1.2)
  col2Y -= 4
  col2Y = drawTextColumn(page2, c4_3, 316, col2Y, 260, regular, 6.5, 1.2)
  col2Y -= 8
  col2Y = drawTextColumn(page2, c5_1, 316, col2Y, 260, regular, 6.5, 1.2)
  col2Y -= 4
  col2Y = drawTextColumn(page2, c5_2, 316, col2Y, 260, regular, 6.5, 1.2)
  col2Y -= 4
  col2Y = drawTextColumn(page2, c5_3, 316, col2Y, 260, regular, 6.5, 1.2)
  col2Y -= 8
  col2Y = drawTextColumn(page2, c6_1, 316, col2Y, 260, regular, 6.5, 1.2)

  return pdfDoc.save()
}

// Helpers for buildContratoPdf
async function drawSignaturePdfLib(pdfDoc, page, dataUrl, x, y, width, height, label = 'firma') {
  const imageInfo = parseImageDataUrl(dataUrl)
  if (!imageInfo) {
    console.warn(`No se pudo insertar ${label} en contrato: imagen vacia o formato no reconocido.`)
    return false
  }

  try {
    const image = imageInfo.mime === 'image/png'
      ? await pdfDoc.embedPng(imageInfo.bytes)
      : await pdfDoc.embedJpg(imageInfo.bytes)
    const scaled = image.scaleToFit(width, height)
    page.drawImage(image, {
      x: x + (width - scaled.width) / 2,
      y: y + (height - scaled.height) / 2,
      width: scaled.width,
      height: scaled.height,
    })
    return true
  } catch (err) {
    console.warn(`No se pudo insertar ${label} en contrato: error al embeber imagen.`, err)
    return false
  }
}

function drawMaterialRow(p, x, y, label, val, font) {
  const black = rgb(0, 0, 0)
  const safeFont = assertPdfFont(font, 'drawMaterialRow')
  p.drawRectangle({ x, y, width: 110, height: 12, borderColor: black, borderWidth: 0.5 })
  p.drawText(safeText(label), { x: x + 4, y: y + 3, size: 6.5, font: safeFont, color: black })
  
  p.drawRectangle({ x: x + 110, y, width: 50, height: 12, borderColor: black, borderWidth: 0.5 })
  p.drawText(safeText(String(val ?? 0)), { x: x + 114, y: y + 3, size: 6.5, font: safeFont, color: black })
}

function getInstalacionDateTime(fechaInstalacion) {
  if (!fechaInstalacion) return { date: 'N/A', time: 'N/A' }
  const parts = String(fechaInstalacion).split(' ')
  if (parts.length >= 2) {
    const dateParts = parts[0].split('-')
    const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : parts[0]
    const timeParts = parts[1].split(':')
    const formattedTime = timeParts.length >= 2 ? `${timeParts[0]}:${timeParts[1]} hrs` : parts[1]
    return { date: formattedDate, time: formattedTime }
  }
  try {
    const d = new Date(fechaInstalacion)
    if (!isNaN(d.getTime())) {
      const formattedDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
      const formattedTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} hrs`
      return { date: formattedDate, time: formattedTime }
    }
  } catch {}
  return { date: fechaInstalacion, time: 'N/A' }
}

function formatCicloCorte(nombre) {
  if (!nombre) return 'N/A'
  const match = String(nombre).match(/^CORTE\s+(\d+-\d+)$/i)
  if (match) return `${match[1]} de cada mes`
  return nombre
}

function drawTextColumn(page, text, x, y, width, font, size, lineGap = 1.3) {
  const safeFont = assertPdfFont(font, 'drawTextColumn')
  const safeX = finiteNumber(x, 36)
  const safeWidth = Math.max(finiteNumber(width, 200), 1)
  const safeSize = Math.max(finiteNumber(size, 7), 1)
  const safeLineGap = Math.max(finiteNumber(lineGap, 1.3), 1)
  const words = safeText(text || '').split(/\s+/).filter(Boolean)
  let line = ''
  let currentY = finiteNumber(y, 700)
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word
    if (safeFont.widthOfTextAtSize(testLine, safeSize) <= safeWidth || !line) {
      line = testLine
    } else {
      page.drawText(safeText(line), { x: safeX, y: currentY, size: safeSize, font: safeFont })
      currentY -= (safeSize * safeLineGap)
      line = word
    }
  }
  if (line) {
    page.drawText(safeText(line), { x: safeX, y: currentY, size: safeSize, font: safeFont })
    currentY -= (safeSize * safeLineGap)
  }
  return currentY
}

function assertPdfFont(font, context) {
  if (font && typeof font.widthOfTextAtSize === 'function') return font
  throw new Error(`Fuente PDF invalida en ${context}.`)
}

function finiteNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function parseImageDataUrl(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const match = raw.match(/^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/)
  const mime = match ? match[1] : detectBase64ImageMime(raw)
  const base64 = match ? match[2] : raw
  if (!mime || !base64) return null
  return {
    mime: mime === 'image/jpg' ? 'image/jpeg' : mime,
    bytes: base64ToBytes(base64),
  }
}

function detectBase64ImageMime(base64) {
  const clean = String(base64 || '').slice(0, 20)
  if (clean.startsWith('iVBOR')) return 'image/png'
  if (clean.startsWith('/9j/')) return 'image/jpeg'
  return null
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

function getVigenciaContrato(comunidadNombre, contratoVigencia) {
  if (!isComunidadVigenciaEspecial(comunidadNombre)) return CONTRATO_VIGENCIA_NORMAL
  const vigencia = normalizeText(contratoVigencia)
  return CONTRATO_VIGENCIAS_ESPECIALES.includes(vigencia) ? vigencia : 'MINIMO 6 MESES'
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function isComunidadVigenciaEspecial(comunidadNombre) {
  return COMUNIDADES_VIGENCIA_ESPECIAL.includes(normalizeText(comunidadNombre))
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


