CREATE TABLE IF NOT EXISTS cajas_fibra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comunidad_id INTEGER NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'CAJA',
  nombre_original_kml TEXT,
  nombre TEXT NOT NULL,
  pon INTEGER,
  numero_caja INTEGER,
  codigo_caja TEXT,
  latitud REAL,
  longitud REAL,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TEXT,
  FOREIGN KEY (comunidad_id) REFERENCES comunidades(id),
  CHECK (tipo IN ('CAJA', 'OLT'))
);

CREATE TABLE IF NOT EXISTS caja_terminales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caja_id INTEGER NOT NULL,
  numero_terminal INTEGER NOT NULL,
  estado TEXT NOT NULL DEFAULT 'LIBRE',
  servicio_fibra_id INTEGER,
  observaciones TEXT,
  creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TEXT,
  FOREIGN KEY (caja_id) REFERENCES cajas_fibra(id),
  FOREIGN KEY (servicio_fibra_id) REFERENCES servicios_fibra(id),
  CHECK (numero_terminal BETWEEN 1 AND 8),
  CHECK (estado IN ('LIBRE', 'OCUPADO', 'RESERVADO', 'DAÑADO'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cajas_fibra_comunidad_codigo
ON cajas_fibra(comunidad_id, codigo_caja)
WHERE codigo_caja IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_caja_terminales_caja_numero
ON caja_terminales(caja_id, numero_terminal);
