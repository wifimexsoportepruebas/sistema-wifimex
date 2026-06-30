import { useCallback, useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'
import '../../styles/Comunidades.css'

function Comunidades({ apiUrl, token }) {
  const [comunidades, setComunidades] = useState([])
  const [resumen, setResumen] = useState({ total: 0, activas: 0, inactivas: 0 })
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [q, setQ] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('todas')

  // Modal / Form state
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingComunidad, setEditingComunidad] = useState(null)
  const [nombre, setNombre] = useState('')
  const [prefijo, setPrefijo] = useState('')
  const [numeroInicial, setNumeroInicial] = useState('')
  const [siguienteNumero, setSiguienteNumero] = useState('')
  const [latitud, setLatitud] = useState('')
  const [longitud, setLongitud] = useState('')
  const [activo, setActivo] = useState(true)

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const loadComunidades = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('estado', estadoFilter)
      if (q.trim()) params.set('q', q)

      const response = await fetch(`${apiUrl}/api/comunidades-admin?${params.toString()}`, { headers: authHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudieron cargar las comunidades.')
      
      setComunidades(data.comunidades ?? [])
      setResumen(data.resumen ?? { total: 0, activas: 0, inactivas: 0 })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    } finally {
      setLoading(false)
    }
  }, [apiUrl, authHeaders, estadoFilter, q])

  useEffect(() => {
    loadComunidades()
  }, [loadComunidades])

  const handleOpenCreateModal = () => {
    setEditingComunidad(null)
    setNombre('')
    setPrefijo('')
    setNumeroInicial('1000')
    setSiguienteNumero('1000')
    setLatitud('')
    setLongitud('')
    setActivo(true)
    setShowFormModal(true)
  }

  const handleOpenEditModal = (c) => {
    setEditingComunidad(c)
    setNombre(c.nombre)
    setPrefijo(c.prefijo ?? '')
    setNumeroInicial(String(c.numero_inicial ?? ''))
    setSiguienteNumero(String(c.siguiente_numero ?? ''))
    setLatitud(c.latitud !== null ? String(c.latitud) : '')
    setLongitud(c.longitud !== null ? String(c.longitud) : '')
    setActivo(c.activo === 1)
    setShowFormModal(true)
  }

  const handleToggleEstado = async (c) => {
    const nuevoEstado = c.activo === 1 ? 0 : 1
    const actionText = nuevoEstado === 1 ? 'reactivar' : 'desactivar'
    const confirmTitle = nuevoEstado === 1 ? '¿Reactivar comunidad?' : '¿Desactivar comunidad?'
    const confirmText = nuevoEstado === 1
      ? 'La comunidad volverá a aparecer como activa en el sistema.'
      : 'La comunidad dejará de aparecer como activa, pero no se eliminarán sus datos.'

    const confirm = await Swal.fire({
      title: confirmTitle,
      text: confirmText,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: nuevoEstado === 1 ? 'Reactivar' : 'Desactivar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: nuevoEstado === 1 ? '#10b981' : '#ef4444',
      cancelButtonColor: '#94a3b8'
    })

    if (!confirm.isConfirmed) return

    try {
      const response = await fetch(`${apiUrl}/api/comunidades-admin/${c.id}/estado`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: nuevoEstado })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? `No se pudo ${actionText} la comunidad.`)

      Swal.fire({ icon: 'success', title: 'Completado', text: data.message, confirmButtonColor: '#4274D9' })
      loadComunidades()
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()

    const nameVal = nombre.trim().toUpperCase()
    const prefVal = prefijo.trim().toUpperCase()
    const numInitVal = Number(numeroInicial)
    const nextNumVal = Number(siguienteNumero)
    const latVal = latitud !== '' ? Number(latitud) : null
    const lngVal = longitud !== '' ? Number(longitud) : null

    // Validations
    if (!nameVal) {
      Swal.fire({ icon: 'warning', title: 'Validación', text: 'El nombre es obligatorio.', confirmButtonColor: '#4274D9' })
      return
    }
    if (!prefVal) {
      Swal.fire({ icon: 'warning', title: 'Validación', text: 'El prefijo es obligatorio.', confirmButtonColor: '#4274D9' })
      return
    }
    if (isNaN(numInitVal) || numInitVal < 0) {
      Swal.fire({ icon: 'warning', title: 'Validación', text: 'El número inicial debe ser un entero mayor o igual a 0.', confirmButtonColor: '#4274D9' })
      return
    }
    if (isNaN(nextNumVal) || nextNumVal < numInitVal) {
      Swal.fire({ icon: 'warning', title: 'Validación', text: 'El siguiente número debe ser mayor o igual al número inicial.', confirmButtonColor: '#4274D9' })
      return
    }
    if (latVal !== null && (isNaN(latVal) || latVal < -90 || latVal > 90)) {
      Swal.fire({ icon: 'warning', title: 'Validación', text: 'La latitud debe ser un número entre -90 y 90.', confirmButtonColor: '#4274D9' })
      return
    }
    if (lngVal !== null && (isNaN(lngVal) || lngVal < -180 || lngVal > 180)) {
      Swal.fire({ icon: 'warning', title: 'Validación', text: 'La longitud debe ser un número entre -180 y 180.', confirmButtonColor: '#4274D9' })
      return
    }

    const payload = {
      nombre: nameVal,
      prefijo: prefVal,
      numero_inicial: numInitVal,
      siguiente_numero: nextNumVal,
      latitud: latVal,
      longitud: lngVal,
      activo: activo ? 1 : 0
    }

    const isEdit = !!editingComunidad
    const urlEndpoint = isEdit 
      ? `${apiUrl}/api/comunidades-admin/${editingComunidad.id}`
      : `${apiUrl}/api/comunidades-admin`
    const method = isEdit ? 'PUT' : 'POST'

    try {
      const response = await fetch(urlEndpoint, {
        method,
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar la comunidad.')

      Swal.fire({
        icon: 'success',
        title: 'Guardado',
        text: isEdit ? 'Comunidad actualizada correctamente.' : 'Comunidad creada correctamente.',
        confirmButtonColor: '#4274D9'
      })
      setShowFormModal(false)
      loadComunidades()
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    }
  }

  return (
    <div className="comunidades-page fiber-page">
      <section className="fiber-page-header">
        <div>
          <span className="fiber-kicker">Catálogos del sistema</span>
          <h1>Comunidades</h1>
          <p>Administra comunidades, prefijos y coordenadas operativas.</p>
        </div>
        <div>
          <button type="button" className="fiber-primary-button" onClick={handleOpenCreateModal}>
            + Nueva comunidad
          </button>
        </div>
      </section>

      <section className="comunidades-filters-bar">
        <div className="comunidades-filter-group">
          <label htmlFor="search-input">Buscar comunidad</label>
          <input
            id="search-input"
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o prefijo..."
          />
        </div>
        <div className="comunidades-filter-group">
          <label htmlFor="select-estado">Estado</label>
          <select
            id="select-estado"
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
          >
            <option value="todas">Todas</option>
            <option value="activas">Activas</option>
            <option value="inactivas">Inactivas</option>
          </select>
        </div>
        <button
          type="button"
          className="fiber-primary-button"
          onClick={loadComunidades}
          style={{ minHeight: 'auto', padding: '12px 24px', borderRadius: '12px' }}
        >
          Filtrar
        </button>
      </section>

      <section className="comunidades-summary-grid">
        <div className="comunidades-summary-card" style={{ borderLeft: '4px solid #475569' }}>
          <div className="comunidades-summary-card-value">{resumen.total}</div>
          <div className="comunidades-summary-card-label">Comunidades totales</div>
        </div>
        <div className="comunidades-summary-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="comunidades-summary-card-value">{resumen.activas}</div>
          <div className="comunidades-summary-card-label">Activas</div>
        </div>
        <div className="comunidades-summary-card" style={{ borderLeft: '4px solid #94a3b8' }}>
          <div className="comunidades-summary-card-value">{resumen.inactivas}</div>
          <div className="comunidades-summary-card-label">Inactivas</div>
        </div>
      </section>

      <section className="fiber-panel">
        <div className="fiber-table-wrap">
          <table className="fiber-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Prefijo</th>
                <th>Número Inicial</th>
                <th>Siguiente Número</th>
                <th>Latitud</th>
                <th>Longitud</th>
                <th>Estado</th>
                <th style={{ width: '160px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Cargando comunidades...</td>
                </tr>
              )}
              {!loading && comunidades.length === 0 && (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No se encontraron comunidades.</td>
                </tr>
              )}
              {!loading && comunidades.map((c) => (
                <tr key={c.id}>
                  <td><strong>#{c.id}</strong></td>
                  <td><strong>{c.nombre}</strong></td>
                  <td><span className="soft-pill">{c.prefijo || '-'}</span></td>
                  <td>{c.numero_inicial ?? '-'}</td>
                  <td>{c.siguiente_numero ?? '-'}</td>
                  <td>{c.latitud !== null ? c.latitud.toFixed(6) : 'N/A'}</td>
                  <td>{c.longitud !== null ? c.longitud.toFixed(6) : 'N/A'}</td>
                  <td>
                    <span className={`status-pill ${c.activo === 1 ? 'activo' : 'inactivo'}`}>
                      {c.activo === 1 ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        type="button"
                        className="fiber-link-button"
                        style={{ padding: '4px 8px', fontSize: '0.82rem' }}
                        onClick={() => handleOpenEditModal(c)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="fiber-link-button"
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.82rem',
                          color: c.activo === 1 ? '#ef4444' : '#10b981'
                        }}
                        onClick={() => handleToggleEstado(c)}
                      >
                        {c.activo === 1 ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showFormModal && (
        <div className="client-modal-backdrop" onClick={() => setShowFormModal(false)}>
          <div className="client-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(580px, 100%)' }}>
            <div className="client-modal-header">
              <h3>{editingComunidad ? 'Editar Comunidad' : 'Nueva Comunidad'}</h3>
              <button type="button" onClick={() => setShowFormModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
                
                {editingComunidad && String(siguienteNumero) !== String(editingComunidad.siguiente_numero) && (
                  <div className="comunidades-warning-box">
                    <strong>⚠️ Advertencia de secuencia</strong>
                    <span>Este número se usa para generar el siguiente cliente de la comunidad. Modifícalo solo si estás seguro.</span>
                  </div>
                )}

                <div className="comunidades-form-grid">
                  <div className="comunidades-filter-group">
                    <label htmlFor="form-nombre">Nombre de la comunidad *</label>
                    <input
                      id="form-nombre"
                      type="text"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Ej. AMOJILECA"
                      required
                    />
                  </div>
                  <div className="comunidades-filter-group">
                    <label htmlFor="form-prefijo">Prefijo (máx 5 letras) *</label>
                    <input
                      id="form-prefijo"
                      type="text"
                      value={prefijo}
                      maxLength={5}
                      onChange={(e) => setPrefijo(e.target.value)}
                      placeholder="Ej. AMJ"
                      required
                    />
                  </div>
                </div>

                <div className="comunidades-form-grid">
                  <div className="comunidades-filter-group">
                    <label htmlFor="form-num-init">Número inicial *</label>
                    <input
                      id="form-num-init"
                      type="number"
                      min="0"
                      value={numeroInicial}
                      onChange={(e) => setNumeroInicial(e.target.value)}
                      placeholder="Ej. 1000"
                      required
                    />
                  </div>
                  <div className="comunidades-filter-group">
                    <label htmlFor="form-next-num">Siguiente número *</label>
                    <input
                      id="form-next-num"
                      type="number"
                      min="0"
                      value={siguienteNumero}
                      onChange={(e) => setSiguienteNumero(e.target.value)}
                      placeholder="Ej. 1000"
                      required
                    />
                  </div>
                </div>

                <div className="comunidades-form-grid">
                  <div className="comunidades-filter-group">
                    <label htmlFor="form-latitud">Latitud (opcional)</label>
                    <input
                      id="form-latitud"
                      type="text"
                      value={latitud}
                      onChange={(e) => setLatitud(e.target.value)}
                      placeholder="Ej. 17.5696"
                    />
                  </div>
                  <div className="comunidades-filter-group">
                    <label htmlFor="form-longitud">Longitud (opcional)</label>
                    <input
                      id="form-longitud"
                      type="text"
                      value={longitud}
                      onChange={(e) => setLongitud(e.target.value)}
                      placeholder="Ej. -99.5704"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <input
                    id="form-activo"
                    type="checkbox"
                    checked={activo}
                    onChange={(e) => setActivo(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="form-activo" style={{ fontSize: '0.88rem', fontWeight: 'bold', color: '#1e293b', cursor: 'pointer' }}>
                    Comunidad activa
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', padding: '16px 24px', borderTop: '1px solid #e2e8f0', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
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
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="fiber-primary-button"
                  style={{ minHeight: 'auto', padding: '10px 24px', borderRadius: '12px' }}
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Comunidades
