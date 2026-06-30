import { useEffect, useState } from 'react'
import Sidebar from '../../fragments/Sidebar.jsx'
import Navbar from '../../fragments/Navbar.jsx'
import ReportesAtencion from '../reportes/ReportesAtencion.jsx'
import ReportesOperativos from '../reportes/ReportesOperativos.jsx'
import TecnicoDashboard from '../tecnico/TecnicoDashboard.jsx'
import AtencionDashboard from '../atencion/AtencionDashboard.jsx'
import Empleados from '../admin/Empleados.jsx'
import ClientesAlta from '../clientes/ClientesAlta.jsx'
import ClientesLista from '../clientes/ClientesLista.jsx'
import CajasFibra from '../infraestructura/CajasFibra.jsx'
import Prospectos from '../prospectos/Prospectos.jsx'
import CajasCercanas from '../tecnico/CajasCercanas.jsx'
import BitacoraTecnicos from '../soporte/BitacoraTecnicos.jsx'
import Comunidades from '../comunidades/Comunidades.jsx'

const roleProfiles = {
  ADMIN: { label: 'Administracion' },
  ATENCION_CLIENTE: { label: 'Atencion a cliente' },
  TECNICO_FIBRA: { label: 'Tecnico fibra' },
  TECNICO: { label: 'Tecnico' },
  SOPORTE_FIBRA: { label: 'Soporte fibra' },
  SOPORTE: { label: 'Soporte' },
}

function getPrimaryRole(roles) {
  if (roles.includes('ADMIN')) return 'ADMIN'
  return roles[0] ?? 'SIN_ROL'
}

