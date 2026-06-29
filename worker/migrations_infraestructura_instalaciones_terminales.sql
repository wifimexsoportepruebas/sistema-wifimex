ALTER TABLE instalaciones_fibra ADD COLUMN caja_id INTEGER;
ALTER TABLE instalaciones_fibra ADD COLUMN caja_terminal_id INTEGER;

ALTER TABLE servicios_fibra ADD COLUMN caja_id INTEGER;
ALTER TABLE servicios_fibra ADD COLUMN caja_terminal_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_instalaciones_caja ON instalaciones_fibra(caja_id);
CREATE INDEX IF NOT EXISTS idx_instalaciones_caja_terminal ON instalaciones_fibra(caja_terminal_id);
CREATE INDEX IF NOT EXISTS idx_servicios_caja ON servicios_fibra(caja_id);
CREATE INDEX IF NOT EXISTS idx_servicios_caja_terminal ON servicios_fibra(caja_terminal_id);
