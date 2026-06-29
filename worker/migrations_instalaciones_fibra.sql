CREATE TABLE IF NOT EXISTS instalaciones_fibra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  reporte_id INTEGER NOT NULL,
  prospecto_id INTEGER,
  cliente_id INTEGER,
  servicio_fibra_id INTEGER,
  comunidad_id INTEGER NOT NULL,
  tecnico_id INTEGER NOT NULL,
  paquete_instalacion_id INTEGER,
  alfanumerico_equipo TEXT,
  titular_nombres TEXT,
  titular_apellido_paterno TEXT,
  titular_apellido_materno TEXT,
  titular_telefono TEXT,
  titular_direccion TEXT,
  titular_referencia TEXT,

  fibra_optica_metros REAL DEFAULT 0,
  tensor_gancho INTEGER DEFAULT 0,
  argollas INTEGER DEFAULT 0,
  taquetes INTEGER DEFAULT 0,
  sujetadores INTEGER DEFAULT 0,
  roseta INTEGER DEFAULT 0,

  terminal TEXT NOT NULL,
  puerto TEXT NOT NULL,
  potencia REAL NOT NULL,

  firma_cliente_base64 TEXT,
  firma_tecnico_base64 TEXT,
  foto_router_r2_key TEXT,
  foto_router_content_type TEXT,
  comentario_tecnico TEXT,

  fecha_instalacion TEXT DEFAULT CURRENT_TIMESTAMP,
  creado_en TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (reporte_id) REFERENCES reportes(id),
  FOREIGN KEY (prospecto_id) REFERENCES prospectos(id),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  FOREIGN KEY (servicio_fibra_id) REFERENCES servicios_fibra(id),
  FOREIGN KEY (comunidad_id) REFERENCES comunidades(id),
  FOREIGN KEY (tecnico_id) REFERENCES usuarios(id),

  CHECK (terminal IN ('1', '2', '3', '4', '5', '6', '7', '8')),
  CHECK (puerto GLOB '[ABCD][0-9]' OR puerto IN ('A10', 'B10', 'C10', 'D10', 'A11', 'B11', 'C11', 'D11')),
  CHECK (potencia >= -30 AND potencia <= -12)
);

CREATE INDEX IF NOT EXISTS idx_instalaciones_reporte ON instalaciones_fibra (reporte_id);
CREATE INDEX IF NOT EXISTS idx_instalaciones_prospecto ON instalaciones_fibra (prospecto_id);
CREATE INDEX IF NOT EXISTS idx_instalaciones_tecnico ON instalaciones_fibra (tecnico_id);
