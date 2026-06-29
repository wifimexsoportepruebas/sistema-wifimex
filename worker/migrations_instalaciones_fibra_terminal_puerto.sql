PRAGMA foreign_keys = OFF;

CREATE TABLE instalaciones_fibra_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  reporte_id INTEGER NOT NULL,
  prospecto_id INTEGER,
  cliente_id INTEGER,
  servicio_fibra_id INTEGER,
  comunidad_id INTEGER NOT NULL,
  tecnico_id INTEGER NOT NULL,

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
  comentario_tecnico TEXT,

  fecha_instalacion TEXT DEFAULT CURRENT_TIMESTAMP,
  creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
  firma_tecnico_base64 TEXT,
  paquete_instalacion_id INTEGER,
  alfanumerico_equipo TEXT,
  titular_nombres TEXT,
  titular_apellido_paterno TEXT,
  titular_apellido_materno TEXT,
  titular_telefono TEXT,
  titular_direccion TEXT,
  titular_referencia TEXT,
  foto_router_r2_key TEXT,
  foto_router_content_type TEXT,

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

INSERT INTO instalaciones_fibra_new (
  id, reporte_id, prospecto_id, cliente_id, servicio_fibra_id, comunidad_id, tecnico_id,
  fibra_optica_metros, tensor_gancho, argollas, taquetes, sujetadores, roseta,
  terminal, puerto, potencia, firma_cliente_base64, comentario_tecnico,
  fecha_instalacion, creado_en, firma_tecnico_base64, paquete_instalacion_id,
  alfanumerico_equipo, titular_nombres, titular_apellido_paterno, titular_apellido_materno,
  titular_telefono, titular_direccion, titular_referencia, foto_router_r2_key,
  foto_router_content_type
)
SELECT
  id, reporte_id, prospecto_id, cliente_id, servicio_fibra_id, comunidad_id, tecnico_id,
  fibra_optica_metros, tensor_gancho, argollas, taquetes, sujetadores, roseta,
  CASE
    WHEN CAST(puerto AS TEXT) IN ('1', '2', '3', '4') THEN CAST(puerto AS TEXT)
    WHEN terminal IN ('1', '2', '3', '4') THEN terminal
    ELSE '1'
  END AS terminal,
  CASE
    WHEN terminal GLOB '[ABCD][0-9]' OR terminal IN ('A10', 'B10', 'C10', 'D10') THEN terminal
    WHEN CAST(puerto AS TEXT) GLOB '[ABCD][0-9]' OR CAST(puerto AS TEXT) IN ('A10', 'B10', 'C10', 'D10') THEN CAST(puerto AS TEXT)
    ELSE 'A0'
  END AS puerto,
  potencia, firma_cliente_base64, comentario_tecnico,
  fecha_instalacion, creado_en, firma_tecnico_base64, paquete_instalacion_id,
  alfanumerico_equipo, titular_nombres, titular_apellido_paterno, titular_apellido_materno,
  titular_telefono, titular_direccion, titular_referencia, foto_router_r2_key,
  foto_router_content_type
FROM instalaciones_fibra;

DROP TABLE instalaciones_fibra;
ALTER TABLE instalaciones_fibra_new RENAME TO instalaciones_fibra;

CREATE INDEX IF NOT EXISTS idx_instalaciones_reporte ON instalaciones_fibra (reporte_id);
CREATE INDEX IF NOT EXISTS idx_instalaciones_prospecto ON instalaciones_fibra (prospecto_id);
CREATE INDEX IF NOT EXISTS idx_instalaciones_tecnico ON instalaciones_fibra (tecnico_id);

PRAGMA foreign_keys = ON;
