import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import Swal from 'sweetalert2'
import 'leaflet/dist/leaflet.css'
import '../../styles/CajasCercanas.css'

const CAJA_GREEN_ICON = L.divIcon({ className: 'fiber-map-marker caja-green', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] })
const CAJA_YELLOW_ICON = L.divIcon({ className: 'fiber-map-marker caja-yellow', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] })
const CAJA_RED_ICON = L.divIcon({ className: 'fiber-map-marker caja-red', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] })
const CAJA_GRAY_ICON = L.divIcon({ className: 'fiber-map-marker caja-gray', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] })
const TECH_ICON = L.divIcon({ className: 'fiber-map-marker tech', html: '<span></span>', iconSize: [24, 24], iconAnchor: [12, 12] })

function MapRecenter({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom())
    }
  }, [center, zoom, map])
  return null
}

function getCajaIcon(caja) {
  if (caja.latitud == null || caja.longitud == null) return CAJA_GRAY_ICON
  if (caja.terminales_libres > 2) return CAJA_GREEN_ICON
  if (caja.terminales_libres > 0) return CAJA_YELLOW_ICON
  if (caja.terminales_reservadas > 0) return CAJA_YELLOW_ICON
  return CAJA_RED_ICON
}

function getCajaColorClass(caja) {
  if (caja.latitud == null || caja.longitud == null) return 'caja-gray-card'
  if (caja.terminales_libres > 2) return 'caja-green-card'
  if (caja.terminales_libres > 0) return 'caja-yellow-card'
  if (caja.terminales_reservadas > 0) return 'caja-yellow-card'
  return 'caja-red-card'
}

function getHaversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null
  const R = 6371e3
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

function formatDistance(meters) {
  if (meters == null) return ''
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  return `${(meters / 1000).toFixed(1)} km`
}

