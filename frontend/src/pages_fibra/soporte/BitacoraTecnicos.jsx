import { useCallback, useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'
import '../../styles/BitacoraTecnicos.css'

const MONTHS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' }
]

function formatSpanishDate(dateStr) {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const year = parts[0]
  const monthIdx = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  return `${day} de ${months[monthIdx]} de ${year}`
}

function formatDateTime(value) {
  if (!value) return 'N/A'
  return String(value).replace('T', ' ').slice(0, 19)
}

function formatCurrency(value) {
  const number = Number(value ?? 0)
  const safeValue = Number.isFinite(number) ? number : 0
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(safeValue)
}

function todayInputDate() {
  const today = new Date()
  const offset = today.getTimezoneOffset()
  return new Date(today.getTime() - offset * 60 * 1000).toISOString().slice(0, 10)
}

function getDatesForPeriod(p, y, m, customIni, customFin) {
  const pad = (num) => String(num).padStart(2, '0')
  if (p === 'hoy') {
    const today = todayInputDate()
    return { inicio: today, fin: today }
  }
  if (p === 'q1') {
    const start = `${y}-${pad(m)}-01`
    const end = `${y}-${pad(m)}-15`
    return { inicio: start, fin: end }
  }
  if (p === 'q2') {
    const start = `${y}-${pad(m)}-16`
    const lastDay = new Date(y, m, 0).getDate()
    const end = `${y}-${pad(m)}-${pad(lastDay)}`
    return { inicio: start, fin: end }
  }
  if (p === 'mes') {
    const start = `${y}-${pad(m)}-01`
    const lastDay = new Date(y, m, 0).getDate()
    const end = `${y}-${pad(m)}-${pad(lastDay)}`
    return { inicio: start, fin: end }
  }
  if (p === 'custom') {
    return { inicio: customIni, fin: customFin }
  }
  const today = todayInputDate()
  return { inicio: today, fin: today }
}

