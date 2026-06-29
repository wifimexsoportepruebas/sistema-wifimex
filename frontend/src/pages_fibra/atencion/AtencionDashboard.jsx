import React from 'react'

function AtencionDashboard({ apiUrl, token, usuario }) {
  return (
    <div className="atencion-dashboard">
      <section className="admin-hero">
        <div>
          <span className="section-kicker">Atención a Clientes</span>
          <h2>Panel de Atención</h2>
          <p>Bienvenido al módulo de Atención a Clientes. Desde aquí podrás gestionar el primer contacto con los clientes, registrar solicitudes y dar seguimiento.</p>
        </div>
      </section>

      <section className="workspace-grid" aria-label="Información de atención" style={{ marginTop: '24px' }}>
        <article className="work-panel work-panel--large" style={{ gridColumn: 'span 3', padding: '30px', textAlign: 'center', background: '#ffffff', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '40px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>Módulo en preparación</h3>
            <p style={{ color: '#64748b', maxWidth: '460px', margin: '0 auto 20px', fontSize: '0.95rem', lineHeight: '1.6' }}>
              Estamos configurando las métricas de atención rápida, prospectos calificados y accesos directos para agilizar el registro.
            </p>
            <span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: '100px', background: '#eef4fb', color: '#0077c8', fontSize: '0.8rem', fontWeight: '750' }}>Próximamente</span>
          </div>
        </article>
      </section>
    </div>
  )
}

export default AtencionDashboard
