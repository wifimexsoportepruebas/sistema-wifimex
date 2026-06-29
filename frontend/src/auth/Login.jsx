import { useEffect, useState } from 'react'
import { clearStoredToken, saveToken } from './session.js'
import '../styles/Login.css'

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg className="eye-icon eye-open" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg className="eye-icon eye-closed" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function BrandName() {
  return (
    <span className="brand-name" aria-label="WiFiMex">
      <span className="brand-blue">Wi</span>
      <span className="brand-red">Fi</span>
      <span className="brand-yellow">M</span>
      <span className="brand-green">e</span>
      <span className="brand-gray">x</span>
    </span>
  )
}

function Login({ apiUrl, onLogin }) {
  const loginImages = ['/loginfoto.png', '/loginfoto2.png']
  const [numeroEmpleado, setNumeroEmpleado] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeImage, setActiveImage] = useState(0)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveImage((current) => (current + 1) % loginImages.length)
    }, 5000)

    return () => window.clearInterval(intervalId)
  }, [loginImages.length])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const empleado = numeroEmpleado.trim()
    const clave = password.trim()

    if (!empleado || !clave) {
      setError('Escribe tu numero de empleado y contrasena para iniciar sesion.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero_empleado: empleado,
          password: clave,
          remember: rememberMe,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.token) {
        throw new Error('Número de empleado o contraseña incorrectos.')
      }

      saveToken(data.token, rememberMe ? 'local' : 'session')

      onLogin(data, rememberMe ? 'local' : 'session')
    } catch {
      clearStoredToken()
      setError('Número de empleado o contraseña incorrectos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-shell" aria-label="Acceso al Sistema Fibra Central">
        <section className="login-panel">
          <div className="company-brand">
            <img src="/logo-wifimex.png" alt="" aria-hidden="true" />
            <BrandName />
          </div>

          <header className="login-header">
            <h1>Bienvenido</h1>
            <p>Ingresa tus datos para acceder al Sistema Fibra Central.</p>
          </header>

          <form className="login-form" onSubmit={handleSubmit} autoComplete="on">
            <label htmlFor="numero-empleado">Número de empleado</label>
            <div className="field">
              <span className="field-icon">
                <UserIcon />
              </span>
              <input
                id="numero-empleado"
                name="numeroEmpleado"
                type="text"
                value={numeroEmpleado}
                onChange={(event) => setNumeroEmpleado(event.target.value)}
                placeholder="ADMIN001"
                autoComplete="username"
                disabled={loading}
              />
            </div>

            <label htmlFor="password">Contraseña</label>
            <div className="field password-field">
              <span className="field-icon">
                <LockIcon />
              </span>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Escribe tu contraseña"
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                className="eye-toggle"
                type="button"
                data-visible={String(showPassword)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setShowPassword((visible) => !visible)}
                disabled={loading}
              >
                <EyeIcon />
                <EyeOffIcon />
              </button>
            </div>

            <div className="form-options">
              <label className="remember" htmlFor="remember-me">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  disabled={loading}
                />
                Recordarme
              </label>
              <span className="access-note">Solicita acceso al administrador</span>
            </div>

            {error ? (
              <p className="login-error" role="alert">
                {error}
              </p>
            ) : null}

            <button className="login-button" type="submit" disabled={loading}>
              {loading ? 'Validando acceso...' : 'Entrar al sistema'}
            </button>
          </form>
        </section>

        <aside className="login-visual" aria-hidden="true">
          <div className="visual-card">
            {loginImages.map((image, index) => (
              <img
                key={image}
                className={index === activeImage ? 'is-active' : ''}
                src={image}
                alt="Ilustracion de soporte tecnico y red de fibra"
              />
            ))}
            <img src="/loginfoto.png" alt="Ilustración de soporte técnico y red de fibra" />
          </div>
        </aside>
      </section>
    </main>
  )
}

export default Login
