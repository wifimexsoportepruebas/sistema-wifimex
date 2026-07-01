import { useCallback, useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'
import '../../styles/BitacoraTecnicos.css'

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

function BitacoraTecnicos({ apiUrl, token }) {
  const [fecha, setFecha] = useState(todayInputDate)
  const [tecnicoId, setTecnicoId] = useState('todos')
  const [estado, setEstado] = useState('todos')
  const [tecnicosDropdown, setTecnicosDropdown] = useState([])
  const [bitacoraData, setBitacoraData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedTrabajo, setSelectedTrabajo] = useState(null)

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const loadTecnicos = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/bitacora-tecnicos/tecnicos`, { headers: authHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudieron cargar los tecnicos.')
      setTecnicosDropdown(data.usuarios ?? [])
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    }
  }, [apiUrl, authHeaders])

  const loadBitacora = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('fecha', fecha)
      params.set('tecnico_id', tecnicoId)
      params.set('estado', estado)

      const response = await fetch(`${apiUrl}/api/bitacora-tecnicos?${params.toString()}`, { headers: authHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudo cargar la bitacora.')
      setBitacoraData(data)
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    } finally {
      setLoading(false)
    }
  }, [apiUrl, authHeaders, fecha, tecnicoId, estado])

  useEffect(() => {
    loadTecnicos()
  }, [loadTecnicos])

  useEffect(() => {
    loadBitacora()
  }, [loadBitacora])

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
    ? 'No hay trabajos terminados para esta fecha.'
    : 'Este tecnico no tiene trabajos terminados en esta fecha.'

  return (
    <div className="bitacora-page fiber-page">
      <section className="fiber-page-header">
        <div>
          <span className="fiber-kicker">Auditoria de operaciones</span>
          <h1>Bitacora de tecnicos</h1>
          <p>Trabajos terminados por tecnico en la fecha seleccionada.</p>
        </div>
      </section>

      <section className="bitacora-filters-bar">
        <div className="bitacora-filter-group">
          <label htmlFor="input-fecha">Fecha</label>
          <input
            id="input-fecha"
            type="date"
            value={fecha}
            onChange={(event) => setFecha(event.target.value)}
          />
        </div>
        <div className="bitacora-filter-group">
          <label htmlFor="select-tecnico">Tecnico</label>
          <select
            id="select-tecnico"
            value={tecnicoId}
            onChange={(event) => setTecnicoId(event.target.value)}
          >
            <option value="todos">Todos los tecnicos</option>
            {tecnicosDropdown.map((tecnico) => (
              <option key={tecnico.id} value={tecnico.id}>{tecnico.nombre_completo}</option>
            ))}
          </select>
        </div>
        <div className="bitacora-filter-group">
          <label htmlFor="select-estado">Estado</label>
          <select
            id="select-estado"
            value={estado}
            onChange={(event) => setEstado(event.target.value)}
          >
            <option value="todos">Todos los terminados</option>
            <option value="pendientes_confirmacion">Pendientes de confirmacion</option>
            <option value="confirmados">Confirmados</option>
          </select>
        </div>
        <button
          type="button"
          className="fiber-primary-button"
          onClick={loadBitacora}
        >
          Consultar
        </button>
      </section>

      <div className="bitacora-current-date">
        Viendo trabajos terminados del <strong>{formatSpanishDate(fecha)}</strong>
      </div>

      <section className="bitacora-summary-grid">
        <SummaryCard value={resumen.total_terminados} label="Total terminados" tone="total" />
        <SummaryCard value={resumen.pendientes_confirmacion} label="Pendientes de confirmacion" tone="pending" />
        <SummaryCard value={resumen.confirmados} label="Confirmados" tone="confirmed" />
        <SummaryCard value={resumen.tecnicos_con_actividad} label="Tecnicos activos" tone="techs" />
        <SummaryCard value={formatCurrency(resumen.total_costo_instalacion)} label="Total cobrado por instalaciones" tone="money" />
      </section>

      <section className="bitacora-tech-list">
        {loading && <p className="bitacora-empty">Cargando bitacora...</p>}

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
    return (
      <article className="bitacora-tech-section empty">
        <div className="bitacora-tech-header">
          <div>
            <h2 className="bitacora-tech-title">{tecnico.tecnico_nombre}</h2>
            <p>Sin trabajos terminados en esta fecha.</p>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className="bitacora-tech-section">
      <div className="bitacora-tech-header">
        <div>
          <h2 className="bitacora-tech-title">{tecnico.tecnico_nombre}</h2>
          <p>Trabajos completados: {tecnico.resumen.total_terminados}</p>
        </div>
        <div className="bitacora-tech-stats">
          <span className="bitacora-tech-badge total">Total: {tecnico.resumen.total_terminados}</span>
          <span className="bitacora-tech-badge confirmacion">Pendientes: {tecnico.resumen.pendientes_confirmacion}</span>
          <span className="bitacora-tech-badge completada">Confirmados: {tecnico.resumen.confirmados}</span>
          <span className="bitacora-tech-badge money">Cobrado: {formatCurrency(tecnico.resumen.total_costo_instalacion)}</span>
        </div>
      </div>

      <div className="bitacora-work-list">
        {tecnico.trabajos.map((trabajo) => (
          <div className="bitacora-work-card" key={trabajo.reporte_id}>
            <div className="bitacora-work-time">{trabajo.hora}</div>
            <div className="bitacora-work-body">
              <div className="bitacora-work-title-row">
                <div>
                  <h3>{getWorkTitle(trabajo)}</h3>
                  <p>Cliente: {trabajo.cliente}</p>
                </div>
                <EstadoBadge estado={trabajo.estado} label={trabajo.estado_label} />
              </div>

              <div className="bitacora-work-meta">
                <span>Comunidad: {trabajo.comunidad}</span>
                <span>Direccion: {trabajo.direccion}</span>
                <span>Costo instalacion: {formatCurrency(trabajo.contrato_costo_instalacion)}</span>
                {trabajo.es_imprevista && <span>Instalacion imprevista</span>}
              </div>

              <div className="bitacora-work-actions">
                {trabajo.contrato_id ? (
                  <button type="button" className="fiber-link-button" onClick={() => onVerContrato(trabajo.contrato_id)}>
                    Ver contrato {trabajo.contrato_numero}
                  </button>
                ) : (
                  trabajo.tipo_reporte === 'INSTALACION' && <span className="bitacora-muted">Sin contrato</span>
                )}
                <button type="button" className="fiber-secondary-button" onClick={() => onVerDetalle(trabajo)}>
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
      <div className="client-modal bitacora-detail-modal" onClick={(event) => event.stopPropagation()}>
        <div className="client-modal-header">
          <h3>Detalle del reporte #{detalle.reporte_id}</h3>
          <button type="button" onClick={onClose}>x</button>
        </div>

        <div className="bitacora-detail-content">
          <DetailSection title="Datos del reporte">
            <DetailItem label="Tipo" value={detalle.tipo_reporte} />
            <DetailItem label="Estado actual" value={detalle.estado_label || detalle.estado_actual} />
            <DetailItem label="Tecnico" value={detalle.tecnico} />
            <DetailItem label="Cliente / Prospecto" value={detalle.cliente} />
            <DetailItem label="Telefono" value={detalle.telefono} />
            <DetailItem label="Comunidad" value={detalle.comunidad} />
            <DetailItem label="Direccion" value={detalle.direccion} wide />
            <DetailItem label="Referencia" value={detalle.referencia} wide />
          </DetailSection>

          <DetailSection title="Fechas">
            <DetailItem label="Reportado" value={formatDateTime(detalle.fecha_reportada)} />
            <DetailItem label="Asignacion" value={formatDateTime(detalle.fecha_asignacion)} />
            <DetailItem label="Programado" value={formatDateTime(detalle.fecha_programada)} />
            <DetailItem label="Inicio" value={formatDateTime(detalle.fecha_inicio)} />
            <DetailItem label="Cierre tecnico" value={formatDateTime(detalle.fecha_cierre_tecnico)} />
            <DetailItem label="Confirmacion" value={formatDateTime(detalle.fecha_confirmacion)} />
          </DetailSection>

          {detalle.tipo_reporte === 'INSTALACION' && (
            <>
              <DetailSection title="Datos tecnicos">
                <DetailItem label="Caja" value={detalle.caja} />
                <DetailItem label="Terminal" value={detalle.terminal} />
                <DetailItem label="Puerto" value={detalle.puerto} />
                <DetailItem label="Potencia" value={detalle.potencia != null ? `${detalle.potencia} dBm` : 'N/A'} />
                <DetailItem label="Alfanumerico" value={detalle.alfanumerico_equipo} />
                <DetailItem label="Paquete" value={detalle.paquete} />
                <DetailItem label="Costo de instalacion cobrado" value={formatCurrency(detalle.contrato_costo_instalacion)} />
              </DetailSection>

              <DetailSection title="Materiales usados">
                <DetailItem label="Fibra optica" value={`${detalle.materiales?.fibra_optica_metros ?? 0} m`} />
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
            <DetailItem label="Instalacion imprevista" value={detalle.es_imprevista ? 'Si' : 'No'} />
            <DetailItem label="Contrato" value={detalle.contrato_numero || 'N/A'} />
          </DetailSection>

          <section className="bitacora-log-section">
            <h4>Seguimientos</h4>
            {(detalle.logs ?? []).length === 0 ? (
              <p className="bitacora-muted">Sin seguimientos registrados.</p>
            ) : (
              <div className="bitacora-log-list">
                {detalle.logs.map((log) => (
                  <div className="bitacora-log-item" key={log.seguimiento_id}>
                    <span>{formatDateTime(log.fecha)}</span>
                    <strong>{log.estado}</strong>
                    <p>{log.comentario}</p>
                    <small>{log.usuario}</small>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="bitacora-detail-actions">
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
    <section className="bitacora-detail-section">
      <h4>{title}</h4>
      <div className="bitacora-detail-grid">{children}</div>
    </section>
  )
}

function DetailItem({ label, value, wide = false }) {
  return (
    <div className={`bitacora-detail-item ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      <strong>{value ?? 'N/A'}</strong>
    </div>
  )
}

function getWorkTitle(trabajo) {
  if (trabajo.tipo_reporte === 'INSTALACION') return 'Instalacion completada'
  return 'Soporte completado'
}

export default BitacoraTecnicos
