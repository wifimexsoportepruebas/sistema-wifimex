CREATE TABLE IF NOT EXISTS pagos_clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  cliente_id INTEGER NOT NULL,
  servicio_fibra_id INTEGER NOT NULL,
  punto_cobro_id INTEGER NOT NULL,
  comunidad_id INTEGER NOT NULL,

  anio INTEGER NOT NULL,
  mes INTEGER NOT NULL,

  ciclo_corte_id INTEGER NOT NULL,

  monto_pagado REAL NOT NULL,
  metodo_pago TEXT NOT NULL DEFAULT 'EFECTIVO',

  estado TEXT NOT NULL DEFAULT 'PAGADO'
    CHECK (estado IN ('PAGADO','CANCELADO')),

  fecha_pago TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  observaciones TEXT,

  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  FOREIGN KEY (servicio_fibra_id) REFERENCES servicios_fibra(id),
  FOREIGN KEY (punto_cobro_id) REFERENCES puntos_cobro(id),
  FOREIGN KEY (comunidad_id) REFERENCES comunidades(id),
  FOREIGN KEY (ciclo_corte_id) REFERENCES ciclos_corte(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pago_cliente_servicio_mes
ON pagos_clientes(servicio_fibra_id, anio, mes)
WHERE estado = 'PAGADO';
