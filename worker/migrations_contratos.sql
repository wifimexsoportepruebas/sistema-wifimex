CREATE TABLE IF NOT EXISTS contratos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero_contrato TEXT NOT NULL UNIQUE,
  cliente_id INTEGER NOT NULL,
  servicio_fibra_id INTEGER NOT NULL,
  instalacion_fibra_id INTEGER,
  r2_key TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/pdf',
  estado TEXT NOT NULL DEFAULT 'GENERADO',
  aplica_reconexion TEXT,
  cantidad_reconexion REAL,
  marca_equipo TEXT,
  numero_equipos INTEGER,
  costo_equipo_penalidad REAL,
  costo_instalacion REAL,
  vigencia_contrato TEXT,
  nombre_instalador TEXT,
  generado_por_usuario_id INTEGER,
  fecha_generado TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  FOREIGN KEY (servicio_fibra_id) REFERENCES servicios_fibra(id),
  FOREIGN KEY (instalacion_fibra_id) REFERENCES instalaciones_fibra(id),
  FOREIGN KEY (generado_por_usuario_id) REFERENCES usuarios(id),
  CHECK (estado IN ('GENERADO', 'CANCELADO', 'REGENERADO'))
);

CREATE INDEX IF NOT EXISTS idx_contratos_cliente
ON contratos(cliente_id);

CREATE INDEX IF NOT EXISTS idx_contratos_servicio
ON contratos(servicio_fibra_id);

CREATE INDEX IF NOT EXISTS idx_contratos_instalacion_generado
ON contratos(instalacion_fibra_id, estado);
