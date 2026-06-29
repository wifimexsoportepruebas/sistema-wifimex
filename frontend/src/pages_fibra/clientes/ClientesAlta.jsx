import { useCallback, useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'

const initialForm = {
  comunidad_id: '',
  nombres: '',
  apellido_paterno: '',
  apellido_materno: '',
  telefono: '',
  paquete_id: '',
  ciclo_corte_id: '',
  precio_mensual: '',
  alfanumerico_equipo: '',
  ip_asignada: '',
  fecha_instalacion: '',
  direccion: '',
  referencia: '',
}

function ClientesAlta({ apiUrl, token }) {
  const [tab, setTab] = useState('manual')
  const [comunidades, setComunidades] = useState([])
  const [paquetes, setPaquetes] = useState([])
  const [ciclos, setCiclos] = useState([])
  const [form, setForm] = useState(initialForm)
  const [numeroCliente, setNumeroCliente] = useState('')
  const [saving, setSaving] = useState(false)
  const [importComunidadId, setImportComunidadId] = useState('')
  const [csvFile, setCsvFile] = useState(null)
  const [importing, setImporting] = useState(false)

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const selectedComunidad = comunidades.find((item) => item.id === Number(form.comunidad_id))

  const loadCatalogs = useCallback(async () => {
    try {
      const [comunidadesResponse, ciclosResponse] = await Promise.all([
        fetch(`${apiUrl}/api/comunidades`, { headers: authHeaders }),
        fetch(`${apiUrl}/api/ciclos-corte`, { headers: authHeaders }),
      ])

      const comunidadesData = await comunidadesResponse.json()
      const ciclosData = await ciclosResponse.json()

      if (!comunidadesResponse.ok) throw new Error(comunidadesData.error ?? 'No se pudieron cargar comunidades.')
      if (!ciclosResponse.ok) throw new Error(ciclosData.error ?? 'No se pudieron cargar ciclos de corte.')

      setComunidades(comunidadesData.comunidades ?? [])
      setCiclos(ciclosData.ciclos ?? [])
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    }
  }, [apiUrl, authHeaders])

  const loadPaquetes = useCallback(async (comunidadId) => {
    if (!comunidadId) {
      setPaquetes([])
      return
    }

    try {
      const response = await fetch(`${apiUrl}/api/paquetes?comunidad_id=${comunidadId}`, { headers: authHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudieron cargar paquetes.')
      setPaquetes(data.paquetes ?? [])
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#4274D9' })
    }
  }, [apiUrl, authHeaders])

  useEffect(() => {
    loadCatalogs()
  }, [loadCatalogs])

  function updateField(name, value) {
    const nextValue = ['nombres', 'apellido_paterno', 'apellido_materno'].includes(name)
      ? value.toUpperCase()
      : value
    setForm((current) => ({ ...current, [name]: nextValue }))
  }

  function handleComunidadChange(value) {
    updateField('comunidad_id', value)
    updateField('paquete_id', '')
    updateField('precio_mensual', '')
    loadPaquetes(value)

    const comunidad = comunidades.find((item) => item.id === Number(value))
    if (!comunidad) {
      setNumeroCliente('')
      return
    }

    const nextNumber = Number(comunidad.siguiente_numero_cliente ?? comunidad.numero_inicial_cliente ?? 0) + 1
    setNumeroCliente(comunidad.prefijo ? `${comunidad.prefijo}-${nextNumber}` : String(nextNumber))
  }

  function handlePaqueteChange(value) {
    updateField('paquete_id', value)
    const paquete = paquetes.find((item) => item.id === Number(value))
    updateField('precio_mensual', paquete?.precio_mensual ? String(paquete.precio_mensual) : '')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!form.comunidad_id || !form.nombres.trim() || !form.paquete_id || !form.ciclo_corte_id) {
      Swal.fire({
        icon: 'warning',
        title: 'Datos incompletos',
        text: 'Comunidad, nombre, paquete y ciclo de corte son obligatorios.',
        confirmButtonColor: '#4274D9',
      })
      return
    }

    if (form.telefono && !/^\d{10}$/.test(form.telefono.trim())) {
      Swal.fire({
        icon: 'warning',
        title: 'Telefono invalido',
        text: 'El telefono debe tener 10 digitos.',
        confirmButtonColor: '#4274D9',
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        comunidad_id: Number(form.comunidad_id),
        nombres: form.nombres.trim().toUpperCase(),
        apellido_paterno: form.apellido_paterno.trim().toUpperCase() || null,
        apellido_materno: form.apellido_materno.trim().toUpperCase() || null,
        telefono: form.telefono.trim() || null,
        direccion: form.direccion.trim() || null,
        referencia: form.referencia.trim() || null,
        paquete_id: Number(form.paquete_id),
        ciclo_corte_id: Number(form.ciclo_corte_id),
        precio_mensual: Number(form.precio_mensual),
        alfanumerico_equipo: form.alfanumerico_equipo.trim() || null,
        ip_asignada: form.ip_asignada.trim() || null,
        fecha_instalacion: form.fecha_instalacion || null,
      }

      const response = await fetch(`${apiUrl}/api/clientes`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar el cliente.')

      await Swal.fire({
        icon: 'success',
        title: 'Cliente guardado',
        text: `Se registro el cliente ${data.numero_cliente ?? ''}.`,
        confirmButtonColor: '#4274D9',
      })

      setForm({ ...initialForm, comunidad_id: form.comunidad_id })
      setPaquetes([])
      setNumeroCliente('')
      await loadCatalogs()
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error al guardar', text: err.message, confirmButtonColor: '#4274D9' })
    } finally {
      setSaving(false)
    }
  }

  async function handleImport(event) {
    event.preventDefault()

    if (!importComunidadId || !csvFile) {
      Swal.fire({
        icon: 'warning',
        title: 'Datos incompletos',
        text: 'Selecciona una comunidad destino y un archivo CSV.',
        confirmButtonColor: '#4274D9',
      })
      return
    }

    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('comunidad_id', importComunidadId)
      formData.append('file', csvFile)

      const response = await fetch(`${apiUrl}/api/clientes/importar`, {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudo importar el archivo.')

      const summary = data.summary ?? {}
      const imported = Number(summary.imported ?? 0)
      const errors = Number(summary.errors ?? 0)
      const alertConfig = getImportAlertConfig(imported, errors, data.message)

      await Swal.fire({
        icon: alertConfig.icon,
        title: alertConfig.title,
        html: `
          <div style="text-align:left">
            <p>${alertConfig.message}</p>
            <p><b>Filas:</b> ${summary.rows ?? 0}</p>
            <p><b>Importados:</b> ${imported}</p>
            <p><b>Duplicados:</b> ${summary.duplicates ?? 0}</p>
            <p><b>Errores:</b> ${errors}</p>
            <p><b>Sin alfanumerico:</b> ${summary.sin_alfanumerico ?? 0}</p>
          </div>
        `,
        confirmButtonColor: '#4274D9',
      })

      if (imported > 0) {
        setCsvFile(null)
        event.target.reset()
        await loadCatalogs()
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error de importacion', text: err.message, confirmButtonColor: '#4274D9' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="clientes-alta-page fiber-page">
      <section className="fiber-page-header">
        <div>
          <span className="fiber-kicker">Atencion y soporte</span>
          <h1>Alta de clientes</h1>
        </div>
      </section>

      <div className="fiber-tabs">
        <button type="button" className={tab === 'manual' ? 'active' : ''} onClick={() => setTab('manual')}>
          Alta manual
        </button>
        <button type="button" className={tab === 'import' ? 'active' : ''} onClick={() => setTab('import')}>
          Importacion masiva
        </button>
      </div>

      {tab === 'manual' && (
        <form className="fiber-panel client-form" onSubmit={handleSubmit}>
          <div className="client-form-grid three">
            <label>
              Comunidad
              <select value={form.comunidad_id} onChange={(event) => handleComunidadChange(event.target.value)} required>
                <option value="">Selecciona una comunidad</option>
                {comunidades.map((comunidad) => (
                  <option key={comunidad.id} value={comunidad.id}>{comunidad.nombre}</option>
                ))}
              </select>
            </label>
            <label>
              Numero de cliente
              <input value={numeroCliente} readOnly placeholder="Se genera al seleccionar comunidad" />
              <small>Se confirma al guardar para evitar duplicados.</small>
            </label>
            <label>
              Nombre
              <input value={form.nombres} onChange={(event) => updateField('nombres', event.target.value)} required />
            </label>
          </div>

          <div className="client-form-grid two">
            <label>
              Apellido paterno
              <input value={form.apellido_paterno} onChange={(event) => updateField('apellido_paterno', event.target.value)} />
            </label>
            <label>
              Apellido materno
              <input value={form.apellido_materno} onChange={(event) => updateField('apellido_materno', event.target.value)} />
            </label>
            <label>
              Telefono
              <input value={form.telefono} onChange={(event) => updateField('telefono', event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" />
            </label>
            <label>
              Paquete
              <select value={form.paquete_id} onChange={(event) => handlePaqueteChange(event.target.value)} disabled={!selectedComunidad} required>
                <option value="">{selectedComunidad ? 'Selecciona un paquete' : 'Selecciona una comunidad primero'}</option>
                {paquetes.map((paquete) => (
                  <option key={paquete.id} value={paquete.id}>
                    {paquete.nombre} - {paquete.velocidad_megas} Mbps
                  </option>
                ))}
              </select>
              <small>El precio se llenara al seleccionar paquete.</small>
            </label>
            <label>
              Ciclo de corte
              <select value={form.ciclo_corte_id} onChange={(event) => updateField('ciclo_corte_id', event.target.value)} required>
                <option value="">Selecciona ciclo</option>
                {ciclos.map((ciclo) => (
                  <option key={ciclo.id} value={ciclo.id}>{ciclo.nombre}</option>
                ))}
              </select>
            </label>
            <label>
              Precio mensual
              <input value={form.precio_mensual} onChange={(event) => updateField('precio_mensual', event.target.value)} inputMode="decimal" />
            </label>
            <label>
              Alfanumerico equipo
              <input value={form.alfanumerico_equipo} onChange={(event) => updateField('alfanumerico_equipo', event.target.value)} />
            </label>
            <label>
              IP asignada
              <input value={form.ip_asignada} onChange={(event) => updateField('ip_asignada', event.target.value)} placeholder="Opcional" />
            </label>
            <label>
              Fecha instalacion
              <input type="date" value={form.fecha_instalacion} onChange={(event) => updateField('fecha_instalacion', event.target.value)} />
            </label>
            <label>
              Direccion
              <input value={form.direccion} onChange={(event) => updateField('direccion', event.target.value)} placeholder="Calle, numero o ubicacion" />
            </label>
            <label>
              Referencia
              <input value={form.referencia} onChange={(event) => updateField('referencia', event.target.value)} placeholder="Referencia para ubicar el domicilio" />
            </label>
          </div>

          <button type="submit" className="fiber-primary-button client-save-button" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cliente'}
          </button>
        </form>
      )}

      {tab === 'import' && (
        <form className="fiber-panel client-import-panel" onSubmit={handleImport}>
          <span className="fiber-kicker">Registro masivo</span>
          <h2>Importar clientes desde CSV</h2>
          <div className="client-form-grid two">
            <label>
              Comunidad destino
              <select value={importComunidadId} onChange={(event) => setImportComunidadId(event.target.value)} required>
                <option value="">Selecciona una comunidad</option>
                {comunidades.map((comunidad) => (
                  <option key={comunidad.id} value={comunidad.id}>{comunidad.nombre}</option>
                ))}
              </select>
            </label>
            <label>
              Archivo CSV
              <input type="file" accept=".csv,text/csv,.txt" onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)} required />
              <small>Columnas esperadas: SERVICIO, NUM- CLIENTE, FECHA DE INSTALACION, FECHA DE PAGO, PAQUETE, PRECIO, ALFANUMERICO.</small>
            </label>
          </div>
          <button type="submit" className="fiber-secondary-button" disabled={importing}>
            {importing ? 'Importando...' : 'Importar archivo'}
          </button>
        </form>
      )}
    </div>
  )
}

function getImportAlertConfig(imported, errors, message) {
  if (imported > 0 && errors === 0) {
    return {
      icon: 'success',
      title: 'Importacion completada',
      message: message || 'Los clientes se importaron correctamente.',
    }
  }

  if (imported > 0 && errors > 0) {
    return {
      icon: 'warning',
      title: 'Importacion parcial',
      message: message || 'Se importaron algunos clientes, pero hubo errores en otras filas.',
    }
  }

  return {
    icon: 'error',
    title: 'No se importo ningun cliente',
    message: message || 'No se importo ningun cliente. Revisa los errores detectados.',
  }
}

export default ClientesAlta
