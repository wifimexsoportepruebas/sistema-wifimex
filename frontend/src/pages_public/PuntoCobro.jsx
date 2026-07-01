import { useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'
import { Html5Qrcode } from 'html5-qrcode'
import '../styles/PuntoCobro.css'

function PuntoCobro({ apiUrl, token }) {
  const [punto, setPunto] = useState(null)
  const [clientePago, setClientePago] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const period = useMemo(() => getCurrentPeriod(), [])

  // QR Scanner state
  const [scannerActive, setScannerActive] = useState(false)
  const [scannerError, setScannerError] = useState('')
  const [html5QrCodeInstance, setHtml5QrCodeInstance] = useState(null)

  useEffect(() => {
    async function loadPunto() {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(`${apiUrl}/api/punto-cobro/${encodeURIComponent(token)}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'Acceso no válido.')
        setPunto(data.punto)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadPunto()
  }, [apiUrl, token])

  // Stop scanner on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeInstance && html5QrCodeInstance.isScanning) {
        html5QrCodeInstance.stop().catch(err => console.error('Unmount stop error:', err))
      }
    }
  }, [html5QrCodeInstance])

  const startScanner = async () => {
    setScannerError('')
    setScannerActive(true)
    setClientePago(null)

    // Delay briefly to allow the DOM element to render
    setTimeout(() => {
      try {
        const html5QrCode = new Html5Qrcode("reader")
        setHtml5QrCodeInstance(html5QrCode)

        html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          async (decodedText) => {
            // Found QR! Stop scanner and fetch client
            try {
              await html5QrCode.stop()
              setScannerActive(false)
              setHtml5QrCodeInstance(null)
            } catch (stopErr) {
              console.error('Stop error:', stopErr)
            }

            const qrToken = extractQrToken(decodedText)
            if (qrToken) {
              setSearching(true)
              try {
                const response = await fetch(`${apiUrl}/api/punto-cobro/${encodeURIComponent(token)}/cliente/${encodeURIComponent(qrToken)}`)
                const data = await response.json()
                if (!response.ok) throw new Error(data.error ?? 'No se pudo encontrar el cliente.')
                setClientePago(data)
              } catch (err) {
                Swal.fire({ icon: 'error', title: 'Cliente no encontrado', text: err.message, confirmButtonColor: '#4274D9' })
              } finally {
                setSearching(false)
              }
            }
          },
          (errorMessage) => {
            // Ignore scan failure errors (produced continuously if no QR is in sight)
          }
        ).catch((err) => {
          console.error('Scanner start failed:', err)
          setScannerError('No se pudo acceder a la cámara. Permite el acceso a la cámara para escanear el QR.')
          setScannerActive(false)
          setHtml5QrCodeInstance(null)
        })
      } catch (err) {
        console.error('Scanner instance error:', err)
        setScannerError('Error al inicializar el escáner de cámara.')
        setScannerActive(false)
      }
    }, 150)
  }

  const stopScanner = async () => {
    if (html5QrCodeInstance) {
      try {
        if (html5QrCodeInstance.isScanning) {
          await html5QrCodeInstance.stop()
        }
      } catch (err) {
        console.error('Stop error:', err)
      }
      setHtml5QrCodeInstance(null)
    }
    setScannerActive(false)
  }

  async function registrarPago() {
    if (!clientePago || clientePago.pago_mes?.pagado) return

    const result = await Swal.fire({
      icon: 'question',
      title: 'Registrar pago',
      text: `¿Confirmas que recibiste el pago en efectivo de ${formatCurrency(clientePago.servicio.precio_mensual)} para el mes de ${monthName(period.mes)} ${period.anio}?`,
      showCancelButton: true,
      confirmButtonText: 'Registrar pago',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#cbd5e1'
    })
    if (!result.isConfirmed) return

    setPaying(true)
    try {
      const response = await fetch(`${apiUrl}/api/punto-cobro/${encodeURIComponent(token)}/pagos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clientePago.cliente.id,
          servicio_fibra_id: clientePago.servicio.id,
          anio: period.anio,
          mes: period.mes,
          monto_pagado: clientePago.servicio.precio_mensual,
          observaciones: '',
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudo registrar el pago.')

      const localDateStr = new Date().toLocaleString('es-MX')
      await Swal.fire({
        icon: 'success',
        title: 'Pago registrado correctamente',
        html: `
          <div style="text-align: left; padding: 10px 0; font-size: 0.95rem; line-height: 1.6;">
            <p><b>Cliente:</b> ${clientePago.cliente.nombre}</p>
            <p><b>Mes pagado:</b> ${monthName(period.mes)} ${period.anio}</p>
            <p><b>Monto pagado:</b> ${formatCurrency(clientePago.servicio.precio_mensual)}</p>
            <p><b>Fecha/hora:</b> ${localDateStr}</p>
          </div>
        `,
        confirmButtonColor: '#10b981'
      })

      // Clean client details so they scan next QR code
      setClientePago(null)
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'No se registró el pago', text: err.message, confirmButtonColor: '#4274D9' })
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <main className="punto-cobro-page">
        <section className="punto-cobro-loading">Cargando punto de cobro...</section>
      </main>
    )
  }

  if (error) {
    return (
      <main className="punto-cobro-page">
        <section className="punto-cobro-access">
          <img src="/logo-wifimex.png" alt="WiFiMex" style={{ height: '48px', marginBottom: '16px' }} />
          <h1>Acceso no válido</h1>
          <p>{error}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="punto-cobro-page">
      <section className="punto-cobro-shell" style={{ maxWidth: '500px' }}>
        <header className="punto-cobro-hero" style={{ textAlign: 'center', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img src="/logo-wifimex.png" alt="WiFiMex" style={{ height: '40px', marginBottom: '12px' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b' }}>WIFIMEX PUNTO DE COBRO</span>
          <h1 style={{ fontSize: '1.8rem', margin: '8px 0 4px', color: '#1e293b' }}>{punto?.nombre}</h1>
          <p style={{ margin: 0, color: '#64748b' }}>Comunidad: <strong>{punto?.comunidad}</strong></p>
        </header>

        <section className="punto-cobro-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div className="punto-cobro-card-head" style={{ width: '100%', textAlign: 'center', marginBottom: 0 }}>
            <h2 style={{ fontSize: '1.15rem', margin: 0, fontWeight: '750', color: '#1e293b' }}>Escanear QR del cliente</h2>
          </div>

          {scannerActive ? (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
              <div id="reader" style={{ width: '100%', maxWidth: '300px', height: '300px', borderRadius: '12px', overflow: 'hidden', border: '2px solid #3b82f6' }}></div>
              <button
                type="button"
                className="fiber-secondary-button"
                style={{ minHeight: '44px', width: '100%', maxWidth: '300px', fontWeight: 'bold' }}
                onClick={stopScanner}
              >
                Cancelar escaneo
              </button>
            </div>
          ) : (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                className="punto-cobro-pay-button"
                style={{
                  width: '100%',
                  maxWidth: '300px',
                  padding: '16px',
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  background: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.25)'
                }}
                onClick={startScanner}
              >
                Habilitar cámara
              </button>
              {scannerError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', fontSize: '0.88rem', width: '100%', textAlign: 'center' }}>
                  {scannerError}
                </div>
              )}
            </div>
          )}
        </section>

        {searching && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p style={{ fontWeight: 'bold', color: '#64748b' }}>Buscando información del cliente...</p>
          </div>
        )}

        {clientePago && (
          <section className="punto-cobro-card cliente-pago-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <div className="cliente-pago-header" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '14px', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' }}>Cliente encontrado</span>
                <h2 style={{ fontSize: '1.4rem', margin: '4px 0 2px', color: '#1e293b' }}>{clientePago.cliente.nombre}</h2>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>
                  No. cliente: <strong>{clientePago.cliente.numero_cliente || 'Sin número'}</strong> · Comunidad: <strong>{clientePago.cliente.comunidad}</strong>
                </p>
              </div>
              <strong className={clientePago.pago_mes.pagado ? 'paid-badge' : 'pending-badge'} style={{
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '0.78rem',
                fontWeight: 'bold',
                alignSelf: 'center'
              }}>
                {clientePago.pago_mes.pagado ? 'PAGADO' : 'PENDIENTE'}
              </strong>
            </div>

            <div className="cliente-pago-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <InfoItem label="Paquete" value={clientePago.servicio.paquete} />
              <InfoItem label="Ciclo de corte" value={clientePago.servicio.ciclo_corte} />
              <InfoItem label="Mes a pagar" value={`${monthName(clientePago.pago_mes.mes)} ${clientePago.pago_mes.anio}`} />
              <InfoItem label="Mensualidad" value={formatCurrency(clientePago.servicio.precio_mensual)} />
            </div>

            <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '16px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.88rem', color: '#64748b', fontWeight: 'bold' }}>Monto a cobrar</span>
              <div style={{ fontSize: '2.4rem', fontWeight: '800', color: '#10b981', margin: '4px 0' }}>
                {formatCurrency(clientePago.servicio.precio_mensual)}
              </div>
            </div>

            {clientePago.pago_mes.pagado ? (
              <div className="pago-existing" style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                padding: '14px',
                borderRadius: '8px',
                marginTop: '16px',
                textAlign: 'center',
                fontWeight: 'bold'
              }}>
                Este mes ya está pagado
              </div>
            ) : (
              <button
                type="button"
                className="punto-cobro-pay-button"
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  background: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginTop: '16px',
                  boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)'
                }}
                onClick={registrarPago}
                disabled={paying}
              >
                {paying ? 'Registrando...' : 'Registrar pago en efectivo'}
              </button>
            )}
          </section>
        )}
      </section>
    </main>
  )
}

function InfoItem({ label, value }) {
  return (
    <div className="cliente-pago-info" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 14px', borderRadius: '8px' }}>
      <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>{label}</span>
      <strong style={{ fontSize: '0.92rem', color: '#1e293b' }}>{value || 'Sin dato'}</strong>
    </div>
  )
}

function extractQrToken(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  const match = text.match(/\/qr-cliente\/([^/?#]+)/i)
  if (match) return decodeURIComponent(match[1])

  try {
    const url = new URL(text)
    const urlMatch = url.pathname.match(/\/qr-cliente\/([^/?#]+)/i)
    if (urlMatch) return decodeURIComponent(urlMatch[1])
  } catch {
    // Plain tokens are expected in this first phase.
  }

  return text.replace(/^qr-cliente\//i, '').trim()
}

function getCurrentPeriod() {
  const date = new Date()
  return {
    anio: date.getFullYear(),
    mes: date.getMonth() + 1,
  }
}

function monthName(month) {
  const date = new Date(2026, Number(month) - 1, 1)
  return date.toLocaleDateString('es-MX', { month: 'long' })
}

function formatCurrency(value) {
  return Number(value ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

export default PuntoCobro