function CajasCercanas({ apiUrl, token, roles = [] }) {
  const [cajas, setCajas] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedCaja, setSelectedCaja] = useState(null)
  const [geoState, setGeoState] = useState({ loading: true, coords: null, error: null })
  const [mapFocus, setMapFocus] = useState(null)

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const requestLocation = useCallback(() => {
    setGeoState(prev => ({ ...prev, loading: true, error: null }))
    if (!navigator.geolocation) {
      setGeoState({ loading: false, coords: null, error: 'La geolocalización no está soportada por tu navegador.' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude }
        setGeoState({ loading: false, coords, error: null })
        setMapFocus(coords)
      },
      (error) => {
        let msg = 'Permiso de ubicación denegado.'
        if (error.code === error.POSITION_UNAVAILABLE) msg = 'Ubicación no disponible.'
        if (error.code === error.TIMEOUT) msg = 'Tiempo de espera agotado.'
        setGeoState({ loading: false, coords: null, error: msg })
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }, [])

  const loadCajas = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`${apiUrl}/api/cajas-cercanas`, { headers: authHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudieron cargar las cajas.')
      setCajas(data.cajas ?? [])
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    } finally {
      setLoading(false)
    }
  }, [apiUrl, authHeaders])

  useEffect(() => {
    loadCajas()
    requestLocation()
  }, [loadCajas, requestLocation])

  const sortedAndFilteredCajas = useMemo(() => {
    let result = cajas.map(caja => {
      let distance = null
      if (geoState.coords && caja.latitud != null && caja.longitud != null) {
        distance = getHaversineDistance(geoState.coords.lat, geoState.coords.lng, caja.latitud, caja.longitud)
      }
      return { ...caja, distance }
    })

    const qNorm = query.trim().toUpperCase()
    if (qNorm) {
      result = result.filter(caja => {
        const cod = String(caja.codigo || '').toUpperCase()
        const com = String(caja.comunidad || '').toUpperCase()
        const kml = String(caja.nombre_original_kml || '').toUpperCase()
        const nom = String(caja.nombre || '').toUpperCase()
        return cod.includes(qNorm) || com.includes(qNorm) || kml.includes(qNorm) || nom.includes(qNorm)
      })
    }

    if (geoState.coords) {
      result.sort((a, b) => {
        if (a.distance == null && b.distance == null) return 0
        if (a.distance == null) return 1
        if (b.distance == null) return -1
        return a.distance - b.distance
      })
    } else {
      result.sort((a, b) => {
        const comp = String(a.comunidad || '').localeCompare(String(b.comunidad || ''))
        if (comp !== 0) return comp
        return String(a.codigo || '').localeCompare(String(b.codigo || ''))
      })
    }

    return result
  }, [cajas, geoState.coords, query])

  const closestCajaId = useMemo(() => {
    if (!geoState.coords || sortedAndFilteredCajas.length === 0) return null
    const firstWithDist = sortedAndFilteredCajas.find(c => c.distance != null)
    return firstWithDist ? firstWithDist.id : null
  }, [geoState.coords, sortedAndFilteredCajas])

  const initialCenter = useMemo(() => {
    if (geoState.coords) return [geoState.coords.lat, geoState.coords.lng]
    const withCoords = cajas.find(c => c.latitud != null && c.longitud != null)
    if (withCoords) return [withCoords.latitud, withCoords.longitud]
    return [18.349, -99.535]
  }, [geoState.coords, cajas])

  const handleCardClick = (caja) => {
    if (caja.latitud != null && caja.longitud != null) {
      setMapFocus({ lat: caja.latitud, lng: caja.longitud })
    }
    setSelectedCaja(caja)
  }

  const handleCenterTech = () => {
    if (geoState.coords) {
      setMapFocus({ ...geoState.coords })
    }
  }

  return (
    <div className="cajas-cercanas-page fiber-page">
      <section className="cajas-cercanas-header">
        <div>
          <span className="fiber-kicker">Consulta en campo</span>
          <h1>Cajas cercanas</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="fiber-link-button" onClick={handleCenterTech} disabled={!geoState.coords}>
            Centrar en mí
          </button>
          <button type="button" className="fiber-primary-button" onClick={requestLocation} disabled={geoState.loading} style={{ minHeight: 'auto', padding: '10px 16px' }}>
            {geoState.loading ? 'Buscando...' : 'Actualizar ubicación'}
          </button>
        </div>
      </section>

      {geoState.error && (
        <div className="geo-warning-box">
          <div>
            <strong>Aviso:</strong> {geoState.error} Puedes consultar las cajas manualmente.
          </div>
          <button type="button" onClick={requestLocation} style={{ background: 'none', border: 'none', color: 'inherit', fontWeight: 'bold', cursor: 'pointer' }}>
            Reintentar
          </button>
        </div>
      )}

      <div style={{ margin: '0 24px 8px', fontSize: '0.82rem', color: '#64748b', fontWeight: 'bold' }}>
        ℹ️ Tu ubicación solo se usa para mostrar cajas cercanas y no se guarda en el servidor.
      </div>

      <section className="cajas-cercanas-content">
        <div className="cajas-cercanas-map-panel">
          <MapContainer center={initialCenter} zoom={15} scrollWheelZoom={true}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {mapFocus && <MapRecenter center={[mapFocus.lat, mapFocus.lng]} />}
            
            {geoState.coords && (
              <Marker position={[geoState.coords.lat, geoState.coords.lng]} icon={TECH_ICON}>
                <Popup>
                  <strong>Tú estás aquí</strong>
                </Popup>
              </Marker>
            )}

            {cajas.filter(c => c.latitud != null && c.longitud != null).map((caja) => (
              <Marker key={caja.id} position={[caja.latitud, caja.longitud]} icon={getCajaIcon(caja)}>
                <Popup>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <strong>Caja {caja.codigo || caja.nombre}</strong>
                    <span>Comunidad: {caja.comunidad}</span>
                    <span>Libres: {caja.terminales_libres} / {caja.terminales_total}</span>
                    <button
                      type="button"
                      style={{
                        marginTop: '5px',
                        background: '#4274D9',
                        color: 'white',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}
                      onClick={() => handleCardClick(caja)}
                    >
                      Ver detalle
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <div className="cajas-cercanas-sidebar">
          <div className="cajas-cercanas-search-bar">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar por código de caja o comunidad..."
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
              <span>{sortedAndFilteredCajas.length} cajas encontradas</span>
              <span>Ordenado por: {geoState.coords ? 'cercanía' : 'localidad'}</span>
            </div>
          </div>

          <div className="cajas-cercanas-list">
            {loading && <p style={{ textAlign: 'center', padding: '20px' }}>Cargando cajas...</p>}
            {!loading && sortedAndFilteredCajas.length === 0 && (
              <p style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>
                No se encontraron cajas con ese filtro.
              </p>
            )}
            {!loading && sortedAndFilteredCajas.map((caja) => {
              const isClosest = closestCajaId === caja.id
              return (
                <div
                  key={caja.id}
                  onClick={() => handleCardClick(caja)}
                  className={`caja-cercana-card ${getCajaColorClass(caja)} ${selectedCaja?.id === caja.id ? 'selected' : ''}`}
                >
                  <div className="caja-cercana-card-header">
                    <div>
                      <div className="caja-cercana-card-title">Caja {caja.codigo || caja.nombre}</div>
                      <div className="caja-cercana-card-subtitle">{caja.comunidad}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      {caja.distance != null && (
                        <span className="caja-cercana-card-distance">{formatDistance(caja.distance)}</span>
                      )}
                      {isClosest && (
                        <span className="caja-cercana-card-closest-badge">Caja más cercana</span>
                      )}
                    </div>
                  </div>

                  <div className="caja-cercana-card-stats">
                    <span>🟢 Libres: {caja.terminales_libres}</span>
                    <span>🔴 Ocupadas: {caja.terminales_ocupadas}</span>
                    <span>🟡 Reservadas: {caja.terminales_reservadas}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {selectedCaja && (
        <div className="client-modal-backdrop" onClick={() => setSelectedCaja(null)}>
          <div className="client-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(580px, 100%)', maxHeight: '85vh' }}>
            <div className="client-modal-header">
              <h3>Detalle de Caja {selectedCaja.codigo || selectedCaja.nombre}</h3>
              <button type="button" onClick={() => setSelectedCaja(null)}>✕</button>
            </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f8fafc', padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.88rem', marginBottom: '20px' }}>
                <div>
                  <strong>Comunidad:</strong> {selectedCaja.comunidad}
                </div>
                {selectedCaja.distance != null && (
                  <div>
                    <strong>Distancia:</strong> {formatDistance(selectedCaja.distance)}
                  </div>
                )}
                <div>
                  <strong>Coordenadas:</strong> {selectedCaja.latitud != null && selectedCaja.longitud != null ? `${selectedCaja.latitud.toFixed(5)}, ${selectedCaja.longitud.toFixed(5)}` : 'Sin coordenadas'}
                </div>
                <div>
                  <strong>Original KML:</strong> {selectedCaja.nombre_original_kml || 'N/A'}
                </div>
              </div>

              <div style={{ fontSize: '0.92rem', fontWeight: 'bold', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                Terminales de la caja ({selectedCaja.terminales?.length || 0} registradas):
              </div>

              <div className="terminal-grid">
                {selectedCaja.terminales && selectedCaja.terminales.map((term) => (
                  <div key={term.id} className={`terminal-badge ${String(term.estado).toLowerCase()}`}>
                    <span>T{term.numero_terminal}</span>
                    <strong style={{ fontSize: '0.78rem' }}>{term.estado}</strong>
                  </div>
                ))}
                {(!selectedCaja.terminales || selectedCaja.terminales.length === 0) && (
                  <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                    Esta caja no tiene terminales registradas.
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                {selectedCaja.latitud != null && selectedCaja.longitud != null && (
                  <a
                    href={`https://www.google.com/maps?q=${selectedCaja.latitud},${selectedCaja.longitud}`}
                    target="_blank"
                    rel="noreferrer"
                    className="fiber-primary-button"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      textDecoration: 'none',
                      minHeight: 'auto',
                      padding: '10px 20px',
                      fontSize: '0.88rem'
                    }}
                  >
                    Ver ruta en Google Maps
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedCaja(null)}
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

export default CajasCercanas
