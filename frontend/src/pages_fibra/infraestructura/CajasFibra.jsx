import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import Swal from 'sweetalert2'
import 'leaflet/dist/leaflet.css'
import '../../styles/CajasFibra.css'

const DEFAULT_CENTER = [18.349, -99.535]
const CAJA_ICON = L.divIcon({ className: 'fiber-map-marker caja', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] })
const OLT_ICON = L.divIcon({ className: 'fiber-map-marker olt', html: '<span></span>', iconSize: [28, 28], iconAnchor: [14, 14] })

function CajasFibra({ apiUrl, token }) {
  const [cajas, setCajas] = useState([])
  const [comunidades, setComunidades] = useState([])
  const [terminales, setTerminales] = useState([])
  const [selectedCaja, setSelectedCaja] = useState(null)
  const [filters, setFilters] = useState({ comunidad_id: '', estado: 'activo', q: '' })
  const [loading, setLoading] = useState(true)

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const loadComunidades = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/comunidades`, { headers: authHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudieron cargar las comunidades.')
      setComunidades(data.comunidades ?? [])
    } catch (error) {
      showError(error.message)
    }
  }, [apiUrl, authHeaders])

  const loadCajas = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.comunidad_id) params.set('comunidad_id', filters.comunidad_id)
      if (filters.estado) params.set('estado', filters.estado)
      if (filters.q.trim()) params.set('q', filters.q.trim())

      const response = await fetch(`${apiUrl}/api/infraestructura/cajas?${params.toString()}`, { headers: authHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudieron cargar las cajas.')
      setCajas(data.cajas ?? [])
    } catch (error) {
      showError(error.message)
    } finally {
      setLoading(false)
    }
  }, [apiUrl, authHeaders, filters])

  useEffect(() => {
    loadComunidades()
  }, [loadComunidades])

  useEffect(() => {
    loadCajas()
  }, [loadCajas])

  const mapCenter = useMemo(() => {
    const item = cajas.find((caja) => Number.isFinite(Number(caja.latitud)) && Number.isFinite(Number(caja.longitud)))
    return item ? [Number(item.latitud), Number(item.longitud)] : DEFAULT_CENTER
  }, [cajas])

  async function openDetail(caja) {
    try {
      const response = await fetch(`${apiUrl}/api/infraestructura/cajas/${caja.id}`, { headers: authHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudo cargar el detalle.')
      setSelectedCaja(data.caja)
      setTerminales(data.terminales ?? [])
    } catch (error) {
      showError(error.message)
    }
  }

  async function openCajaForm(caja = null) {
    const result = await Swal.fire({
      title: caja ? 'Editar caja' : 'Nueva caja de fibra',
      html: renderCajaForm(comunidades, caja),
      width: 720,
      confirmButtonText: caja ? 'Guardar cambios' : 'Crear caja',
      cancelButtonText: 'Cancelar',
      showCancelButton: true,
      confirmButtonColor: '#4274D9',
      focusConfirm: false,
      didOpen: () => wireCajaTypeToggle(caja),
      preConfirm: () => getCajaFormValues(),
    })

    if (!result.isConfirmed) return
    const payload = result.value
    try {
      const response = await fetch(`${apiUrl}/api/infraestructura/cajas${caja ? `/${caja.id}` : ''}`, {
        method: caja ? 'PATCH' : 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar la caja.')
      await Swal.fire({ icon: 'success', title: 'Caja guardada', confirmButtonColor: '#4274D9' })
      loadCajas()
      if (selectedCaja?.id === caja?.id) openDetail(caja)
    } catch (error) {
      showError(error.message)
    }
  }

  async function toggleCaja(caja) {
    const nextActive = Number(caja.activo) ? 0 : 1
    const result = await Swal.fire({
      icon: 'question',
      title: nextActive ? 'Activar caja' : 'Desactivar caja',
      text: `${caja.nombre || caja.codigo_caja} quedara ${nextActive ? 'activa' : 'inactiva'}.`,
      showCancelButton: true,
      confirmButtonText: nextActive ? 'Activar' : 'Desactivar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4274D9',
    })
    if (!result.isConfirmed) return

    try {
      const response = await fetch(`${apiUrl}/api/infraestructura/cajas/${caja.id}/estado`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: nextActive }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudo actualizar el estado.')
      loadCajas()
      if (selectedCaja?.id === caja.id) setSelectedCaja((current) => ({ ...current, activo: nextActive }))
    } catch (error) {
      showError(error.message)
    }
  }

  async function updateTerminal(terminal) {
    const estado = normalizeTerminalEstado(terminal.estado)
    const result = await Swal.fire({
      title: `Terminal ${terminal.numero_terminal}`,
      html: renderTerminalModal(terminal),
      showCancelButton: true,
      showConfirmButton: estado !== 'RESERVADO',
      showDenyButton: estado === 'LIBRE',
      confirmButtonText: estado === 'OCUPADO' ? 'Desvincular cliente' : estado === 'DA\u00d1ADO' ? 'Marcar como libre' : 'Vincular cliente',
      denyButtonText: 'Marcar como da\u00f1ada',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: estado === 'OCUPADO' ? '#d71935' : '#4274D9',
      denyButtonColor: '#64748b',
    })
    if (result.isDenied) {
      await updateTerminalEstado(terminal, 'DA\u00d1ADO')
      return
    }
    if (!result.isConfirmed) return

    if (estado === 'LIBRE') {
      await openServicioSearch(terminal)
      return
    }

    if (estado === 'DA\u00d1ADO') {
      await updateTerminalEstado(terminal, 'LIBRE')
      return
    }

    if (estado === 'OCUPADO') {
      await unlinkTerminalServicio(terminal)
    }
  }
  async function updateTerminalEstado(terminal, estado) {
    try {
      const response = await fetch(`${apiUrl}/api/infraestructura/terminales/${terminal.id}/estado`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudo actualizar la terminal.')
      await Swal.fire({ icon: 'success', title: 'Terminal actualizada', confirmButtonColor: '#4274D9', timer: 1300, showConfirmButton: false })
      await refreshSelectedCaja()
    } catch (error) {
      showError(error.message)
    }
  }

  async function openServicioSearch(terminal) {
    if (!selectedCaja?.comunidad_id) {
      showError('Selecciona una caja valida.')
      return
    }

    let selectedServicioId = ''
    const result = await Swal.fire({
      title: 'Vincular cliente',
      html: `
        <div class="swal-fiber-form infra-service-search">
          <input id="service-search-input" placeholder="Numero, nombre, telefono o alfanumerico" />
          <div id="service-search-results" class="service-search-results">Escribe para buscar servicios activos de esta comunidad.</div>
        </div>
      `,
      width: 760,
      showCancelButton: true,
      confirmButtonText: 'Vincular cliente',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4274D9',
      didOpen: () => {
        const input = document.getElementById('service-search-input')
        const results = document.getElementById('service-search-results')
        let timerId

        const renderResults = async () => {
          const query = input?.value?.trim() ?? ''
          results.innerHTML = 'Buscando...'
          try {
            const servicios = await searchServicios(selectedCaja.comunidad_id, query)
            if (!servicios.length) {
              results.innerHTML = '<p class="service-empty">No hay servicios activos disponibles.</p>'
              selectedServicioId = ''
              return
            }
            results.innerHTML = servicios.map((servicio) => renderServicioOption(servicio)).join('')
            results.querySelectorAll('[data-servicio-id]').forEach((item) => {
              item.addEventListener('click', () => {
                selectedServicioId = item.dataset.servicioId
                results.querySelectorAll('[data-servicio-id]').forEach((node) => node.classList.remove('selected'))
                item.classList.add('selected')
              })
            })
          } catch (error) {
            results.innerHTML = `<p class="service-empty">${escapeHtml(error.message)}</p>`
          }
        }

        input?.addEventListener('input', () => {
          window.clearTimeout(timerId)
          timerId = window.setTimeout(renderResults, 250)
        })
        renderResults()
      },
      preConfirm: () => {
        if (!selectedServicioId) {
          Swal.showValidationMessage('Selecciona un servicio.')
          return false
        }
        return Number(selectedServicioId)
      },
    })
    if (!result.isConfirmed) return

    try {
      const response = await fetch(`${apiUrl}/api/infraestructura/terminales/${terminal.id}/vincular-servicio`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ servicio_fibra_id: result.value }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudo vincular el cliente.')
      await Swal.fire({ icon: 'success', title: data.message || 'Cliente vinculado correctamente.', confirmButtonColor: '#4274D9' })
      await refreshSelectedCaja()
    } catch (error) {
      showError(error.message)
    }
  }

  async function searchServicios(comunidadId, query) {
    const params = new URLSearchParams()
    params.set('comunidad_id', comunidadId)
    params.set('q', query)
    const response = await fetch(`${apiUrl}/api/infraestructura/servicios-buscar?${params.toString()}`, { headers: authHeaders })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? 'No se pudieron buscar servicios.')
    return data.servicios ?? []
  }

  async function unlinkTerminalServicio(terminal) {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: '¿Desvincular este cliente de la terminal?',
      text: 'La terminal quedará como LIBRE.',
      showCancelButton: true,
      confirmButtonText: 'Desvincular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d71935',
    })
    if (!confirm.isConfirmed) return

    try {
      const response = await fetch(`${apiUrl}/api/infraestructura/terminales/${terminal.id}/desvincular-servicio`, {
        method: 'POST',
        headers: authHeaders,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudo desvincular el cliente.')
      await Swal.fire({ icon: 'success', title: 'Cliente desvinculado', confirmButtonColor: '#4274D9', timer: 1300, showConfirmButton: false })
      await refreshSelectedCaja()
    } catch (error) {
      showError(error.message)
    }
  }

  async function refreshSelectedCaja() {
    await loadCajas()
    if (selectedCaja) await openDetail(selectedCaja)
  }

  async function importKml() {
    const result = await Swal.fire({
      title: 'Importar cajas desde KML',
      html: renderKmlForm(comunidades, filters.comunidad_id),
      showCancelButton: true,
      confirmButtonText: 'Revisar archivo',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4274D9',
      focusConfirm: false,
      preConfirm: () => {
        const comunidadId = document.getElementById('kml-comunidad')?.value
        const file = document.getElementById('kml-file')?.files?.[0]
        if (!comunidadId) {
          Swal.showValidationMessage('Selecciona una comunidad.')
          return false
        }
        if (!file) {
          Swal.showValidationMessage('Selecciona un archivo KML.')
          return false
        }
        return { comunidadId, file }
      },
    })
    if (!result.isConfirmed) return

    try {
      const previewForm = new FormData()
      previewForm.append('file', result.value.file)
      const previewResponse = await fetch(`${apiUrl}/api/infraestructura/cajas/preview-kml`, {
        method: 'POST',
        headers: authHeaders,
        body: previewForm,
      })
      const preview = await previewResponse.json()
      if (!previewResponse.ok) throw new Error(preview.error ?? 'No se pudo revisar el KML.')

      const confirm = await Swal.fire({
        icon: preview.detected?.length ? 'question' : 'warning',
        title: 'Vista previa del KML',
        html: `
          <div class="infra-kml-summary">
            <strong>${preview.detected?.length ?? 0}</strong><span>puntos detectados</span>
            <strong>${preview.ignored?.length ?? 0}</strong><span>puntos ignorados</span>
          </div>
          <p class="infra-kml-note">Se importaran cajas y OLT detectadas como puntos. Lineas y poligonos se ignoran.</p>
        `,
        showCancelButton: true,
        confirmButtonText: 'Importar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#4274D9',
      })
      if (!confirm.isConfirmed) return

      const importForm = new FormData()
      importForm.append('comunidad_id', result.value.comunidadId)
      importForm.append('file', result.value.file)
      const importResponse = await fetch(`${apiUrl}/api/infraestructura/cajas/importar-kml`, {
        method: 'POST',
        headers: authHeaders,
        body: importForm,
      })
      const imported = await importResponse.json()
      if (!importResponse.ok) throw new Error(imported.error ?? 'No se pudo importar el KML.')

      await Swal.fire({
        icon: 'success',
        title: 'Importacion procesada',
        text: `Insertadas: ${imported.summary?.inserted ?? 0}. Duplicadas: ${imported.summary?.duplicates ?? 0}. Ignoradas: ${imported.summary?.ignored ?? 0}.`,
        confirmButtonColor: '#4274D9',
      })
      loadCajas()
    } catch (error) {
      showError(error.message)
    }
  }

  return (
    <div className="infra-cajas-page fiber-page">
      <section className="fiber-page-header infra-cajas-header">
        <div>
          <span className="fiber-kicker">Infraestructura</span>
          <h1>Cajas de fibra</h1>
          <p>Consulta cajas, OLT y terminales disponibles por comunidad.</p>
        </div>
        <div className="infra-header-actions">
          <button type="button" className="fiber-secondary-button" onClick={importKml}>Importar KML</button>
          <button type="button" className="fiber-primary-button" onClick={() => openCajaForm()}>Nueva caja</button>
        </div>
      </section>

      <section className="fiber-panel infra-cajas-toolbar">
        <input
          type="search"
          value={filters.q}
          onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
          placeholder="Buscar caja, OLT o comunidad"
        />
        <select value={filters.comunidad_id} onChange={(event) => setFilters((current) => ({ ...current, comunidad_id: event.target.value }))}>
          <option value="">Todas las comunidades</option>
          {comunidades.map((comunidad) => (
            <option key={comunidad.id} value={comunidad.id}>{comunidad.nombre}</option>
          ))}
        </select>
        <select value={filters.estado} onChange={(event) => setFilters((current) => ({ ...current, estado: event.target.value }))}>
          <option value="">Todas</option>
          <option value="activo">Activas</option>
          <option value="inactivo">Inactivas</option>
        </select>
        <button type="button" className="fiber-link-button" onClick={() => setFilters({ comunidad_id: '', estado: 'activo', q: '' })}>Limpiar</button>
      </section>

      <section className="infra-cajas-grid">
        <div className="fiber-panel infra-map-panel">
          <MapContainer center={mapCenter} zoom={14} scrollWheelZoom className="infra-map">
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapRecenter center={mapCenter} />
            {cajas.map((caja) => (
              <Marker
                key={caja.id}
                position={[Number(caja.latitud), Number(caja.longitud)]}
                icon={caja.tipo === 'OLT' ? OLT_ICON : CAJA_ICON}
                eventHandlers={{ click: () => openDetail(caja) }}
              >
                <Popup>
                  <strong>{caja.nombre || caja.codigo_caja || 'Punto'}</strong>
                  <span>{caja.comunidad_nombre}</span>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <aside className="fiber-panel infra-detail-panel">
          {selectedCaja ? (
            <>
              <div className="infra-detail-head">
                <div>
                  <span className="fiber-kicker">{selectedCaja.tipo}</span>
                  <h2>{selectedCaja.nombre || selectedCaja.codigo_caja}</h2>
                  <p>{selectedCaja.comunidad_nombre}</p>
                </div>
                <span className={`status-pill ${Number(selectedCaja.activo) ? '' : 'inactive'}`}>
                  {Number(selectedCaja.activo) ? 'ACTIVA' : 'INACTIVA'}
                </span>
              </div>
              <dl className="infra-detail-list">
                <div><dt>Codigo</dt><dd>{selectedCaja.codigo_caja || 'N/A'}</dd></div>
                <div><dt>Coordenadas</dt><dd>{selectedCaja.latitud}, {selectedCaja.longitud}</dd></div>
              </dl>
              <div className="infra-detail-actions">
                <button type="button" className="fiber-secondary-button" onClick={() => openCajaForm(selectedCaja)}>Editar</button>
                <button type="button" className="fiber-link-button" onClick={() => toggleCaja(selectedCaja)}>
                  {Number(selectedCaja.activo) ? 'Desactivar' : 'Activar'}
                </button>
              </div>
              {selectedCaja.tipo === 'CAJA' ? (
                <div className="terminal-grid">
                  {terminales.map((terminal) => (
                    <button
                      type="button"
                      key={terminal.id}
                      className={`terminal-chip ${getTerminalClass(terminal.estado)}`}
                      onClick={() => updateTerminal(terminal)}
                    >
                      <strong>Terminal {terminal.numero_terminal}</strong>
                      <span>{formatTerminalLabel(terminal)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="infra-empty-note">Las OLT no generan terminales.</p>
              )}
            </>
          ) : (
            <div className="infra-empty-detail">
              <span className="fiber-kicker">Detalle</span>
              <h2>Selecciona una caja</h2>
              <p>Haz clic en un marcador o en una fila para ver sus terminales.</p>
            </div>
          )}
        </aside>
      </section>

      <section className="fiber-panel infra-list-panel">
        <div className="infra-list-meta">
          <strong>{cajas.length} puntos encontrados</strong>
          {loading && <span>Cargando...</span>}
        </div>
        <div className="fiber-table-wrap">
          <table className="fiber-table infra-cajas-table">
            <thead>
              <tr>
                <th>Punto</th>
                <th>Comunidad</th>
                <th>Terminales</th>
                <th>Coordenadas</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!loading && cajas.length === 0 && (
                <tr><td colSpan="6" className="table-empty">No hay cajas para mostrar.</td></tr>
              )}
              {loading && (
                <tr><td colSpan="6" className="table-empty">Cargando cajas...</td></tr>
              )}
              {!loading && cajas.map((caja) => (
                <tr key={caja.id} onClick={() => openDetail(caja)}>
                  <td>
                    <strong>{caja.nombre || caja.codigo_caja}</strong>
                    <span>{caja.tipo === 'CAJA' ? `PON ${caja.pon} / Caja ${caja.numero_caja}` : 'OLT'}</span>
                  </td>
                  <td>
                    <strong>{caja.comunidad_nombre}</strong>
                    <span>{caja.nombre_original_kml || 'Registro manual'}</span>
                  </td>
                  <td>
                    <strong>{caja.terminales_libres ?? 0} libres</strong>
                    <span>{caja.terminales_ocupadas ?? 0} ocupadas / {caja.terminales_total ?? 0} total</span>
                  </td>
                  <td>
                    <strong>{Number(caja.latitud).toFixed(6)}</strong>
                    <span>{Number(caja.longitud).toFixed(6)}</span>
                  </td>
                  <td>
                    <span className={`status-pill ${Number(caja.activo) ? '' : 'inactive'}`}>{Number(caja.activo) ? 'ACTIVA' : 'INACTIVA'}</span>
                  </td>
                  <td>
                    <div className="infra-row-actions">
                      <button type="button" onClick={(event) => { event.stopPropagation(); openCajaForm(caja) }}>Editar</button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); toggleCaja(caja) }}>
                        {Number(caja.activo) ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function MapRecenter({ center }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, map.getZoom())
  }, [center, map])
  return null
}

function renderCajaForm(comunidades, caja) {
  return `
    <div class="swal-fiber-form infra-swal-form">
      <input id="caja-activo" type="hidden" value="${caja?.activo ?? 1}" />
      <label>Comunidad
        <select id="caja-comunidad">
          <option value="">Selecciona comunidad</option>
          ${comunidades.map((comunidad) => `<option value="${comunidad.id}" ${String(caja?.comunidad_id ?? '') === String(comunidad.id) ? 'selected' : ''}>${escapeHtml(comunidad.nombre)}</option>`).join('')}
        </select>
      </label>
      <label>Tipo
        <select id="caja-tipo">
          <option value="CAJA" ${caja?.tipo !== 'OLT' ? 'selected' : ''}>Caja</option>
          <option value="OLT" ${caja?.tipo === 'OLT' ? 'selected' : ''}>OLT</option>
        </select>
      </label>
      <label>Nombre
        <input id="caja-nombre" value="${escapeHtml(caja?.nombre ?? '')}" placeholder="CAJA A1 u OLT PRINCIPAL" />
      </label>
      <div class="infra-swal-row" data-caja-fields>
        <label>PON
          <input id="caja-pon" type="number" min="1" max="26" value="${caja?.pon ?? ''}" />
        </label>
        <label>Numero de caja
          <input id="caja-numero" type="number" min="1" value="${caja?.numero_caja ?? ''}" />
        </label>
      </div>
      <div class="infra-swal-row">
        <label>Latitud
          <input id="caja-latitud" type="number" step="any" value="${caja?.latitud ?? ''}" />
        </label>
        <label>Longitud
          <input id="caja-longitud" type="number" step="any" value="${caja?.longitud ?? ''}" />
        </label>
      </div>
    </div>
  `
}

function wireCajaTypeToggle(caja) {
  const typeSelect = document.getElementById('caja-tipo')
  const fields = document.querySelector('[data-caja-fields]')
  const refresh = () => {
    if (fields) fields.style.display = typeSelect?.value === 'OLT' ? 'none' : 'grid'
  }
  typeSelect?.addEventListener('change', refresh)
  refresh(caja)
}

function getCajaFormValues() {
  const tipo = document.getElementById('caja-tipo')?.value
  const payload = {
    comunidad_id: document.getElementById('caja-comunidad')?.value,
    tipo,
    nombre: document.getElementById('caja-nombre')?.value,
    pon: document.getElementById('caja-pon')?.value,
    numero_caja: document.getElementById('caja-numero')?.value,
    latitud: document.getElementById('caja-latitud')?.value,
    longitud: document.getElementById('caja-longitud')?.value,
    activo: document.getElementById('caja-activo')?.value ?? 1,
  }

  if (!payload.comunidad_id) {
    Swal.showValidationMessage('Selecciona una comunidad.')
    return false
  }
  if (!payload.nombre && payload.tipo === 'OLT') {
    Swal.showValidationMessage('Escribe el nombre de la OLT.')
    return false
  }
  if (payload.tipo === 'CAJA' && (!payload.pon || !payload.numero_caja)) {
    Swal.showValidationMessage('PON y numero de caja son obligatorios.')
    return false
  }
  if (!payload.latitud || !payload.longitud) {
    Swal.showValidationMessage('Latitud y longitud son obligatorias.')
    return false
  }
  return payload
}

function renderTerminalModal(terminal) {
  const estado = normalizeTerminalEstado(terminal.estado)
  const cliente = fullName(terminal)
  const clienteLine = terminal.numero_cliente ? `${terminal.numero_cliente} - ${cliente || 'SIN NOMBRE'}` : 'Sin cliente'

  if (estado === 'OCUPADO') {
    return `
      <div class="terminal-action-modal">
        <p><strong>Estado:</strong> OCUPADA</p>
        <p><strong>Cliente:</strong> ${escapeHtml(clienteLine)}</p>
        <p><strong>Servicio:</strong> ${escapeHtml(terminal.paquete_nombre || 'Sin paquete')}</p>
        <p><strong>Alfanumerico:</strong> ${escapeHtml(terminal.alfanumerico_equipo || 'Sin alfanumerico')}</p>
      </div>
    `
  }

  return `
    <div class="terminal-action-modal">
      <p><strong>Estado:</strong> ${escapeHtml(estado)}</p>
    </div>
  `
}

function renderServicioOption(servicio) {
  const nombre = fullName(servicio) || 'SIN NOMBRE'
  const disabled = servicio.caja_id || servicio.caja_terminal_id
  return `
    <button type="button" class="service-result-card ${disabled ? 'disabled' : ''}" data-servicio-id="${disabled ? '' : servicio.servicio_fibra_id}" ${disabled ? 'disabled' : ''}>
      <strong>${escapeHtml(servicio.numero_cliente || 'SIN CLIENTE')} - ${escapeHtml(nombre)}</strong>
      <span>${escapeHtml(servicio.comunidad_nombre || 'Sin comunidad')}</span>
      <span>Servicio: ${escapeHtml(servicio.paquete_nombre || 'Sin paquete')}</span>
      <span>Alfanumerico: ${escapeHtml(servicio.alfanumerico_equipo || 'Sin alfanumerico')}</span>
      ${disabled ? '<em>Ya vinculado a otra caja/terminal</em>' : ''}
    </button>
  `
}

function formatTerminalLabel(terminal) {
  const estado = normalizeTerminalEstado(terminal.estado)
  if (estado === 'OCUPADO' && terminal.numero_cliente) return `OCUPADO - ${terminal.numero_cliente}`
  return estado
}

function normalizeTerminalEstado(value) {
  const estado = String(value ?? '').trim().toUpperCase()
  if (estado === 'DA\u00d1ADO' || estado === 'DA\u00c3\u2018ADO' || estado === 'DA\u00c3\u0192\u00e2\u20ac\u02dcADO') return 'DA\u00d1ADO'
  return estado
}

function getTerminalClass(estado) {
  return normalizeTerminalEstado(estado).toLowerCase().replace('\u00f1', 'n')
}
function fullName(item) {
  return [item.nombres, item.apellido_paterno, item.apellido_materno].filter(Boolean).join(' ')
}

function renderKmlForm(comunidades, selectedComunidadId) {
  return `
    <div class="swal-fiber-form">
      <label>Comunidad destino
        <select id="kml-comunidad">
          <option value="">Selecciona comunidad</option>
          ${comunidades.map((comunidad) => `<option value="${comunidad.id}" ${String(selectedComunidadId) === String(comunidad.id) ? 'selected' : ''}>${escapeHtml(comunidad.nombre)}</option>`).join('')}
        </select>
      </label>
      <label>Archivo KML
        <input id="kml-file" type="file" accept=".kml,application/vnd.google-earth.kml+xml" />
      </label>
      <p class="infra-kml-note">KMZ se importara despues. Por ahora selecciona un archivo .kml.</p>
    </div>
  `
}

function showError(message) {
  Swal.fire({ icon: 'error', title: 'Error', text: message, confirmButtonColor: '#4274D9' })
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export default CajasFibra
