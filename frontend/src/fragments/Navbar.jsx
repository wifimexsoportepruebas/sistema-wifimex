import { useEffect, useRef, useState } from 'react'

function Navbar({ usuario, primaryRole, sidebarOpen, onToggleSidebar, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const displayName = getDisplayName(usuario)
  const initial = displayName.trim().slice(0, 1).toUpperCase() || 'U'

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleLogoutClick() {
    setMenuOpen(false)
    onLogout?.()
  }

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button
          className="menu-button"
          type="button"
          aria-label={sidebarOpen ? 'Ocultar menu' : 'Mostrar menu'}
          aria-expanded={sidebarOpen}
          onClick={onToggleSidebar}
        >
          <span className="menu-button-lines" />
        </button>

        <div className="navbar-title">
          <span>WiFiMex Central Fibra</span>
          <strong>Panel principal</strong>
        </div>
      </div>

      <div className="navbar-right">
        <div className="navbar-user-menu" ref={menuRef}>
          <button
            className="navbar-user-trigger"
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <span className="user-avatar" aria-hidden="true">
              {initial}
            </span>
            <span className="navbar-user-copy">
              <strong>{displayName}</strong>
              <small>{primaryRole}</small>
            </span>
            <svg className="navbar-chevron" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5.7 7.5 10 11.8l4.3-4.3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {menuOpen && (
            <div className="navbar-user-dropdown" role="menu">
              <button type="button" role="menuitem" onClick={handleLogoutClick}>
                Cerrar sesion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function getDisplayName(usuario) {
  const nombre = usuario?.nombre || usuario?.nombres
  if (nombre) return String(nombre).trim()
  if (usuario?.numero_empleado) return String(usuario.numero_empleado).trim()
  return 'Usuario'
}

export default Navbar
