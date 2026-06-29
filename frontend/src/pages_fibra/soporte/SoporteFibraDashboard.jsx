import { useCallback, useEffect, useMemo, useState } from 'react'
import RutaOperativa from './RutaOperativa.jsx'

const estadosSoporte = ['ASIGNADO', 'EN_PROCESO', 'CANCELADO']

function SoporteFibraDashboard({ apiUrl, token }) {
  const [reportes, setReportes] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
    }),
    [token],
  )

  const loadReportes = useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetch(`${apiUrl}/api/reportes`, {
        headers: authHeaders,
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudieron cargar los reportes.')
      }

      setReportes((data.reportes ?? []).filter((reporte) => (
        ['ASIGNADO', 'EN_PROCESO', 'PENDIENTE'].includes(reporte.estado)
      )))
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }, [apiUrl, authHeaders])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReportes()
  }, [loadReportes])

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
      await loadReportes()
    } catch (error) {
      setMessage(error.message)
    }
  }

  function programar(reporte, fecha, estado = reporte.estado === 'PENDIENTE' ? 'ASIGNADO' : reporte.estado) {
    patchReporte(
      `${apiUrl}/api/reportes/${reporte.id}/programacion`,
      { fecha_programada: fecha, estado },
      'Programacion actualizada.',
    )
  }

  function cambiarEstado(reporte, estado) {
    if (estado === 'CANCELADO') {
      patchReporte(
        `${apiUrl}/api/reportes/${reporte.id}/estado`,
        { estado },
        'Reporte cancelado.',
      )
      return
    }

    patchReporte(
      `${apiUrl}/api/reportes/${reporte.id}/estado`,
      { estado },
      'Estado actualizado.',
    )
  }

  function cerrarReporte(reporteId) {
    const solucion = window.prompt('Solucion del reporte:')

    if (!solucion) return

    patchReporte(
      `${apiUrl}/api/reportes/${reporteId}/cerrar`,
      { solucion },
      'Reporte cerrado.',
    )
  }

  const programadosHoy = reportes.filter((reporte) => isToday(reporte.fecha_programada)).length
  const sinFecha = reportes.filter((reporte) => !reporte.fecha_programada).length
  const enProceso = reportes.filter((reporte) => reporte.estado === 'EN_PROCESO').length
  const mapReporte = reportes.find((reporte) => reporte.comunidad_latitud && reporte.comunidad_longitud)
  const mapSrc = mapReporte
    ? buildOsmEmbedUrl(Number(mapReporte.comunidad_latitud), Number(mapReporte.comunidad_longitud))
    : ''

  return (
    <div className="soporte-page">
      <section className="admin-hero">
        <div>
          <span className="section-kicker">Soporte Fibra</span>
          <h2>Seguimiento de rutas tecnicas</h2>
          <p>Programa visitas, reagenda si cambia el dia y da seguimiento a reportes asignados.</p>
        </div>
      </section>

      {message && <div className="report-message">{message}</div>}

      <section className="admin-metrics">
        <article><span>Para hoy</span><strong>{programadosHoy}</strong></article>
        <article><span>Sin fecha</span><strong>{sinFecha}</strong></article>
        <article><span>En proceso</span><strong>{enProceso}</strong></article>
        <article><span>Total visible</span><strong>{reportes.length}</strong></article>
      </section>

      <section className="soporte-grid">
        <article className="admin-reportes-card">
          <div className="panel-heading">
            <span className="section-kicker">Agenda</span>
            <h3>Reportes asignados y pendientes</h3>
          </div>

          <div className="support-report-list">
            {loading && <p>Cargando reportes...</p>}
            {!loading && reportes.length === 0 && <p>No hay reportes para seguimiento.</p>}

            {!loading && reportes.map((reporte) => (
              <div className="support-report-item" key={reporte.id}>
                <div className="support-report-main">
                  <strong>#{reporte.id} · {reporte.comunidad_nombre}</strong>
                  <span>{formatCliente(reporte)}</span>
                  <small>{reporte.tecnico_nombre || 'Sin tecnico asignado'} · {reporte.tipo_reporte}</small>
                </div>

                <label>
                  Fecha
                  <input
                    type="date"
                    value={toDateInput(reporte.fecha_programada)}
                    onChange={(event) => programar(reporte, event.target.value)}
                  />
                </label>

                <label>
                  Estado
                  <select value={reporte.estado} onChange={(event) => cambiarEstado(reporte, event.target.value)}>
                    {estadosSoporte.map((estado) => (
                      <option value={estado} key={estado}>{estado}</option>
                    ))}
                  </select>
                </label>

                <button type="button" onClick={() => cerrarReporte(reporte.id)}>
                  Cerrar
                </button>
              </div>
            ))}
          </div>
        </article>

      </section>

      <section style={{ marginTop: '30px' }}>
        <RutaOperativa apiUrl={apiUrl} token={token} />
      </section>
    </div>
  )
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

function toDateInput(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function isToday(value) {
  if (!value) return false
  const today = new Date().toISOString().slice(0, 10)
  return toDateInput(value) === today
}

function buildOsmEmbedUrl(latitud, longitud) {
  const offset = 0.025
  const left = longitud - offset
  const right = longitud + offset
  const top = latitud + offset
  const bottom = latitud - offset

  return `https://www.openstreetmap.org/export/embed.html?bbox=${left},${bottom},${right},${top}&layer=mapnik&marker=${latitud},${longitud}`
}

export default SoporteFibraDashboard
