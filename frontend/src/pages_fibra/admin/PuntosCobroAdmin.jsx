import { useState, useEffect, useCallback, useMemo } from 'react'
import Swal from 'sweetalert2'
import '../../styles/PuntosCobroAdmin.css'

const YEARS = [2026, 2027, 2028, 2029, 2030]
const MONTHS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' }
]

function PuntosCobroAdmin({ apiUrl, token }) {
  const [activeTab, setActiveTab] = useState('puntos')
  const [puntos, setPuntos] = useState([])
  const [comunidades, setComunidades] = useState([])
  const [ciclos, setCiclos] = useState([])

  // Filters
  const now = new Date()
  const [filterAnio, setFilterAnio] = useState(now.getFullYear())
  const [filterMes, setFilterMes] = useState(now.getMonth() + 1)
  const [filterComunidad, setFilterComunidad] = useState('')
  const [filterCiclo, setFilterCiclo] = useState('')
  const [filterPunto, setFilterPunto] = useState('')

  // Summaries & History
  const [resumen, setResumen] = useState({
    total_general: 0,
    cantidad_pagos: 0,
    total_hoy: 0,
    total_por_punto: [],
    total_por_comunidad: [],
    total_por_ciclo: [],
    total_por_dia: []
  })
  const [pagos, setPagos] = useState([])

  // Loading States
  const [loading, setLoading] = useState(true)
  const [loadingResumen, setLoadingResumen] = useState(false)
  const [loadingPagos, setLoadingPagos] = useState(false)

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPunto, setEditingPunto] = useState(null)
  const [formName, setFormName] = useState('')
  const [formComunidadId, setFormComunidadId] = useState('')
  const [formDireccion, setFormDireccion] = useState('')
  const [formTelefono, setFormTelefono] = useState('')

  const authHeaders = useMemo(() => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }), [token])

  // Get catalogs (communities & cycles)
  const loadCatalogs = useCallback(async () => {
    try {
      const [comunidadesRes, ciclosRes] = await Promise.all([
        fetch(`${apiUrl}/api/comunidades`, { headers: authHeaders }),
        fetch(`${apiUrl}/api/ciclos-corte`, { headers: authHeaders })
      ])
      const comunidadesData = await comunidadesRes.json()
      const ciclosData = await ciclosRes.json()

      if (comunidadesRes.ok) setComunidades(comunidadesData.comunidades ?? [])
      if (ciclosRes.ok) setCiclos(ciclosData.ciclos ?? [])
    } catch (err) {
      console.error('Error loading catalogs:', err)
    }
  }, [apiUrl, authHeaders])

  // Get points list
  const loadPuntos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${apiUrl}/api/admin/puntos-cobro`, { headers: authHeaders })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudieron cargar los puntos de cobro')
      setPuntos(data.puntos_cobro ?? [])
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    } finally {
      setLoading(false)
    }
  }, [apiUrl, authHeaders])

  // Get summary of statistics
  const loadResumen = useCallback(async () => {
    setLoadingResumen(true)
    try {
      const params = new URLSearchParams({
        anio: String(filterAnio),
        mes: String(filterMes)
      })
      if (filterComunidad) params.append('comunidad_id', filterComunidad)
      if (filterCiclo) params.append('ciclo_corte_id', filterCiclo)
      if (filterPunto) params.append('punto_cobro_id', filterPunto)

      const res = await fetch(`${apiUrl}/api/admin/puntos-cobro/resumen?${params.toString()}`, { headers: authHeaders })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo cargar el resumen')
      setResumen(data.resumen ?? {
        total_general: 0,
        cantidad_pagos: 0,
        total_hoy: 0,
        total_por_punto: [],
        total_por_comunidad: [],
        total_por_ciclo: [],
        total_por_dia: []
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingResumen(false)
    }
  }, [apiUrl, authHeaders, filterAnio, filterMes, filterComunidad, filterCiclo, filterPunto])

  // Get detailed payments list
  const loadPagos = useCallback(async () => {
    setLoadingPagos(true)
    try {
      const params = new URLSearchParams({
        anio: String(filterAnio),
        mes: String(filterMes)
      })
      if (filterComunidad) params.append('comunidad_id', filterComunidad)
      if (filterCiclo) params.append('ciclo_corte_id', filterCiclo)
      if (filterPunto) params.append('punto_cobro_id', filterPunto)

      const res = await fetch(`${apiUrl}/api/admin/puntos-cobro/pagos?${params.toString()}`, { headers: authHeaders })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo cargar el detalle de pagos')
      setPagos(data.pagos ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingPagos(false)
    }
  }, [apiUrl, authHeaders, filterAnio, filterMes, filterComunidad, filterCiclo, filterPunto])

  // Initial load
  useEffect(() => {
    loadCatalogs()
    loadPuntos()
  }, [loadCatalogs, loadPuntos])

  // Load summary and payments when filters change or when active tab changes
  useEffect(() => {
    if (activeTab === 'reportes') {
      loadResumen()
    } else if (activeTab === 'pagos') {
      loadPagos()
    }
  }, [activeTab, loadResumen, loadPagos])

  // Modal open for create/edit
  const handleOpenModal = (punto = null) => {
    setEditingPunto(punto)
    if (punto) {
      setFormName(punto.nombre)
      setFormComunidadId(punto.comunidad_id)
      setFormDireccion(punto.direccion || '')
      setFormTelefono(punto.telefono || '')
    } else {
      setFormName('')
      setFormComunidadId('')
      setFormDireccion('')
      setFormTelefono('')
    }
    setModalOpen(true)
  }

  // Save point of payment
  const handleSavePunto = async (e) => {
    e.preventDefault()
    if (!formName.trim() || !formComunidadId) {
      Swal.fire({ icon: 'warning', title: 'Atención', text: 'El nombre y la comunidad son obligatorios', confirmButtonColor: '#4274D9' })
      return
    }

    try {
      const payload = {
        nombre: formName.trim(),
        comunidad_id: Number(formComunidadId),
        direccion: formDireccion.trim() || null,
        telefono: formTelefono.trim() || null
      }

      let res
      if (editingPunto) {
        res = await fetch(`${apiUrl}/api/admin/puntos-cobro/${editingPunto.id}`, {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify(payload)
        })
      } else {
        res = await fetch(`${apiUrl}/api/admin/puntos-cobro`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(payload)
        })
      }

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar el punto de cobro')

      Swal.fire({
        icon: 'success',
        title: 'Guardado',
        text: editingPunto ? 'Punto de cobro actualizado correctamente.' : 'Punto de cobro creado correctamente.',
        confirmButtonColor: '#4274D9'
      })

      setModalOpen(false)
      loadPuntos()
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    }
  }

  // Toggle active status
  const handleToggleStatus = async (punto) => {
    const nextState = punto.activo ? 0 : 1
    const actionText = nextState ? 'activar' : 'desactivar'

    const confirm = await Swal.fire({
      title: `¿Confirmas ${actionText} este punto?`,
      text: nextState
        ? 'El enlace público volverá a estar disponible para recibir cobros.'
        : 'Cualquier persona que use el link no podrá registrar ni visualizar información.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4274D9',
      cancelButtonColor: '#cbd5e1'
    })

    if (!confirm.isConfirmed) return

    try {
      const res = await fetch(`${apiUrl}/api/admin/puntos-cobro/${punto.id}/activo`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ activo: nextState })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo actualizar el estado')

      Swal.fire({ icon: 'success', title: 'Actualizado', text: 'Estado cambiado correctamente.', confirmButtonColor: '#4274D9' })
      loadPuntos()
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    }
  }

  // Regenerate Token
  const handleRegenerateToken = async (punto) => {
    const confirm = await Swal.fire({
      title: '¿Regenerar enlace de acceso?',
      text: 'El enlace actual se invalidará inmediatamente y los dispositivos conectados deberán usar el nuevo link.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, regenerar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#cbd5e1'
    })

    if (!confirm.isConfirmed) return

    try {
      const res = await fetch(`${apiUrl}/api/admin/puntos-cobro/${punto.id}/regenerar-token`, {
        method: 'POST',
        headers: authHeaders
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo regenerar el token')

      Swal.fire({ icon: 'success', title: 'Regenerado', text: 'Enlace regenerado correctamente.', confirmButtonColor: '#4274D9' })
      loadPuntos()
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    }
  }

  // Copy Link helper
  const handleCopyLink = (tokenAcceso) => {
    const link = `${window.location.origin}/punto-cobro/${tokenAcceso}`
    navigator.clipboard.writeText(link)
      .then(() => {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Enlace copiado al portapapeles',
          showConfirmButton: false,
          timer: 1500
        })
      })
      .catch((err) => {
        console.error('Copy failed:', err)
      })
  }

  // Format currency helper
  const formatMoney = (val) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val)
  }

  // Count active points of cobro
  const activeCount = useMemo(() => {
    return puntos.filter(p => p.activo).length
  }, [puntos])

  // Sum of total cobrado this month across points
  const totalMesPoints = useMemo(() => {
    return puntos.reduce((sum, p) => sum + Number(p.total_mes ?? 0), 0)
  }, [puntos])

  // Sum of total cobrado today across points
  const totalHoyPoints = useMemo(() => {
    return puntos.reduce((sum, p) => sum + Number(p.total_hoy ?? 0), 0)
  }, [puntos])

  // Count of total monthly payments
  const totalPaymentsPoints = useMemo(() => {
    return puntos.reduce((sum, p) => sum + Number(p.cantidad_pagos_mes ?? 0), 0)
  }, [puntos])

  return (
    <div className="puntos-cobro-admin-page fiber-page">
      <section className="fiber-page-header">
        <div>
          <span className="fiber-kicker">Módulo administrativo</span>
          <h1>Puntos de Cobro</h1>
          <p className="fiber-page-desc">Administra puntos de cobro físicos, genera enlaces públicos de recaudación y consulta estadísticas de ingresos.</p>
        </div>
        <button type="button" className="fiber-primary-button" onClick={() => handleOpenModal(null)}>
          + Nuevo punto de cobro
        </button>
      </section>

      {/* Metrics Summary Grid */}
      <div className="metrics-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="metrics-summary-card" style={{ borderLeft: '4px solid #10b981', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
          <div className="metrics-summary-card-value" style={{ fontSize: '1.8rem', fontWeight: '800', color: '#10b981' }}>{formatMoney(totalHoyPoints)}</div>
          <div className="metrics-summary-card-label" style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 'bold', marginTop: '4px' }}>Total Cobrado Hoy</div>
        </div>
        <div className="metrics-summary-card" style={{ borderLeft: '4px solid #3b82f6', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
          <div className="metrics-summary-card-value" style={{ fontSize: '1.8rem', fontWeight: '800', color: '#3b82f6' }}>{formatMoney(totalMesPoints)}</div>
          <div className="metrics-summary-card-label" style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 'bold', marginTop: '4px' }}>Total Cobrado este Mes</div>
        </div>
        <div className="metrics-summary-card" style={{ borderLeft: '4px solid #eab308', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
          <div className="metrics-summary-card-value" style={{ fontSize: '1.8rem', fontWeight: '800', color: '#d97706' }}>{totalPaymentsPoints}</div>
          <div className="metrics-summary-card-label" style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 'bold', marginTop: '4px' }}>Cobros del Mes</div>
        </div>
        <div className="metrics-summary-card" style={{ borderLeft: '4px solid #8b5cf6', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
          <div className="metrics-summary-card-value" style={{ fontSize: '1.8rem', fontWeight: '800', color: '#8b5cf6' }}>{activeCount} / {puntos.length}</div>
          <div className="metrics-summary-card-label" style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 'bold', marginTop: '4px' }}>Puntos Activos</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="fiber-tabs" style={{ marginBottom: '20px' }}>
        <button type="button" className={activeTab === 'puntos' ? 'active' : ''} onClick={() => setActiveTab('puntos')}>
          Puntos de Cobro
        </button>
        <button type="button" className={activeTab === 'reportes' ? 'active' : ''} onClick={() => setActiveTab('reportes')}>
          Reportes y Totales
        </button>
        <button type="button" className={activeTab === 'pagos' ? 'active' : ''} onClick={() => setActiveTab('pagos')}>
          Detalle de Pagos
        </button>
      </div>

      {/* Filter panel for Reportes and Pagos tabs */}
      {(activeTab === 'reportes' || activeTab === 'pagos') && (
        <section className="fiber-panel" style={{ padding: '16px 24px', marginBottom: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', alignItems: 'center' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>
              Año
              <select value={filterAnio} onChange={(e) => setFilterAnio(Number(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px' }}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>
              Mes
              <select value={filterMes} onChange={(e) => setFilterMes(Number(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px' }}>
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </label>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>
              Comunidad
              <select value={filterComunidad} onChange={(e) => setFilterComunidad(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px' }}>
                <option value="">Todas</option>
                {comunidades.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>
              Ciclo de corte
              <select value={filterCiclo} onChange={(e) => setFilterCiclo(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px' }}>
                <option value="">Todos</option>
                {ciclos.map(cc => <option key={cc.id} value={cc.id}>{cc.nombre}</option>)}
              </select>
            </label>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>
              Punto de cobro
              <select value={filterPunto} onChange={(e) => setFilterPunto(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px' }}>
                <option value="">Todos</option>
                {puntos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', gap: '8px' }}>
            <button type="button" className="fiber-secondary-button" style={{ padding: '6px 14px', fontSize: '0.85rem', minHeight: 'auto' }} onClick={() => {
              setFilterAnio(now.getFullYear())
              setFilterMes(now.getMonth() + 1)
              setFilterComunidad('')
              setFilterCiclo('')
              setFilterPunto('')
            }}>
              Limpiar Filtros
            </button>
            <button type="button" className="fiber-primary-button" style={{ padding: '6px 16px', fontSize: '0.85rem', minHeight: 'auto' }} onClick={activeTab === 'reportes' ? loadResumen : loadPagos}>
              Filtrar
            </button>
          </div>
        </section>
      )}

      {/* Tab: Puntos de Cobro */}
      {activeTab === 'puntos' && (
        <section className="fiber-panel">
          <div className="fiber-table-wrap">
            <table className="fiber-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Localidad/Comunidad</th>
                  <th>Contacto/Dirección</th>
                  <th>Enlace de Acceso</th>
                  <th>Hoy</th>
                  <th>Mes</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="table-empty">Cargando puntos de cobro...</td>
                  </tr>
                ) : puntos.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="table-empty">No hay puntos de cobro registrados.</td>
                  </tr>
                ) : (
                  puntos.map((punto) => (
                    <tr key={punto.id}>
                      <td>
                        <strong style={{ color: '#1e293b' }}>{punto.nombre}</strong>
                      </td>
                      <td>
                        <strong>{punto.comunidad_nombre}</strong>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{punto.direccion || 'Sin dirección'}</div>
                        <div style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 'bold' }}>{punto.telefono || 'Sin teléfono'}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="fiber-secondary-button"
                            style={{ padding: '4px 10px', fontSize: '0.75rem', minHeight: 'auto', borderRadius: '6px' }}
                            onClick={() => handleCopyLink(punto.token_acceso)}
                          >
                            Copiar Link
                          </button>
                          <a
                            href={`/punto-cobro/${punto.token_acceso}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="fiber-link-button"
                            style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#2563eb' }}
                          >
                            Abrir
                          </a>
                        </div>
                      </td>
                      <td>
                        <strong style={{ color: '#10b981' }}>{formatMoney(punto.total_hoy)}</strong>
                      </td>
                      <td>
                        <strong style={{ color: '#3b82f6' }}>{formatMoney(punto.total_mes)}</strong>
                      </td>
                      <td>
                        <span className={`status-pill ${punto.activo ? 'activo' : 'inactivo'}`} style={{
                          background: punto.activo ? '#dcfce7' : '#fee2e2',
                          color: punto.activo ? '#15803d' : '#b91c1c',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '0.78rem',
                          fontWeight: 'bold'
                        }}>
                          {punto.activo ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="fiber-link-button"
                            style={{ fontSize: '0.82rem', color: '#475569' }}
                            onClick={() => handleOpenModal(punto)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="fiber-link-button"
                            style={{ fontSize: '0.82rem', color: punto.activo ? '#b91c1c' : '#15803d' }}
                            onClick={() => handleToggleStatus(punto)}
                          >
                            {punto.activo ? 'Desactivar' : 'Activar'}
                          </button>
                          <button
                            type="button"
                            className="fiber-link-button"
                            style={{ fontSize: '0.82rem', color: '#7c3aed' }}
                            onClick={() => handleRegenerateToken(punto)}
                          >
                            Regenerar Token
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab: Reportes y Totales */}
      {activeTab === 'reportes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Totales por Punto de Cobro */}
            <section className="fiber-panel" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: '800', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                Cobros por Punto de Cobro
              </h3>
              {loadingResumen ? (
                <p>Cargando datos...</p>
              ) : resumen.total_por_punto.length === 0 ? (
                <p style={{ color: '#64748b' }}>Sin cobros en este periodo.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {resumen.total_por_punto.map((item) => (
                    <div key={item.punto_cobro_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div>
                        <strong style={{ color: '#1e293b' }}>{item.punto_cobro}</strong>
                        <span style={{ fontSize: '0.78rem', color: '#64748b', marginLeft: '8px' }}>({item.cantidad_pagos} pagos)</span>
                      </div>
                      <strong style={{ color: '#0f172a' }}>{formatMoney(item.total)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Totales por Comunidad */}
            <section className="fiber-panel" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: '800', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                Cobros por Comunidad
              </h3>
              {loadingResumen ? (
                <p>Cargando datos...</p>
              ) : resumen.total_por_comunidad.length === 0 ? (
                <p style={{ color: '#64748b' }}>Sin cobros en este periodo.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {resumen.total_por_comunidad.map((item) => (
                    <div key={item.comunidad_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div>
                        <strong style={{ color: '#1e293b' }}>{item.comunidad}</strong>
                        <span style={{ fontSize: '0.78rem', color: '#64748b', marginLeft: '8px' }}>({item.cantidad_pagos} pagos)</span>
                      </div>
                      <strong style={{ color: '#0f172a' }}>{formatMoney(item.total)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Totales por Ciclo de Corte */}
            <section className="fiber-panel" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: '800', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                Cobros por Ciclo de Corte
              </h3>
              {loadingResumen ? (
                <p>Cargando datos...</p>
              ) : resumen.total_por_ciclo.length === 0 ? (
                <p style={{ color: '#64748b' }}>Sin cobros en este periodo.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {resumen.total_por_ciclo.map((item) => (
                    <div key={item.ciclo_corte_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div>
                        <strong style={{ color: '#1e293b' }}>{item.ciclo_corte}</strong>
                        <span style={{ fontSize: '0.78rem', color: '#64748b', marginLeft: '8px' }}>({item.cantidad_pagos} pagos)</span>
                      </div>
                      <strong style={{ color: '#0f172a' }}>{formatMoney(item.total)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Totales por Día */}
            <section className="fiber-panel" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: '800', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                Cobros Diarios
              </h3>
              {loadingResumen ? (
                <p>Cargando datos...</p>
              ) : resumen.total_por_dia.length === 0 ? (
                <p style={{ color: '#64748b' }}>Sin cobros en este periodo.</p>
              ) : (
                <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {resumen.total_por_dia.map((item) => (
                    <div key={item.dia} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div>
                        <strong style={{ color: '#1e293b' }}>{item.dia}</strong>
                        <span style={{ fontSize: '0.78rem', color: '#64748b', marginLeft: '8px' }}>({item.cantidad_pagos} pagos)</span>
                      </div>
                      <strong style={{ color: '#0f172a' }}>{formatMoney(item.total)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

        </div>
      )}

      {/* Tab: Detalle de Pagos */}
      {activeTab === 'pagos' && (
        <section className="fiber-panel">
          <div className="fiber-table-wrap">
            <table className="fiber-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Comunidad</th>
                  <th>Punto de Cobro</th>
                  <th>Detalle Pago</th>
                  <th>Mensualidad</th>
                  <th>Monto</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {loadingPagos ? (
                  <tr>
                    <td colSpan="8" className="table-empty">Cargando transacciones...</td>
                  </tr>
                ) : pagos.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="table-empty">No hay registros de pagos para los filtros seleccionados.</td>
                  </tr>
                ) : (
                  pagos.map((p) => (
                    <tr key={p.pago_id}>
                      <td>
                        <div style={{ fontWeight: 'bold' }}>{new Date(p.fecha_pago).toLocaleDateString('es-MX')}</div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{new Date(p.fecha_pago).toLocaleTimeString('es-MX')}</div>
                      </td>
                      <td>
                        <strong>{p.numero_cliente}</strong>
                        <div style={{ fontSize: '0.82rem', color: '#1e293b' }}>{p.cliente_nombre}</div>
                      </td>
                      <td>
                        <strong>{p.comunidad}</strong>
                      </td>
                      <td>
                        <strong style={{ color: '#4f46e5' }}>{p.punto_cobro}</strong>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.82rem' }}>{p.paquete}</div>
                        <div style={{ fontSize: '0.76rem', color: '#475569' }}>Ciclo: <strong>{p.ciclo_corte}</strong></div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569' }}>{MONTHS.find(m => m.value === p.mes)?.label} - {p.anio}</div>
                      </td>
                      <td>
                        <strong style={{ color: '#10b981', fontSize: '0.92rem' }}>{formatMoney(p.monto_pagado)}</strong>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: '#64748b' }}>{p.observaciones || '-'}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Modal: Create/Edit Point of Cobro */}
      {modalOpen && (
        <div className="client-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="client-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(500px, 100%)' }}>
            <div className="client-modal-header">
              <h3>{editingPunto ? 'Editar Punto de Cobro' : 'Nuevo Punto de Cobro'}</h3>
              <button type="button" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            
            <form onSubmit={handleSavePunto} style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 'bold', color: '#475569' }}>
                  Nombre del punto de cobro *
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ej. Tienda Doña María, Oficina Centro"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', fontSize: '0.9rem' }}
                  />
                </label>

                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 'bold', color: '#475569' }}>
                  Comunidad asociada *
                  <select
                    required
                    value={formComunidadId}
                    onChange={(e) => setFormComunidadId(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', fontSize: '0.9rem' }}
                  >
                    <option value="">Selecciona una comunidad</option>
                    {comunidades.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </label>

                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 'bold', color: '#475569' }}>
                  Dirección
                  <input
                    type="text"
                    value={formDireccion}
                    onChange={(e) => setFormDireccion(e.target.value)}
                    placeholder="Calle, número, referencias de ubicación"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', fontSize: '0.9rem' }}
                  />
                </label>

                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 'bold', color: '#475569' }}>
                  Teléfono de contacto
                  <input
                    type="text"
                    value={formTelefono}
                    onChange={(e) => setFormTelefono(e.target.value)}
                    placeholder="Teléfono a 10 dígitos"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', fontSize: '0.9rem' }}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <button type="button" className="fiber-secondary-button" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="fiber-primary-button">
                  {editingPunto ? 'Actualizar' : 'Crear Punto'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  )
}

export default PuntosCobroAdmin
