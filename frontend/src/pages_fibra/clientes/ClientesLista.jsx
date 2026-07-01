import { useCallback, useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'

const SPEED_OPTIONS = [10, 20, 30]
const PAGE_LIMIT = 20

function ClientesLista({ apiUrl, token, roles = [] }) {
  const [clientes, setClientes] = useState([])
  const [comunidades, setComunidades] = useState([])
  const [q, setQ] = useState('')
  const [comunidadId, setComunidadId] = useState('')
  const [velocidad, setVelocidad] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_LIMIT, total: 0, total_pages: 1 })

  // State for contract linking
  const [selectedCliente, setSelectedCliente] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [suggestedContracts, setSuggestedContracts] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [selectedContract, setSelectedContract] = useState(null)
  const [customNumeroContrato, setCustomNumeroContrato] = useState('')
  const [isChangeMode, setIsChangeMode] = useState(false)

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const canManageContracts = useMemo(() => {
    return roles.includes('ADMIN') || roles.includes('SOPORTE') || roles.includes('SOPORTE_FIBRA') || roles.includes('ATENCION_CLIENTE')
  }, [roles])

  const loadComunidades = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/comunidades`, { headers: authHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudieron cargar las comunidades.')
      setComunidades(data.comunidades ?? [])
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    }
  }, [apiUrl, authHeaders])

  const loadClientes = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_LIMIT),
      })

      if (q.trim()) params.set('q', q.trim())
      if (comunidadId) params.set('comunidad_id', comunidadId)
      if (velocidad) params.set('velocidad', velocidad)

      const response = await fetch(`${apiUrl}/api/clientes?${params.toString()}`, { headers: authHeaders })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error ?? 'No se pudieron cargar los clientes.')

      setClientes(data.clientes ?? [])
      setPagination(data.pagination ?? { page, limit: PAGE_LIMIT, total: data.clientes?.length ?? 0, total_pages: 1 })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    } finally {
      setLoading(false)
    }
  }, [apiUrl, authHeaders, comunidadId, page, q, velocidad])

  useEffect(() => {
    loadComunidades()
  }, [loadComunidades])

  useEffect(() => {
    loadClientes()
  }, [loadClientes])

  function handleSearch(event) {
    event.preventDefault()
    setPage(1)
    loadClientes()
  }

  function handleClear() {
    setQ('')
    setComunidadId('')
    setVelocidad('')
    setPage(1)
  }

  function getShortHash(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16).slice(0, 6).toUpperCase()
  }

  const loadSuggestions = useCallback(async (clienteId, qVal) => {
    setLoadingSuggestions(true)
    try {
      const params = new URLSearchParams({ cliente_id: String(clienteId) })
      if (qVal) params.set('q', qVal)
      const response = await fetch(`${apiUrl}/api/contratos/r2/sugerencias?${params.toString()}`, { headers: authHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudieron cargar sugerencias.')
      setSuggestedContracts(data.resultados ?? [])
    } catch (err) {
      console.error(err)
      setSuggestedContracts([])
    } finally {
      setLoadingSuggestions(false)
    }
  }, [apiUrl, authHeaders])

  const handleOpenVincularModal = useCallback((cliente, isChange = false) => {
    if (cliente.estado_servicio !== 'ACTIVO') {
      Swal.fire({
        icon: 'warning',
        title: 'Sin servicio activo',
        text: 'Este cliente no tiene servicio activo. Primero debe tener un servicio para poder vincular contrato.',
        confirmButtonColor: '#4274D9'
      })
      return
    }
    setIsChangeMode(isChange)
    setSelectedCliente(cliente)
    setIsModalOpen(true)
    setSearchQuery('')
    setSelectedContract(null)
    setCustomNumeroContrato('')
    loadSuggestions(cliente.id, '')
  }, [loadSuggestions])

  const handleSelectContract = (contract) => {
    setSelectedContract(contract)
    if (contract.numero_detectado) {
      setCustomNumeroContrato(`R2-${contract.numero_detectado}`)
    } else {
      setCustomNumeroContrato(`R2-${getShortHash(contract.r2_key)}`)
    }
  }

  const handleConfirmVincular = async () => {
    if (!selectedContract) {
      Swal.fire({ icon: 'warning', title: 'Atención', text: 'Por favor selecciona un contrato.', confirmButtonColor: '#4274D9' })
      return
    }
    if (!customNumeroContrato.trim()) {
      Swal.fire({ icon: 'warning', title: 'Atención', text: 'El número de contrato es obligatorio.', confirmButtonColor: '#4274D9' })
      return
    }

    if (isChangeMode && selectedContract.r2_key === selectedCliente.contrato_r2_key) {
      Swal.fire({ icon: 'warning', title: 'Atención', text: 'Este contrato ya está vinculado a este cliente.', confirmButtonColor: '#4274D9' })
      return
    }

    if (isChangeMode) {
      const isSystemGenerated = selectedCliente.contrato_origen === 'GENERADO'
      const warningText = isSystemGenerated
        ? 'Este contrato fue generado por el sistema. Si lo cambias, el contrato anterior quedará desvinculado del cliente, pero el PDF no se eliminará.'
        : 'El contrato anterior quedará desvinculado, pero el PDF no se eliminará.'

      const result = await Swal.fire({
        title: '¿Cambiar contrato del cliente?',
        text: warningText,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Cambiar contrato',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#4274D9',
        cancelButtonColor: '#cbd5e1'
      })

      if (!result.isConfirmed) return
    }

    try {
      const endpoint = isChangeMode
        ? `${apiUrl}/api/contratos/cambiar-vinculo`
        : `${apiUrl}/api/contratos/vincular-existente`

      const payload = isChangeMode
        ? {
            cliente_id: selectedCliente.id,
            contrato_actual_id: selectedCliente.contrato_id,
            nuevo_r2_key: selectedContract.r2_key,
            numero_contrato: customNumeroContrato.trim()
          }
        : {
            cliente_id: selectedCliente.id,
            r2_key: selectedContract.r2_key,
            numero_contrato: customNumeroContrato.trim()
          }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudo procesar la vinculación del contrato.')

      Swal.fire({
        icon: 'success',
        title: isChangeMode ? 'Contrato Cambiado' : 'Vínculo Exitoso',
        text: isChangeMode ? 'Contrato cambiado correctamente.' : 'Contrato vinculado correctamente.',
        confirmButtonColor: '#4274D9'
      })

      setIsModalOpen(false)
      loadClientes()
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    }
  }

  const handleVerContrato = async (contratoId) => {
    try {
      const response = await fetch(`${apiUrl}/api/contratos/${contratoId}/archivo`, {
        headers: authHeaders
      })
      if (!response.ok) {
        const text = await response.text()
        let errorMsg = 'No se pudo cargar el archivo del contrato.'
        try {
          const data = JSON.parse(text)
          errorMsg = data.error ?? errorMsg
        } catch {}
        throw new Error(errorMsg)
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    }
  }

  const totalPages = Math.max(Number(pagination.total_pages ?? 1), 1)

  return (
    <div className="clientes-lista-page fiber-page">
      <section className="fiber-page-header">
        <div>
          <span className="fiber-kicker">Clientes activos</span>
          <h1>Lista de clientes</h1>
        </div>
        <button type="button" className="fiber-primary-button" onClick={() => { window.location.hash = '#clientes-alta' }}>
          Nuevo cliente
        </button>
      </section>

      <section className="fiber-panel clientes-list-panel">
        <form className="client-filters" onSubmit={handleSearch}>
          <input
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Buscar por numero, nombre, telefono, comunidad o equipo"
          />
          <select value={comunidadId} onChange={(event) => setComunidadId(event.target.value)}>
            <option value="">Todas las localidades</option>
            {comunidades.map((comunidad) => (
              <option key={comunidad.id} value={comunidad.id}>
                {comunidad.nombre}
              </option>
            ))}
          </select>
          <select value={velocidad} onChange={(event) => setVelocidad(event.target.value)}>
            <option value="">Todos los paquetes</option>
            {SPEED_OPTIONS.map((speed) => (
              <option key={speed} value={speed}>
                {speed} Megas
              </option>
            ))}
          </select>
          <button type="submit" className="fiber-primary-button">Buscar</button>
          <button type="button" className="fiber-link-button" onClick={handleClear}>Limpiar</button>
        </form>

        <div className="client-list-meta">
          <strong>{pagination.total ?? 0} clientes encontrados</strong>
          <span>Ordenados de menor a mayor por localidad y numero de cliente.</span>
        </div>

        <div className="fiber-table-wrap">
          <table className="fiber-table client-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contacto</th>
                <th>Comunidad</th>
                <th>Servicio</th>
                <th>Cobro</th>
                <th>Equipo</th>
                <th>Estado</th>
                <th>Contrato</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="8" className="table-empty">Cargando clientes...</td>
                </tr>
              )}
              {!loading && clientes.length === 0 && (
                <tr>
                  <td colSpan="8" className="table-empty">No hay clientes para mostrar.</td>
                </tr>
              )}
              {!loading && clientes.map((cliente) => (
                <tr key={cliente.id}>
                  <td>
                    <strong>{cliente.numero_cliente}</strong>
                    <span>{fullName(cliente) || 'Sin nombre'}</span>
                  </td>
                  <td>
                    <strong>{cliente.telefono || 'Sin telefono'}</strong>
                    <span>{cliente.direccion || 'Sin direccion'}</span>
                  </td>
                  <td>
                    <strong>{cliente.comunidad_nombre || 'Sin comunidad'}</strong>
                    <span>{cliente.referencia || 'Sin referencia'}</span>
                  </td>
                  <td>
                    <strong>{cliente.paquete_nombre || 'Sin paquete'}</strong>
                    <span>{cliente.velocidad_megas ? `${cliente.velocidad_megas} Mbps` : 'Sin velocidad'}</span>
                  </td>
                  <td>
                    <strong>{money(cliente.precio_mensual)}</strong>
                    <span>{cliente.ciclo_corte_nombre || 'Sin ciclo'}</span>
                  </td>
                  <td>
                    <strong>{cliente.alfanumerico_equipo || 'Sin alfanumerico'}</strong>
                    <span>
                      {cliente.codigo_caja && cliente.caja_terminal_numero
                        ? `Caja ${cliente.codigo_caja}, Terminal ${cliente.caja_terminal_numero}`
                        : cliente.ip_asignada || 'Sin IP'}
                    </span>
                  </td>
                  <td>
                    <span className="status-pill">{cliente.estado_servicio || cliente.estado_cliente || 'ACTIVO'}</span>
                  </td>
                  <td>
                    {cliente.contrato_id ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="fiber-link-button"
                          style={{ fontWeight: 'bold' }}
                          onClick={() => handleVerContrato(cliente.contrato_id)}
                        >
                          Ver contrato
                        </button>
                        {canManageContracts && (
                          <button
                            type="button"
                            className="fiber-link-button"
                            style={{ color: '#d97706', fontSize: '0.85rem' }}
                            onClick={() => handleOpenVincularModal(cliente, true)}
                          >
                            Cambiar contrato
                          </button>
                        )}
                      </div>
                    ) : (
                      canManageContracts && (
                        <button
                          type="button"
                          className="fiber-primary-button"
                          style={{ padding: '4px 10px', fontSize: '0.78rem', minHeight: 'auto', borderRadius: '8px' }}
                          onClick={() => handleOpenVincularModal(cliente, false)}
                        >
                          Vincular
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="fiber-pagination">
            <button type="button" onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={page <= 1 || loading}>
              Anterior
            </button>
            <span>Pagina {page} de {totalPages}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(current + 1, totalPages))} disabled={page >= totalPages || loading}>
              Siguiente
            </button>
          </div>
        )}
      </section>

      {isModalOpen && selectedCliente && (
        <div className="client-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="client-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(680px, 100%)', maxHeight: '90vh' }}>
            <div className="client-modal-header">
              <h3>{isChangeMode ? 'Cambiar contrato vinculado' : 'Vincular Contrato Existente'}</h3>
              <button type="button" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            
            <div style={{ padding: '20px 24px 0', fontSize: '0.9rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div>
                  <strong>Cliente:</strong> {fullName(selectedCliente)}
                </div>
                <div>
                  <strong>Comunidad:</strong> {selectedCliente.comunidad_nombre || 'Sin comunidad'}
                </div>
                <div>
                  <strong>Teléfono:</strong> {selectedCliente.telefono || 'Sin teléfono'}
                </div>
                <div>
                  <strong>Número Cliente:</strong> {selectedCliente.numero_cliente}
                </div>
              </div>
            </div>

            {isChangeMode && (
              <div style={{ padding: '12px 24px 0', fontSize: '0.85rem' }}>
                <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', padding: '10px 14px', borderRadius: '10px', color: '#78350f' }}>
                  <h4 style={{ margin: '0 0 4px', fontWeight: 'bold', fontSize: '0.9rem' }}>Contrato actual:</h4>
                  <div><strong>Número:</strong> {selectedCliente.contrato_numero || 'Sin número'}</div>
                  <div><strong>Origen:</strong> {selectedCliente.contrato_origen || 'GENERADO'}</div>
                  <div style={{ wordBreak: 'break-all' }}><strong>Archivo (R2):</strong> {selectedCliente.contrato_r2_key || 'No disponible'}</div>
                </div>
              </div>
            )}

            <input
              type="text"
              className="client-search-input"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                loadSuggestions(selectedCliente.id, e.target.value);
              }}
              placeholder="Buscar por nombre o número de contrato viejo en la comunidad..."
              style={{ margin: '16px 24px 12px' }}
            />

            <div className="client-results" style={{ padding: '0 24px 16px', maxHeight: '300px', overflowY: 'auto' }}>
              {loadingSuggestions ? (
                <p style={{ textAlign: 'center' }}>Cargando sugerencias de R2...</p>
              ) : suggestedContracts.length === 0 ? (
                <p style={{ textAlign: 'center' }}>
                  No se encontraron contratos en la carpeta de esta comunidad.<br/>
                  Puedes buscar manualmente con el cuadro de arriba.
                </p>
              ) : (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {suggestedContracts.map((item) => (
                    <div
                      key={item.r2_key}
                      onClick={() => handleSelectContract(item)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: selectedContract?.r2_key === item.r2_key ? '2px solid #4274D9' : '1px solid #cbd5e1',
                        background: selectedContract?.r2_key === item.r2_key ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <strong style={{ color: '#1e293b', fontSize: '0.9rem', wordBreak: 'break-all' }}>{item.filename}</strong>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: item.score >= 80 ? '#dcfce7' : item.score >= 50 ? '#fef9c3' : '#f1f5f9',
                          color: item.score >= 80 ? '#166534' : item.score >= 50 ? '#854d0e' : '#475569'
                        }}>
                          {item.score}% coincidencia
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', wordBreak: 'break-all' }}>{item.r2_key}</span>
                      {item.numero_detectado && (
                        <span style={{ fontSize: '0.75rem', color: '#2563eb', marginTop: '2px' }}>
                          Número detectado: {item.numero_detectado}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedContract && (
              <div style={{ padding: '0 24px 20px', borderTop: '1px solid #e2e8f0', paddingTop: '16px', background: '#f8fafc' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>
                  Confirmar Número de Contrato (se guardará con prefijo R2-)
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={customNumeroContrato}
                    onChange={(e) => setCustomNumeroContrato(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.95rem'
                    }}
                    placeholder="Ej. R2-494"
                  />
                  <button
                    type="button"
                    className="fiber-primary-button"
                    onClick={handleConfirmVincular}
                    style={{ minHeight: 'auto', padding: '10px 20px' }}
                  >
                    {isChangeMode ? 'Cambiar Contrato' : 'Vincular Contrato'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function fullName(cliente) {
  return [cliente.nombres, cliente.apellido_paterno, cliente.apellido_materno].filter(Boolean).join(' ').trim()
}

function money(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '$0.00'
  return amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

export default ClientesLista
