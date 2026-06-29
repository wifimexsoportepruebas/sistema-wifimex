import { useCallback, useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'

function Prospectos({ apiUrl, token, roles = [] }) {
  const [prospectos, setProspectos] = useState([])
  const [comunidades, setComunidades] = useState([])
  const [paquetes, setPaquetes] = useState([])
  const [search, setSearch] = useState('')
  const [conversionFilter, setConversionFilter] = useState('no_convertidos')
  const [loading, setLoading] = useState(true)
  const canDeleteProspectos = roles.some((role) => ['ADMIN', 'ATENCION_CLIENTE'].includes(role))

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
    }),
    [token]
  )

  const authJsonHeaders = useMemo(
    () => ({
      ...authHeaders,
      'Content-Type': 'application/json',
    }),
    [authHeaders]
  )

  const loadCatalogs = useCallback(async () => {
    const [comunidadesResponse, paquetesResponse] = await Promise.all([
      fetch(`${apiUrl}/api/comunidades`, { headers: authHeaders }),
      fetch(`${apiUrl}/api/paquetes`, { headers: authHeaders }),
    ])

    const comunidadesData = await comunidadesResponse.json().catch(() => ({}))
    const paquetesData = await paquetesResponse.json().catch(() => ({}))

    if (comunidadesResponse.ok) setComunidades(comunidadesData.comunidades ?? [])
    if (paquetesResponse.ok) setPaquetes(paquetesData.paquetes ?? [])
  }, [apiUrl, authHeaders])

  const loadProspectos = useCallback(async () => {
    setLoading(true)

    try {
      const params = new URLSearchParams()
      params.set('search', search)
      params.set('conversion', conversionFilter)
      const response = await fetch(`${apiUrl}/api/prospectos?${params.toString()}`, {
        headers: authHeaders,
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudieron cargar los prospectos.')
      }

      setProspectos(data.prospectos ?? [])
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message,
        confirmButtonColor: '#4274D9',
      })
    } finally {
      setLoading(false)
    }
  }, [apiUrl, authHeaders, search, conversionFilter])

  useEffect(() => {
    loadCatalogs().catch(() => {})
  }, [loadCatalogs])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadProspectos()
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [loadProspectos])

  function optionList(items, selectedId, labelKey = 'nombre') {
    return items
      .map((item) => `<option value="${item.id}" ${Number(selectedId) === Number(item.id) ? 'selected' : ''}>${escapeHtml(item[labelKey] ?? '')}</option>`)
      .join('')
  }

  function paqueteOptionsFor(comunidadId, selectedId) {
    const filtered = paquetes.filter((paquete) => Number(paquete.comunidad_id) === Number(comunidadId))
    if (!comunidadId) return '<option value="">Selecciona una comunidad primero</option>'
    if (!filtered.length) return '<option value="">Sin paquetes activos</option>'
    return [
      '<option value="">Sin paquete</option>',
      ...filtered.map((paquete) => (
        `<option value="${paquete.id}" ${Number(selectedId) === Number(paquete.id) ? 'selected' : ''}>${escapeHtml(paquete.nombre)}</option>`
      )),
    ].join('')
  }

  async function openForm(prospecto = null) {
    const isEdit = Boolean(prospecto)
    const comunidadesOptions = `<option value="">Selecciona comunidad</option>${optionList(comunidades, prospecto?.comunidad_id)}`
    const paquetesOptions = paqueteOptionsFor(prospecto?.comunidad_id, prospecto?.paquete_interes_id)

    const { value } = await Swal.fire({
      title: isEdit ? 'Editar prospecto' : 'Nuevo prospecto',
      html: `
        <div class="swal-fiber-form">
          <div class="swal-grid-2">
            <label>Nombres *
              <input id="swal-nombres" value="${escapeAttr(prospecto?.nombres ?? '')}" />
            </label>
            <label>Apellido paterno
              <input id="swal-apellido-paterno" value="${escapeAttr(prospecto?.apellido_paterno ?? '')}" />
            </label>
          </div>
          <div class="swal-grid-2">
            <label>Apellido materno
              <input id="swal-apellido-materno" value="${escapeAttr(prospecto?.apellido_materno ?? '')}" />
            </label>
            <label>Telefono *
              <input id="swal-telefono" value="${escapeAttr(prospecto?.telefono ?? '')}" maxlength="10" inputmode="numeric" pattern="[0-9]{10}" />
            </label>
          </div>
          <label>Comunidad *
            <select id="swal-comunidad">${comunidadesOptions}</select>
          </label>
          <label>Paquete de interes
            <select id="swal-paquete" ${prospecto?.comunidad_id ? '' : 'disabled'}>${paquetesOptions}</select>
          </label>
          <label>Direccion
            <input id="swal-direccion" value="${escapeAttr(prospecto?.direccion ?? '')}" />
          </label>
          <label>Referencia
            <input id="swal-referencia" value="${escapeAttr(prospecto?.referencia ?? '')}" />
          </label>
        </div>
      `,
      width: 720,
      showCancelButton: true,
      confirmButtonText: isEdit ? 'Guardar cambios' : 'Crear prospecto',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4274D9',
      cancelButtonColor: '#64748b',
      focusConfirm: false,
      didOpen: () => {
        const telefonoInput = document.getElementById('swal-telefono')
        const comunidadSelect = document.getElementById('swal-comunidad')
        const paqueteSelect = document.getElementById('swal-paquete')
        const uppercaseIds = [
          'swal-nombres',
          'swal-apellido-paterno',
          'swal-apellido-materno',
          'swal-direccion',
          'swal-referencia',
        ]

        telefonoInput?.addEventListener('input', () => {
          telefonoInput.value = telefonoInput.value.replace(/\D/g, '').slice(0, 10)
        })

        uppercaseIds.forEach((id) => {
          const input = document.getElementById(id)
          input?.addEventListener('input', () => {
            input.value = input.value.toUpperCase()
          })
        })

        comunidadSelect?.addEventListener('change', () => {
          paqueteSelect.innerHTML = paqueteOptionsFor(comunidadSelect.value, null)
          paqueteSelect.disabled = !comunidadSelect.value
        })
      },
      preConfirm: () => {
        const form = {
          nombres: document.getElementById('swal-nombres').value.trim().toUpperCase(),
          apellido_paterno: document.getElementById('swal-apellido-paterno').value.trim().toUpperCase(),
          apellido_materno: document.getElementById('swal-apellido-materno').value.trim().toUpperCase(),
          telefono: document.getElementById('swal-telefono').value.trim(),
          comunidad_id: Number(document.getElementById('swal-comunidad').value),
          paquete_interes_id: document.getElementById('swal-paquete').value ? Number(document.getElementById('swal-paquete').value) : null,
          direccion: document.getElementById('swal-direccion').value.trim().toUpperCase(),
          referencia: document.getElementById('swal-referencia').value.trim().toUpperCase(),
        }

        if (!form.nombres || !form.telefono || !form.comunidad_id) {
          Swal.showValidationMessage('Nombres, telefono y comunidad son obligatorios.')
          return false
        }

        if (!/^\d{10}$/.test(form.telefono)) {
          Swal.showValidationMessage('El telefono debe tener exactamente 10 digitos.')
          return false
        }

        return form
      },
    })

    if (!value) return

    try {
      const response = await fetch(`${apiUrl}/api/prospectos${isEdit ? `/${prospecto.id}` : ''}`, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: authJsonHeaders,
        body: JSON.stringify(value),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudo guardar el prospecto.')
      }

      await Swal.fire({
        icon: 'success',
        title: isEdit ? 'Prospecto actualizado' : 'Prospecto creado',
        confirmButtonColor: '#4274D9',
        timer: 1600,
        showConfirmButton: false,
      })

      loadProspectos()
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message,
        confirmButtonColor: '#4274D9',
      })
    }
  }

  async function deleteProspecto(prospecto) {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Eliminar prospecto',
      text: `Se eliminara ${prospecto.nombres}.`,
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d71935',
      cancelButtonColor: '#64748b',
    })

    if (!result.isConfirmed) return

    try {
      const response = await fetch(`${apiUrl}/api/prospectos/${prospecto.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudo eliminar el prospecto.')
      }

      await Swal.fire({
        icon: 'success',
        title: 'Prospecto eliminado',
        timer: 1400,
        showConfirmButton: false,
      })
      loadProspectos()
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message,
        confirmButtonColor: '#4274D9',
      })
    }
  }

  return (
    <section className="prospectos-page fiber-page">
      <header className="fiber-page-header">
        <div>
          <span className="section-kicker">Clientes</span>
          <h2>Prospectos</h2>
          <p>Seguimiento administrativo de interesados antes de convertirlos en clientes.</p>
        </div>
        <button className="fiber-primary-button" type="button" onClick={() => openForm()}>
          Nuevo prospecto
        </button>
      </header>

      <section className="fiber-table-card">
        <div className="fiber-toolbar">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, telefono, comunidad o cliente"
          />
          <select value={conversionFilter} onChange={(event) => setConversionFilter(event.target.value)}>
            <option value="no_convertidos">No convertidos</option>
            <option value="convertidos">Convertidos</option>
            <option value="todos">Todos</option>
          </select>
          <button type="button" onClick={loadProspectos}>Buscar</button>
          <button className="fiber-link-button" type="button" onClick={() => setSearch('')}>Limpiar</button>
        </div>

        <div className="fiber-table-wrap">
          <table className="fiber-table">
            <thead>
              <tr>
                <th>Prospecto</th>
                <th>Contacto</th>
                <th>Ubicacion</th>
                <th>Paquete</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6">Cargando prospectos...</td></tr>
              ) : prospectos.length === 0 ? (
                <tr><td colSpan="6">No hay prospectos registrados.</td></tr>
              ) : prospectos.map((prospecto) => (
                <tr key={prospecto.id}>
                  <td>
                    <strong>{fullName(prospecto)}</strong>
                    <span>{formatDate(prospecto.fecha_registro)}</span>
                  </td>
                  <td>{prospecto.telefono}</td>
                  <td>
                    <strong>{prospecto.comunidad_nombre}</strong>
                    <span>{prospecto.direccion || 'Sin direccion'}</span>
                  </td>
                  <td>
                    {prospecto.paquete_nombre ? (
                      <>
                        <strong>{prospecto.paquete_nombre}</strong>
                        <span>{formatMoney(prospecto.paquete_precio)}</span>
                      </>
                    ) : 'Sin paquete'}
                  </td>
                  <td>
                    {prospecto.cliente_id ? (
                      <span className="soft-pill">CONVERTIDO A CLIENTE{prospecto.numero_cliente ? ` | Cliente: ${prospecto.numero_cliente}` : ''}</span>
                    ) : (
                      <span className="soft-pill">NO CONVERTIDO</span>
                    )}
                  </td>
                  <td>
                    <div className="fiber-row-actions">
                      <button type="button" onClick={() => openForm(prospecto)}>Editar</button>
                      {canDeleteProspectos && (
                        <button className="danger" type="button" onClick={() => deleteProspecto(prospecto)}>Eliminar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}

function fullName(prospecto) {
  return [prospecto.nombres, prospecto.apellido_paterno, prospecto.apellido_materno].filter(Boolean).join(' ')
}

function formatDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value.replace(' ', 'T')))
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return ''
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value))
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function escapeAttr(value) {
  return escapeHtml(value)
}

export default Prospectos
