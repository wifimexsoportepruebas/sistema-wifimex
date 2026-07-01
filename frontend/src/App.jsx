import { useEffect, useState } from 'react'
import Login from './auth/Login.jsx'
import { clearStoredToken, getStoredToken, saveToken } from './auth/session.js'
import Dashboard from './pages_fibra/dashboard/Dashboard.jsx'
import PuntoCobro from './pages_public/PuntoCobro.jsx'
import LoadingScreen from './fragments/LoadingScreen.jsx'


const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'

function App() {
  const puntoCobroToken = getPuntoCobroToken()
  const [auth, setAuth] = useState({
    loading: true,
    token: getStoredToken(),
    usuario: null,
    roles: [],
  })

  useEffect(() => {
    async function loadSession() {
      if (puntoCobroToken) {
        setAuth((current) => ({ ...current, loading: false }))
        return
      }

      if (!auth.token) {
        setAuth((current) => ({ ...current, loading: false }))
        return
      }

      try {
        const response = await fetch(`${API_URL}/api/me`, {
          headers: {
            Authorization: `Bearer ${auth.token}`,
          },
        })

        if (!response.ok) {
          throw new Error('Sesión inválida')
        }

        const data = await response.json()
        setAuth({
          loading: false,
          token: auth.token,
          usuario: data.usuario,
          roles: data.roles,
        })
      } catch {
        clearStoredToken()
        setAuth({ loading: false, token: null, usuario: null, roles: [] })
      }
    }

    loadSession()
  }, [auth.token, puntoCobroToken])

  if (puntoCobroToken) {
    return <PuntoCobro apiUrl={API_URL} token={puntoCobroToken} />
  }

  function handleLogin(session, storageType = 'local') {
    saveToken(session.token, storageType)
    setAuth({
      loading: false,
      token: session.token,
      usuario: session.usuario,
      roles: session.roles,
    })
    window.history.replaceState(null, '', `/dashboard#${getDashboardHash(session.roles ?? [])}`)
  }

  async function handleLogout() {
    if (auth.token) {
      await fetch(`${API_URL}/api/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      }).catch(() => {})
    }

    clearStoredToken()
    setAuth({ loading: false, token: null, usuario: null, roles: [] })
    window.history.replaceState(null, '', '/login')
  }

  if (auth.loading) {
    return <LoadingScreen />
  }

  if (!auth.token) {
    return <Login apiUrl={API_URL} onLogin={handleLogin} />
  }

  return (
    <Dashboard
      apiUrl={API_URL}
      token={auth.token}
      usuario={auth.usuario}
      roles={auth.roles}
      onLogout={handleLogout}
    />
  )
}

function getPuntoCobroToken() {
  const match = window.location.pathname.match(/^\/punto-cobro\/([^/]+)\/?$/)
  return match ? decodeURIComponent(match[1]) : ''
}

function getDashboardHash(roles) {
  if (roles.includes('ADMIN')) return 'admin'
  if (roles.includes('ATENCION_CLIENTE')) return 'atencion'
  if (roles.includes('SOPORTE') || roles.includes('SOPORTE_FIBRA')) return 'soporte'
  if (roles.includes('TECNICO') || roles.includes('TECNICO_FIBRA')) return 'tecnico'
  return 'dashboard'
}

export default App
