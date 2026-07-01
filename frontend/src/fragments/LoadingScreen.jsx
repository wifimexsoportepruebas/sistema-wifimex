import '../styles/LoadingScreen.css'

function LoadingScreen() {
  return (
    <main className="app-loading-screen">
      <div className="loading-container">
        <img src="/logo-wifimex.png" alt="WiFiMex Logo" className="loading-logo" />
        <p className="loading-text">Cargando...</p>
        <div className="loading-dots">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
      </div>
    </main>
  )
}

export default LoadingScreen
