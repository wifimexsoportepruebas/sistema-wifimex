import { useState } from 'react'

const menuItems = [
  { label: 'Inicio', icon: 'IN', view: 'dashboard', roles: ['ADMIN', 'SOPORTE', 'SOPORTE_FIBRA', 'ATENCION_CLIENTE', 'TECNICO', 'TECNICO_FIBRA'] },
  {
    label: 'Clientes',
    icon: 'CL',
    roles: ['ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'],
    submenu: [
      { label: 'Prospectos', view: 'prospectos', icon: 'PR' },
      { label: 'Lista clientes', view: 'clientes-ver', icon: 'LC' },
      { label: 'Alta clientes', view: 'clientes-alta', icon: 'AC' },
    ],
  },
  {
    label: 'Reportes',
    icon: 'RP',
    roles: ['ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'],
    submenu: [
      { label: 'Alta de reporte', view: 'reportes-atencion', icon: 'AR' },
    ],
  },
  {
    label: 'Operación técnica',
    icon: 'OT',
    roles: ['ADMIN', 'SOPORTE', 'SOPORTE_FIBRA'],
    submenu: [
      { label: 'Cajas de fibra', view: 'infraestructura-cajas', icon: 'CF', roles: ['ADMIN', 'SOPORTE', 'SOPORTE_FIBRA'] },
      { label: 'Ruta operativa', view: 'reportes-operativos', icon: 'RO', roles: ['ADMIN', 'SOPORTE'] },
      { label: 'Bitácora de técnicos', view: 'bitacora-tecnicos', icon: 'BT', roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Administración',
    icon: 'AD',
    roles: ['ADMIN', 'SOPORTE', 'SOPORTE_FIBRA'],
    submenu: [
      { label: 'Comunidades', view: 'comunidades', icon: 'CM', roles: ['SOPORTE', 'SOPORTE_FIBRA'] },
      { label: 'Empleados', view: 'empleados', icon: 'EM', roles: ['ADMIN'] },
      { label: 'Puntos de cobro', view: 'puntos-cobro', icon: 'PC', roles: ['ADMIN'] },
    ],
  },
  { label: 'Cajas cercanas', icon: 'CC', view: 'cajas-cercanas', roles: ['TECNICO', 'TECNICO_FIBRA'] },
  { label: 'Mis Tareas', icon: 'MA', view: 'tecnico', roles: ['TECNICO', 'TECNICO_FIBRA'] },
]

function canSeeItem(item, roles) {
  return item.roles.some((role) => roles.includes(role))
}

function Sidebar({ open, roles, activeView, homeView = 'dashboard', onNavigate, onClose }) {
  const [openMenus, setOpenMenus] = useState({
    Clientes: true,
    Reportes: true,
    'Operación técnica': true,
    Administración: true,
  })
  const visibleItems = menuItems.filter((item) => canSeeItem(item, roles))

  function handleNavigate(event, view) {
    event.preventDefault()
    onNavigate(view)
    onClose()
  }

  function toggleMenu(label, isOpen) {
    setOpenMenus((current) => ({ ...current, [label]: !isOpen }))
  }

  return (
    <>
      <button
        className={`sidebar-backdrop ${open ? 'show' : ''}`}
        type="button"
        aria-label="Cerrar menu"
        onClick={onClose}
      />

      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Navegacion principal">
        <div className="sidebar-brand">
          <img src="/logo-wifimex.png" alt="WiFiMex" />
          <span>Central Fibra</span>
        </div>

        <nav className="sidebar-menu" aria-label="Menu principal">
          {visibleItems.map((item) => {
            if (item.submenu) {
              const visibleSubmenu = item.submenu.filter((sub) => !sub.roles || sub.roles.some((r) => roles.includes(r)))
              if (visibleSubmenu.length === 0) return null

              const isChildActive = visibleSubmenu.some((sub) => sub.view === activeView)
              const isOpen = openMenus[item.label] ?? true
              return (
                <div key={item.label} className="sidebar-item-group" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <a
                    className={`submenu-trigger ${isChildActive ? 'active' : ''}`}
                    href="#"
                    onClick={(event) => {
                      event.preventDefault()
                      toggleMenu(item.label, isOpen)
                    }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'inherit' }}>
                      <span>{item.icon}</span>
                      <strong>{item.label}</strong>
                    </div>
                    <span className="submenu-arrow" style={{ fontSize: '0.75rem', opacity: 0.7, marginRight: '8px' }}>
                      {isOpen ? 'v' : '>'}
                    </span>
                  </a>
                  {isOpen && (
                    <div className="sidebar-submenu">
                      {visibleSubmenu.map((sub) => (
                        <a
                          className={activeView === sub.view ? 'sub-active' : 'sub-item'}
                          href={`#${sub.view}`}
                          key={sub.label}
                          onClick={(event) => handleNavigate(event, sub.view)}
                        >
                          <span style={{ fontSize: '0.75rem', marginRight: '6px', opacity: 0.8 }}>{sub.icon}</span>
                          <strong>{sub.label}</strong>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <a
                className={activeView === item.view || (item.view === 'dashboard' && activeView === homeView) ? 'active' : ''}
                href={`#${item.view === 'dashboard' ? homeView : item.view}`}
                key={item.label}
                onClick={(event) => handleNavigate(event, item.view === 'dashboard' ? homeView : item.view)}
              >
                <span>{item.icon}</span>
                <strong>{item.label}</strong>
              </a>
            )
          })}
        </nav>

        <div className="sidebar-footer">
        </div>
      </aside>
    </>
  )
}

export default Sidebar
