import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import '../../styles/TecnicoDashboard.css'

const initialInstallationForm = {
  titular_nombres: '',
  titular_apellido_paterno: '',
  titular_apellido_materno: '',
  titular_telefono: '',
  titular_direccion: '',
  paquete_instalacion_id: '',
  alfanumerico_equipo: '',
  contrato_marca_equipo: 'HUAWEI',
  contrato_marca_equipo_otro: '',
  contrato_numero_equipos: '1',
  contrato_costo_equipo_penalidad: '800',
  contrato_costo_instalacion: '0',
  contrato_aplica_reconexion: 'SI',
  contrato_cantidad_reconexion: '350',
  contrato_modalidad_pago: 'SIN DEFINIR',
  caja_id: '',
  caja_terminal_id: '',
  fibra_optica_metros: '0',
  tensor_gancho: '0',
  argollas: '0',
  taquetes: '0',
  sujetadores: '0',
  roseta: '0',
  potencia: '',
  comentario: '',
}

function TecnicoDashboard({ apiUrl, token, usuario }) {
  const [reportes, setReportes] = useState([])
  const [fecha, setFecha] = useState('')
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState('')
  const [installationReporte, setInstallationReporte] = useState(null)
  const [installationForm, setInstallationForm] = useState(initialInstallationForm)
  const [installationPackages, setInstallationPackages] = useState([])
  const [installationCajas, setInstallationCajas] = useState([])
  const [installationTerminales, setInstallationTerminales] = useState([])
  const [technicianLocation, setTechnicianLocation] = useState(null)
  const [locationStatus, setLocationStatus] = useState('idle')
  const [locationMessage, setLocationMessage] = useState('')
  const [boxSelectorOpen, setBoxSelectorOpen] = useState(false)
  const [loadingInstallationData, setLoadingInstallationData] = useState(false)
  const [clientSignature, setClientSignature] = useState('')
  const [technicianSignature, setTechnicianSignature] = useState('')
  const [routerPhoto, setRouterPhoto] = useState('')
  const [routerPhotoPreview, setRouterPhotoPreview] = useState('')
  const [hasStoredRouterPhoto, setHasStoredRouterPhoto] = useState(false)
  const [clearClientSignatureSignal, setClearClientSignatureSignal] = useState(0)
  const [clearTechnicianSignatureSignal, setClearTechnicianSignatureSignal] = useState(0)
  const [sendingInstallation, setSendingInstallation] = useState(false)

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const loadReportes = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const response = await fetch(`${apiUrl}/api/tecnico/reportes/hoy`, { headers: authHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudieron cargar tus reportes.')
      setReportes(data.reportes ?? [])
      setFecha(data.fecha ?? '')
      setLastUpdated(formatTime(new Date()))
    } catch (error) {
      if (!silent) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.message, confirmButtonText: 'Entendido', confirmButtonColor: '#4274D9' })
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [apiUrl, authHeaders])

  useEffect(() => {
    loadReportes()

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadReportes({ silent: true })
      }
    }, 20000)

    return () => window.clearInterval(intervalId)
  }, [loadReportes])

  async function patchAction(reporteId, action, body = {}) {
    const response = await fetch(`${apiUrl}/api/tecnico/reportes/${reporteId}/${action}`, {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error ?? 'No se pudo actualizar el reporte.')
    await loadReportes()
  }

  async function iniciarTrabajo(reporte) {
    try {
      await patchAction(reporte.id, 'iniciar')
      requestTechnicianLocation()
      await Swal.fire({
        icon: 'success',
        title: 'Trabajo iniciado',
        text: `Has iniciado la atencion del reporte #${reporte.id}.`,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#4274D9',
      })
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message, confirmButtonText: 'Entendido', confirmButtonColor: '#4274D9' })
    }
  }

  async function noEncontrado(reporte) {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'No encontraste al cliente?',
      text: `Atencion/Soporte revisara el reporte #${reporte.id}.`,
      showCancelButton: true,
      confirmButtonText: 'Registrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4274D9',
      cancelButtonColor: '#64748b',
    })
    if (!result.isConfirmed) return

    try {
      await patchAction(reporte.id, 'no-encontrado')
      await Swal.fire({ icon: 'success', title: 'Reporte enviado a revision', text: 'Atencion/Soporte revisara este reporte.', confirmButtonText: 'Entendido', confirmButtonColor: '#4274D9' })
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message, confirmButtonText: 'Entendido', confirmButtonColor: '#4274D9' })
    }
  }

  async function solicitarCierre(reporte) {
    if (reporte.tipo_reporte === 'INSTALACION') {
      openInstallationModal(reporte)
      return
    }

    const result = await Swal.fire({
      title: 'Solicitar cierre',
      input: 'textarea',
      inputLabel: 'Que se realizo?',
      inputPlaceholder: 'Describe la solucion realizada',
      inputAttributes: { 'aria-label': 'Solucion realizada' },
      showCancelButton: true,
      confirmButtonText: 'Enviar solicitud',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4274D9',
      inputValidator: (value) => {
        if (!String(value ?? '').trim()) return 'Escribe que se realizo.'
        return null
      },
      didOpen: () => {
        const textarea = Swal.getInput()
        textarea?.addEventListener('input', () => {
          textarea.value = textarea.value.toUpperCase()
        })
      },
    })
    if (!result.isConfirmed) return

    try {
      await patchAction(reporte.id, 'solicitar-cierre', { solucion: String(result.value ?? '').trim().toUpperCase() })
      await Swal.fire({ icon: 'success', title: 'Solicitud enviada', text: 'Atencion/Soporte confirmara el cierre.', confirmButtonText: 'Entendido', confirmButtonColor: '#4274D9' })
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message, confirmButtonText: 'Entendido', confirmButtonColor: '#4274D9' })
    }
  }

  function openInstallationModal(reporte) {
    setInstallationReporte(reporte)
    setInstallationForm(initialInstallationForm)
    setInstallationPackages([])
    setInstallationCajas([])
    setInstallationTerminales([])
    setClientSignature('')
    setTechnicianSignature('')
    setRouterPhoto('')
    setRouterPhotoPreview('')
    setHasStoredRouterPhoto(false)
    setBoxSelectorOpen(false)
    setClearClientSignatureSignal((current) => current + 1)
    setClearTechnicianSignatureSignal((current) => current + 1)
    requestTechnicianLocation()
    loadInstallationData(reporte)
  }

  function requestTechnicianLocation() {
    if (locationStatus === 'loading' || locationStatus === 'granted' || locationStatus === 'denied' || locationStatus === 'unsupported') return

    if (!navigator.geolocation) {
      setLocationStatus('unsupported')
      setLocationMessage('No se pudo obtener tu ubicacion. Puedes seleccionar la caja manualmente.')
      return
    }

    setLocationStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setTechnicianLocation({
          latitud: position.coords.latitude,
          longitud: position.coords.longitude,
        })
        setLocationStatus('granted')
        setLocationMessage('Tu ubicacion solo se usa para mostrar cajas cercanas y no se guarda.')
      },
      () => {
        setTechnicianLocation(null)
        setLocationStatus('denied')
        setLocationMessage('No se pudo obtener tu ubicacion. Puedes seleccionar la caja manualmente.')
        Swal.fire({
          icon: 'info',
          title: 'Ubicacion no disponible',
          text: 'No se pudo obtener tu ubicacion. Puedes seleccionar la caja manualmente.',
          confirmButtonColor: '#4274D9',
        })
      },
      {
        enableHighAccuracy: true,
        timeout: 9000,
        maximumAge: 60000,
      }
    )
  }

  async function loadInstallationData(reporte) {
    setLoadingInstallationData(true)
    try {
      const response = await fetch(`${apiUrl}/api/tecnico/reportes/${reporte.id}/instalacion`, { headers: authHeaders })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'No se pudieron cargar los datos de instalacion.')

      const instalacion = data.instalacion
      const prospecto = data.prospecto ?? {}
      setInstallationPackages(data.paquetes ?? [])
      setInstallationForm({
        titular_nombres: instalacion?.titular_nombres ?? prospecto.nombres ?? '',
        titular_apellido_paterno: instalacion?.titular_apellido_paterno ?? prospecto.apellido_paterno ?? '',
        titular_apellido_materno: instalacion?.titular_apellido_materno ?? prospecto.apellido_materno ?? '',
        titular_telefono: instalacion?.titular_telefono ?? prospecto.telefono ?? '',
        titular_direccion: instalacion?.titular_direccion ?? prospecto.direccion ?? '',
        paquete_instalacion_id: String(instalacion?.paquete_instalacion_id ?? data.paquete_default_id ?? ''),
        alfanumerico_equipo: instalacion?.alfanumerico_equipo ?? '',
        contrato_marca_equipo: getKnownBrand(instalacion?.contrato_marca_equipo),
        contrato_marca_equipo_otro: getKnownBrand(instalacion?.contrato_marca_equipo) === 'OTRO' ? instalacion?.contrato_marca_equipo ?? '' : '',
        contrato_numero_equipos: String(instalacion?.contrato_numero_equipos ?? '1'),
        contrato_costo_equipo_penalidad: String(instalacion?.contrato_costo_equipo_penalidad ?? '800'),
        contrato_costo_instalacion: String(instalacion?.contrato_costo_instalacion ?? '0'),
        contrato_aplica_reconexion: instalacion?.contrato_aplica_reconexion ?? 'SI',
        contrato_cantidad_reconexion: String(instalacion?.contrato_cantidad_reconexion ?? '350'),
        contrato_modalidad_pago: instalacion?.contrato_modalidad_pago ?? 'SIN DEFINIR',
        caja_id: instalacion?.caja_id ? String(instalacion.caja_id) : '',
        caja_terminal_id: instalacion?.caja_terminal_id ? String(instalacion.caja_terminal_id) : '',
        fibra_optica_metros: String(instalacion?.fibra_optica_metros ?? '0'),
        tensor_gancho: String(instalacion?.tensor_gancho ?? '0'),
        argollas: String(instalacion?.argollas ?? '0'),
        taquetes: String(instalacion?.taquetes ?? '0'),
        sujetadores: String(instalacion?.sujetadores ?? '0'),
        roseta: String(instalacion?.roseta ?? '0'),
        potencia: instalacion?.potencia != null ? String(instalacion.potencia) : '',
        comentario: instalacion?.comentario_tecnico ?? '',
      })
      setClientSignature(instalacion?.firma_cliente_base64 ?? '')
      setTechnicianSignature(instalacion?.firma_tecnico_base64 ?? '')
      setRouterPhoto('')
      setRouterPhotoPreview('')
      setHasStoredRouterPhoto(Boolean(instalacion?.foto_router_r2_key))
      await loadCajasDisponibles(reporte.comunidad_id)
      if (instalacion?.caja_id) {
        await loadTerminalesDisponibles(instalacion.caja_id, reporte.id)
      }
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message, confirmButtonColor: '#4274D9' })
    } finally {
      setLoadingInstallationData(false)
    }
  }

  function closeInstallationModal() {
    if (sendingInstallation) return
    setInstallationReporte(null)
    setClientSignature('')
    setTechnicianSignature('')
    setRouterPhoto('')
    setRouterPhotoPreview('')
    setHasStoredRouterPhoto(false)
    setInstallationCajas([])
    setInstallationTerminales([])
    setBoxSelectorOpen(false)
  }

  function updateInstallationForm(field, value) {
    setInstallationForm((current) => ({
      ...current,
      [field]: ['comentario', 'alfanumerico_equipo', 'titular_nombres', 'titular_apellido_paterno', 'titular_apellido_materno', 'titular_direccion', 'contrato_marca_equipo_otro'].includes(field) ? value.toUpperCase() : value,
    }))
  }

  async function loadCajasDisponibles(comunidadId) {
    if (!comunidadId) {
      setInstallationCajas([])
      return
    }

    try {
      const response = await fetch(`${apiUrl}/api/infraestructura/cajas/disponibles?comunidad_id=${comunidadId}`, { headers: authHeaders })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'No se pudieron cargar las cajas de fibra.')
      setInstallationCajas(data.cajas ?? [])
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message, confirmButtonColor: '#4274D9' })
    }
  }

  async function loadTerminalesDisponibles(cajaId, reporteId = installationReporte?.id) {
    if (!cajaId) {
      setInstallationTerminales([])
      return
    }

    try {
      const params = new URLSearchParams()
      if (reporteId) params.set('reporte_id', String(reporteId))
      const response = await fetch(`${apiUrl}/api/infraestructura/cajas/${cajaId}/terminales-disponibles?${params.toString()}`, { headers: authHeaders })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'No se pudieron cargar las terminales libres.')
      setInstallationTerminales(data.terminales ?? [])
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message, confirmButtonColor: '#4274D9' })
    }
  }

  function handleCajaChange(value) {
    setInstallationForm((current) => ({ ...current, caja_id: value, caja_terminal_id: '' }))
    loadTerminalesDisponibles(value)
  }

  function selectCaja(caja) {
    const libres = Number(caja?.terminales_libres ?? 0)
    if (!caja?.id || libres <= 0) return
    handleCajaChange(String(caja.id))
    setBoxSelectorOpen(false)
  }

  const sortedInstallationCajas = useMemo(() => {
    const cajas = installationCajas.map((caja) => {
      const distanceMeters = technicianLocation
        ? calculateDistanceMeters(technicianLocation.latitud, technicianLocation.longitud, caja.latitud, caja.longitud)
        : null
      return { ...caja, distanceMeters }
    })

    return cajas.sort((a, b) => {
      if (a.distanceMeters !== null && b.distanceMeters !== null) return a.distanceMeters - b.distanceMeters
      if (a.distanceMeters !== null) return -1
      if (b.distanceMeters !== null) return 1
      return String(a.codigo_caja || a.nombre || '').localeCompare(String(b.codigo_caja || b.nombre || ''), 'es-MX', { numeric: true })
    })
  }, [installationCajas, technicianLocation])

  const selectedInstallationCaja = useMemo(
    () => sortedInstallationCajas.find((caja) => String(caja.id) === String(installationForm.caja_id)),
    [sortedInstallationCajas, installationForm.caja_id]
  )

  const selectedInstallationTerminal = useMemo(
    () => installationTerminales.find((terminal) => String(terminal.id) === String(installationForm.caja_terminal_id)),
    [installationTerminales, installationForm.caja_terminal_id]
  )

  async function handleRouterPhotoChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const dataUrl = await imageFileToWebpDataUrl(file)
      setRouterPhoto(dataUrl)
      setRouterPhotoPreview(dataUrl)
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Foto no valida', text: error.message, confirmButtonColor: '#4274D9' })
    } finally {
      event.target.value = ''
    }
  }

  function clearRouterPhoto() {
    setRouterPhoto('')
    setRouterPhotoPreview('')
  }

  async function submitInstallationClose(event) {
    event.preventDefault()
    if (!installationReporte) return

    const potencia = Number(installationForm.potencia)
    if (!installationForm.titular_nombres.trim() || !installationForm.titular_telefono.trim() || !installationForm.titular_direccion.trim()) {
      Swal.fire({ icon: 'warning', title: 'Titular incompleto', text: 'Nombre, telefono y direccion del titular son obligatorios.', confirmButtonColor: '#4274D9' })
      return
    }

    const titularTelefono = installationForm.titular_telefono.replace(/\D/g, '')
    if (titularTelefono.length !== 10) {
      Swal.fire({ icon: 'warning', title: 'Telefono invalido', text: 'El telefono del titular debe tener 10 digitos.', confirmButtonColor: '#4274D9' })
      return
    }

    if (!installationForm.paquete_instalacion_id) {
      Swal.fire({ icon: 'warning', title: 'Paquete obligatorio', text: 'Selecciona el paquete final solicitado.', confirmButtonColor: '#4274D9' })
      return
    }

    if (!installationForm.alfanumerico_equipo.trim()) {
      Swal.fire({ icon: 'warning', title: 'Alfanumerico obligatorio', text: 'Captura el alfanumerico del equipo.', confirmButtonColor: '#4274D9' })
      return
    }

    const contractBrand = installationForm.contrato_marca_equipo === 'OTRO'
      ? installationForm.contrato_marca_equipo_otro.trim()
      : installationForm.contrato_marca_equipo
    const contractNumbers = [
      Number(installationForm.contrato_numero_equipos),
      Number(installationForm.contrato_costo_equipo_penalidad),
      Number(installationForm.contrato_costo_instalacion),
      Number(installationForm.contrato_cantidad_reconexion),
    ]
    if (!contractBrand || !Number.isInteger(contractNumbers[0]) || contractNumbers[0] < 1 || contractNumbers[0] > 5 || contractNumbers.some((number) => !Number.isFinite(number) || number < 0)) {
      Swal.fire({ icon: 'warning', title: 'Datos para contrato incompletos', text: 'Faltan datos para contrato. Revisa marca del equipo, numero de equipos, alfanumerico y firmas.', confirmButtonColor: '#4274D9' })
      return
    }

    if (!installationForm.caja_id) {
      Swal.fire({ icon: 'warning', title: 'Caja obligatoria', text: 'Selecciona una caja de fibra.', confirmButtonColor: '#4274D9' })
      return
    }

    if (!installationForm.caja_terminal_id) {
      Swal.fire({ icon: 'warning', title: 'Terminal obligatoria', text: 'Selecciona una terminal libre de la caja.', confirmButtonColor: '#4274D9' })
      return
    }

    if (!Number.isFinite(potencia) || potencia < -30 || potencia > -12) {
      Swal.fire({ icon: 'warning', title: 'Potencia fuera de rango', text: 'La potencia debe estar entre -12 y -30.', confirmButtonColor: '#4274D9' })
      return
    }

    if (!installationForm.comentario.trim()) {
      Swal.fire({ icon: 'warning', title: 'Comentario obligatorio', text: 'Escribe que se realizo.', confirmButtonColor: '#4274D9' })
      return
    }

    if (!clientSignature) {
      Swal.fire({ icon: 'warning', title: 'Firma requerida', text: 'Captura la firma del cliente para solicitar cierre.', confirmButtonColor: '#4274D9' })
      return
    }

    if (!technicianSignature) {
      Swal.fire({ icon: 'warning', title: 'Firma requerida', text: 'Captura la firma del tecnico para solicitar cierre.', confirmButtonColor: '#4274D9' })
      return
    }

    if (potencia <= -26) {
      const result = await Swal.fire({
        icon: 'warning',
        title: 'Potencia baja',
        text: 'La potencia es baja. Revisa la instalacion antes de enviar la solicitud.',
        showCancelButton: true,
        confirmButtonText: 'Enviar solicitud',
        cancelButtonText: 'Revisar',
        confirmButtonColor: '#4274D9',
      })
      if (!result.isConfirmed) return
    }

    const payload = {
      titular_nombres: installationForm.titular_nombres.trim().toUpperCase(),
      titular_apellido_paterno: installationForm.titular_apellido_paterno.trim().toUpperCase(),
      titular_apellido_materno: installationForm.titular_apellido_materno.trim().toUpperCase(),
      titular_telefono: titularTelefono,
      titular_direccion: installationForm.titular_direccion.trim().toUpperCase(),
      paquete_instalacion_id: Number(installationForm.paquete_instalacion_id),
      alfanumerico_equipo: installationForm.alfanumerico_equipo.trim().toUpperCase(),
      contrato_marca_equipo: installationForm.contrato_marca_equipo,
      contrato_marca_equipo_otro: installationForm.contrato_marca_equipo_otro.trim().toUpperCase(),
      contrato_numero_equipos: Number(installationForm.contrato_numero_equipos),
      contrato_costo_equipo_penalidad: Number(installationForm.contrato_costo_equipo_penalidad || 0),
      contrato_costo_instalacion: Number(installationForm.contrato_costo_instalacion || 0),
      contrato_aplica_reconexion: installationForm.contrato_aplica_reconexion,
      contrato_cantidad_reconexion: Number(installationForm.contrato_cantidad_reconexion || 0),
      contrato_modalidad_pago: installationForm.contrato_modalidad_pago,
      caja_id: Number(installationForm.caja_id),
      caja_terminal_id: Number(installationForm.caja_terminal_id),
      fibra_optica_metros: Number(installationForm.fibra_optica_metros || 0),
      tensor_gancho: Number(installationForm.tensor_gancho || 0),
      argollas: Number(installationForm.argollas || 0),
      taquetes: Number(installationForm.taquetes || 0),
      sujetadores: Number(installationForm.sujetadores || 0),
      roseta: Number(installationForm.roseta || 0),
      terminal: selectedInstallationTerminal?.numero_terminal ? String(selectedInstallationTerminal.numero_terminal) : undefined,
      puerto: selectedInstallationCaja?.codigo_caja || selectedInstallationCaja?.nombre || undefined,
      potencia,
      firma_cliente_base64: clientSignature,
      firma_tecnico_base64: technicianSignature,
      foto_router_base64: routerPhoto || undefined,
      comentario: installationForm.comentario.trim().toUpperCase(),
    }

    setSendingInstallation(true)
    try {
      await patchAction(installationReporte.id, 'solicitar-cierre', payload)
      setInstallationReporte(null)
      await Swal.fire({ icon: 'success', title: 'Solicitud enviada', text: 'La instalacion quedo pendiente de confirmacion.', confirmButtonColor: '#4274D9' })
    } catch (error) {
      const errorText = error.message.toLowerCase()
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message,
        confirmButtonColor: '#4274D9',
      })
    } finally {
      setSendingInstallation(false)
    }
  }

  const activeReportes = useMemo(
    () => reportes
      .filter((reporte) => !['COMPLETADO', 'CANCELADO'].includes(getReporteStatus(reporte)))
      .sort(compareTecnicoReportes),
    [reportes]
  )
  const currentReporte = activeReportes.find((reporte) => getReporteStatus(reporte) === 'EN_PROCESO') || null
  const enviadosRevision = activeReportes.filter((reporte) => getReporteStatus(reporte) === 'PENDIENTE_CONFIRMACION')
  const otherReportes = activeReportes.filter((reporte) => {
    const estado = getReporteStatus(reporte)
    return reporte.id !== currentReporte?.id && estado !== 'PENDIENTE_CONFIRMACION'
  })
  const pendientes = activeReportes.filter((reporte) => getReporteStatus(reporte) === 'ASIGNADO').length
  const enProceso = activeReportes.filter((reporte) => getReporteStatus(reporte) === 'EN_PROCESO').length
  const hasEnProceso = enProceso > 0

  function renderReporteCard(reporte, { featured = false } = {}) {
    const estado = getReporteStatus(reporte)

    return (
      <article className={`tecnico-job-card ${featured ? 'featured-current' : ''} ${getStatusClass(estado)}`} key={reporte.id}>
        {featured && <span className="current-report-label">REPORTE EN ATENCION</span>}
        <header>
          <div>
            <strong>#{reporte.id} - {reporte.comunidad_nombre}</strong>
            <span>{formatSubject(reporte)}</span>
          </div>
          <b>{formatStatus(estado)}</b>
        </header>

        <dl>
          <div><dt>Tipo</dt><dd>{reporte.tipo_reporte}</dd></div>
          <div><dt>Telefono</dt><dd>{formatPhone(reporte)}</dd></div>
          <div><dt>Programado para</dt><dd>{formatScheduledDate(reporte)}</dd></div>
          <div className="tecnico-address-row"><dt>Direccion</dt><dd>{formatAddress(reporte)}</dd></div>
        </dl>

        {reporte.comentario && (
          <div className="tecnico-comment-box">
            <span>Comentario</span>
            <p>{reporte.comentario}</p>
          </div>
        )}

        <footer>
          {estado === 'ASIGNADO' && (
            <>
              <button
                type="button"
                className="tecnico-primary-action"
                disabled={hasEnProceso}
                onClick={() => iniciarTrabajo(reporte)}
              >
                Iniciar trabajo
              </button>
              {hasEnProceso && (
                <p className="tecnico-status-note">Ya tienes un reporte en proceso. Finalizalo antes de iniciar otro.</p>
              )}
            </>
          )}
          {estado === 'EN_PROCESO' && (
            <>
              <button type="button" className="tecnico-secondary-action" onClick={() => noEncontrado(reporte)}>
                No encontre al cliente
              </button>
              <button type="button" className="tecnico-primary-action" onClick={() => solicitarCierre(reporte)}>
                {reporte.tipo_reporte === 'INSTALACION' ? 'Solicitar cierre de instalacion' : 'Solicitar cierre'}
              </button>
            </>
          )}
          {estado === 'PENDIENTE_CONFIRMACION' && (
            <p className="tecnico-status-note">Enviado a revision. Pendiente de confirmacion por Atencion/Soporte.</p>
          )}
          {estado === 'NO_LOCALIZADO' && (
            <p className="tecnico-status-note">Cliente no localizado. Esperando revision de Atencion/Soporte.</p>
          )}
        </footer>
      </article>
    )
  }

  return (
    <div className="tecnico-page-simple">
      <section className="tecnico-hero-simple">
        <span className="fiber-kicker">Panel tecnico</span>
        <h1>Hola, {usuario.nombre || usuario.nombres || 'tecnico'}</h1>
        <p>Trabajos asignados para hoy{fecha ? ` (${fecha})` : ''}</p>
        {lastUpdated && <small className="live-refresh-label">Ultima actualizacion: {lastUpdated}</small>}
      </section>

      <section className="tecnico-summary-simple">
        <article>
          <span>Mis reportes de hoy</span>
          <strong>{reportes.length}</strong>
        </article>
        <article>
          <span>En proceso</span>
          <strong>{enProceso}</strong>
        </article>
        <article>
          <span>Pendientes</span>
          <strong>{pendientes}</strong>
        </article>
      </section>

      {currentReporte && (
        <section className="tecnico-current-report">
          {renderReporteCard(currentReporte, { featured: true })}
        </section>
      )}

      <section className="tecnico-card-list">
        {loading && <p className="tecnico-empty">Cargando trabajos de hoy...</p>}
        {!loading && activeReportes.length === 0 && (
          <p className="tecnico-empty">No tienes trabajos asignados para hoy.</p>
        )}

        {!loading && otherReportes.map((reporte) => renderReporteCard(reporte))}
      </section>

      {!loading && enviadosRevision.length > 0 && (
        <section className="tecnico-review-section">
          <div className="tecnico-section-title">
            <span className="fiber-kicker">Enviados a revision</span>
            <h2>Pendientes de confirmacion</h2>
          </div>
          <div className="tecnico-card-list">
            {enviadosRevision.map((reporte) => renderReporteCard(reporte))}
          </div>
        </section>
      )}

      {installationReporte && (
        <div className="installation-modal-backdrop" role="dialog" aria-modal="true">
          <form className="installation-modal" onSubmit={submitInstallationClose}>
            <header>
              <div>
                <span className="fiber-kicker">Datos de instalacion</span>
                <h2>Reporte #{installationReporte.id}</h2>
                <p>{formatSubject(installationReporte)}</p>
              </div>
              <button type="button" className="installation-close" onClick={closeInstallationModal} aria-label="Cerrar">
                x
              </button>
            </header>

            {loadingInstallationData && <p className="installation-loading">Cargando datos previos de instalacion...</p>}

            <section className="installation-form-section">
              <h3>Datos finales del titular</h3>
              <div className="installation-form-grid">
                <label>
                  Nombre(s)
                  <input type="text" value={installationForm.titular_nombres} onChange={(event) => updateInstallationForm('titular_nombres', event.target.value)} required />
                </label>
                <label>
                  Apellido paterno
                  <input type="text" value={installationForm.titular_apellido_paterno} onChange={(event) => updateInstallationForm('titular_apellido_paterno', event.target.value)} />
                </label>
                <label>
                  Apellido materno
                  <input type="text" value={installationForm.titular_apellido_materno} onChange={(event) => updateInstallationForm('titular_apellido_materno', event.target.value)} />
                </label>
                <label>
                  Telefono
                  <input type="tel" inputMode="numeric" maxLength="10" value={installationForm.titular_telefono} onChange={(event) => updateInstallationForm('titular_telefono', event.target.value.replace(/\D/g, '').slice(0, 10))} required />
                </label>
                <label className="installation-package-field">
                  Direccion
                  <input type="text" value={installationForm.titular_direccion} onChange={(event) => updateInstallationForm('titular_direccion', event.target.value)} required />
                </label>
              </div>
            </section>

            <section className="installation-form-section">
              <h3>Datos del servicio</h3>
            <div className="installation-form-grid">
              <label className="installation-package-field">
                Paquete final solicitado
                <select
                  value={installationForm.paquete_instalacion_id}
                  onChange={(event) => updateInstallationForm('paquete_instalacion_id', event.target.value)}
                  required
                >
                  <option value="">Selecciona paquete</option>
                  {installationPackages.map((paquete) => (
                    <option value={paquete.id} key={paquete.id}>
                      {paquete.nombre} - {formatCurrency(paquete.precio_mensual)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="installation-package-field">
                Alfanumerico del equipo
                <input
                  type="text"
                  value={installationForm.alfanumerico_equipo}
                  onChange={(event) => updateInstallationForm('alfanumerico_equipo', event.target.value.replace(/\s+/g, ''))}
                  placeholder="HWTC4B8F8AB6"
                  autoCapitalize="characters"
                  required
                />
              </label>
            </div>
            </section>

            <section className="installation-form-section">
              <h3>Datos para contrato</h3>
              <div className="installation-form-grid">
                <label>
                  Marca del equipo
                  <select value={installationForm.contrato_marca_equipo} onChange={(event) => updateInstallationForm('contrato_marca_equipo', event.target.value)} required>
                    {['HUAWEI', 'ZTE', 'NOKIA', 'FIBERHOME', 'ATW', 'OTRO'].map((marca) => (
                      <option key={marca} value={marca}>{marca}</option>
                    ))}
                  </select>
                </label>
                {installationForm.contrato_marca_equipo === 'OTRO' && (
                  <label>
                    Marca manual
                    <input type="text" value={installationForm.contrato_marca_equipo_otro} onChange={(event) => updateInstallationForm('contrato_marca_equipo_otro', event.target.value)} required />
                  </label>
                )}
                <label>
                  Numero de equipos
                  <select value={installationForm.contrato_numero_equipos} onChange={(event) => updateInstallationForm('contrato_numero_equipos', event.target.value)} required>
                    {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <NumberField label="Costo equipo / penalidad" value={installationForm.contrato_costo_equipo_penalidad} onChange={(value) => updateInstallationForm('contrato_costo_equipo_penalidad', value)} step="0.01" />
                <NumberField label="Costo de instalacion" value={installationForm.contrato_costo_instalacion} onChange={(value) => updateInstallationForm('contrato_costo_instalacion', value)} step="0.01" />
                <label>
                  Tarifa por reconexion
                  <select value={installationForm.contrato_aplica_reconexion} onChange={(event) => updateInstallationForm('contrato_aplica_reconexion', event.target.value)} required>
                    <option value="SI">SI</option>
                    <option value="NO">NO</option>
                  </select>
                </label>
                <NumberField label="Cantidad de reconexion" value={installationForm.contrato_cantidad_reconexion} onChange={(value) => updateInstallationForm('contrato_cantidad_reconexion', value)} step="0.01" />
                <label>
                  Modalidad de pago
                  <select value={installationForm.contrato_modalidad_pago} onChange={(event) => updateInstallationForm('contrato_modalidad_pago', event.target.value)} required>
                    {['SIN DEFINIR', 'EFECTIVO', 'TRANSFERENCIA', 'DEPOSITO', 'TARJETA', 'OTRO'].map((mode) => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="installation-form-section">
              <h3>Ubicacion de conexion</h3>
              <p className="location-privacy-note">
                {locationStatus === 'loading'
                  ? 'Obteniendo ubicacion para sugerir cajas cercanas...'
                  : locationMessage || 'Tu ubicacion solo se usa para mostrar cajas cercanas y no se guarda.'}
              </p>
            <div className="installation-form-grid">
              <div className="installation-box-picker">
                <span>Caja</span>
                <button type="button" className="box-picker-trigger" onClick={() => setBoxSelectorOpen(true)}>
                  {selectedInstallationCaja ? (
                    <>
                      <strong>{formatCajaTitle(selectedInstallationCaja)}</strong>
                      <small>{formatCajaOption(selectedInstallationCaja)}</small>
                    </>
                  ) : (
                    <>
                      <strong>Seleccionar caja</strong>
                      <small>{technicianLocation ? 'Ordenadas por cercania' : 'Seleccion manual por codigo'}</small>
                    </>
                  )}
                </button>
              </div>
              <label>
                Terminal
                <select
                  value={installationForm.caja_terminal_id}
                  onChange={(event) => updateInstallationForm('caja_terminal_id', event.target.value)}
                  disabled={!installationForm.caja_id}
                  required
                >
                  <option value="">{installationForm.caja_id ? 'Selecciona terminal' : 'Primero selecciona caja'}</option>
                  {installationTerminales.map((terminal) => (
                    <option value={terminal.id} key={terminal.id}>
                      Terminal {terminal.numero_terminal}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            </section>

            {boxSelectorOpen && (
              <div className="box-selector-backdrop" role="dialog" aria-modal="true" aria-labelledby="box-selector-title">
                <div className="box-selector-modal">
                  <header>
                    <div>
                      <span className="fiber-kicker">{technicianLocation ? 'Cajas cercanas' : 'Seleccion manual'}</span>
                      <h3 id="box-selector-title">Selecciona una caja cercana</h3>
                      <p>{technicianLocation ? 'Ordenadas por distancia aproximada a tu ubicacion actual.' : 'Sin ubicacion disponible, ordenadas por codigo.'}</p>
                    </div>
                    <button type="button" className="installation-close" onClick={() => setBoxSelectorOpen(false)} aria-label="Cerrar selector de cajas">
                      x
                    </button>
                  </header>

                  <div className="box-selector-list">
                    {sortedInstallationCajas.length === 0 && (
                      <p className="box-selector-empty">No hay cajas disponibles para esta comunidad.</p>
                    )}
                    {sortedInstallationCajas.map((caja) => {
                      const libres = Number(caja.terminales_libres ?? 0)
                      const ocupadas = Number(caja.terminales_ocupadas ?? 0)
                      const reservadas = Number(caja.terminales_reservadas ?? 0)
                      const isFull = libres <= 0
                      return (
                        <article className={`box-card ${getDistanceClass(caja.distanceMeters)} ${isFull ? 'is-full' : ''}`} key={caja.id}>
                          <div className="box-card-main">
                            <div>
                              <h4>{formatCajaTitle(caja)}</h4>
                              {caja.nombre_original_kml && <p className="box-card-original">{caja.nombre_original_kml}</p>}
                            </div>
                            <span className={`box-card-status ${isFull ? 'full' : ''}`}>{isFull ? 'Llena' : `${libres} libres`}</span>
                          </div>
                          <p className="box-card-stats">
                            Libres: {libres} | Ocupadas: {ocupadas} | Reservadas: {reservadas}
                          </p>
                          <p className="box-card-distance">
                            {caja.distanceMeters !== null && caja.distanceMeters !== undefined ? formatDistance(caja.distanceMeters) : 'Distancia no disponible'}
                          </p>
                          <div className="box-card-actions">
                            <button type="button" className="tecnico-primary-action" onClick={() => selectCaja(caja)} disabled={isFull}>
                              {isFull ? 'Llena' : 'Seleccionar'}
                            </button>
                            {hasCajaCoordinates(caja) && (
                              <a className="tecnico-secondary-action box-map-link" href={getCajaMapsUrl(caja)} target="_blank" rel="noopener noreferrer">
                                Ver en Maps
                              </a>
                            )}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            <section className="installation-form-section">
              <h3>Datos tecnicos</h3>
              <div className="installation-form-grid">
              <NumberField label="Fibra optica usada (m)" value={installationForm.fibra_optica_metros} onChange={(value) => updateInstallationForm('fibra_optica_metros', value)} step="0.01" />
              <NumberField label="Tensor gancho" value={installationForm.tensor_gancho} onChange={(value) => updateInstallationForm('tensor_gancho', value)} />
              <NumberField label="Argollas" value={installationForm.argollas} onChange={(value) => updateInstallationForm('argollas', value)} />
              <NumberField label="Taquetes" value={installationForm.taquetes} onChange={(value) => updateInstallationForm('taquetes', value)} />
              <NumberField label="Sujetadores" value={installationForm.sujetadores} onChange={(value) => updateInstallationForm('sujetadores', value)} />
              <NumberField label="Roseta" value={installationForm.roseta} onChange={(value) => updateInstallationForm('roseta', value)} />

              <label>
                Potencia
                <input
                  type="number"
                  min="-30"
                  max="-12"
                  step="0.01"
                  value={installationForm.potencia}
                  onChange={(event) => updateInstallationForm('potencia', event.target.value)}
                  placeholder="-18.34"
                  required
                />
                {Number(installationForm.potencia) <= -26 && (
                  <small className="installation-warning">Potencia baja, revisa la instalacion antes de enviar.</small>
                )}
              </label>
            </div>
            </section>

            <section className="signature-section">
              <div>
                <strong>Foto del router detras</strong>
                <span>Opcional. Puedes tomarla con la camara o elegir una imagen.</span>
              </div>
              {hasStoredRouterPhoto && !routerPhotoPreview && (
                <p className="router-photo-status">Ya existe una foto guardada. Si no tomas otra, se conservara la anterior.</p>
              )}
              <label className="router-photo-button">
                Tomar foto
                <input type="file" accept="image/*" capture="environment" onChange={handleRouterPhotoChange} />
              </label>
              {routerPhotoPreview && (
                <div className="router-photo-preview">
                  <span>Vista previa de la foto</span>
                  <img src={routerPhotoPreview} alt="Vista previa del router detras" />
                  <button type="button" className="tecnico-secondary-action" onClick={clearRouterPhoto}>Quitar foto</button>
                </div>
              )}
            </section>

            <label className="installation-comment">
              Que se realizo?
              <textarea
                value={installationForm.comentario}
                onChange={(event) => updateInstallationForm('comentario', event.target.value)}
                placeholder="SE REALIZO INSTALACION"
                required
              />
            </label>

            <section className="signature-section">
              <div>
                <strong>Firma del cliente</strong>
                <span>Firma con el dedo dentro del recuadro.</span>
              </div>
              <SignaturePad onChange={setClientSignature} clearSignal={clearClientSignatureSignal} initialValue={clientSignature} />
              <div className="signature-actions">
                <button type="button" className="tecnico-secondary-action" onClick={() => setClearClientSignatureSignal((current) => current + 1)}>
                  Limpiar firma cliente
                </button>
              </div>
            </section>

            <section className="signature-section">
              <div>
                <strong>Firma del tecnico</strong>
                <span>Firma con el dedo dentro del recuadro.</span>
              </div>
              <SignaturePad onChange={setTechnicianSignature} clearSignal={clearTechnicianSignatureSignal} initialValue={technicianSignature} />
              <div className="signature-actions">
                <button type="button" className="tecnico-secondary-action" onClick={() => setClearTechnicianSignatureSignal((current) => current + 1)}>
                  Limpiar firma tecnico
                </button>
              </div>
            </section>

            <footer>
              <button type="button" className="tecnico-secondary-action" onClick={closeInstallationModal} disabled={sendingInstallation}>
                Cancelar
              </button>
              <button type="submit" className="tecnico-primary-action" disabled={sendingInstallation}>
                {sendingInstallation ? 'Enviando...' : 'Enviar solicitud de cierre'}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  )
}

function NumberField({ label, value, onChange, step = '1' }) {
  return (
    <label>
      {label}
      <input type="number" min="0" step={step} value={value} onChange={(event) => onChange(event.target.value)} required />
    </label>
  )
}

function formatCajaOption(caja) {
  const libres = Number(caja.terminales_libres ?? 0)
  const distance = caja.distanceMeters !== null && caja.distanceMeters !== undefined ? `${formatDistance(caja.distanceMeters)} - ` : ''
  const availability = libres > 0 ? `${libres} ${libres === 1 ? 'terminal libre' : 'terminales libres'}` : 'Llena'
  return `${caja.codigo_caja || caja.nombre} - ${distance}${availability}`
}

function formatCajaTitle(caja) {
  return caja.codigo_caja ? `Caja ${caja.codigo_caja}` : caja.nombre || 'Caja sin codigo'
}

function getDistanceClass(distanceMeters) {
  if (distanceMeters === null || distanceMeters === undefined || !Number.isFinite(distanceMeters)) return 'distance-neutral'
  if (distanceMeters <= 150) return 'distance-near'
  if (distanceMeters <= 400) return 'distance-medium'
  if (distanceMeters <= 1000) return 'distance-far'
  return 'distance-remote'
}

function hasCajaCoordinates(caja) {
  return Number.isFinite(Number(caja?.latitud)) && Number.isFinite(Number(caja?.longitud))
}

function getCajaMapsUrl(caja) {
  return `https://www.google.com/maps?q=${Number(caja.latitud)},${Number(caja.longitud)}`
}

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const originLat = Number(lat1)
  const originLon = Number(lon1)
  const targetLat = Number(lat2)
  const targetLon = Number(lon2)
  if (![originLat, originLon, targetLat, targetLon].every(Number.isFinite)) return null

  const earthRadiusMeters = 6371000
  const deltaLat = toRadians(targetLat - originLat)
  const deltaLon = toRadians(targetLon - originLon)
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(originLat)) * Math.cos(toRadians(targetLat)) *
    Math.sin(deltaLon / 2) ** 2

  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

function formatDistance(meters) {
  if (!Number.isFinite(meters)) return ''
  if (meters < 1000) return `${Math.max(Math.round(meters), 1)} m`
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`
}

function toRadians(value) {
  return (value * Math.PI) / 180
}

function getKnownBrand(value) {
  const brand = String(value || 'HUAWEI').toUpperCase()
  return ['HUAWEI', 'ZTE', 'NOKIA', 'FIBERHOME', 'ATW'].includes(brand) ? brand : 'OTRO'
}

function SignaturePad({ onChange, clearSignal, initialValue }) {
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const initializedRef = useRef(false)
  const lastClearSignalRef = useRef(clearSignal)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const initTimer = window.setTimeout(() => {
      resizeSignatureCanvas(canvas)
      initializedRef.current = true
    }, 50)

    const handleResize = () => {
      if (drawingRef.current || !initializedRef.current) return
      const currentSignature = canvas.toDataURL('image/png')
      resizeSignatureCanvas(canvas)
      drawSignatureImage(canvas, currentSignature)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.clearTimeout(initTimer)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (lastClearSignalRef.current === clearSignal) return
    lastClearSignalRef.current = clearSignal
    clearSignatureCanvas(canvas)
    onChange('')
  }, [clearSignal, onChange])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !initialValue) return
    window.setTimeout(() => {
      resizeSignatureCanvas(canvas)
      drawSignatureImage(canvas, initialValue)
    }, 50)
  }, [initialValue])

  function getPoint(event) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function startDrawing(event) {
    event.preventDefault()
    canvasRef.current.setPointerCapture?.(event.pointerId)
    drawingRef.current = true
    const context = canvasRef.current.getContext('2d')
    const point = getPoint(event)
    context.beginPath()
    context.moveTo(point.x, point.y)
  }

  function draw(event) {
    if (!drawingRef.current) return
    event.preventDefault()
    const context = canvasRef.current.getContext('2d')
    const point = getPoint(event)
    context.lineTo(point.x, point.y)
    context.stroke()
  }

  function stopDrawing(event) {
    if (!drawingRef.current) return
    event.preventDefault()
    drawingRef.current = false
    canvasRef.current.releasePointerCapture?.(event.pointerId)
    
    try {
      const canvas = canvasRef.current
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = 250
      tempCanvas.height = 100
      const ctx = tempCanvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
      ctx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height)
      onChange(tempCanvas.toDataURL('image/jpeg', 0.6))
    } catch (err) {
      onChange(canvasRef.current.toDataURL('image/png'))
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="signature-canvas"
      onPointerDown={startDrawing}
      onPointerMove={draw}
      onPointerUp={stopDrawing}
      onPointerCancel={stopDrawing}
      onPointerLeave={stopDrawing}
    />
  )
}

function resizeSignatureCanvas(canvas) {
  const rect = canvas.getBoundingClientRect()
  const ratio = Math.max(window.devicePixelRatio || 1, 1)
  const width = Math.max(Math.round(rect.width * ratio), 1)
  const height = Math.max(Math.round(rect.height * ratio), 1)

  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height

  const context = canvas.getContext('2d')
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.lineWidth = 2.2
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = '#0f172a'
}

function clearSignatureCanvas(canvas) {
  const context = canvas.getContext('2d')
  const rect = canvas.getBoundingClientRect()
  context.clearRect(0, 0, rect.width, rect.height)
}

function drawSignatureImage(canvas, dataUrl) {
  if (!dataUrl) return

  const image = new Image()
  image.onload = () => {
    const context = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    clearSignatureCanvas(canvas)
    context.drawImage(image, 0, 0, rect.width, rect.height)
  }
  image.src = dataUrl
}

function formatSubject(reporte) {
  if (reporte.tipo_reporte === 'DETALLE') {
    return [reporte.numero_cliente, reporte.cliente_nombre].filter(Boolean).join(' - ') || 'Cliente sin datos'
  }
  return reporte.prospecto_nombre ? `Prospecto - ${reporte.prospecto_nombre}` : 'Prospecto sin datos'
}

function formatPhone(reporte) {
  return reporte.tipo_reporte === 'DETALLE'
    ? reporte.cliente_telefono || 'Sin telefono'
    : reporte.prospecto_telefono || 'Sin telefono'
}

function formatAddress(reporte) {
  return reporte.tipo_reporte === 'DETALLE'
    ? reporte.cliente_direccion || 'Sin direccion'
    : reporte.prospecto_direccion || 'Sin direccion'
}

function formatScheduledDate(reporte) {
  return reporte.fecha_programada ? String(reporte.fecha_programada).slice(0, 10) : 'HOY'
}

function compareTecnicoReportes(a, b) {
  const stateWeight = { EN_PROCESO: 1, ASIGNADO: 2, PENDIENTE_CONFIRMACION: 3, NO_LOCALIZADO: 4 }
  const weightDiff = (stateWeight[getReporteStatus(a)] || 9) - (stateWeight[getReporteStatus(b)] || 9)
  if (weightDiff) return weightDiff

  const routeA = a.orden_ruta == null ? Number.MAX_SAFE_INTEGER : Number(a.orden_ruta)
  const routeB = b.orden_ruta == null ? Number.MAX_SAFE_INTEGER : Number(b.orden_ruta)
  if (routeA !== routeB) return routeA - routeB

  return Number(a.id) - Number(b.id)
}

function getReporteStatus(reporte) {
  return String(reporte?.estado ?? '').trim().toUpperCase()
}

function getStatusClass(estado) {
  if (estado === 'EN_PROCESO') return 'in-progress'
  if (estado === 'PENDIENTE_CONFIRMACION') return 'pending-confirmation'
  if (estado === 'NO_LOCALIZADO') return 'not-found'
  return ''
}

function formatStatus(estado) {
  if (estado === 'PENDIENTE_CONFIRMACION') return 'PENDIENTE CONFIRMACION'
  if (estado === 'NO_LOCALIZADO') return 'NO LOCALIZADO'
  return estado
}

function formatTime(date) {
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

function imageFileToWebpDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selecciona un archivo de imagen.'))
      return
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('No se pudo procesar la imagen.'))
      image.onload = () => {
        const maxSize = 1280
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/webp', 0.82))
      }
      image.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export default TecnicoDashboard
