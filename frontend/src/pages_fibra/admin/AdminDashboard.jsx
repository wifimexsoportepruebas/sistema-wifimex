import { useCallback, useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'

const estados = ['PENDIENTE', 'ASIGNADO', 'EN_PROCESO', 'COMPLETADO', 'CANCELADO']
const prioridadPeso = { URGENTE: 4, ALTA: 3, NORMAL: 2, BAJA: 1 }

function AdminDashboard({ apiUrl, token }) {
  const [reportes, setReportes] = useState([])
  const [tecnicos, setTecnicos] = useState([])
  const [comunidades, setComunidades] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const todayKey = getDateKey(new Date())

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
    }),
    [token],
  )

  const loadData = useCallback(async () => {
    setLoading(true)

    try {
      const [reportesResponse, tecnicosResponse, comunidadesResponse] = await Promise.all([
        fetch(`${apiUrl}/api/reportes`, { headers: authHeaders }),
        fetch(`${apiUrl}/api/usuarios/tecnicos`, { headers: authHeaders }),
        fetch(`${apiUrl}/api/comunidades`, { headers: authHeaders }),
      ])

      const reportesData = await reportesResponse.json()
      const tecnicosData = await tecnicosResponse.json()
      const comunidadesData = await comunidadesResponse.json()

      if (!reportesResponse.ok) {
        throw new Error(reportesData.error ?? 'No se pudieron cargar los reportes.')
      }

      setReportes(reportesData.reportes ?? [])
      setTecnicos(tecnicosData.tecnicos ?? [])
      setComunidades(comunidadesData.comunidades ?? [])
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }, [apiUrl, authHeaders])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadData()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadData])

  async function patchReporte(url, body, success) {
    setMessage('')

    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudo actualizar el reporte.')
      }

      setMessage(success)
      await loadData()
    } catch (error) {
      setMessage(error.message)
    }
  }

  function assignTecnico(reporteId, tecnicoId) {
    patchReporte(
      `${apiUrl}/api/reportes/${reporteId}/asignar-tecnico`,
      { tecnico_id: tecnicoId },
      'Tecnico asignado.',
    )
  }

  function changeEstado(reporteId, estado) {
    patchReporte(
      `${apiUrl}/api/reportes/${reporteId}/estado`,
      { estado },
      'Estado actualizado.',
    )
  }

  async function deleteReporte(reporteId) {
    const result = await Swal.fire({
      title: '¿Cancelar reporte?',
      text: 'Esta acción marcará el reporte como CANCELADO.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'No, conservar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
    })

    if (!result.isConfirmed) return

    patchReporte(
      `${apiUrl}/api/reportes/${reporteId}/cancelar`,
      { comentario_cierre: 'Reporte cancelado' },
      'Reporte cancelado.',
    )
  }

  const reportesActivos = reportes.filter((reporte) => !['COMPLETADO', 'CANCELADO'].includes(reporte.estado))
  const reportesHoy = reportesActivos.filter((reporte) => isReporteToday(reporte, todayKey))
  const baseOperativa = reportesHoy.length ? reportesHoy : reportesActivos
  const porAsignar = baseOperativa.filter((reporte) => !reporte.tecnico_id)
  const asignados = baseOperativa.filter((reporte) => reporte.tecnico_id)
  const urgentes = baseOperativa.filter((reporte) => ['URGENTE', 'ALTA'].includes(reporte.prioridad))
  const enProceso = reportesActivos.filter((reporte) => reporte.estado === 'EN_PROCESO')
  const comunidadesRuta = groupReportsByCommunity(baseOperativa, comunidades)
  const mapaCentro = comunidadesRuta[0] ?? comunidades.find((comunidad) => comunidad.latitud && comunidad.longitud)
  const mapaSrc = mapaCentro
    ? buildOsmEmbedUrl(Number(mapaCentro.latitud), Number(mapaCentro.longitud))
    : ''

  return (
    <div className="admin-page control-operativo-page">
      <section className="control-hero">
        <div>
          <span className="section-kicker">Control Operativo</span>
          <h2>Ruta tecnica del dia</h2>
          <p>
            Prioriza localidades con reportes de hoy, identifica urgencias y asigna tecnico con la menor friccion posible.
          </p>
        </div>
        <div className="control-date-card">
          <span>Fecha operativa</span>
          <strong>{formatToday()}</strong>
          <small>{reportesHoy.length ? 'Mostrando agenda de hoy' : 'Sin agenda de hoy: mostrando activos'}</small>
        </div>
      </section>

      {message && <div className="report-message">{message}</div>}

      <section className="control-metrics">
        <MetricCard label="Para ruta" value={baseOperativa.length} tone="blue" />
        <MetricCard label="Sin tecnico" value={porAsignar.length} tone="yellow" />
        <MetricCard label="Prioridad alta" value={urgentes.length} tone="red" />
        <MetricCard label="En proceso" value={enProceso.length} tone="green" />
      </section>

      <section className="control-grid">
        <article className="control-map-card">
          <div className="panel-heading control-heading-row">
            <div>
              <span className="section-kicker">Mapa operativo</span>
              <h3>Localidades con reportes</h3>
            </div>
            <span className="route-pill">{comunidadesRuta.length} parada{comunidadesRuta.length === 1 ? '' : 's'}</span>
          </div>

          <div className="basic-map admin-cluster-map control-map">
            {mapaSrc ? (
              <iframe
                title={`Mapa ${mapaCentro.comunidad_nombre ?? mapaCentro.nombre}`}
                src={mapaSrc}
                loading="lazy"
              />
            ) : (
              <p>No hay comunidades con coordenadas todavia.</p>
            )}

            {comunidadesRuta.map((grupo, index) => (
              <div
                className={`map-cluster ${grupo.urgentes > 0 ? 'multiple' : ''}`}
                key={grupo.comunidad_id}
                style={{
                  left: `${16 + (index % 5) * 17}%`,
                  top: `${22 + (index % 4) * 15}%`,
                }}
              >
                <span>{grupo.total}</span>
                <div className="map-tooltip">
                  <strong>{grupo.comunidad_nombre}</strong>
                  <small>{grupo.urgentes} alta prioridad · {grupo.sinTecnico} sin tecnico</small>
                  {grupo.reportes.slice(0, 4).map((reporte) => (
                    <p key={reporte.id}>#{reporte.id} · {formatCliente(reporte)}</p>
                  ))}
                  {grupo.total > 4 && <em>+{grupo.total - 4} mas</em>}
                </div>
              </div>
            ))}
          </div>

          <p className="map-note">
            La ruta sugerida se ordena por prioridad y cantidad de reportes por localidad. Para trazado real podemos integrar Leaflet/OpenStreetMap despues.
          </p>
        </article>

        <article className="control-route-card">
          <div className="panel-heading">
            <span className="section-kicker">Ruta sugerida</span>
            <h3>Orden por localidad</h3>
          </div>

          <div className="route-list">
            {loading && <p>Cargando localidades...</p>}
            {!loading && comunidadesRuta.length === 0 && <p>No hay reportes activos para armar ruta.</p>}
            {!loading && comunidadesRuta.map((grupo, index) => (
              <div className="route-stop" key={grupo.comunidad_id}>
                <b>{index + 1}</b>
                <div>
                  <strong>{grupo.comunidad_nombre}</strong>
                  <span>{grupo.total} reporte{grupo.total === 1 ? '' : 's'} · {grupo.sinTecnico} sin tecnico</span>
                </div>
                <PriorityBadge prioridad={grupo.prioridadMaxima} />
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="control-work-grid">
        <article className="admin-reportes-card admin-assignment-panel">
          <div className="panel-heading">
            <span className="section-kicker">Asignacion rapida</span>
            <h3>Reportes sin tecnico</h3>
          </div>

          <div className="admin-report-list">
            {loading && <p>Cargando reportes...</p>}
            {!loading && porAsignar.length === 0 && <p>No hay reportes pendientes de tecnico.</p>}
            {!loading && porAsignar.map((reporte) => (
              <ReportAssignmentCard
                key={reporte.id}
                reporte={reporte}
                tecnicos={tecnicos}
                onAssign={assignTecnico}
                onState={changeEstado}
                onDelete={deleteReporte}
              />
            ))}
          </div>
        </article>

        <article className="admin-reportes-card">
          <div className="panel-heading">
            <span className="section-kicker">Seguimiento</span>
            <h3>Ya asignados</h3>
          </div>

          <div className="admin-assigned-grid">
            {loading && <p>Cargando reportes...</p>}
            {!loading && asignados.length === 0 && <p>No hay reportes asignados activos.</p>}
            {!loading && asignados.map((reporte) => (
              <ReportAssignmentCard
                compact
                key={reporte.id}
                reporte={reporte}
                tecnicos={tecnicos}
                onAssign={assignTecnico}
                onState={changeEstado}
                onDelete={deleteReporte}
              />
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}

function MetricCard({ label, value, tone }) {
  return (
    <article className={`control-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function ReportAssignmentCard({ reporte, tecnicos, onAssign, onState, onDelete, compact = false }) {
  return (
    <div className={`admin-report-item control-report-card ${compact ? 'compact' : ''}`}>
      <div>
        <strong>#{reporte.id} · {reporte.comunidad_nombre}</strong>
        <span>{formatCliente(reporte)}</span>
        <small>{formatDateLabel(reporte)} · {reporte.tipo_reporte}</small>
      </div>

      <PriorityBadge prioridad={reporte.prioridad} />

      <select value={reporte.tecnico_id ?? ''} onChange={(event) => onAssign(reporte.id, event.target.value)}>
        <option value="">Sin tecnico</option>
        {tecnicos.map((tecnico) => (
          <option value={tecnico.id} key={tecnico.id}>{tecnico.nombre}</option>
        ))}
      </select>

      <select value={reporte.estado} onChange={(event) => onState(reporte.id, event.target.value)}>
        {estados.map((estado) => (
          <option value={estado} key={estado}>{estado}</option>
        ))}
      </select>

      {['PENDIENTE', 'ASIGNADO'].includes(reporte.estado) && (
        <button type="button" onClick={() => onDelete(reporte.id)}>
          Cancelar
        </button>
      )}
    </div>
  )
}

function PriorityBadge({ prioridad }) {
  return <span className={`priority-pill ${String(prioridad ?? 'NORMAL').toLowerCase()}`}>{prioridad ?? 'NORMAL'}</span>
}

function groupReportsByCommunity(reportes, comunidades) {
  const grouped = new Map()

  for (const comunidad of comunidades) {
    if (!comunidad.latitud || !comunidad.longitud) continue
    grouped.set(String(comunidad.id), {
      comunidad_id: comunidad.id,
      comunidad_nombre: comunidad.nombre,
      latitud: comunidad.latitud,
      longitud: comunidad.longitud,
      reportes: [],
      total: 0,
      urgentes: 0,
      sinTecnico: 0,
      prioridadMaxima: 'BAJA',
      peso: 0,
    })
  }

  for (const reporte of reportes) {
    const key = String(reporte.comunidad_id)

    if (!grouped.has(key) && reporte.comunidad_latitud && reporte.comunidad_longitud) {
      grouped.set(key, {
        comunidad_id: reporte.comunidad_id,
        comunidad_nombre: reporte.comunidad_nombre,
        latitud: reporte.comunidad_latitud,
        longitud: reporte.comunidad_longitud,
        reportes: [],
        total: 0,
        urgentes: 0,
        sinTecnico: 0,
        prioridadMaxima: 'BAJA',
        peso: 0,
      })
    }

    const group = grouped.get(key)
    if (!group) continue
    const peso = prioridadPeso[reporte.prioridad] ?? 2
    group.reportes.push(reporte)
    group.total += 1
    group.peso += peso
    if (peso > (prioridadPeso[group.prioridadMaxima] ?? 1)) group.prioridadMaxima = reporte.prioridad
    if (['URGENTE', 'ALTA'].includes(reporte.prioridad)) group.urgentes += 1
    if (!reporte.tecnico_id) group.sinTecnico += 1
  }

  return Array.from(grouped.values())
    .filter((group) => group.total > 0)
    .sort((a, b) => b.peso - a.peso || b.total - a.total || a.comunidad_nombre.localeCompare(b.comunidad_nombre))
}

function isReporteToday(reporte, todayKey) {
  const programmed = getDateKey(reporte.fecha_programada)
  const reported = getDateKey(reporte.fecha_reportada)
  return programmed === todayKey || reported === todayKey
}

function getDateKey(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function formatDateLabel(reporte) {
  if (reporte.fecha_programada) return `Agenda ${getDateKey(reporte.fecha_programada)}`
  return `Reportado ${getDateKey(reporte.fecha_reportada)}`
}

function formatToday() {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
  }).format(new Date())
}

function formatCliente(reporte) {
  if (reporte.cliente_nombre) {
    return `${reporte.numero_cliente} - ${reporte.cliente_nombre}`
  }

  if (reporte.prospecto_nombre) {
    return `Prospecto - ${reporte.prospecto_nombre}`
  }

  return 'Sin cliente/prospecto'
}

function buildOsmEmbedUrl(latitud, longitud) {
  const offset = 0.035
  const left = longitud - offset
  const right = longitud + offset
  const top = latitud + offset
  const bottom = latitud - offset

  return `https://www.openstreetmap.org/export/embed.html?bbox=${left},${bottom},${right},${top}&layer=mapnik&marker=${latitud},${longitud}`
}

export default AdminDashboard
