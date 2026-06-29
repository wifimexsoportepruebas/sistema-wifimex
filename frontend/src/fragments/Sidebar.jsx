import { useState } from 'react'

const menuItems = [
  { label: 'Inicio', icon: 'IN', view: 'dashboard', roles: ['ADMIN', 'SOPORTE', 'SOPORTE_FIBRA', 'ATENCION_CLIENTE', 'TECNICO', 'TECNICO_FIBRA'] },
  {
    label: 'Clientes',
    icon: 'CL',
    roles: ['ATENCION_CLIENTE', 'SOPORTE', 'SOPORTE_FIBRA'],
    submenu: [
      { label: 'Lista clientes', view: 'clientes-ver', icon: 'LC' },
      { label: 'Prospectos', view: 'prospectos', icon: 'PR' },
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
    label: 'Ruta operativa',
    icon: 'RO',
    view: 'reportes-operativos',
    roles: ['ADMIN'],
  },
  {
    label: 'Infraestructura',
    icon: 'IF',
    roles: ['ADMIN', 'SOPORTE', 'SOPORTE_FIBRA'],
    submenu: [
      { label: 'Cajas de fibra', view: 'infraestructura-cajas', icon: 'CF' },
    ],
  },
  {
    label: 'Empleados',
    icon: 'EM',
    view: 'empleados',
    roles: ['ADMIN'],
  },
  { label: 'Mis Asignaciones', icon: 'MA', view: 'tecnico', roles: ['TECNICO', 'TECNICO_FIBRA'] },
]

function canSeeItem(item, roles) {
  return item.roles.some((role) => roles.includes(role))
}

function Sidebar({ open, roles, activeView, homeView = 'dashboard', onNavigate, onClose }) {
  const [openMenus, setOpenMenus] = useState({
    Clientes: true,
    Reportes: true,
    Infraestructura: true,
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
              const isChildActive = item.submenu.some((sub) => sub.view === activeView)
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
                      {isOpen ? '^' : 'v'}
                    </span>
                  </a>
                  {isOpen && (
                    <div className="sidebar-submenu">
                      {item.submenu.map((sub) => (
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
