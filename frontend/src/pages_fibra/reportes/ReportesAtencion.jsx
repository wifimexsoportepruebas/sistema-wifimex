import { useCallback, useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'
import '../../styles/ReportesAtencion.css'

const tipos = ['DETALLE', 'INSTALACION']
const prioridades = ['BAJA', 'NORMAL', 'ALTA', 'URGENTE']

const initialForm = {
  comunidad_id: '',
  tipo_reporte: 'DETALLE',
  cliente_id: '',
  prospecto_id: '',
  comentario: '',
  prioridad: 'NORMAL',
  fecha_programada: tomorrowDate(),
}

function ReportesAtencion({ apiUrl, token }) {
  const [comunidades, setComunidades] = useState([])
  const [clientes, setClientes] = useState([])
  const [prospectos, setProspectos] = useState([])
  const [ciclosCorte, setCiclosCorte] = useState([])
  const [reportes, setReportes] = useState([])
  const [reportesConfirmacion, setReportesConfirmacion] = useState([])
  const [form, setForm] = useState(initialForm)
  const [filters, setFilters] = useState({ fecha: todayDate(), comunidad_id: '', tipo_reporte: '' })
  const [loading, setLoading] = useState(true)
  const [loadingConfirmacion, setLoadingConfirmacion] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastUpdated, setLastUpdated] = useState('')
  const [subjectSearch, setSubjectSearch] = useState('')
  const [subjectLoading, setSubjectLoading] = useState(false)

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const loadCatalogs = useCallback(async () => {
    try {
      const [comunidadesResponse, ciclosResponse] = await Promise.all([
        fetch(`${apiUrl}/api/comunidades`, { headers: authHeaders }),
        fetch(`${apiUrl}/api/ciclos-corte`, { headers: authHeaders }),
      ])
      const comunidadesData = await comunidadesResponse.json()
      const ciclosData = await ciclosResponse.json()
      if (!comunidadesResponse.ok) throw new Error(comunidadesData.error ?? 'No se pudieron cargar comunidades.')
      if (!ciclosResponse.ok) throw new Error(ciclosData.error ?? 'No se pudieron cargar ciclos de corte.')
      setComunidades(comunidadesData.comunidades ?? [])
      setCiclosCorte(ciclosData.ciclos ?? [])
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    }
  }, [apiUrl, authHeaders])

  const loadReportes = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('fecha', filters.fecha || todayDate())
      if (filters.comunidad_id) params.set('comunidad_id', filters.comunidad_id)
      if (filters.tipo_reporte) params.set('tipo_reporte', filters.tipo_reporte)

      const response = await fetch(`${apiUrl}/api/reportes?${params.toString()}`, { headers: authHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudieron cargar reportes.')
      setReportes(data.reportes ?? [])
      setLastUpdated(formatTime(new Date()))
    } catch (err) {
      if (!silent) Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    } finally {
      if (!silent) setLoading(false)
    }
  }, [apiUrl, authHeaders, filters])

  const loadReportesConfirmacion = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoadingConfirmacion(true)
    try {
      const response = await fetch(`${apiUrl}/api/reportes?confirmacion=1`, { headers: authHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudieron cargar reportes por confirmar.')
      setReportesConfirmacion(data.reportes ?? [])
      setLastUpdated(formatTime(new Date()))
    } catch (err) {
      if (!silent) Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    } finally {
      if (!silent) setLoadingConfirmacion(false)
    }
  }, [apiUrl, authHeaders])

  const loadClientes = useCallback(async (comunidadId, search = '') => {
    if (!comunidadId && !search.trim()) {
      setClientes([])
      return
    }
    const params = new URLSearchParams()
    if (comunidadId) params.set('comunidad_id', comunidadId)
    if (search.trim()) params.set('q', search.trim())
    params.set('limit', '20')
    const response = await fetch(`${apiUrl}/api/clientes/buscar?${params.toString()}`, { headers: authHeaders })
    const data = await response.json()
    if (response.ok) setClientes(data.clientes ?? [])
  }, [apiUrl, authHeaders])

  const loadProspectos = useCallback(async (comunidadId, search = '') => {
    if (!comunidadId && !search.trim()) {
      setProspectos([])
      return
    }
    const params = new URLSearchParams()
    if (comunidadId) params.set('comunidad_id', comunidadId)
    if (search.trim()) params.set('q', search.trim())
    const response = await fetch(`${apiUrl}/api/prospectos/disponibles?${params.toString()}`, { headers: authHeaders })
    const data = await response.json()
    if (response.ok) setProspectos(data.prospectos ?? [])
  }, [apiUrl, authHeaders])

  useEffect(() => { loadCatalogs() }, [loadCatalogs])
  useEffect(() => { loadReportes() }, [loadReportes])
  useEffect(() => { loadReportesConfirmacion() }, [loadReportesConfirmacion])
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadReportes({ silent: true })
        loadReportesConfirmacion({ silent: true })
      }
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [loadReportes, loadReportesConfirmacion])
  useEffect(() => {
    let cancelled = false
    const timeoutId = window.setTimeout(async () => {
      setSubjectLoading(true)
      try {
        if (form.tipo_reporte === 'DETALLE') {
          await loadClientes(form.comunidad_id, subjectSearch)
          if (!cancelled) setProspectos([])
        } else {
          await loadProspectos(form.comunidad_id, subjectSearch)
          if (!cancelled) setClientes([])
        }
      } finally {
        if (!cancelled) setSubjectLoading(false)
      }
    }, 220)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [form.comunidad_id, form.tipo_reporte, subjectSearch, loadClientes, loadProspectos])

  function updateForm(field, value) {
    const nextValue = field === 'comentario' ? value.toUpperCase() : value
    setForm((current) => {
      const next = { ...current, [field]: nextValue }
      if (field === 'comunidad_id' || field === 'tipo_reporte') {
        next.cliente_id = ''
        next.prospecto_id = ''
      }
      return next
    })
  }

  function selectCliente(cliente) {
    updateForm('cliente_id', String(cliente.id))
    setSubjectSearch(`${cliente.numero_cliente} - ${fullName(cliente)}`)
  }

  function selectProspecto(prospecto) {
    updateForm('prospecto_id', String(prospecto.id))
    setSubjectSearch(fullName(prospecto))
  }

  async function saveReporte(event) {
    event.preventDefault()

    if (!form.comunidad_id || !form.comentario.trim() || !form.fecha_programada) {
      Swal.fire({ icon: 'warning', title: 'Datos incompletos', text: 'Comunidad, comentario y fecha programada son obligatorios.', confirmButtonColor: '#4274D9' })
      return
    }

    if (form.tipo_reporte === 'DETALLE' && !form.cliente_id) {
      Swal.fire({ icon: 'warning', title: 'Selecciona cliente', text: 'Los reportes de detalle requieren un cliente.', confirmButtonColor: '#4274D9' })
      return
    }

    if (form.tipo_reporte === 'INSTALACION' && !form.prospecto_id) {
      Swal.fire({ icon: 'warning', title: 'Selecciona prospecto', text: 'Los reportes de instalacion requieren un prospecto.', confirmButtonColor: '#4274D9' })
      return
    }

    setSaving(true)
    try {
      const payload = {
        comunidad_id: Number(form.comunidad_id),
        tipo_reporte: form.tipo_reporte,
        cliente_id: form.tipo_reporte === 'DETALLE' ? Number(form.cliente_id) : null,
        prospecto_id: form.tipo_reporte === 'INSTALACION' ? Number(form.prospecto_id) : null,
        comentario: form.comentario.trim().toUpperCase(),
        prioridad: form.prioridad,
        fecha_programada: form.fecha_programada,
      }

      const response = await fetch(`${apiUrl}/api/reportes`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar el reporte.')

      await Swal.fire({ icon: 'success', title: 'Reporte guardado', text: 'El reporte quedo registrado para atencion.', confirmButtonColor: '#4274D9' })
      setForm(initialForm)
      setSubjectSearch('')
      setClientes([])
      setProspectos([])
      await loadReportes()
      await loadReportesConfirmacion()
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    } finally {
      setSaving(false)
    }
  }

  async function patchReporte(reporte, path, body, successTitle) {
    try {
      const response = await fetch(`${apiUrl}/api/reportes/${reporte.id}/${path}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'No se pudo actualizar el reporte.')
      await Swal.fire({ icon: 'success', title: successTitle, confirmButtonColor: '#4274D9' })
      await loadReportesConfirmacion()
      await loadReportes()
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    }
  }

  async function confirmarCierre(reporte) {
    if (reporte.tipo_reporte === 'INSTALACION') {
      await confirmarInstalacion(reporte)
      return
    }

    const result = await Swal.fire({
      icon: 'question',
      title: 'Confirmar cierre',
      text: `Se marcara como completado el reporte #${reporte.id}.`,
      showCancelButton: true,
      confirmButtonText: 'Confirmar cierre',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4274D9',
    })
    if (!result.isConfirmed) return
    await patchReporte(reporte, 'confirmar-cierre', {}, 'Cierre confirmado')
  }

  async function confirmarInstalacion(reporte) {
    if (!ciclosCorte.length) {
      Swal.fire({ icon: 'warning', title: 'Sin ciclos de corte', text: 'No hay ciclos de corte activos para confirmar la instalacion.', confirmButtonColor: '#4274D9' })
      return
    }

    if (!reporte.caja_id || !reporte.caja_terminal_id) {
      Swal.fire({ icon: 'warning', title: 'Falta infraestructura', text: 'Falta seleccionar caja y terminal.', confirmButtonColor: '#4274D9' })
      return
    }

    const result = await Swal.fire({
      title: 'Confirmar instalacion',
      html: buildInstallationConfirmationHtml(reporte, ciclosCorte),
      showCancelButton: true,
      confirmButtonText: 'Confirmar instalacion',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4274D9',
      focusConfirm: false,
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async () => {
        const cicloCorteId = document.getElementById('confirm-install-cycle')?.value
        const ipAsignada = document.getElementById('confirm-install-ip')?.value?.trim()
        if (!cicloCorteId) {
          Swal.showValidationMessage('Selecciona el ciclo de corte.')
          return false
        }

        try {
          const response = await fetch(`${apiUrl}/api/reportes/${reporte.id}/confirmar-instalacion`, {
            method: 'POST',
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ciclo_corte_id: Number(cicloCorteId),
              ip_asignada: ipAsignada || null,
            }),
          })
          const data = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(data.error ?? 'No se pudo confirmar la instalacion.')
          return data
        } catch (err) {
          Swal.showValidationMessage(err.message)
          return false
        }
      },
    })

    if (!result.isConfirmed || !result.value) return
    await Swal.fire({
      icon: 'success',
      title: 'Instalacion confirmada',
      text: `Cliente creado: ${result.value.cliente?.numero_cliente ?? 'sin numero'}`,
      confirmButtonColor: '#4274D9',
    })
    await loadReportesConfirmacion()
    await loadReportes()
  }

  async function regresarTecnico(reporte) {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Regresar a tecnico',
      text: `El reporte #${reporte.id} volvera a EN_PROCESO.`,
      showCancelButton: true,
      confirmButtonText: 'Regresar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4274D9',
    })
    if (!result.isConfirmed) return
    await patchReporte(reporte, 'regresar-tecnico', {}, 'Reporte regresado al tecnico')
  }

  async function reagendarReporte(reporte) {
    const result = await Swal.fire({
      title: 'Reagendar reporte',
      input: 'date',
      inputLabel: 'Nueva fecha programada',
      inputValue: tomorrowDate(),
      showCancelButton: true,
      confirmButtonText: 'Reagendar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4274D9',
      inputValidator: (value) => {
        if (!value) return 'Selecciona una fecha.'
        return null
      },
    })
    if (!result.isConfirmed) return
    await patchReporte(reporte, 'reagendar', { fecha_programada: result.value }, 'Reporte reagendado')
  }

  async function cancelarReporte(reporte) {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Cancelar reporte',
      text: `Se cancelara el reporte #${reporte.id}.`,
      showCancelButton: true,
      confirmButtonText: 'Cancelar reporte',
      cancelButtonText: 'Conservar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#64748b',
    })
    if (!result.isConfirmed) return
    await patchReporte(reporte, 'cancelar', { comentario_cierre: 'CANCELADO POR ATENCION/SOPORTE' }, 'Reporte cancelado')
  }

  async function verFotoRouter(reporte) {
    try {
      const response = await fetch(`${apiUrl}/api/reportes/${reporte.id}/foto-router`, { headers: authHeaders })
      if (!response.ok) throw new Error('No se pudo cargar la foto del router.')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      await Swal.fire({
        title: 'Foto del router detras',
        imageUrl: url,
        imageAlt: 'Foto del router detras',
        confirmButtonText: 'Cerrar',
        confirmButtonColor: '#4274D9',
        willClose: () => URL.revokeObjectURL(url),
      })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    }
  }

  return (
    <div className="reportes-page fiber-page">
      <section className="fiber-page-header">
        <div>
          <span className="fiber-kicker">Reportes</span>
          <h1>Alta de reporte</h1>
          {lastUpdated && <small className="live-refresh-label">Ultima actualizacion: {lastUpdated}</small>}
        </div>
      </section>

      <form className="fiber-panel report-form-modern" onSubmit={saveReporte}>
        <div className="report-form-grid">
          <label>
            Comunidad
            <select
              value={form.comunidad_id}
              onChange={(event) => {
                setSubjectSearch('')
                updateForm('comunidad_id', event.target.value)
              }}
              required
            >
              <option value="">Selecciona comunidad</option>
              {comunidades.map((comunidad) => <option key={comunidad.id} value={comunidad.id}>{comunidad.nombre}</option>)}
            </select>
          </label>

          <label>
            Tipo
            <select
              value={form.tipo_reporte}
              onChange={(event) => {
                setSubjectSearch('')
                updateForm('tipo_reporte', event.target.value)
              }}
              required
            >
              {tipos.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
            </select>
          </label>

          <div className="report-subject-search">
            <label>
              {form.tipo_reporte === 'DETALLE' ? 'Cliente' : 'Prospecto'}
              <input
                type="search"
                value={subjectSearch}
                onChange={(event) => {
                  setSubjectSearch(event.target.value)
                  updateForm(form.tipo_reporte === 'DETALLE' ? 'cliente_id' : 'prospecto_id', '')
                }}
                placeholder={form.comunidad_id ? 'Buscar cliente/prospecto...' : 'Primero selecciona comunidad'}
                disabled={!form.comunidad_id}
                required
              />
            </label>
            <div className="subject-result-list">
              {subjectLoading && <p>Buscando...</p>}
              {!subjectLoading && form.tipo_reporte === 'DETALLE' && clientes.map((cliente) => (
                <button type="button" key={cliente.id} onClick={() => selectCliente(cliente)}>
                  <strong>{cliente.numero_cliente} - {fullName(cliente)}</strong>
                  <span>{cliente.comunidad_nombre || 'Sin comunidad'} | Tel: {cliente.telefono || 'Sin telefono'}</span>
                  {cliente.alfanumerico_equipo && <small>Equipo: {cliente.alfanumerico_equipo}</small>}
                </button>
              ))}
              {!subjectLoading && form.tipo_reporte === 'INSTALACION' && prospectos.map((prospecto) => (
                <button type="button" key={prospecto.id} onClick={() => selectProspecto(prospecto)}>
                  <strong>{fullName(prospecto)}</strong>
                  <span>{prospecto.comunidad_nombre || 'Sin comunidad'} | Tel: {prospecto.telefono || 'Sin telefono'}</span>
                </button>
              ))}
              {!subjectLoading && form.comunidad_id && form.tipo_reporte === 'DETALLE' && clientes.length === 0 && (
                <p>No hay clientes activos disponibles.</p>
              )}
              {!subjectLoading && form.comunidad_id && form.tipo_reporte === 'INSTALACION' && prospectos.length === 0 && (
                <p>No hay prospectos disponibles para instalacion.</p>
              )}
            </div>
          </div>

          <label>
            Fecha programada
            <input type="date" value={form.fecha_programada} onChange={(event) => updateForm('fecha_programada', event.target.value)} required />
          </label>

          <label>
            Prioridad
            <select value={form.prioridad} onChange={(event) => updateForm('prioridad', event.target.value)}>
              {prioridades.map((prioridad) => <option key={prioridad} value={prioridad}>{prioridad}</option>)}
            </select>
          </label>
        </div>

        <label className="report-comment-field">
          Comentario
          <textarea value={form.comentario} onChange={(event) => updateForm('comentario', event.target.value)} placeholder="Describe el reporte" required />
        </label>

        <button type="submit" className="fiber-primary-button report-save-button" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar reporte'}
        </button>
      </form>

      <section className="fiber-panel">
        <div className="panel-heading">
          <span className="fiber-kicker">Revision de oficina</span>
          <h3>Reportes por confirmar ({reportesConfirmacion.length})</h3>
        </div>

        <div className="confirmation-list">
          {loadingConfirmacion && <p className="table-empty">Cargando reportes por confirmar...</p>}
          {!loadingConfirmacion && reportesConfirmacion.length === 0 && (
            <p className="table-empty">No hay reportes pendientes de confirmacion.</p>
          )}
          {!loadingConfirmacion && reportesConfirmacion.map((reporte) => (
            <article className={`confirmation-card ${String(reporte.estado).toLowerCase()}`} key={reporte.id}>
              <header>
                <div>
                  <strong>#{reporte.id} - {reporte.comunidad_nombre}</strong>
                  <span>{getSubjectName(reporte)} | {getSubjectDetail(reporte)}</span>
                </div>
                <b>{formatEstado(reporte.estado)}</b>
              </header>
              <div className="confirmation-grid">
                <p><strong>Tecnico:</strong> {reporte.tecnico_nombre || 'Sin tecnico'}</p>
                <p><strong>Fecha programada:</strong> {formatDate(reporte.fecha_programada) || 'Sin fecha'}</p>
                <p><strong>Comentario original:</strong> {reporte.comentario}</p>
                <p><strong>Comentario tecnico:</strong> {reporte.comentario_cierre || (reporte.estado === 'NO_LOCALIZADO' ? 'NO SE ENCONTRO AL CLIENTE' : 'Sin comentario tecnico')}</p>
              </div>
              {reporte.tipo_reporte === 'INSTALACION' && (
                <InstallationReview reporte={reporte} onViewPhoto={verFotoRouter} />
              )}
              <footer>
                {reporte.estado === 'PENDIENTE_CONFIRMACION' && (
                  <>
                    <button type="button" className="fiber-primary-button" onClick={() => confirmarCierre(reporte)}>
                      {reporte.tipo_reporte === 'INSTALACION' ? 'Confirmar instalacion' : 'Confirmar cierre'}
                    </button>
                    <button type="button" className="fiber-secondary-button" onClick={() => regresarTecnico(reporte)}>Regresar a tecnico</button>
                  </>
                )}
                {reporte.estado === 'NO_LOCALIZADO' && (
                  <>
                    <button type="button" className="fiber-secondary-button" onClick={() => reagendarReporte(reporte)}>Reagendar</button>
                    <button type="button" className="fiber-link-button danger-link" onClick={() => cancelarReporte(reporte)}>Cancelar</button>
                    <button type="button" className="fiber-secondary-button" onClick={() => regresarTecnico(reporte)}>Regresar a tecnico</button>
                  </>
                )}
              </footer>
            </article>
          ))}
        </div>
      </section>

      <section className="fiber-panel">
        <div className="report-filter-bar">
          <div className="quick-date-group">
            <button type="button" className={filters.fecha === todayDate() ? 'active' : ''} onClick={() => setFilters((current) => ({ ...current, fecha: todayDate() }))}>Hoy</button>
            <button type="button" onClick={() => setFilters((current) => ({ ...current, fecha: addDays(-1) }))}>Ayer</button>
            <input type="date" value={filters.fecha} onChange={(event) => setFilters((current) => ({ ...current, fecha: event.target.value }))} />
          </div>

          <select value={filters.comunidad_id} onChange={(event) => setFilters((current) => ({ ...current, comunidad_id: event.target.value }))}>
            <option value="">Todas las comunidades</option>
            {comunidades.map((comunidad) => <option key={comunidad.id} value={comunidad.id}>{comunidad.nombre}</option>)}
          </select>

          <select value={filters.tipo_reporte} onChange={(event) => setFilters((current) => ({ ...current, tipo_reporte: event.target.value }))}>
            <option value="">Todos los tipos</option>
            {tipos.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
          </select>
        </div>

        <div className="fiber-table-wrap">
          <table className="fiber-table reportes-table-modern">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Comunidad</th>
                <th>Tipo</th>
                <th>Cliente/Prospecto</th>
                <th>Comentario</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th>Fecha programada</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan="8" className="table-empty">Cargando reportes...</td></tr>}
              {!loading && reportes.length === 0 && <tr><td colSpan="8" className="table-empty">No hay reportes para esta fecha.</td></tr>}
              {!loading && reportes.map((reporte) => (
                <tr key={reporte.id}>
                  <td><strong>{formatDate(reporte.fecha_reportada)}</strong><span>#{reporte.id}</span></td>
                  <td>{reporte.comunidad_nombre}</td>
                  <td><span className="soft-pill">{reporte.tipo_reporte}</span></td>
                  <td><strong>{getSubjectName(reporte)}</strong><span>{getSubjectDetail(reporte)}</span></td>
                  <td>{reporte.comentario}</td>
                  <td><span className={`priority-pill ${String(reporte.prioridad).toLowerCase()}`}>{reporte.prioridad}</span></td>
                  <td><span className="state-pill">{reporte.estado}</span></td>
                  <td>{formatDate(reporte.fecha_programada) || 'Sin fecha'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function InstallationReview({ reporte, onViewPhoto }) {
  const prospectoNombre = fullName({
    nombres: reporte.prospecto_nombres_original,
    apellido_paterno: reporte.prospecto_apellido_paterno_original,
    apellido_materno: reporte.prospecto_apellido_materno_original,
  })
  const titularNombre = fullName({
    nombres: reporte.titular_nombres,
    apellido_paterno: reporte.titular_apellido_paterno,
    apellido_materno: reporte.titular_apellido_materno,
  })
  const titularDiferente = normalizeCompare(prospectoNombre) !== normalizeCompare(titularNombre)

  return (
    <div className="installation-review">
      {titularDiferente && titularNombre !== 'Sin nombre' && (
        <p className="installation-review-warning">El titular final capturado en campo es diferente al prospecto original.</p>
      )}

      <section>
        <h4>Prospecto original</h4>
        <p><strong>Nombre:</strong> {prospectoNombre}</p>
        <p><strong>Telefono:</strong> {reporte.prospecto_telefono || 'Sin telefono'}</p>
        <p><strong>Direccion:</strong> {reporte.prospecto_direccion || 'Sin direccion'}</p>
        <p><strong>Referencia:</strong> {reporte.prospecto_referencia || 'Sin referencia'}</p>
        <p><strong>Paquete interes:</strong> {reporte.prospecto_paquete_nombre || reporte.prospecto_paquete_interes_id || 'Sin paquete'}</p>
      </section>

      <section>
        <h4>Titular final</h4>
        <p><strong>Nombre:</strong> {titularNombre}</p>
        <p><strong>Telefono:</strong> {reporte.titular_telefono || 'Sin telefono'}</p>
        <p><strong>Direccion:</strong> {reporte.titular_direccion || 'Sin direccion'}</p>
        <p><strong>Referencia:</strong> {reporte.titular_referencia || 'Sin referencia'}</p>
        <p><strong>Paquete final:</strong> {reporte.paquete_instalacion_nombre || reporte.paquete_instalacion_id || 'Sin paquete'}</p>
      </section>

      <section>
        <h4>Datos tecnicos</h4>
        <p><strong>Alfanumerico:</strong> {reporte.alfanumerico_equipo || 'Sin dato'}</p>
        <p><strong>Fibra:</strong> {formatNumber(reporte.fibra_optica_metros)} m</p>
        <p><strong>Tensor gancho:</strong> {formatNumber(reporte.tensor_gancho)}</p>
        <p><strong>Argollas:</strong> {formatNumber(reporte.argollas)}</p>
        <p><strong>Taquetes:</strong> {formatNumber(reporte.taquetes)}</p>
        <p><strong>Sujetadores:</strong> {formatNumber(reporte.sujetadores)}</p>
        <p><strong>Roseta:</strong> {formatNumber(reporte.roseta)}</p>
        <p><strong>Caja:</strong> {reporte.codigo_caja || reporte.caja_nombre || reporte.puerto || 'Falta seleccionar caja y terminal.'}</p>
        <p><strong>Terminal:</strong> {reporte.caja_terminal_numero || reporte.terminal || 'Falta seleccionar caja y terminal.'}</p>
        <p><strong>Potencia:</strong> {reporte.potencia ?? 'Sin dato'}</p>
      </section>

      <section>
        <h4>Evidencia</h4>
        <p><strong>Firma cliente:</strong> {reporte.firma_cliente_base64 ? 'Capturada' : 'Sin firma'}</p>
        <p><strong>Firma tecnico:</strong> {reporte.firma_tecnico_base64 ? 'Capturada' : 'Sin firma'}</p>
        {reporte.foto_router_r2_key ? (
          <button type="button" className="fiber-secondary-button" onClick={() => onViewPhoto(reporte)}>Ver foto del router detras</button>
        ) : (
          <p><strong>Foto del router detras:</strong> Sin foto</p>
        )}
      </section>
    </div>
  )
}

function buildInstallationConfirmationHtml(reporte, ciclosCorte) {
  const prospectoNombre = fullName({
    nombres: reporte.prospecto_nombres_original,
    apellido_paterno: reporte.prospecto_apellido_paterno_original,
    apellido_materno: reporte.prospecto_apellido_materno_original,
  })
  const titularNombre = fullName({
    nombres: reporte.titular_nombres,
    apellido_paterno: reporte.titular_apellido_paterno,
    apellido_materno: reporte.titular_apellido_materno,
  })
  const cicloOptions = ciclosCorte
    .map((ciclo) => `<option value="${escapeHtml(ciclo.id)}">${escapeHtml(ciclo.nombre)}</option>`)
    .join('')

  return `
    <div class="confirm-installation-modal">
      <section>
        <h4>Resumen</h4>
        <p><strong>Prospecto:</strong> ${escapeHtml(prospectoNombre)}</p>
        <p><strong>Titular final:</strong> ${escapeHtml(titularNombre)}</p>
        <p><strong>Comunidad:</strong> ${escapeHtml(reporte.comunidad_nombre || 'Sin comunidad')}</p>
        <p><strong>Paquete final:</strong> ${escapeHtml(reporte.paquete_instalacion_nombre || reporte.paquete_instalacion_id || 'Sin paquete')}</p>
      </section>
      <section>
        <h4>Datos tecnicos</h4>
        <p><strong>Alfanumerico:</strong> ${escapeHtml(reporte.alfanumerico_equipo || 'Sin dato')}</p>
        <p><strong>Caja:</strong> ${escapeHtml(reporte.codigo_caja || reporte.caja_nombre || reporte.puerto || 'Falta seleccionar caja y terminal.')}</p>
        <p><strong>Terminal:</strong> ${escapeHtml(reporte.caja_terminal_numero || reporte.terminal || 'Falta seleccionar caja y terminal.')}</p>
        <p><strong>Potencia:</strong> ${escapeHtml(reporte.potencia ?? 'Sin dato')}</p>
        <p><strong>Materiales:</strong> fibra ${escapeHtml(formatNumber(reporte.fibra_optica_metros))} m, tensor ${escapeHtml(formatNumber(reporte.tensor_gancho))}, argollas ${escapeHtml(formatNumber(reporte.argollas))}, taquetes ${escapeHtml(formatNumber(reporte.taquetes))}, sujetadores ${escapeHtml(formatNumber(reporte.sujetadores))}, roseta ${escapeHtml(formatNumber(reporte.roseta))}</p>
        <p><strong>Firma cliente:</strong> ${reporte.firma_cliente_base64 ? 'Capturada' : 'Sin firma'}</p>
        <p><strong>Firma tecnico:</strong> ${reporte.firma_tecnico_base64 ? 'Capturada' : 'Sin firma'}</p>
        <p><strong>Foto del router detras:</strong> ${reporte.foto_router_r2_key ? 'Capturada' : 'Sin foto'}</p>
      </section>
      <label>
        Ciclo de corte
        <select id="confirm-install-cycle" class="swal2-select" required>
          <option value="">Selecciona ciclo</option>
          ${cicloOptions}
        </select>
      </label>
      <label>
        IP asignada <span>Opcional</span>
        <input id="confirm-install-ip" class="swal2-input" placeholder="172.20.5.10" />
      </label>
    </div>
  `
}

function formatEstado(estado) {
  if (estado === 'PENDIENTE_CONFIRMACION') return 'PENDIENTE CONFIRMACION'
  if (estado === 'NO_LOCALIZADO') return 'NO LOCALIZADO'
  return estado
}

function fullName(item) {
  return [item.nombres, item.apellido_paterno, item.apellido_materno].filter(Boolean).join(' ').trim() || 'Sin nombre'
}

function getSubjectName(reporte) {
  return reporte.tipo_reporte === 'DETALLE' ? reporte.cliente_nombre || 'Cliente sin nombre' : reporte.prospecto_nombre || 'Prospecto sin nombre'
}

function getSubjectDetail(reporte) {
  if (reporte.tipo_reporte === 'DETALLE') return [reporte.numero_cliente, reporte.cliente_telefono].filter(Boolean).join(' - ') || 'Sin datos'
  return reporte.prospecto_telefono || 'Sin telefono'
}

function formatDate(value) {
  return value ? String(value).slice(0, 10) : ''
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function tomorrowDate() {
  return addDays(1)
}

function addDays(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function formatTime(date) {
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function formatNumber(value) {
  return value === null || value === undefined || value === '' ? 0 : value
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function normalizeCompare(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ')
}

export default ReportesAtencion
