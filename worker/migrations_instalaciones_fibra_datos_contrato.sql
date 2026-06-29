ALTER TABLE instalaciones_fibra ADD COLUMN contrato_marca_equipo TEXT;
ALTER TABLE instalaciones_fibra ADD COLUMN contrato_numero_equipos INTEGER DEFAULT 1;
ALTER TABLE instalaciones_fibra ADD COLUMN contrato_aplica_reconexion TEXT DEFAULT 'SI';
ALTER TABLE instalaciones_fibra ADD COLUMN contrato_cantidad_reconexion REAL DEFAULT 350;
ALTER TABLE instalaciones_fibra ADD COLUMN contrato_costo_equipo_penalidad REAL DEFAULT 800;
ALTER TABLE instalaciones_fibra ADD COLUMN contrato_costo_instalacion REAL DEFAULT 0;
ALTER TABLE instalaciones_fibra ADD COLUMN contrato_modalidad_pago TEXT DEFAULT 'SIN DEFINIR';
