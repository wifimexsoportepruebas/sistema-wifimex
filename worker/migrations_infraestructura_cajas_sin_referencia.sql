PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS cajas_fibra_new;

CREATE TABLE cajas_fibra_new (
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

INSERT INTO cajas_fibra_new (
  id, comunidad_id, tipo, nombre_original_kml, nombre, pon, numero_caja,
  codigo_caja, latitud, longitud, activo, creado_en, actualizado_en
)
SELECT
  id, comunidad_id, tipo, nombre_original_kml, nombre, pon, numero_caja,
  codigo_caja, latitud, longitud, activo, creado_en, actualizado_en
FROM cajas_fibra;

DROP TABLE cajas_fibra;
ALTER TABLE cajas_fibra_new RENAME TO cajas_fibra;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cajas_fibra_comunidad_codigo
ON cajas_fibra(comunidad_id, codigo_caja)
WHERE codigo_caja IS NOT NULL;

PRAGMA foreign_keys = ON;
