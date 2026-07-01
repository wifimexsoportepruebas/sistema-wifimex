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
  const [importSummary, setImportSummary] = useState(null)

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
      setImportSummary(data)
    } catch (err) {
      setImportSummary(null)
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
        <button type="button" className={tab === 'manual' ? 'active' : ''} onClick={() => { setTab('manual'); setImportSummary(null); }}>
          Alta manual
        </button>
        <button type="button" className={tab === 'import' ? 'active' : ''} onClick={() => { setTab('import'); setImportSummary(null); }}>
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

      {tab === 'import' && importSummary && (
        <section className="fiber-panel client-import-results" style={{ marginTop: '24px' }}>
          <span className="fiber-kicker">Resultados del proceso</span>
          <h2>Resumen de vinculación de contratos</h2>

          {/* Cards Grid */}
          <div className="comunidades-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', margin: '20px 0' }}>
            <div className="comunidades-summary-card" style={{ borderLeft: '4px solid #475569', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
              <div className="comunidades-summary-card-value" style={{ fontSize: '1.8rem', fontWeight: '800', color: '#1e293b' }}>{importSummary.clientes_importados ?? 0}</div>
              <div className="comunidades-summary-card-label" style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 'bold' }}>Clientes Importados</div>
            </div>
            <div className="comunidades-summary-card" style={{ borderLeft: '4px solid #10b981', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
              <div className="comunidades-summary-card-value" style={{ fontSize: '1.8rem', fontWeight: '800', color: '#10b981' }}>{importSummary.contratos_auto_vinculados ?? 0}</div>
              <div className="comunidades-summary-card-label" style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 'bold' }}>Vinculados Auto</div>
            </div>
            <div className="comunidades-summary-card" style={{ borderLeft: '4px solid #eab308', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
              <div className="comunidades-summary-card-value" style={{ fontSize: '1.8rem', fontWeight: '800', color: '#d97706' }}>{importSummary.contratos_sugeridos ?? 0}</div>
              <div className="comunidades-summary-card-label" style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 'bold' }}>Sugerencias</div>
            </div>
            <div className="comunidades-summary-card" style={{ borderLeft: '4px solid #64748b', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
              <div className="comunidades-summary-card-value" style={{ fontSize: '1.8rem', fontWeight: '800', color: '#64748b' }}>{importSummary.sin_contrato ?? 0}</div>
              <div className="comunidades-summary-card-label" style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 'bold' }}>Sin Contrato</div>
            </div>
            <div className="comunidades-summary-card" style={{ borderLeft: '4px solid #ef4444', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
              <div className="comunidades-summary-card-value" style={{ fontSize: '1.8rem', fontWeight: '800', color: '#ef4444' }}>{importSummary.conflictos ?? 0}</div>
              <div className="comunidades-summary-card-label" style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 'bold' }}>Conflictos</div>
            </div>
          </div>

          {/* Detailed Lists Sections */}
          <div className="results-sections" style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '24px' }}>
            
            {/* 1. Vinculados Automáticamente */}
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1e293b', borderBottom: '2px solid #10b981', paddingBottom: '6px', marginBottom: '12px' }}>
                1. Contratos vinculados automáticamente ({importSummary.detalle?.auto_vinculados?.length ?? 0})
              </h3>
              {(!importSummary.detalle?.auto_vinculados || importSummary.detalle.auto_vinculados.length === 0) ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Ninguno vinculado de forma automática.</p>
              ) : (
                <div style={{ maxHeight: '200px', overflowY: 'auto', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '12px' }}>
                  {importSummary.detalle.auto_vinculados.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: idx < importSummary.detalle.auto_vinculados.length - 1 ? '1px solid #e2e8f0' : 'none', fontSize: '0.88rem' }}>
                      <span style={{ fontWeight: '750', color: '#1e293b' }}>{item.cliente_nombre}</span>
                      <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>{item.filename} <span style={{ background: '#eef4fb', color: '#0077c8', padding: '2px 6px', borderRadius: '4px', fontSize: '0.76rem', fontWeight: 'bold' }}>{item.numero_contrato}</span></span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Sugerencias para Revisión */}
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1e293b', borderBottom: '2px solid #eab308', paddingBottom: '6px', marginBottom: '12px' }}>
                2. Sugerencias para revisión ({importSummary.detalle?.sugerencias?.length ?? 0})
              </h3>
              {(!importSummary.detalle?.sugerencias || importSummary.detalle.sugerencias.length === 0) ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No hay sugerencias para revisar.</p>
              ) : (
                <div style={{ maxHeight: '250px', overflowY: 'auto', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '12px' }}>
                  {importSummary.detalle.sugerencias.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 0', borderBottom: idx < importSummary.detalle.sugerencias.length - 1 ? '1px solid #e2e8f0' : 'none', fontSize: '0.88rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: '750', color: '#1e293b' }}>{item.cliente_nombre}</span>
                        <span style={{ color: '#64748b' }}>Coincidencia: <strong style={{ color: '#d97706' }}>{item.score}%</strong></span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                        <span style={{ fontFamily: 'monospace', color: '#475569', fontSize: '0.82rem' }}>Archivo: {item.filename}</span>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Razón: {item.razon}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Sin Contrato Encontrado */}
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1e293b', borderBottom: '2px solid #94a3b8', paddingBottom: '6px', marginBottom: '12px' }}>
                3. Clientes sin contrato encontrado ({importSummary.detalle?.sin_contrato?.length ?? 0})
              </h3>
              {(!importSummary.detalle?.sin_contrato || importSummary.detalle.sin_contrato.length === 0) ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Todos los clientes tienen coincidencia o sugerencia.</p>
              ) : (
                <div style={{ maxHeight: '180px', overflowY: 'auto', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    {importSummary.detalle.sin_contrato.map((item, idx) => (
                      <div key={idx} style={{ background: '#ffffff', padding: '6px 12px', borderRadius: '6px', border: '1px solid #f1f5f9', fontSize: '0.84rem', color: '#475569', fontWeight: '600' }}>
                        {item.cliente_nombre}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Conflictos Omitidos */}
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1e293b', borderBottom: '2px solid #ef4444', paddingBottom: '6px', marginBottom: '12px' }}>
                4. Conflictos / Omitidos ({importSummary.detalle?.conflictos?.length ?? 0})
              </h3>
              {(!importSummary.detalle?.conflictos || importSummary.detalle.conflictos.length === 0) ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Sin conflictos detectados.</p>
              ) : (
                <div style={{ maxHeight: '180px', overflowY: 'auto', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '12px' }}>
                  {importSummary.detalle.conflictos.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: idx < importSummary.detalle.conflictos.length - 1 ? '1px solid #e2e8f0' : 'none', fontSize: '0.88rem' }}>
                      <div>
                        <strong style={{ color: '#ef4444' }}>{item.cliente_nombre}</strong>
                        {item.filename && <div style={{ fontSize: '0.78rem', color: '#64748b', fontFamily: 'monospace', marginTop: '2px' }}>Archivo: {item.filename}</div>}
                      </div>
                      <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.82rem' }}>{item.razon}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </section>
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
