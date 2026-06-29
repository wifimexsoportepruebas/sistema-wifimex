import { useCallback, useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'

const SPEED_OPTIONS = [10, 20, 30]
const PAGE_LIMIT = 20

function ClientesLista({ apiUrl, token }) {
  const [clientes, setClientes] = useState([])
  const [comunidades, setComunidades] = useState([])
  const [q, setQ] = useState('')
  const [comunidadId, setComunidadId] = useState('')
  const [velocidad, setVelocidad] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_LIMIT, total: 0, total_pages: 1 })

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

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
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="7" className="table-empty">Cargando clientes...</td>
                </tr>
              )}
              {!loading && clientes.length === 0 && (
                <tr>
                  <td colSpan="7" className="table-empty">No hay clientes para mostrar.</td>
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