function Dashboard({ apiUrl, token, usuario, roles, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeView, setActiveView] = useState(() => getViewFromHash())
  const primaryRole = getPrimaryRole(roles)
  const profile = roleProfiles[primaryRole] ?? roleProfiles.SOPORTE
  const homeView = getRoleHomeView(roles)
  const canUseClientes = roles.some((role) => ['ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'].includes(role))
  const canUseProspectos = roles.some((role) => ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'].includes(role))
  const canCreateReportes = roles.some((role) => ['ADMIN', 'ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'].includes(role))
  const canUseRutaOperativa = roles.includes('ADMIN')
  const canUseInfraestructura = roles.some((role) => ['ADMIN', 'SOPORTE', 'SOPORTE_FIBRA'].includes(role))
  const canUseCajasCercanas = roles.some((role) => ['TECNICO', 'TECNICO_FIBRA', 'ADMIN'].includes(role))
  const canUseBitacora = roles.some((role) => ['ADMIN', 'SOPORTE', 'SOPORTE_FIBRA'].includes(role))
  const canUseComunidades = roles.some((role) => ['ADMIN', 'SOPORTE', 'SOPORTE_FIBRA'].includes(role))

  useEffect(() => {
    function syncViewFromHash() {
      setActiveView(getViewFromHash())
    }

    window.addEventListener('hashchange', syncViewFromHash)
    return () => window.removeEventListener('hashchange', syncViewFromHash)
  }, [])

  function handleNavigate(view) {
    const nextHash = view === 'dashboard' ? '#dashboard' : `#${view}`
    setActiveView(view)

    if (window.location.hash !== nextHash) {
      window.history.pushState(null, '', nextHash)
    }
  }

  return (
    <main className={`dashboard-shell ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <Sidebar
        open={sidebarOpen}
        roles={roles}
        activeView={activeView}
        homeView={homeView}
        onNavigate={handleNavigate}
        onClose={() => setSidebarOpen(false)}
      />

      <section className="dashboard-main">
        <Navbar
          usuario={usuario}
          primaryRole={profile.label}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((current) => !current)}
          onLogout={onLogout}
        />

        {activeView === 'admin' ? (
          <div className="dashboard-content">
            {primaryRole === 'ADMIN' ? <AdminHome onNavigate={handleNavigate} /> : <AccessDenied title="Panel admin" />}
          </div>
        ) : activeView === 'atencion' ? (
          <div className="dashboard-content">
            {roles.includes('ATENCION_CLIENTE') ? (
              <RoleHome
                kicker="Atencion al cliente"
                title="Panel de atencion"
                actionLabel="Alta de reporte"
                onAction={() => handleNavigate('reportes-atencion')}
              />
            ) : <AccessDenied title="Panel de atencion" />}
          </div>
        ) : activeView === 'soporte' ? (
          <div className="dashboard-content">
            {roles.some((role) => ['SOPORTE', 'SOPORTE_FIBRA'].includes(role)) ? <RoleHome kicker="Soporte" title="Panel de soporte" /> : <AccessDenied title="Panel de soporte" />}
          </div>
        ) : activeView === 'reportes-operativos' || activeView === 'ruta-operativa' ? (
          <div className="dashboard-content">
            {canUseRutaOperativa ? <ReportesOperativos apiUrl={apiUrl} token={token} roles={roles} /> : <AccessDenied title="Ruta operativa" />}
          </div>
        ) : activeView === 'empleados' ? (
          <div className="dashboard-content">
            {primaryRole === 'ADMIN' ? <Empleados apiUrl={apiUrl} token={token} /> : <AccessDenied title="Empleados" />}
          </div>
        ) : activeView === 'infraestructura-cajas' ? (
          <div className="dashboard-content">
            {canUseInfraestructura ? <CajasFibra apiUrl={apiUrl} token={token} /> : <AccessDenied title="Cajas de fibra" />}
          </div>
        ) : activeView === 'reportes-atencion' || activeView === 'soporte-fibra' ? (
          <div className="dashboard-content">
            {canCreateReportes ? <ReportesAtencion apiUrl={apiUrl} token={token} roles={roles} /> : <AccessDenied title="Reportes" />}
          </div>
        ) : activeView === 'tecnico' ? (
          <div className="dashboard-content">
            <TecnicoDashboard apiUrl={apiUrl} token={token} usuario={usuario} />
          </div>
        ) : activeView === 'clientes-alta' ? (
          <div className="dashboard-content">
            {canUseClientes ? <ClientesAlta apiUrl={apiUrl} token={token} /> : <AccessDenied title="Clientes" />}
          </div>
        ) : activeView === 'clientes-ver' ? (
          <div className="dashboard-content">
            {canUseClientes ? <ClientesLista apiUrl={apiUrl} token={token} roles={roles} /> : <AccessDenied title="Clientes" />}
          </div>
        ) : activeView === 'cajas-cercanas' ? (
          <div className="dashboard-content">
            {canUseCajasCercanas ? <CajasCercanas apiUrl={apiUrl} token={token} roles={roles} /> : <AccessDenied title="Cajas cercanas" />}
          </div>
        ) : activeView === 'bitacora-tecnicos' ? (
          <div className="dashboard-content">
            {canUseBitacora ? <BitacoraTecnicos apiUrl={apiUrl} token={token} /> : <AccessDenied title="Bitácora de técnicos" />}
          </div>
        ) : activeView === 'comunidades' ? (
          <div className="dashboard-content">
            {canUseComunidades ? <Comunidades apiUrl={apiUrl} token={token} /> : <AccessDenied title="Comunidades" />}
          </div>
        ) : activeView === 'prospectos' ? (
          <div className="dashboard-content">
            {canUseProspectos ? <Prospectos apiUrl={apiUrl} token={token} roles={roles} /> : <AccessDenied title="Prospectos" />}
          </div>
        ) : (
          <div className="dashboard-content">
            {primaryRole === 'ADMIN' && <AdminHome onNavigate={handleNavigate} />}
            {primaryRole === 'ATENCION_CLIENTE' && (
              <RoleHome
                kicker="Atencion al cliente"
                title="Panel de atencion"
                actionLabel="Alta de reporte"
                onAction={() => handleNavigate('reportes-atencion')}
              />
            )}
            {(primaryRole === 'SOPORTE' || primaryRole === 'SOPORTE_FIBRA') && <RoleHome kicker="Soporte" title="Panel de soporte" />}
            {(primaryRole === 'TECNICO' || primaryRole === 'TECNICO_FIBRA') && <TecnicoDashboard apiUrl={apiUrl} token={token} usuario={usuario} />}
          </div>
        )}
      </section>
    </main>
  )
}

function AdminHome({ onNavigate }) {
  return (
    <section className="admin-empty-home">
      <span className="section-kicker">Dashboard admin</span>
      <h2>Panel principal</h2>
      <p>Este espacio queda reservado para indicadores generales, resumen financiero, clientes y crecimiento operativo.</p>
      <div className="admin-home-actions">
        <button type="button" className="fiber-primary-button" onClick={() => onNavigate('reportes-operativos')}>
          Ruta operativa
        </button>
        <button type="button" className="fiber-secondary-button" onClick={() => onNavigate('empleados')}>
          Empleados
        </button>
        <button type="button" className="fiber-secondary-button" onClick={() => onNavigate('prospectos')}>
          Prospectos
        </button>
      </div>
    </section>
  )
}

function RoleHome({ kicker, title, actionLabel, onAction }) {
  return (
    <section className="admin-empty-home">
      <span className="section-kicker">{kicker}</span>
      <h2>{title}</h2>
      <p>Modulo en construccion.</p>
      {actionLabel && onAction && (
        <button type="button" className="fiber-primary-button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </section>
  )
}

function AccessDenied({ title }) {
  return (
    <section className="access-denied-card">
      <span className="section-kicker">Acceso restringido</span>
      <h2>{title}</h2>
      <p>Tu rol no tiene permisos para abrir este modulo.</p>
    </section>
  )
}

function getViewFromHash() {
  const view = window.location.hash.replace('#', '')
  return view || 'dashboard'
}

function getRoleHomeView(roles) {
  if (roles.includes('ADMIN')) return 'admin'
  if (roles.includes('ATENCION_CLIENTE')) return 'atencion'
  if (roles.includes('SOPORTE') || roles.includes('SOPORTE_FIBRA')) return 'soporte'
  if (roles.includes('TECNICO') || roles.includes('TECNICO_FIBRA')) return 'tecnico'
  return 'dashboard'
}

export default Dashboard
