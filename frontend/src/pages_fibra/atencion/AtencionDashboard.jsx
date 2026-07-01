import { useState, useEffect } from 'react'
import '../../styles/AtencionDashboard.css'

function AtencionDashboard({ apiUrl, token, usuario, onNavigate }) {
  const displayName = getDisplayName(usuario)

  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    async function loadStats() {
      setLoadingStats(true)
      setLoadError('')
      try {
        const hoy = getLocalDateString()
        const response = await fetch(`${apiUrl}/api/atencion/dashboard-resumen?fecha=${hoy}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'Error al cargar resumen.')
        setStats(data)
      } catch (err) {
        console.error('Stats loading failed:', err)
        setLoadError('No se pudo cargar el resumen.')
      } finally {
        setLoadingStats(false)
      }
    }

    loadStats()
  }, [apiUrl, token])

  return (
    <div className="atencion-dashboard">
      
      {/* Hero Header */}
      <section className="admin-hero">
        <div>
          <span className="section-kicker">Atención a Clientes</span>
          <h2>¡Hola, {displayName}!</h2>
          <p>Bienvenido al módulo de Atención a Clientes. Desde aquí puedes registrar prospectos, consultar clientes, dar de alta clientes y levantar reportes.</p>
          <div className="session-info-badge" style={{ marginTop: '12px', display: 'inline-block', fontSize: '0.8rem', fontWeight: 'bold', background: 'rgba(255,255,255,0.15)', color: '#ffffff', padding: '4px 12px', borderRadius: '20px' }}>
            Sesión activa como: {displayName} (Atención a Cliente)
          </div>
        </div>
      </section>

      {/* Quick Actions Grid */}
      <section className="dashboard-grid-section" style={{ marginTop: '28px' }}>
        <h3 className="section-title">Accesos Rápidos</h3>
        <div className="quick-actions-grid">
          
          <div className="action-card" onClick={() => onNavigate?.('prospectos')}>
            <div className="action-card-icon pr">PR</div>
            <div className="action-card-content">
              <h4>Prospectos</h4>
              <p>Consulta y da seguimiento a prospectos registrados.</p>
              <button type="button" className="action-card-btn">Ir a prospectos</button>
            </div>
          </div>

          <div className="action-card" onClick={() => onNavigate?.('clientes-ver')}>
            <div className="action-card-icon lc">LC</div>
            <div className="action-card-content">
              <h4>Lista de clientes</h4>
              <p>Busca clientes por nombre, número o comunidad.</p>
              <button type="button" className="action-card-btn">Ver clientes</button>
            </div>
          </div>

          <div className="action-card" onClick={() => onNavigate?.('clientes-alta')}>
            <div className="action-card-icon ac">AC</div>
            <div className="action-card-content">
              <h4>Alta de cliente</h4>
              <p>Registra un nuevo cliente en el sistema.</p>
              <button type="button" className="action-card-btn">Registrar cliente</button>
            </div>
          </div>

          <div className="action-card" onClick={() => onNavigate?.('reportes-atencion')}>
            <div className="action-card-icon ar">AR</div>
            <div className="action-card-content">
              <h4>Alta de reporte</h4>
              <p>Levanta reportes de atención, soporte o instalación.</p>
              <button type="button" className="action-card-btn">Crear reporte</button>
            </div>
          </div>

        </div>
      </section>

      {/* Error / Loading Indicators */}
      {loadError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', padding: '16px', borderRadius: '12px', marginTop: '24px', fontWeight: 'bold', fontSize: '0.92rem', textAlign: 'center' }}>
          {loadError}
        </div>
      )}

      {/* Resumen de hoy */}
      <section className="dashboard-grid-section" style={{ marginTop: '28px' }}>
        <h3 className="section-title">Resumen de hoy</h3>
        <div className="stats-summary-grid">
          
          <div className="stat-card">
            <div className="stat-card-value">
              {loadingStats ? '...' : (stats?.prospectos_hoy ?? 0)}
            </div>
            <div className="stat-card-label">Prospectos registrados hoy</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-value">
              {loadingStats ? '...' : (stats?.clientes_hoy ?? 0)}
            </div>
            <div className="stat-card-label">Clientes registrados hoy</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-value">
              {loadingStats ? '...' : (stats?.reportes_creados_hoy ?? 0)}
            </div>
            <div className="stat-card-label">Reportes creados hoy</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-value">
              {loadingStats ? '...' : (stats?.reportes_completados_hoy ?? 0)}
            </div>
            <div className="stat-card-label">Reportes completados hoy</div>
          </div>

        </div>
      </section>

      {/* Resumen general */}
      <section className="dashboard-grid-section" style={{ marginTop: '28px' }}>
        <h3 className="section-title">Resumen general</h3>
        <div className="stats-summary-grid">
          
          <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
            <div className="stat-card-value" style={{ color: '#3b82f6' }}>
              {loadingStats ? '...' : (stats?.total_clientes ?? 0)}
            </div>
            <div className="stat-card-label">Total clientes</div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
            <div className="stat-card-value" style={{ color: '#10b981' }}>
              {loadingStats ? '...' : (stats?.total_prospectos ?? 0)}
            </div>
            <div className="stat-card-label">Total prospectos</div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid #eab308' }}>
            <div className="stat-card-value" style={{ color: '#d97706' }}>
              {loadingStats ? '...' : (stats?.reportes_pendientes ?? 0)}
            </div>
            <div className="stat-card-label">Reportes pendientes</div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
            <div className="stat-card-value" style={{ color: '#8b5cf6' }}>
              {loadingStats ? '...' : (stats?.reportes_en_proceso ?? 0)}
            </div>
            <div className="stat-card-label">Reportes en proceso</div>
          </div>

        </div>
      </section>

      {/* Work of the day */}
      <section className="work-day-section" style={{ marginTop: '28px', background: '#f8fafc', padding: '24px', borderRadius: '14px', border: '1px solid #cbd5e1' }}>
        <h3 style={{ margin: '0 0 10px', fontSize: '1.1rem', color: '#1e293b', fontWeight: 'bold' }}>Trabajo del día</h3>
        <p style={{ margin: 0, color: '#475569', fontSize: '0.92rem', lineHeight: '1.6' }}>
          Revisa los prospectos pendientes de asignación, atiende solicitudes de clientes recurrentes y registra reportes nuevos de incidencias a soporte técnico o solicitudes de instalación utilizando los accesos rápidos de la parte superior.
        </p>
      </section>

    </div>
  )
}

function getLocalDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDisplayName(usuario) {
  const nombre = usuario?.nombre || usuario?.nombres
  if (nombre) return String(nombre).trim()
  if (usuario?.numero_empleado) return String(usuario.numero_empleado).trim()
  return 'Atención'
}

export default AtencionDashboard