function BitacoraTecnicos({ apiUrl, token }) {
  // Period states
  const now = new Date()
  const [periodo, setPeriodo] = useState('hoy') // 'hoy', 'q1', 'q2', 'mes', 'custom'
  const [anio, setAnio] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [fechaInicioCustom, setFechaInicioCustom] = useState(todayInputDate())
  const [fechaFinCustom, setFechaFinCustom] = useState(todayInputDate())

  // Dropdown states
  const [tecnicoId, setTecnicoId] = useState('todos')
  const [estado, setEstado] = useState('todos')
  const [comunidadId, setComunidadId] = useState('todos')
  
  const [tecnicosDropdown, setTecnicosDropdown] = useState([])
  const [comunidadesDropdown, setComunidadesDropdown] = useState([])
  
  // Data states
  const [bitacoraData, setBitacoraData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedTrabajo, setSelectedTrabajo] = useState(null)
  const [page, setPage] = useState(1)

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const loadTecnicos = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/bitacora-tecnicos/tecnicos`, { headers: authHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudieron cargar los técnicos.')
      setTecnicosDropdown(data.usuarios ?? [])
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    }
  }, [apiUrl, authHeaders])

  const loadComunidades = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/comunidades`, { headers: authHeaders })
      const data = await response.json()
      if (response.ok) setComunidadesDropdown(data.comunidades ?? [])
    } catch (err) {
      console.error(err)
    }
  }, [apiUrl, authHeaders])

  const loadBitacora = useCallback(async (resetPageNum = null) => {
    setLoading(true)
    try {
      const pageToLoad = resetPageNum !== null ? resetPageNum : page
      const dates = getDatesForPeriod(periodo, anio, mes, fechaInicioCustom, fechaFinCustom)

      if (periodo === 'custom') {
        if (!dates.inicio || !dates.fin) {
          Swal.fire({ icon: 'warning', title: 'Rango incompleto', text: 'Las fechas de inicio y fin son obligatorias para el rango personalizado.', confirmButtonColor: '#4274D9' })
          setLoading(false)
          return
        }
        if (dates.inicio > dates.fin) {
          Swal.fire({ icon: 'warning', title: 'Rango inválido', text: 'La fecha de inicio no puede ser mayor a la fecha de fin.', confirmButtonColor: '#4274D9' })
          setLoading(false)
          return
        }
      }

      const params = new URLSearchParams()
      params.set('fecha_inicio', dates.inicio)
      params.set('fecha_fin', dates.fin)
      params.set('tecnico_id', tecnicoId)
      params.set('estado', estado)
      params.set('comunidad_id', comunidadId)
      params.set('page', String(pageToLoad))
      params.set('page_size', '20')

      const response = await fetch(`${apiUrl}/api/bitacora-tecnicos?${params.toString()}`, { headers: authHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudo cargar la bitácora.')
      setBitacoraData(data)
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    } finally {
      setLoading(false)
    }
  }, [apiUrl, authHeaders, periodo, anio, mes, fechaInicioCustom, fechaFinCustom, tecnicoId, estado, comunidadId, page])

  useEffect(() => {
    loadTecnicos()
    loadComunidades()
  }, [loadTecnicos, loadComunidades])

  // Batch trigger load on filter changes (page will render once with page=1)
  useEffect(() => {
    setPage(1)
    loadBitacora(1)
  }, [periodo, anio, mes, tecnicoId, estado, comunidadId, fechaInicioCustom, fechaFinCustom])

  // Paginate specifically
  useEffect(() => {
    loadBitacora(page)
  }, [page])

  // Helper page reset updates
  const handlePeriodoChange = (val) => {
    setPeriodo(val)
    setPage(1)
  }
  const handleAnioChange = (val) => {
    setAnio(val)
    setPage(1)
  }
  const handleMesChange = (val) => {
    setMes(val)
    setPage(1)
  }
  const handleTecnicoChange = (val) => {
    setTecnicoId(val)
    setPage(1)
  }
  const handleEstadoChange = (val) => {
    setEstado(val)
    setPage(1)
  }
  const handleComunidadChange = (val) => {
    setComunidadId(val)
    setPage(1)
  }
  const handleCustomDateChange = (type, val) => {
    if (type === 'inicio') {
      setFechaInicioCustom(val)
    } else {
      setFechaFinCustom(val)
    }
    setPage(1)
  }

  const handleVerContrato = async (contratoId) => {
    try {
      const response = await fetch(`${apiUrl}/api/contratos/${contratoId}/archivo`, { headers: authHeaders })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'No se pudo descargar el contrato.')
      }
      const blob = await response.blob()
      const urlBlob = URL.createObjectURL(blob)
      window.open(urlBlob, '_blank')
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    }
  }

  const resumen = bitacoraData?.resumen ?? {
    total_terminados: 0,
    pendientes_confirmacion: 0,
    confirmados: 0,
    tecnicos_con_actividad: 0,
    total_costo_instalacion: 0,
  }
  const listTecnicos = bitacoraData?.tecnicos ?? []
  const hasTrabajos = listTecnicos.some((tecnico) => (tecnico.trabajos ?? []).length > 0)
  const emptyText = tecnicoId === 'todos'
    ? 'No hay trabajos terminados para el periodo seleccionado.'
    : 'Este técnico no tiene trabajos terminados en el periodo seleccionado.'

  const showDateText = () => {
    const dates = getDatesForPeriod(periodo, anio, mes, fechaInicioCustom, fechaFinCustom)
    if (dates.inicio === dates.fin) {
      return <>Viendo trabajos terminados del <strong>{formatSpanishDate(dates.inicio)}</strong></>
    }
    return <>Viendo trabajos terminados del <strong>{formatSpanishDate(dates.inicio)}</strong> al <strong>{formatSpanishDate(dates.fin)}</strong></>
  }

  return (
    <div className="bitacora-page fiber-page">
      <section className="fiber-page-header">
        <div>
          <span className="fiber-kicker">Auditoría de operaciones</span>
          <h1>Bitácora de técnicos</h1>
          <p>Trabajos terminados por técnico en el periodo seleccionado.</p>
        </div>
      </section>

      {/* Filter panel */}
      <section className="bitacora-filters-bar" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', borderRadius: '12px' }}>
        
        {/* Row 1: Period selectors */}
        <div className="periodo-selector-row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 'bold', color: '#475569', marginRight: '8px' }}>Periodo:</span>
          {[
            { id: 'hoy', label: 'Hoy' },
            { id: 'q1', label: '1ª Quincena' },
            { id: 'q2', label: '2ª Quincena' },
            { id: 'mes', label: 'Este mes' },
            { id: 'custom', label: 'Rango personalizado' }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={`fiber-tab-button ${periodo === item.id ? 'active' : ''}`}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                border: '1px solid #cbd5e1',
                background: periodo === item.id ? '#3b82f6' : '#ffffff',
                color: periodo === item.id ? '#ffffff' : '#475569',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={() => handlePeriodoChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Row 2: Dynamic Period Parameters */}
        {(periodo === 'q1' || periodo === 'q2' || periodo === 'mes') && (
          <div className="period-params-row" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div className="bitacora-filter-group" style={{ margin: 0 }}>
              <label htmlFor="select-mes" style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#64748b' }}>Mes</label>
              <select
                id="select-mes"
                value={mes}
                onChange={(e) => handleMesChange(Number(e.target.value))}
                style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              >
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="bitacora-filter-group" style={{ margin: 0 }}>
              <label htmlFor="select-anio" style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#64748b' }}>Año</label>
              <select
                id="select-anio"
                value={anio}
                onChange={(e) => handleAnioChange(Number(e.target.value))}
                style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              >
                {[2026, 2027, 2028, 2029, 2030].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        )}

        {periodo === 'custom' && (
          <div className="period-params-row" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="bitacora-filter-group" style={{ margin: 0 }}>
              <label htmlFor="custom-fecha-inicio" style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#64748b' }}>Fecha Inicio</label>
              <input
                id="custom-fecha-inicio"
                type="date"
                value={fechaInicioCustom}
                onChange={(e) => handleCustomDateChange('inicio', e.target.value)}
                style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              />
            </div>
            <div className="bitacora-filter-group" style={{ margin: 0 }}>
              <label htmlFor="custom-fecha-fin" style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#64748b' }}>Fecha Fin</label>
              <input
                id="custom-fecha-fin"
                type="date"
                value={fechaFinCustom}
                onChange={(e) => handleCustomDateChange('fin', e.target.value)}
                style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>
        )}

        {/* Row 3: Dropdowns (Tecnico, Estado, Comunidad) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', width: '100%' }}>
          <div className="bitacora-filter-group" style={{ margin: 0 }}>
            <label htmlFor="select-tecnico">Técnico</label>
            <select
              id="select-tecnico"
              value={tecnicoId}
              onChange={(event) => handleTecnicoChange(event.target.value)}
            >
              <option value="todos">Todos los técnicos</option>
              {tecnicosDropdown.map((tecnico) => (
                <option key={tecnico.id} value={tecnico.id}>{tecnico.nombre_completo}</option>
              ))}
            </select>
          </div>
          <div className="bitacora-filter-group" style={{ margin: 0 }}>
            <label htmlFor="select-estado">Estado</label>
            <select
              id="select-estado"
              value={estado}
              onChange={(event) => handleEstadoChange(event.target.value)}
            >
              <option value="todos">Todos los terminados</option>
              <option value="pendientes_confirmacion">Pendientes de confirmación</option>
              <option value="confirmados">Confirmados</option>
            </select>
          </div>
          <div className="bitacora-filter-group" style={{ margin: 0 }}>
            <label htmlFor="select-comunidad">Comunidad</label>
            <select
              id="select-comunidad"
              value={comunidadId}
              onChange={(event) => handleComunidadChange(event.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            >
              <option value="todos">Todas las comunidades</option>
              {comunidadesDropdown.map((comunidad) => (
                <option key={comunidad.id} value={comunidad.id}>{comunidad.nombre}</option>
              ))}
            </select>
          </div>
        </div>

      </section>

      <div className="bitacora-current-date" style={{ padding: '0 20px', marginBottom: '16px' }}>
        {showDateText()}
      </div>

      <section className="bitacora-summary-grid">
        <SummaryCard value={resumen.total_terminados} label="Total terminados" tone="total" />
        <SummaryCard value={resumen.pendientes_confirmacion} label="Pendientes de confirmación" tone="pending" />
        <SummaryCard value={resumen.confirmados} label="Confirmados" tone="confirmed" />
        <SummaryCard value={resumen.tecnicos_con_actividad} label="Técnicos activos" tone="techs" />
        <SummaryCard value={formatCurrency(resumen.total_costo_instalacion)} label="Total cobrado por instalaciones" tone="money" />
      </section>

      <section className="bitacora-tech-list">
        {loading && <p className="bitacora-empty">Cargando bitácora...</p>}

        {!loading && !hasTrabajos && (
          <div className="bitacora-empty-card">{emptyText}</div>
        )}

        {!loading && listTecnicos.map((tecnico) => (
          <TecnicoGroup
            key={tecnico.tecnico_id}
            tecnico={tecnico}
            onVerDetalle={setSelectedTrabajo}
            onVerContrato={handleVerContrato}
          />
        ))}
      </section>

      {/* Pagination controls */}
      {bitacoraData?.pagination && bitacoraData.pagination.total_items > 0 && (
        <div className="bitacora-pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', marginTop: '20px', borderTop: '1px solid #cbd5e1', flexWrap: 'wrap', gap: '12px' }}>
          <span style={{ fontSize: '0.88rem', color: '#64748b', fontWeight: 'bold' }}>
            Mostrando {((page - 1) * 20) + 1} - {Math.min(page * 20, bitacoraData.pagination.total_items)} de {bitacoraData.pagination.total_items} trabajos
          </span>
          {bitacoraData.pagination.total_pages > 1 && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                className="fiber-secondary-button"
                style={{ minHeight: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <span style={{ fontSize: '0.88rem', color: '#475569', fontWeight: 'bold' }}>
                Página {page} de {bitacoraData.pagination.total_pages}
              </span>
              <button
                type="button"
                className="fiber-secondary-button"
                style={{ minHeight: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
                disabled={page === bitacoraData.pagination.total_pages}
                onClick={() => setPage(p => Math.min(bitacoraData.pagination.total_pages, p + 1))}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}

      {selectedTrabajo && (
        <DetalleTrabajoModal
          trabajo={selectedTrabajo}
          onClose={() => setSelectedTrabajo(null)}
          onVerContrato={handleVerContrato}
        />
      )}
    </div>
  )
}

function SummaryCard({ value, label, tone }) {
  return (
    <article className={`bitacora-summary-card ${tone}`}>
      <div className="bitacora-summary-card-value">{value}</div>
      <div className="bitacora-summary-card-label">{label}</div>
    </article>
  )
}

function TecnicoGroup({ tecnico, onVerDetalle, onVerContrato }) {
  if ((tecnico.trabajos ?? []).length === 0) {
    return null
  }

  return (
    <article className="bitacora-tech-section" style={{ marginBottom: '24px' }}>
      <div className="bitacora-tech-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '10px', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="bitacora-tech-title" style={{ fontSize: '1.2rem', margin: 0, color: '#1e293b' }}>{tecnico.tecnico_nombre}</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Trabajos completados en esta página: {tecnico.resumen.total_terminados}</p>
        </div>
        <div className="bitacora-tech-stats" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span className="bitacora-tech-badge total" style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.78rem', background: '#e2e8f0', color: '#475569', fontWeight: 'bold' }}>Total: {tecnico.resumen.total_terminados}</span>
          <span className="bitacora-tech-badge confirmacion" style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.78rem', background: '#fef3c7', color: '#d97706', fontWeight: 'bold' }}>Pendientes: {tecnico.resumen.pendientes_confirmacion}</span>
          <span className="bitacora-tech-badge completada" style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.78rem', background: '#dcfce7', color: '#15803d', fontWeight: 'bold' }}>Confirmados: {tecnico.resumen.confirmados}</span>
          <span className="bitacora-tech-badge money" style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.78rem', background: '#dbeafe', color: '#2563eb', fontWeight: 'bold' }}>Cobrado: {formatCurrency(tecnico.resumen.total_costo_instalacion)}</span>
        </div>
      </div>

      <div className="bitacora-work-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {tecnico.trabajos.map((trabajo) => (
          <div className="bitacora-work-card" key={trabajo.reporte_id} style={{ display: 'flex', gap: '14px', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
            <div className="bitacora-work-time" style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#64748b', minWidth: '45px' }}>{trabajo.hora}</div>
            <div className="bitacora-work-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="bitacora-work-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: '#1e293b', fontWeight: '750' }}>{getWorkTitle(trabajo)}</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.88rem', color: '#475569' }}>Cliente: <strong>{trabajo.cliente}</strong></p>
                </div>
                <EstadoBadge estado={trabajo.estado} label={trabajo.estado_label} />
              </div>

              <div className="bitacora-work-meta" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.82rem', color: '#64748b' }}>
                <span>Comunidad: <strong>{trabajo.comunidad}</strong></span>
                <span>Dirección: <strong>{trabajo.direccion}</strong></span>
                <span>Costo instalación: <strong style={{ color: '#10b981' }}>{formatCurrency(trabajo.contrato_costo_instalacion)}</strong></span>
                {trabajo.es_imprevista && <span style={{ color: '#d97706', fontWeight: 'bold' }}>Instalación imprevista</span>}
              </div>

              <div className="bitacora-work-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                {trabajo.contrato_id ? (
                  <button type="button" className="fiber-link-button" style={{ fontSize: '0.82rem' }} onClick={() => onVerContrato(trabajo.contrato_id)}>
                    Ver contrato {trabajo.contrato_numero}
                  </button>
                ) : (
                  trabajo.tipo_reporte === 'INSTALACION' && <span className="bitacora-muted" style={{ fontSize: '0.82rem', alignSelf: 'center' }}>Sin contrato</span>
                )}
                <button type="button" className="fiber-secondary-button" style={{ minHeight: 'auto', padding: '6px 12px', fontSize: '0.82rem' }} onClick={() => onVerDetalle(trabajo)}>
                  Ver detalle
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

function EstadoBadge({ estado, label }) {
  const normalized = String(estado || '').toLowerCase()
  return <span className={`bitacora-status ${normalized}`}>{label}</span>
}

function DetalleTrabajoModal({ trabajo, onClose, onVerContrato }) {
  const detalle = trabajo.detalle ?? {}

  return (
    <div className="client-modal-backdrop" onClick={onClose}>
      <div className="client-modal bitacora-detail-modal" onClick={(event) => event.stopPropagation()} style={{ width: 'min(700px, 95%)' }}>
        <div className="client-modal-header">
          <h3>Detalle del reporte #{detalle.reporte_id}</h3>
          <button type="button" onClick={onClose}>✕</button>
        </div>

        <div className="bitacora-detail-content" style={{ maxHeight: 'calc(80vh - 120px)', overflowY: 'auto', padding: '20px 24px' }}>
          <DetailSection title="Datos del reporte">
            <DetailItem label="Tipo" value={detalle.tipo_reporte} />
            <DetailItem label="Estado actual" value={detalle.estado_label || detalle.estado_actual} />
            <DetailItem label="Técnico" value={detalle.tecnico} />
            <DetailItem label="Cliente / Prospecto" value={detalle.cliente} />
            <DetailItem label="Teléfono" value={detalle.telefono} />
            <DetailItem label="Comunidad" value={detalle.comunidad} />
            <DetailItem label="Dirección" value={detalle.direccion} wide />
            <DetailItem label="Referencia" value={detalle.referencia} wide />
          </DetailSection>

          <DetailSection title="Fechas">
            <DetailItem label="Reportado" value={formatDateTime(detalle.fecha_reportada)} />
            <DetailItem label="Asignación" value={formatDateTime(detalle.fecha_asignacion)} />
            <DetailItem label="Programado" value={formatDateTime(detalle.fecha_programada)} />
            <DetailItem label="Inicio" value={formatDateTime(detalle.fecha_inicio)} />
            <DetailItem label="Cierre técnico" value={formatDateTime(detalle.fecha_cierre_tecnico)} />
            <DetailItem label="Confirmación" value={formatDateTime(detalle.fecha_confirmacion)} />
          </DetailSection>

          {detalle.tipo_reporte === 'INSTALACION' && (
            <>
              <DetailSection title="Datos técnicos">
                <DetailItem label="Caja" value={detalle.caja} />
                <DetailItem label="Terminal" value={detalle.terminal} />
                <DetailItem label="Puerto" value={detalle.puerto} />
                <DetailItem label="Potencia" value={detalle.potencia != null ? `${detalle.potencia} dBm` : 'N/A'} />
                <DetailItem label="Alfanumérico" value={detalle.alfanumerico_equipo} />
                <DetailItem label="Paquete" value={detalle.paquete} />
                <DetailItem label="Costo de instalación cobrado" value={formatCurrency(detalle.contrato_costo_instalacion)} />
              </DetailSection>

              <DetailSection title="Materiales usados">
                <DetailItem label="Fibra óptica" value={`${detalle.materiales?.fibra_optica_metros ?? 0} m`} />
                <DetailItem label="Tensor gancho" value={detalle.materiales?.tensor_gancho ?? 0} />
                <DetailItem label="Argollas" value={detalle.materiales?.argollas ?? 0} />
                <DetailItem label="Taquetes" value={detalle.materiales?.taquetes ?? 0} />
                <DetailItem label="Sujetadores" value={detalle.materiales?.sujetadores ?? 0} />
                <DetailItem label="Roseta" value={detalle.materiales?.roseta ?? 0} />
              </DetailSection>
            </>
          )}

          <DetailSection title="Comentarios">
            <DetailItem label="Comentario reporte" value={detalle.comentario_reporte} wide />
            <DetailItem label="Comentario cierre" value={detalle.comentario_cierre} wide />
            <DetailItem label="Instalación imprevista" value={detalle.es_imprevista ? 'Sí' : 'No'} />
            <DetailItem label="Contrato" value={detalle.contrato_numero || 'N/A'} />
          </DetailSection>

          <section className="bitacora-log-section" style={{ marginTop: '20px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', color: '#1e293b' }}>Seguimientos completos</h4>
            {(detalle.logs ?? []).length === 0 ? (
              <p className="bitacora-muted">Sin seguimientos registrados.</p>
            ) : (
              <div className="bitacora-log-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {detalle.logs.map((log) => (
                  <div className="bitacora-log-item" key={log.seguimiento_id} style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.8rem', color: '#64748b' }}>
                      <span>{formatDateTime(log.fecha)}</span>
                      <small style={{ fontWeight: 'bold' }}>{log.usuario}</small>
                    </div>
                    <strong style={{ display: 'block', fontSize: '0.88rem', color: '#1e293b', textTransform: 'uppercase' }}>{log.estado}</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#475569' }}>{log.comentario}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="bitacora-detail-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', borderTop: '1px solid #cbd5e1', paddingTop: '16px' }}>
            {detalle.contrato_id && (
              <button type="button" className="fiber-primary-button" onClick={() => onVerContrato(detalle.contrato_id)}>
                Ver contrato PDF
              </button>
            )}
            <button type="button" className="fiber-secondary-button" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailSection({ title, children }) {
  return (
    <section className="bitacora-detail-section" style={{ marginBottom: '20px' }}>
      <h4 style={{ margin: '0 0 10px', fontSize: '0.95rem', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', color: '#1e293b' }}>{title}</h4>
      <div className="bitacora-detail-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>{children}</div>
    </section>
  )
}

function DetailItem({ label, value, wide = false }) {
  return (
    <div className={`bitacora-detail-item ${wide ? 'wide' : ''}`} style={{ gridColumn: wide ? '1 / -1' : 'auto' }}>
      <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 'bold', display: 'block' }}>{label}</span>
      <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{value ?? 'N/A'}</strong>
    </div>
  )
}

function getWorkTitle(trabajo) {
  if (trabajo.tipo_reporte === 'INSTALACION') return 'Instalación completada'
  return 'Soporte completado'
}

export default BitacoraTecnicos
