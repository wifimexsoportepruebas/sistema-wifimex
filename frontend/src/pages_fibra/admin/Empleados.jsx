import { useCallback, useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'

function Empleados({ apiUrl, token }) {
  const [usuarios, setUsuarios] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [usuariosResponse, rolesResponse] = await Promise.all([
        fetch(`${apiUrl}/api/usuarios`, { headers: authHeaders }),
        fetch(`${apiUrl}/api/roles`, { headers: authHeaders }),
      ])
      const usuariosData = await usuariosResponse.json()
      const rolesData = await rolesResponse.json()

      if (!usuariosResponse.ok) throw new Error(usuariosData.error ?? 'No se pudieron cargar empleados.')
      if (!rolesResponse.ok) throw new Error(rolesData.error ?? 'No se pudieron cargar roles.')

      setUsuarios(usuariosData.usuarios ?? [])
      setRoles(rolesData.roles ?? [])
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message, confirmButtonColor: '#4274D9' })
    } finally {
      setLoading(false)
    }
  }, [apiUrl, authHeaders])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function saveUsuario(payload, usuario = null) {
    const response = await fetch(usuario ? `${apiUrl}/api/usuarios/${usuario.id}` : `${apiUrl}/api/usuarios`, {
      method: usuario ? 'PATCH' : 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar el empleado.')
    await loadData()
  }

  async function openUsuarioModal(usuario = null) {
    const editing = Boolean(usuario)
    const roleOptions = roles.map((rol) => (
      `<option value="${rol.id}" ${String(usuario?.rol_id ?? '') === String(rol.id) ? 'selected' : ''}>${escapeHtml(rol.nombre)}</option>`
    )).join('')

    const result = await Swal.fire({
      title: editing ? 'Editar empleado' : 'Nuevo empleado',
      html: `
        <div class="swal-fiber-form">
          <label>Numero de empleado
            <input id="swal-numero" value="${escapeHtml(usuario?.numero_empleado ?? '')}" placeholder="TEC002">
          </label>
          <label>Nombre
            <input id="swal-nombres" value="${escapeHtml(usuario?.nombres ?? '')}" placeholder="JUAN CARLOS">
          </label>
          <div class="swal-grid-2">
            <label>Apellido paterno
              <input id="swal-paterno" value="${escapeHtml(usuario?.apellido_paterno ?? '')}">
            </label>
            <label>Apellido materno
              <input id="swal-materno" value="${escapeHtml(usuario?.apellido_materno ?? '')}">
            </label>
          </div>
          <div class="swal-grid-2">
            <label>Rol
              <select id="swal-rol">
                <option value="">Selecciona rol</option>
                ${roleOptions}
              </select>
            </label>
            <label>Estado
              <select id="swal-activo">
                <option value="1" ${usuario?.activo === 0 ? '' : 'selected'}>Activo</option>
                <option value="0" ${usuario?.activo === 0 ? 'selected' : ''}>Inactivo</option>
              </select>
            </label>
          </div>
          ${editing ? '' : `
            <div class="swal-grid-2">
              <label>Contrasena
                <input id="swal-password" type="password" autocomplete="new-password">
              </label>
              <label>Confirmar contrasena
                <input id="swal-confirm" type="password" autocomplete="new-password">
              </label>
            </div>
          `}
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: editing ? 'Guardar cambios' : 'Crear empleado',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4274D9',
      focusConfirm: false,
      didOpen: () => {
        for (const id of ['swal-numero', 'swal-nombres', 'swal-paterno', 'swal-materno']) {
          const input = document.getElementById(id)
          input?.addEventListener('input', () => {
            input.value = input.value.toUpperCase()
          })
        }
      },
      preConfirm: () => {
        const payload = {
          numero_empleado: getValue('swal-numero').toUpperCase(),
          nombres: getValue('swal-nombres').toUpperCase(),
          apellido_paterno: getValue('swal-paterno').toUpperCase(),
          apellido_materno: getValue('swal-materno').toUpperCase(),
          rol_id: Number(getValue('swal-rol')),
          activo: Number(getValue('swal-activo')),
        }

        if (!payload.numero_empleado || !payload.nombres || !payload.rol_id) {
          Swal.showValidationMessage('Numero de empleado, nombre y rol son obligatorios.')
          return false
        }

        if (!editing) {
          const password = getValue('swal-password')
          const confirm = getValue('swal-confirm')
          if (password.length < 6) {
            Swal.showValidationMessage('La contrasena debe tener al menos 6 caracteres.')
            return false
          }
          if (password !== confirm) {
            Swal.showValidationMessage('Las contrasenas no coinciden.')
            return false
          }
          payload.password = password
        }

        return payload
      },
    })

    if (!result.isConfirmed) return

    try {
      await saveUsuario(result.value, usuario)
      await Swal.fire({
        icon: 'success',
        title: editing ? 'Empleado actualizado' : 'Empleado creado',
        confirmButtonColor: '#4274D9',
      })
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message, confirmButtonColor: '#4274D9' })
    }
  }

  async function toggleEstado(usuario) {
    const activating = Number(usuario.activo) !== 1
    const result = await Swal.fire({
      icon: 'warning',
      title: activating ? 'Activar empleado?' : 'Desactivar empleado?',
      text: activating ? 'Este usuario podra iniciar sesion.' : 'Este usuario ya no podra iniciar sesion.',
      showCancelButton: true,
      confirmButtonText: activating ? 'Activar' : 'Desactivar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: activating ? '#4274D9' : '#d33',
      cancelButtonColor: '#64748b',
    })
    if (!result.isConfirmed) return

    try {
      const response = await fetch(`${apiUrl}/api/usuarios/${usuario.id}/estado`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: activating ? 1 : 0 }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'No se pudo actualizar el estado.')
      await loadData()
      await Swal.fire({ icon: 'success', title: activating ? 'Empleado activo' : 'Empleado desactivado', confirmButtonColor: '#4274D9' })
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message, confirmButtonColor: '#4274D9' })
    }
  }

  async function changePassword(usuario) {
    const result = await Swal.fire({
      title: 'Cambiar contrasena',
      html: `
        <div class="swal-fiber-form">
          <label>Nueva contrasena
            <input id="swal-new-password" type="password" autocomplete="new-password">
          </label>
          <label>Confirmar contrasena
            <input id="swal-new-confirm" type="password" autocomplete="new-password">
          </label>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Actualizar contrasena',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4274D9',
      focusConfirm: false,
      preConfirm: () => {
        const password = getValue('swal-new-password')
        const confirm = getValue('swal-new-confirm')
        if (password.length < 6) {
          Swal.showValidationMessage('La contrasena debe tener al menos 6 caracteres.')
          return false
        }
        if (password !== confirm) {
          Swal.showValidationMessage('Las contrasenas no coinciden.')
          return false
        }
        return { password }
      },
    })
    if (!result.isConfirmed) return

    try {
      const response = await fetch(`${apiUrl}/api/usuarios/${usuario.id}/password`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(result.value),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'No se pudo cambiar la contrasena.')
      await Swal.fire({ icon: 'success', title: 'Contrasena actualizada correctamente', confirmButtonColor: '#4274D9' })
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message, confirmButtonColor: '#4274D9' })
    }
  }

  return (
    <div className="fiber-page empleados-page">
      <section className="fiber-page-header">
        <div>
          <span className="fiber-kicker">Administracion</span>
          <h1>Empleados del sistema</h1>
        </div>
        <button type="button" className="fiber-primary-button" onClick={() => openUsuarioModal()}>
          Nuevo empleado
        </button>
      </section>

      <section className="fiber-panel">
        <div className="fiber-table-wrap">
          <table className="fiber-table empleados-table">
            <thead>
              <tr>
                <th>Numero de empleado</th>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Fecha registro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan="6" className="table-empty">Cargando empleados...</td></tr>}
              {!loading && usuarios.length === 0 && <tr><td colSpan="6" className="table-empty">No hay empleados registrados.</td></tr>}
              {!loading && usuarios.map((usuario) => (
                <tr key={usuario.id}>
                  <td><strong>{usuario.numero_empleado}</strong></td>
                  <td>
                    <strong>{fullName(usuario)}</strong>
                    <span>#{usuario.id}</span>
                  </td>
                  <td><span className="role-pill">{usuario.rol_nombre || 'SIN ROL'}</span></td>
                  <td><span className={`status-pill ${Number(usuario.activo) === 1 ? '' : 'inactive'}`}>{Number(usuario.activo) === 1 ? 'ACTIVO' : 'INACTIVO'}</span></td>
                  <td>{formatDate(usuario.fecha_registro)}</td>
                  <td>
                    <div className="fiber-row-actions">
                      <button type="button" onClick={() => openUsuarioModal(usuario)}>Editar</button>
                      <button type="button" onClick={() => changePassword(usuario)}>Contrasena</button>
                      <button type="button" className={Number(usuario.activo) === 1 ? 'danger' : ''} onClick={() => toggleEstado(usuario)}>
                        {Number(usuario.activo) === 1 ? 'Desactivar' : 'Activar'}
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

function getValue(id) {
  return String(document.getElementById(id)?.value ?? '').trim()
}

function fullName(usuario) {
  return [usuario.nombres, usuario.apellido_paterno, usuario.apellido_materno].filter(Boolean).join(' ') || 'Sin nombre'
}

function formatDate(value) {
  return value ? String(value).slice(0, 10) : '-'
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export default Empleados
