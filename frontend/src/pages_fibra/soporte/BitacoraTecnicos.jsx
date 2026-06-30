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
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ]
  return `${day} de ${months[monthIdx]} de ${year}`
}

function getEventNodeClass(estado, desc) {
  const e = String(estado).toUpperCase()
  const d = String(desc).toUpperCase()
  if (d.includes('REAGEND') || d.includes('RESTABLEC') || d.includes('REASIGN')) {
    return 'event-node-reagendado'
  }
  switch (e) {
    case 'COMPLETADO': return 'event-node-completado'
    case 'PENDIENTE_CONFIRMACION': return 'event-node-pendiente_confirmacion'
    case 'EN_PROCESO': return 'event-node-en_proceso'
    case 'ASIGNADO':
    case 'PENDIENTE':
      return 'event-node-asignado'
    case 'CANCELADO': return 'event-node-cancelado'
    case 'NO_LOCALIZADO': return 'event-node-no_localizado'
    default: return 'event-node-asignado'
  }
}

function BitacoraTecnicos({ apiUrl, token }) {
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [tecnicoId, setTecnicoId] = useState('todos')
  const [tecnicosDropdown, setTecnicosDropdown] = useState([])
  const [bitacoraData, setBitacoraData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedActividad, setSelectedActividad] = useState(null)

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

  const loadBitacora = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('fecha', fecha)
      params.set('tecnico_id', tecnicoId)

      const response = await fetch(`${apiUrl}/api/bitacora-tecnicos?${params.toString()}`, { headers: authHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudo cargar la bitácora.')
      setBitacoraData(data)
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    } finally {
      setLoading(false)
    }
  }, [apiUrl, authHeaders, fecha, tecnicoId])

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
    total_actividades: 0,
    completadas: 0,
    pendientes_confirmacion: 0,
    en_proceso: 0,
    reagendadas: 0
  }

  const listTecnicos = bitacoraData?.tecnicos ?? []

  return (
    <div className="bitacora-page fiber-page">
      <section className="fiber-page-header">
        <div>
          <span className="fiber-kicker">Auditoría de operaciones</span>
          <h1>Bitácora de técnicos</h1>
        </div>
      </section>

      <section className="bitacora-filters-bar">
        <div className="bitacora-filter-group">
          <label htmlFor="input-fecha">Fecha de consulta</label>
          <input
            id="input-fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
        <div className="bitacora-filter-group">
          <label htmlFor="select-tecnico">Técnico asignado</label>
          <select
            id="select-tecnico"
            value={tecnicoId}
            onChange={(e) => setTecnicoId(e.target.value)}
          >
            <option value="todos">Todos los técnicos</option>
            {tecnicosDropdown.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre_completo}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="fiber-primary-button"
          onClick={loadBitacora}
          style={{ minHeight: 'auto', padding: '12px 24px', borderRadius: '12px' }}
        >
          Consultar
        </button>
      </section>

      <div style={{ padding: '0 8px', fontSize: '0.92rem', color: '#475569', fontWeight: 'bold' }}>
        📅 Viendo actividades del: <span style={{ color: '#4274D9' }}>{formatSpanishDate(fecha)}</span>
      </div>

      <section className="bitacora-summary-grid">
        <div className="bitacora-summary-card" style={{ borderLeft: '4px solid #475569' }}>
          <div className="bitacora-summary-card-value">{resumen.total_actividades}</div>
          <div className="bitacora-summary-card-label">Actividades totales</div>
        </div>
        <div className="bitacora-summary-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="bitacora-summary-card-value">{resumen.completadas}</div>
          <div className="bitacora-summary-card-label">Confirmadas / Completadas</div>
        </div>
        <div className="bitacora-summary-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="bitacora-summary-card-value">{resumen.pendientes_confirmacion}</div>
          <div className="bitacora-summary-card-label">Pendientes de Soporte</div>
        </div>
        <div className="bitacora-summary-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="bitacora-summary-card-value">{resumen.en_proceso}</div>
          <div className="bitacora-summary-card-label">En proceso de campo</div>
        </div>
        <div className="bitacora-summary-card" style={{ borderLeft: '4px solid #f97316' }}>
          <div className="bitacora-summary-card-value">{resumen.reagendadas}</div>
          <div className="bitacora-summary-card-label">Reagendadas / Restablecidas</div>
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {loading && <p style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Cargando bitácora...</p>}

        {!loading && listTecnicos.length === 0 && (
          <div className="bitacora-tech-section" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
            No hay actividades registradas para esta fecha o técnico.
          </div>
        )}

        {!loading && listTecnicos.map((tech) => (
          <div key={tech.tecnico_id} className="bitacora-tech-section">
            <div className="bitacora-tech-header">
              <div className="bitacora-tech-title">{tech.tecnico_nombre}</div>
              <div className="bitacora-tech-stats">
                <span className="bitacora-tech-badge total">Total: {tech.resumen.total}</span>
                <span className="bitacora-tech-badge completada">Completadas: {tech.resumen.completadas}</span>
                <span className="bitacora-tech-badge confirmacion">Pend. Soporte: {tech.resumen.pendientes_confirmacion}</span>
                <span className="bitacora-tech-badge proceso">En proceso: {tech.resumen.en_proceso}</span>
                <span className="bitacora-tech-badge reagendada">Reagendadas: {tech.resumen.reagendadas}</span>
              </div>
            </div>

            {tech.actividades.length === 0 ? (
              <p style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.9rem' }}>Sin actividades registradas.</p>
            ) : (
              <div className="bitacora-timeline">
                {tech.actividades.map((act, index) => (
                  <div key={act.seguimiento_id || index} className={`bitacora-event-node ${getEventNodeClass(act.estado, act.descripcion)}`}>
                    <div className="bitacora-event-card">
                      <div className="bitacora-event-card-header">
                        <div className="bitacora-event-card-time-title">
                          <span className="bitacora-event-time">{act.hora}</span>
                          <span className="bitacora-event-title">{act.descripcion}</span>
                        </div>
                        <div className="bitacora-badges-list">
                          <span className={`bitacora-badge ${String(act.tipo).toLowerCase()}`}>{act.tipo}</span>
                          {act.origen === 'DIRECTA_TECNICO' && (
                            <span className="bitacora-badge imprevista">Instalación imprevista / Sin prospecto previo</span>
                          )}
                          {act.caja && (
                            <span className="bitacora-badge caja">Caja {act.caja} / T{act.terminal}</span>
                          )}
                        </div>
                      </div>

                      <div className="bitacora-event-client-info">
                        <span><strong>Cliente:</strong> {act.cliente}</span>
                        <span><strong>Comunidad:</strong> {act.comunidad}</span>
                        <span><strong>Dirección:</strong> {act.direccion}</span>
                      </div>

                      <div className="bitacora-event-card-footer">
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          {act.contrato_id ? (
                            <button
                              type="button"
                              className="fiber-link-button"
                              onClick={() => handleVerContrato(act.contrato_id)}
                              style={{ fontSize: '0.8rem', padding: 0 }}
                            >
                              📄 Ver Contrato {act.contrato_numero}
                            </button>
                          ) : (
                            act.tipo === 'INSTALACION' && <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Sin contrato</span>
                          )}
                        </div>

                        <button
                          type="button"
                          className="fiber-link-button"
                          onClick={() => setSelectedActividad(act)}
                          style={{ fontSize: '0.82rem', padding: 0, fontWeight: 'bold' }}
                        >
                          Ver detalle completo ➔
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      {selectedActividad && (
        <div className="client-modal-backdrop" onClick={() => setSelectedActividad(null)}>
          <div className="client-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(620px, 100%)', maxHeight: '90vh' }}>
            <div className="client-modal-header">
              <h3>Detalle de Actividad - Reporte #{selectedActividad.reporte_id}</h3>
              <button type="button" onClick={() => setSelectedActividad(null)}>✕</button>
            </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto' }}>
              <div className="bitacora-detail-grid">
                <div className="bitacora-detail-item">
                  <span>Tipo de reporte</span>
                  <strong>{selectedActividad.tipo}</strong>
                </div>
                <div className="bitacora-detail-item">
                  <span>Estado actual</span>
                  <strong>{selectedActividad.estado}</strong>
                </div>
                <div className="bitacora-detail-item">
                  <span>Cliente / Prospecto</span>
                  <strong>{selectedActividad.cliente}</strong>
                </div>
                <div className="bitacora-detail-item">
                  <span>Teléfono</span>
                  <strong>{selectedActividad.telefono}</strong>
                </div>
                <div className="bitacora-detail-item" style={{ gridColumn: '1 / -1' }}>
                  <span>Dirección</span>
                  <strong>{selectedActividad.direccion}</strong>
                </div>
                <div className="bitacora-detail-item">
                  <span>Comunidad</span>
                  <strong>{selectedActividad.comunidad}</strong>
                </div>
                <div className="bitacora-detail-item">
                  <span>Origen de reporte</span>
                  <strong>{selectedActividad.origen === 'DIRECTA_TECNICO' ? 'Instalación imprevista / Sin prospecto' : 'Programado / Prospecto'}</strong>
                </div>
              </div>

              {selectedActividad.tipo === 'INSTALACION' && (
                <>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '12px' }}>
                    Parámetros Técnicos de Instalación
                  </div>
                  <div className="bitacora-detail-grid">
                    <div className="bitacora-detail-item">
                      <span>Caja terminal</span>
                      <strong>{selectedActividad.caja || 'N/A'}</strong>
                    </div>
                    <div className="bitacora-detail-item">
                      <span>Terminal utilizada</span>
                      <strong>{selectedActividad.terminal != null ? `Puerto ${selectedActividad.terminal}` : 'N/A'}</strong>
                    </div>
                    <div className="bitacora-detail-item">
                      <span>Potencia medida</span>
                      <strong>{selectedActividad.potencia != null ? `${selectedActividad.potencia} dBm` : 'N/A'}</strong>
                    </div>
                    <div className="bitacora-detail-item">
                      <span>Fibra instalada</span>
                      <strong>{selectedActividad.metros != null ? `${selectedActividad.metros} metros` : 'N/A'}</strong>
                    </div>
                    <div className="bitacora-detail-item" style={{ gridColumn: '1 / -1' }}>
                      <span>Paquete de instalación</span>
                      <strong>{selectedActividad.paquete || 'N/A'}</strong>
                    </div>
                  </div>
                </>
              )}

              <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '12px' }}>
                Observaciones del Reporte
              </div>
              <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.88rem', color: '#334155', whiteSpace: 'pre-wrap', marginBottom: '24px' }}>
                {selectedActividad.observaciones}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                {selectedActividad.contrato_id && (
                  <button
                    type="button"
                    className="fiber-primary-button"
                    onClick={() => handleVerContrato(selectedActividad.contrato_id)}
                    style={{ minHeight: 'auto', padding: '10px 20px', fontSize: '0.88rem' }}
                  >
                    📄 Ver Contrato PDF
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedActividad(null)}
                  style={{
                    border: '1px solid rgba(6, 26, 51, 0.12)',
                    background: '#ffffff',
                    borderRadius: '12px',
                    padding: '10px 20px',
                    font: 'inherit',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BitacoraTecnicos
