import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import Swal from 'sweetalert2'
import 'leaflet/dist/leaflet.css'

const estados = ['PENDIENTE', 'ASIGNADO', 'EN_PROCESO', 'PENDIENTE_CONFIRMACION', 'NO_LOCALIZADO', 'CANCELADO']
const tipos = ['DETALLE', 'INSTALACION']
const routeColors = ['#4274D9', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#be123c']
const markerColors = {
  instalacion: '#16a34a',
  detalle: '#f97316',
  sinTecnico: '#64748b',
  enProceso: '#f59e0b',
  pendienteConfirmacion: '#4274D9',
  noLocalizado: '#ea580c',
}

function getFormattedDate(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

function todayDate() { return getFormattedDate(0) }
function tomorrowDate() { return getFormattedDate(1) }
function yesterdayDate() { return getFormattedDate(-1) }

function createCommunityIcon(number, color, totalReportes) {
  return L.divIcon({
    className: 'custom-community-marker',
    html: `
      <div class="route-marker" style="--marker-color: ${color}">
        <span>${number}</span>
        ${totalReportes > 1 ? `<b>${totalReportes}</b>` : ''}
      </div>
    `,
    iconSize: [42, 48],
    iconAnchor: [21, 48],
    popupAnchor: [0, -44],
  })
}

function ReportesOperativos({ apiUrl, token, roles = [] }) {
  const [comunidades, setComunidades] = useState([])
  const [tecnicos, setTecnicos] = useState([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [rutaData, setRutaData] = useState({
    tecnicos: [],
    sin_tecnico: [],
    sin_coordenadas: [],
    fecha_programada: todayDate(),
    tecnico_id: 'todos',
  })
  const [filters, setFilters] = useState({
    fecha_programada: todayDate(),
    tecnico_id: 'todos',
    comunidad_id: '',
    tipo_reporte: '',
    estado: 'activos',
  })
  const [loading, setLoading] = useState(true)

  const isAdmin = roles.length === 0 || roles.includes('ADMIN')
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const loadCatalogs = useCallback(async () => {
    try {
      const [comunidadesResponse, tecnicosResponse] = await Promise.all([
        fetch(`${apiUrl}/api/comunidades`, { headers: authHeaders }),
        fetch(`${apiUrl}/api/usuarios/tecnicos`, { headers: authHeaders }),
      ])
      const comunidadesData = await comunidadesResponse.json()
      const tecnicosData = await tecnicosResponse.json()

      if (comunidadesResponse.ok) setComunidades(comunidadesData.comunidades ?? [])
      if (tecnicosResponse.ok) setTecnicos(tecnicosData.tecnicos ?? [])
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar los catalogos.', confirmButtonColor: '#4274D9' })
    }
  }, [apiUrl, authHeaders])

  const loadRutaData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value)
      })

      const response = await fetch(`${apiUrl}/api/reportes/ruta?${params.toString()}`, { headers: authHeaders })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'No se pudo cargar la ruta operativa.')

      setRutaData({
        tecnicos: result.tecnicos ?? [],
        sin_tecnico: result.sin_tecnico ?? [],
        sin_coordenadas: result.sin_coordenadas ?? [],
        fecha_programada: result.fecha_programada ?? filters.fecha_programada,
        tecnico_id: result.tecnico_id ?? filters.tecnico_id,
      })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    } finally {
      setLoading(false)
    }
  }, [apiUrl, authHeaders, filters])

  useEffect(() => {
    loadCatalogs()
  }, [loadCatalogs])

  useEffect(() => {
    loadRutaData()
  }, [loadRutaData])

  const routeGroups = useMemo(() => {
    const groups = rutaData.tecnicos.map((tecnico, index) => ({
      ...tecnico,
      color: routeColors[index % routeColors.length],
      isUnassigned: false,
    }))

    if (rutaData.sin_tecnico.length > 0) {
      groups.push({
        tecnico_id: 'sin_asignar',
        tecnico_nombre: 'Sin tecnico asignado',
        total_reportes: rutaData.sin_tecnico.reduce((sum, comunidad) => sum + Number(comunidad.total_reportes || 0), 0),
        comunidades: rutaData.sin_tecnico,
        distancia_aproximada_km: 0,
        tiempo_aproximado_min: 0,
        color: '#94a3b8',
        isUnassigned: true,
      })
    }

    return groups
  }, [rutaData])

  const reportes = useMemo(() => {
    const mapReportes = routeGroups.flatMap((group) =>
      group.comunidades.flatMap((comunidad) =>
        comunidad.reportes.map((reporte) => ({
          ...reporte,
          tecnico_nombre: reporte.tecnico_nombre || (group.isUnassigned ? '' : group.tecnico_nombre),
        }))
      )
    )
    return [...mapReportes, ...rutaData.sin_coordenadas]
  }, [routeGroups, rutaData.sin_coordenadas])

  const metrics = useMemo(() => ({
    total: reportes.length,
    pendientes: reportes.filter((r) => r.estado === 'PENDIENTE').length,
    asignados: reportes.filter((r) => r.estado === 'ASIGNADO').length,
    tecnicos: rutaData.tecnicos.length,
    sinTecnico: rutaData.sin_tecnico.reduce((sum, comunidad) => sum + Number(comunidad.total_reportes || 0), 0),
  }), [reportes, rutaData])

  const mapCenter = useMemo(() => {
    const firstGroup = routeGroups.find((group) => group.comunidades.length > 0)
    const firstCommunity = firstGroup?.comunidades?.[0]
    if (firstCommunity) return [firstCommunity.latitud, firstCommunity.longitud]
    return [17.55, -99.50]
  }, [routeGroups])

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }))
  }

  function dateButtonClass(value) {
    return filters.fecha_programada === value ? 'fiber-primary-button' : 'fiber-secondary-button'
  }

  async function openScheduleModal(reporte) {
    if (!isAdmin) return

    const tecnicoOptions = tecnicos.map((tecnico) => (
      `<option value="${tecnico.id}" ${String(reporte.tecnico_id || '') === String(tecnico.id) ? 'selected' : ''}>${escapeHtml(tecnico.nombre)}</option>`
    )).join('')

    const result = await Swal.fire({
      title: `Agendar reporte #${reporte.id}`,
      html: `
        <div class="schedule-modal-body">
          <p class="schedule-subtitle">Asigna tecnico, fecha y orden de ruta.</p>
          <div class="schedule-form">
            <label>
              <span>Tecnico</span>
              <select id="swal-tecnico">
                <option value="">Selecciona tecnico</option>
                ${tecnicoOptions}
              </select>
            </label>
            <label>
              <span>Fecha programada</span>
              <input id="swal-fecha" type="date" value="${getModalDateValue(reporte.fecha_programada, filters.fecha_programada)}">
            </label>
            <label>
              <span>Orden de ruta</span>
              <input id="swal-orden" type="number" min="1" value="${reporte.orden_ruta || ''}" placeholder="Ej. 1">
            </label>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar agenda',
      cancelButtonText: 'Cancelar',
      buttonsStyling: false,
      customClass: {
        popup: 'schedule-modal',
        title: 'schedule-modal-title',
        htmlContainer: 'schedule-modal-html',
        actions: 'schedule-actions',
        confirmButton: 'primary-action',
        cancelButton: 'secondary-action',
      },
      focusConfirm: false,
      preConfirm: () => {
        const tecnicoId = document.getElementById('swal-tecnico')?.value
        const fechaProgramada = document.getElementById('swal-fecha')?.value
        const ordenRuta = document.getElementById('swal-orden')?.value

        if (!tecnicoId) {
          Swal.showValidationMessage('Selecciona un tecnico.')
          return false
        }
        if (!fechaProgramada) {
          Swal.showValidationMessage('Selecciona la fecha programada.')
          return false
        }

        return {
          tecnico_id: Number(tecnicoId),
          fecha_programada: fechaProgramada,
          orden_ruta: ordenRuta ? Number(ordenRuta) : null,
        }
      },
    })

    if (!result.isConfirmed) return

    try {
      const response = await fetch(`${apiUrl}/api/reportes/${reporte.id}/asignar-tecnico`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(result.value),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'No se pudo agendar el reporte.')

      await Swal.fire({
        icon: 'success',
        title: 'Reporte agendado',
        text: 'Se asigno el tecnico y la fecha programada.',
        confirmButtonColor: '#4274D9',
      })
      setFilters((current) => ({ ...current, fecha_programada: result.value.fecha_programada, tecnico_id: 'todos' }))
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    }
  }

  async function updateEstado(reporte, estado) {
    try {
      const response = await fetch(`${apiUrl}/api/reportes/${reporte.id}/estado`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'No se pudo actualizar el estado.')
      await loadRutaData()
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    }
  }

  function showDetail(reporte) {
    Swal.fire({
      title: `Reporte #${reporte.id}`,
      html: `
        <div style="text-align:left; line-height:1.6">
          <p><strong>Fecha programada:</strong> ${reporte.fecha_programada || 'Sin fecha'}</p>
          <p><strong>Comunidad:</strong> ${escapeHtml(reporte.comunidad_nombre || '-')}</p>
          <p><strong>Tipo:</strong> ${reporte.tipo_reporte}</p>
          <p><strong>Titular:</strong> ${escapeHtml(getSubjectName(reporte))}</p>
          <p><strong>Prioridad:</strong> ${reporte.prioridad}</p>
          <p><strong>Estado:</strong> ${reporte.estado}</p>
          <p><strong>Tecnico:</strong> ${escapeHtml(reporte.tecnico_nombre || 'Sin asignar')}</p>
          <p><strong>Comentario:</strong> ${escapeHtml(reporte.comentario || '-')}</p>
        </div>
      `,
      confirmButtonColor: '#4274D9',
    })
  }

  function dateLabel() {
    if (filters.fecha_programada === 'todas') return 'Todas las fechas'
    if (filters.fecha_programada === 'sin_fecha') return 'Sin fecha (Pendientes)'
    if (filters.fecha_programada === todayDate()) return 'Hoy'
    if (filters.fecha_programada === tomorrowDate()) return 'Mañana'
    if (filters.fecha_programada === yesterdayDate()) return 'Ayer'
    return filters.fecha_programada
  }

  return (
    <div className="reportes-operativos-page fiber-page" style={{ display: 'grid', gap: '20px' }}>
      <section className="fiber-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span className="fiber-kicker">Panel operativo admin</span>
          <h1>Ruta operativa / Reportes programados</h1>
          <p>Agenda reportes, asigna técnico y revisa la ruta por fecha operativa.</p>
        </div>
        <div style={{ background: '#e0f2fe', color: '#0369a1', padding: '6px 12px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>
          📅 Viendo: {dateLabel()}
        </div>
      </section>
 
      <section className="fiber-panel operational-panel">
        <div className="operational-filters">
          <button className={dateButtonClass(todayDate())} type="button" onClick={() => updateFilter('fecha_programada', todayDate())}>
            Hoy
          </button>
          <button className={dateButtonClass(tomorrowDate())} type="button" onClick={() => updateFilter('fecha_programada', tomorrowDate())}>
            Mañana
          </button>
          <button className={dateButtonClass('sin_fecha')} type="button" onClick={() => updateFilter('fecha_programada', 'sin_fecha')}>
            Sin fecha
          </button>
          <select value={filters.tecnico_id} onChange={(event) => updateFilter('tecnico_id', event.target.value)}>
            <option value="todos">Todos los técnicos</option>
            <option value="sin_asignar">Sin técnico asignado</option>
            {tecnicos.map((tecnico) => (
              <option value={tecnico.id} key={tecnico.id}>{tecnico.nombre}</option>
            ))}
          </select>
          <select value={filters.comunidad_id} onChange={(event) => updateFilter('comunidad_id', event.target.value)}>
            <option value="">Todas las comunidades</option>
            {comunidades.map((comunidad) => (
              <option value={comunidad.id} key={comunidad.id}>{comunidad.nombre}</option>
            ))}
          </select>
          <button 
            type="button" 
            className="fiber-secondary-button" 
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {showAdvanced ? 'Menos filtros ▴' : 'Más filtros ▾'}
          </button>
        </div>

        {showAdvanced && (
          <div className="advanced-filters-panel">
            <div className="advanced-filter-item" style={{ flex: '0 0 auto', minWidth: 'auto' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--fiber-muted)', marginRight: '8px' }}>Otras fechas:</span>
              <button className={dateButtonClass('todas')} type="button" onClick={() => updateFilter('fecha_programada', 'todas')}>
                Todas las fechas
              </button>
              <button className={dateButtonClass(yesterdayDate())} type="button" onClick={() => updateFilter('fecha_programada', yesterdayDate())}>
                Ayer
              </button>
            </div>
            <div className="advanced-filter-item">
              <label htmlFor="filter-estado">Estado del reporte</label>
              <select id="filter-estado" value={filters.estado} onChange={(event) => updateFilter('estado', event.target.value)}>
                <option value="activos">Activos</option>
                <option value="todos">Todos</option>
                <option value="PENDIENTE">Pendientes</option>
                <option value="ASIGNADO">Asignados</option>
                <option value="EN_PROCESO">En proceso</option>
                <option value="PENDIENTE_CONFIRMACION">Pendientes confirmación</option>
                <option value="NO_LOCALIZADO">No localizados</option>
                {estados.filter((estado) => !['PENDIENTE', 'ASIGNADO', 'EN_PROCESO', 'PENDIENTE_CONFIRMACION', 'NO_LOCALIZADO'].includes(estado)).map((estado) => (
                  <option value={estado} key={estado}>{estado}</option>
                ))}
              </select>
            </div>
            <div className="advanced-filter-item">
              <label htmlFor="filter-tipo">Tipo de reporte</label>
              <select id="filter-tipo" value={filters.tipo_reporte} onChange={(event) => updateFilter('tipo_reporte', event.target.value)}>
                <option value="">Todos los tipos</option>
                {tipos.map((tipo) => (
                  <option value={tipo} key={tipo}>{tipo}</option>
                ))}
              </select>
            </div>
          </div>
        )}
 
        <div className="summary-grid">
          <Metric label={filters.fecha_programada === todayDate() ? "Reportes de hoy" : "Reportes del día"} value={metrics.total} />
          <Metric label="Asignados" value={metrics.asignados} />
          <Metric label="Sin técnico" value={metrics.sinTecnico} />
          <Metric label="Técnicos en ruta" value={metrics.tecnicos} />
          <Metric label="Pendientes por atender" value={metrics.pendientes} />
        </div>

        {rutaData.sin_tecnico.length === 0 && reportes.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#dcfce7', color: '#15803d', padding: '10px 16px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold', marginTop: '16px' }}>
            <span>✅ Todos los reportes tienen técnico asignado.</span>
          </div>
        )}
      </section>

      <section className="fiber-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '10px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--fiber-primary-dark)' }}>Mapa por tecnico</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--fiber-muted)' }}>Cada color representa una ruta tecnica. Los reportes sin tecnico solo se muestran como puntos.</p>
          </div>
          <strong style={{ color: 'var(--fiber-primary)' }}>{routeGroups.reduce((sum, group) => sum + group.comunidades.length, 0)} localidades</strong>
        </div>

        <div className="route-map">
          {loading ? (
            <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--fiber-muted)' }}>Cargando ruta operativa...</div>
          ) : (
            <MapContainer center={mapCenter} zoom={11} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution="&copy; OpenStreetMap contributors &copy; CARTO"
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />
              {routeGroups.map((group) => (
                <RouteLayer key={group.tecnico_id} group={group} />
              ))}
            </MapContainer>
          )}
          <MapLegend />
        </div>
      </section>

      <section className="fiber-panel">
        <h3 style={{ marginTop: 0, color: 'var(--fiber-primary-dark)' }}>Resumen por tecnico</h3>
        {loading ? (
          <p style={{ color: 'var(--fiber-muted)' }}>Cargando resumen...</p>
        ) : routeGroups.length === 0 ? (
          <p style={{ color: 'var(--fiber-muted)' }}>No hay reportes para los filtros seleccionados.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            {routeGroups.map((group) => (
              <div key={group.tecnico_id} style={{ border: '1px solid var(--fiber-border)', borderLeft: `5px solid ${group.color}`, borderRadius: '12px', padding: '14px', background: '#fff' }}>
                <strong style={{ color: 'var(--fiber-black)' }}>{group.tecnico_nombre}</strong>
                <p style={{ margin: '6px 0', color: 'var(--fiber-muted)' }}>
                  Reportes: {group.total_reportes} | Localidades: {group.comunidades.length}
                </p>
                {group.isUnassigned ? (
                  <p style={{ margin: 0, color: 'var(--fiber-muted)' }}>Pendiente de agenda, sin trazo de ruta.</p>
                ) : (
                  <p style={{ margin: 0, color: 'var(--fiber-primary)' }}>
                    Distancia aprox: {group.distancia_aproximada_km || 0} km | Tiempo aprox: {formatMinutes(group.tiempo_aproximado_min || 0)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="fiber-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '10px', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, color: 'var(--fiber-primary-dark)' }}>Reportes programados ({reportes.length})</h3>
        </div>

        <div className="fiber-table-wrap operational-table-wrap">
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
                <th>Tecnico</th>
                <th>Orden</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="10" className="table-empty">Cargando reportes...</td>
                </tr>
              )}
              {!loading && reportes.length === 0 && (
                <tr>
                  <td colSpan="10" className="table-empty" style={{ padding: '30px', textAlign: 'center' }}>
                    <div style={{ color: 'var(--fiber-muted)', fontSize: '0.95rem', marginBottom: '10px' }}>
                      {filters.fecha_programada === todayDate() 
                        ? 'No hay reportes programados para hoy.' 
                        : 'No hay reportes para esta fecha o técnico.'}
                    </div>
                    {filters.fecha_programada === todayDate() && (
                      <button 
                        type="button" 
                        className="fiber-link-button" 
                        onClick={() => updateFilter('fecha_programada', 'sin_fecha')}
                        style={{ fontSize: '0.88rem', textDecoration: 'underline', color: 'var(--fiber-primary)', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        Ver reportes sin fecha (pendientes de programar)
                      </button>
                    )}
                  </td>
                </tr>
              )}
              {!loading && reportes.map((reporte) => (
                <tr key={reporte.id}>
                  <td>
                    <strong>{reporte.fecha_programada || 'Sin fecha'}</strong>
                    <span>#{reporte.id}</span>
                  </td>
                  <td>{reporte.comunidad_nombre}</td>
                  <td><span className="soft-pill">{reporte.tipo_reporte}</span></td>
                  <td>
                    <strong>{getSubjectName(reporte)}</strong>
                    <span>{getSubjectDetail(reporte)}</span>
                  </td>
                  <td>{reporte.comentario}</td>
                  <td><span className={`priority-pill ${String(reporte.prioridad).toLowerCase()}`}>{reporte.prioridad}</span></td>
                  <td>
                    <select className="state-select" value={reporte.estado} onChange={(event) => updateEstado(reporte, event.target.value)}>
                      {estados.map((estado) => (
                        <option value={estado} key={estado}>{estado}</option>
                      ))}
                    </select>
                  </td>
                  <td>{reporte.tecnico_nombre || 'Sin asignar'}</td>
                  <td>{reporte.orden_ruta || '-'}</td>
                  <td>
                    <div className="fiber-row-actions">
                      <button type="button" onClick={() => showDetail(reporte)}>Ver</button>
                      <button type="button" onClick={() => openScheduleModal(reporte)}>Agendar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {rutaData.sin_coordenadas.length > 0 && (
        <section className="fiber-panel" style={{ borderColor: '#f59e0b' }}>
          <h3 style={{ marginTop: 0, color: '#b45309' }}>Sin coordenadas ({rutaData.sin_coordenadas.length})</h3>
          <p style={{ color: 'var(--fiber-muted)' }}>Estas comunidades no tienen latitud/longitud valida y no se pintan en el mapa.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
            {rutaData.sin_coordenadas.map((reporte) => (
              <div key={reporte.id} style={{ padding: '10px', borderRadius: '10px', border: '1px solid #fde68a', background: '#fffbeb' }}>
                <strong>#{reporte.id} - {reporte.comunidad_nombre}</strong>
                <p style={{ margin: '4px 0 0', color: 'var(--fiber-muted)' }}>{getSubjectName(reporte)}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function RouteLayer({ group }) {
  const orderedCommunities = [...group.comunidades].sort((a, b) => getCommunityRouteOrder(a) - getCommunityRouteOrder(b))
  const positions = orderedCommunities.map((comunidad) => [comunidad.latitud, comunidad.longitud])

  return (
    <>
      {orderedCommunities.map((comunidad, index) => {
        const markerNumber = getDisplayOrder(comunidad, index)
        const markerColor = getMarkerColor(comunidad, group)

        return (
          <Marker
            key={`${group.tecnico_id}-${comunidad.comunidad_id}`}
            position={[comunidad.latitud, comunidad.longitud]}
            icon={createCommunityIcon(markerNumber, markerColor, comunidad.total_reportes)}
          >
            <Popup>
              <div className="route-popup">
                <h4>{comunidad.comunidad}</h4>
                <p><strong>Tecnico:</strong> {group.tecnico_nombre}</p>
                <p><strong>Reportes:</strong> {comunidad.total_reportes}</p>
                <div className="route-popup-list">
                  {comunidad.reportes.map((reporte, itemIndex) => (
                    <div key={reporte.id}>
                      <strong>{itemIndex + 1}. {reporte.tipo_reporte} - {getSubjectName(reporte)}</strong>
                      <span>{reporte.prioridad} | {reporte.estado}</span>
                      {reporte.comentario && <small>{reporte.comentario}</small>}
                    </div>
                  ))}
                </div>
              </div>
            </Popup>
          </Marker>
        )
      })}
      {!group.isUnassigned && positions.length > 1 && (
        <Polyline positions={positions} color={group.color} weight={4} opacity={0.78} dashArray="8 8" />
      )}
    </>
  )
}

function MapLegend() {
  return (
    <div className="map-legend">
      <span><i style={{ background: markerColors.instalacion }} /> Instalacion</span>
      <span><i style={{ background: markerColors.detalle }} /> Detalle</span>
      <span><i style={{ background: markerColors.sinTecnico }} /> Sin tecnico</span>
      <span><i style={{ background: markerColors.enProceso }} /> En proceso</span>
      <span><i style={{ background: markerColors.pendienteConfirmacion }} /> Pendiente confirmacion</span>
      <span><i style={{ background: markerColors.noLocalizado }} /> No localizado</span>
    </div>
  )
}

function getMarkerColor(comunidad, group) {
  if (group.isUnassigned) return markerColors.sinTecnico

  const estados = comunidad.reportes.map((reporte) => reporte.estado)
  if (estados.includes('NO_LOCALIZADO')) return markerColors.noLocalizado
  if (estados.includes('PENDIENTE_CONFIRMACION')) return markerColors.pendienteConfirmacion
  if (estados.includes('EN_PROCESO')) return markerColors.enProceso
  if (comunidad.reportes.some((reporte) => reporte.tipo_reporte === 'INSTALACION')) return markerColors.instalacion
  return markerColors.detalle
}

function getCommunityRouteOrder(comunidad) {
  const orders = comunidad.reportes
    .map((reporte) => Number(reporte.orden_ruta))
    .filter((value) => Number.isFinite(value) && value > 0)
  return orders.length ? Math.min(...orders) : 9999
}

function getDisplayOrder(comunidad, index) {
  const routeOrder = getCommunityRouteOrder(comunidad)
  return routeOrder === 9999 ? index + 1 : routeOrder
}

function Metric({ label, value }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--fiber-border)', borderRadius: '12px', padding: '12px 14px' }}>
      <span style={{ color: 'var(--fiber-muted)', fontWeight: 700, fontSize: '0.78rem', display: 'block' }}>{label}</span>
      <strong style={{ color: 'var(--fiber-primary-dark)', fontSize: '1.25rem' }}>{value}</strong>
    </div>
  )
}

function getSubjectName(reporte) {
  return reporte.tipo_reporte === 'DETALLE'
    ? reporte.cliente_nombre || 'Cliente sin nombre'
    : reporte.prospecto_nombre || 'Prospecto sin nombre'
}

function getSubjectDetail(reporte) {
  if (reporte.tipo_reporte === 'DETALLE') {
    return [reporte.numero_cliente, reporte.cliente_telefono].filter(Boolean).join(' - ') || 'Sin datos'
  }
  return reporte.prospecto_telefono || 'Sin telefono'
}

function formatMinutes(value) {
  if (!value) return '0 min'
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  return hours > 0 ? `${hours} h ${String(minutes).padStart(2, '0')} min` : `${minutes} min`
}

function getModalDateValue(reporteFecha, filtroFecha) {
  if (reporteFecha && !String(reporteFecha).startsWith('0001')) return String(reporteFecha).slice(0, 10)
  if (filtroFecha && !['todas', 'sin_fecha'].includes(filtroFecha)) return filtroFecha
  return tomorrowDate()
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export default ReportesOperativos
