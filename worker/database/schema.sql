PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  usuario TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  telefono TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TEXT
);

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuario_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  rol_id INTEGER NOT NULL,
  creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE,
  UNIQUE(usuario_id, rol_id)
);

CREATE TABLE IF NOT EXISTS sesiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expira_en TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_usuario_roles_usuario_id
ON usuario_roles (usuario_id);

CREATE INDEX IF NOT EXISTS idx_usuario_roles_rol_id
ON usuario_roles (rol_id);

CREATE INDEX IF NOT EXISTS idx_sesiones_usuario_id
ON sesiones (usuario_id);

CREATE INDEX IF NOT EXISTS idx_sesiones_token
ON sesiones (token);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_telefono
ON usuarios (telefono)
WHERE telefono IS NOT NULL;

INSERT OR IGNORE INTO roles (nombre, descripcion)
VALUES
  ('ADMIN', 'Acceso total al sistema'),
  ('SOPORTE', 'Soporte general'),
  ('ATENCION_CLIENTE', 'Atención y seguimiento de clientes'),
  ('TECNICO_FIBRA', 'Técnico operativo de fibra óptica'),
  ('SOPORTE_FIBRA', 'Soporte especializado de fibra óptica');

INSERT OR IGNORE INTO usuarios (nombre, usuario, email, telefono, password_hash)
VALUES
  (
    'Administrador',
    'admin',
    'admin@wifimex.com',
    '5512345678',
    'pbkdf2$100000$iuVm3dVYcajI7upcTUt76w$lIXQK0v7XZl5gnZK52UDQYWJPjEEaA5mASUqNVVMTAA'
  ),
  (
    'Técnico Fibra',
    'tecnico',
    'tecnico.fibra@wifimex.com',
    '5511111111',
    'pbkdf2$100000$iuVm3dVYcajI7upcTUt76w$lIXQK0v7XZl5gnZK52UDQYWJPjEEaA5mASUqNVVMTAA'
  ),
  (
    'Soporte Fibra',
    'soporte',
    'soporte.fibra@wifimex.com',
    '5522222222',
    'pbkdf2$100000$iuVm3dVYcajI7upcTUt76w$lIXQK0v7XZl5gnZK52UDQYWJPjEEaA5mASUqNVVMTAA'
  ),
  (
    'Atención a Cliente',
    'atencion',
    'atencion.cliente@wifimex.com',
    '5533333333',
    'pbkdf2$100000$iuVm3dVYcajI7upcTUt76w$lIXQK0v7XZl5gnZK52UDQYWJPjEEaA5mASUqNVVMTAA'
  );

UPDATE usuarios
SET telefono = '5512345678'
WHERE email = 'admin@wifimex.com'
  AND telefono IS NULL;

INSERT OR IGNORE INTO usuario_roles (usuario_id, rol_id)
SELECT usuarios.id, roles.id
FROM usuarios
JOIN roles ON roles.nombre = 'ADMIN'
WHERE usuarios.email = 'admin@wifimex.com';

INSERT OR IGNORE INTO usuario_roles (usuario_id, rol_id)
SELECT usuarios.id, roles.id
FROM usuarios
JOIN roles ON roles.nombre = 'TECNICO_FIBRA'
WHERE usuarios.email = 'tecnico.fibra@wifimex.com';

INSERT OR IGNORE INTO usuario_roles (usuario_id, rol_id)
SELECT usuarios.id, roles.id
FROM usuarios
JOIN roles ON roles.nombre = 'SOPORTE_FIBRA'
WHERE usuarios.email = 'soporte.fibra@wifimex.com';

INSERT OR IGNORE INTO usuario_roles (usuario_id, rol_id)
SELECT usuarios.id, roles.id
FROM usuarios
JOIN roles ON roles.nombre = 'ATENCION_CLIENTE'
WHERE usuarios.email = 'atencion.cliente@wifimex.com';

INSERT OR IGNORE INTO roles (nombre, descripcion)
VALUES ('TECNICO', 'Puede recibir y atender reportes tecnicos');

INSERT OR IGNORE INTO usuario_roles (usuario_id, rol_id)
SELECT usuarios.id, roles.id
FROM usuarios
JOIN roles ON roles.nombre = 'TECNICO'
WHERE usuarios.email = 'tecnico.fibra@wifimex.com';

CREATE TABLE IF NOT EXISTS comunidades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  prefijo TEXT,
  numero_inicial_cliente INTEGER,
  siguiente_numero_cliente INTEGER,
  latitud REAL,
  longitud REAL,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TEXT,
  CHECK (numero_inicial_cliente IS NULL OR numero_inicial_cliente > 0),
  CHECK (siguiente_numero_cliente IS NULL OR numero_inicial_cliente IS NULL OR siguiente_numero_cliente >= numero_inicial_cliente)
);

CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comunidad_id INTEGER NOT NULL,
  numero_cliente INTEGER NOT NULL,
  num_servicio_nombre TEXT,
  nombre TEXT,
  telefono TEXT,
  fecha_instalacion TEXT,
  fecha_pago TEXT,
  paquete TEXT,
  precio REAL,
  alfa_numerico TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TEXT,
  FOREIGN KEY (comunidad_id) REFERENCES comunidades(id),
  UNIQUE (comunidad_id, numero_cliente)
);

CREATE TABLE IF NOT EXISTS reportes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha_reportada TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  comunidad_id INTEGER NOT NULL,
  tipo_reporte TEXT NOT NULL,
  cliente_id INTEGER,
  prospecto_id INTEGER,
  comentario TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'PENDIENTE',
  prioridad TEXT NOT NULL DEFAULT 'NORMAL',
  creado_por_usuario_id INTEGER NOT NULL,
  tecnico_id INTEGER,
  asignado_por_usuario_id INTEGER,
  fecha_asignacion TEXT,
  fecha_programada TEXT,
  orden_ruta INTEGER,
  fecha_completado TEXT,
  comentario_cierre TEXT,
  FOREIGN KEY (comunidad_id) REFERENCES comunidades(id),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  FOREIGN KEY (prospecto_id) REFERENCES prospectos(id),
  FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (tecnico_id) REFERENCES usuarios(id),
  FOREIGN KEY (asignado_por_usuario_id) REFERENCES usuarios(id),
  CHECK (tipo_reporte IN ('DETALLE', 'INSTALACION')),
  CHECK (estado IN ('PENDIENTE', 'ASIGNADO', 'EN_PROCESO', 'RESUELTO', 'CANCELADO')),
  CHECK (prioridad IN ('BAJA', 'NORMAL', 'ALTA', 'URGENTE'))
);

CREATE TABLE IF NOT EXISTS reportes_seguimiento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporte_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  estado TEXT NOT NULL,
  comentario TEXT NOT NULL,
  fecha_registro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporte_id) REFERENCES reportes(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_clientes_comunidad_numero
ON clientes (comunidad_id, numero_cliente);

CREATE INDEX IF NOT EXISTS idx_reportes_comunidad
ON reportes (comunidad_id);

CREATE INDEX IF NOT EXISTS idx_reportes_estado
ON reportes (estado);

CREATE INDEX IF NOT EXISTS idx_reportes_tipo
ON reportes (tipo_reporte);

CREATE INDEX IF NOT EXISTS idx_reportes_tecnico
ON reportes (tecnico_id);

CREATE INDEX IF NOT EXISTS idx_reportes_fecha
ON reportes (fecha_reportada);

INSERT OR IGNORE INTO comunidades (nombre, prefijo, numero_inicial_cliente, siguiente_numero_cliente, activo)
VALUES
  ('AMOJILECA', 'AMJ', 1000, 1000, 1),
  ('AMEYALTEPEC', 'AMP', 9000, 9000, 1),
  ('LLANO GRANDE', 'LLG', 8000, 8000, 1),
  ('SAN AGUSTIN OAPAN', 'SAO', 11000, 11000, 1),
  ('SAN FRANCISCO OZOMATLAN', 'SFO', 12000, 12000, 1),
  ('SAN JUAN TETELCINGO', 'SJT', 6000, 6000, 1),
  ('SAN MARCOS', 'SMC', 6000, 6001, 1),
  ('SAN MIGUEL TECUIPAN', 'SMT', 10000, 10000, 1),
  ('TLAMAMACAN', 'TMM', 7000, 7000, 1),
  ('TONALAPAN', 'TNL', 2000, 2000, 1),
  ('VENTA PALULA', 'VPN', 3000, 3000, 1),
  ('XALITLA', 'XAL', 4000, 4000, 1),
  ('SAN JUAN', NULL, NULL, NULL, 1),
  ('PALULA', NULL, NULL, NULL, 1),
  ('SAN MIGUEL', NULL, NULL, NULL, 1),
  ('TULA', NULL, NULL, NULL, 1),
  ('SAN AGUSTIN OSTOTIPAN', NULL, NULL, NULL, 1),
  ('ATETETLA', NULL, NULL, NULL, 1),
  ('PALAPA', NULL, NULL, NULL, 1),
  ('COEXCONCLAN', NULL, NULL, NULL, 1);

UPDATE comunidades
SET latitud = 17.569966,
    longitud = -99.569824
WHERE nombre = 'AMOJILECA';

UPDATE comunidades
SET prefijo = 'SMC',
    numero_inicial_cliente = 6000,
    siguiente_numero_cliente = CASE
      WHEN siguiente_numero_cliente IS NULL OR siguiente_numero_cliente < 6001 THEN 6001
      ELSE siguiente_numero_cliente
    END
WHERE nombre = 'SAN MARCOS';

INSERT OR IGNORE INTO clientes (comunidad_id, numero_cliente, num_servicio_nombre, nombre, telefono, fecha_instalacion, fecha_pago, paquete, precio, alfa_numerico)
SELECT id, 1000, 'SERVICIO FIBRA 1000', 'CLIENTE PRUEBA AMOJILECA', '7471001000', '2026-06-01', '2026-06-15', 'FIBRA 50 MB', 399.00, 'AMJ-1000' FROM comunidades WHERE nombre = 'AMOJILECA';

INSERT OR IGNORE INTO clientes (comunidad_id, numero_cliente, num_servicio_nombre, nombre, telefono, fecha_instalacion, fecha_pago, paquete, precio, alfa_numerico)
SELECT id, 9000, 'SERVICIO FIBRA 9000', 'CLIENTE PRUEBA AMEYALTEPEC', '7471009000', '2026-06-01', '2026-06-15', 'FIBRA 80 MB', 499.00, 'AMP-9000' FROM comunidades WHERE nombre = 'AMEYALTEPEC';

INSERT OR IGNORE INTO clientes (comunidad_id, numero_cliente, num_servicio_nombre, nombre, telefono, fecha_instalacion, fecha_pago, paquete, precio, alfa_numerico)
SELECT id, 8000, 'SERVICIO FIBRA 8000', 'CLIENTE PRUEBA LLANO GRANDE', '7471008000', '2026-06-01', '2026-06-15', 'FIBRA 50 MB', 399.00, 'LLG-8000' FROM comunidades WHERE nombre = 'LLANO GRANDE';

INSERT OR IGNORE INTO clientes (comunidad_id, numero_cliente, num_servicio_nombre, nombre, telefono, fecha_instalacion, fecha_pago, paquete, precio, alfa_numerico)
SELECT id, 11000, 'SERVICIO FIBRA 11000', 'CLIENTE PRUEBA SAN AGUSTIN OAPAN', '7471011000', '2026-06-01', '2026-06-15', 'FIBRA 100 MB', 599.00, 'SAO-11000' FROM comunidades WHERE nombre = 'SAN AGUSTIN OAPAN';

INSERT OR IGNORE INTO clientes (comunidad_id, numero_cliente, num_servicio_nombre, nombre, telefono, fecha_instalacion, fecha_pago, paquete, precio, alfa_numerico)
SELECT id, 12000, 'SERVICIO FIBRA 12000', 'CLIENTE PRUEBA SAN FRANCISCO OZOMATLAN', '7471012000', '2026-06-01', '2026-06-15', 'FIBRA 50 MB', 399.00, 'SFO-12000' FROM comunidades WHERE nombre = 'SAN FRANCISCO OZOMATLAN';




INSERT OR IGNORE INTO clientes (comunidad_id, numero_cliente, num_servicio_nombre, nombre, telefono, fecha_instalacion, fecha_pago, paquete, precio, alfa_numerico)
SELECT id, 10000, 'SERVICIO FIBRA 10000', 'CLIENTE PRUEBA SAN MIGUEL TECUIPAN', '7471010000', '2026-06-01', '2026-06-15', 'FIBRA 100 MB', 599.00, 'SMT-10000' FROM comunidades WHERE nombre = 'SAN MIGUEL TECUIPAN';

INSERT OR IGNORE INTO clientes (comunidad_id, numero_cliente, num_servicio_nombre, nombre, telefono, fecha_instalacion, fecha_pago, paquete, precio, alfa_numerico)
SELECT id, 7000, 'SERVICIO FIBRA 7000', 'CLIENTE PRUEBA TLAMAMACAN', '7471007000', '2026-06-01', '2026-06-15', 'FIBRA 50 MB', 399.00, 'TMM-7000' FROM comunidades WHERE nombre = 'TLAMAMACAN';

INSERT OR IGNORE INTO clientes (comunidad_id, numero_cliente, num_servicio_nombre, nombre, telefono, fecha_instalacion, fecha_pago, paquete, precio, alfa_numerico)
SELECT id, 2000, 'SERVICIO FIBRA 2000', 'CLIENTE PRUEBA TONALAPAN', '7471002000', '2026-06-01', '2026-06-15', 'FIBRA 80 MB', 499.00, 'TNL-2000' FROM comunidades WHERE nombre = 'TONALAPAN';

INSERT OR IGNORE INTO clientes (comunidad_id, numero_cliente, num_servicio_nombre, nombre, telefono, fecha_instalacion, fecha_pago, paquete, precio, alfa_numerico)
SELECT id, 3000, 'SERVICIO FIBRA 3000', 'CLIENTE PRUEBA VENTA PALULA', '7471003000', '2026-06-01', '2026-06-15', 'FIBRA 50 MB', 399.00, 'VPN-3000' FROM comunidades WHERE nombre = 'VENTA PALULA';

INSERT OR IGNORE INTO clientes (comunidad_id, numero_cliente, num_servicio_nombre, nombre, telefono, fecha_instalacion, fecha_pago, paquete, precio, alfa_numerico)
SELECT id, 4000, 'SERVICIO FIBRA 4000', 'CLIENTE PRUEBA XALITLA', '7471004000', '2026-06-01', '2026-06-15', 'FIBRA 80 MB', 499.00, 'XAL-4000' FROM comunidades WHERE nombre = 'XALITLA';

INSERT OR IGNORE INTO clientes (comunidad_id, numero_cliente, num_servicio_nombre, nombre, telefono, fecha_instalacion, fecha_pago, paquete, precio, alfa_numerico)
SELECT id, 2000, 'SERVICIO FIBRA 2000', 'CLIENTE PRUEBA PETAQUILLAS', '7471002001', '2026-06-01', '2026-06-15', 'FIBRA 100 MB', 599.00, 'PET-2000' FROM comunidades WHERE nombre = 'PETAQUILLAS';

INSERT OR IGNORE INTO clientes (comunidad_id, numero_cliente, num_servicio_nombre, nombre, telefono, fecha_instalacion, fecha_pago, paquete, precio, alfa_numerico)
SELECT id, 1, 'SERVICIO FIBRA PENDIENTE', 'CLIENTE PRUEBA SAN JUAN', '7471000001', '2026-06-01', '2026-06-15', 'FIBRA 50 MB', 399.00, 'SJN-001' FROM comunidades WHERE nombre = 'SAN JUAN';

INSERT OR IGNORE INTO clientes (comunidad_id, numero_cliente, num_servicio_nombre, nombre, telefono, fecha_instalacion, fecha_pago, paquete, precio, alfa_numerico)
SELECT id, 1, 'SERVICIO FIBRA PENDIENTE', 'CLIENTE PRUEBA PALULA', '7471000002', '2026-06-01', '2026-06-15', 'FIBRA 50 MB', 399.00, 'PAL-001' FROM comunidades WHERE nombre = 'PALULA';

INSERT OR IGNORE INTO clientes (comunidad_id, numero_cliente, num_servicio_nombre, nombre, telefono, fecha_instalacion, fecha_pago, paquete, precio, alfa_numerico)
SELECT id, 1, 'SERVICIO FIBRA PENDIENTE', 'CLIENTE PRUEBA SAN MIGUEL', '7471000003', '2026-06-01', '2026-06-15', 'FIBRA 50 MB', 399.00, 'SMG-001' FROM comunidades WHERE nombre = 'SAN MIGUEL';

INSERT OR IGNORE INTO clientes (comunidad_id, numero_cliente, num_servicio_nombre, nombre, telefono, fecha_instalacion, fecha_pago, paquete, precio, alfa_numerico)
SELECT id, 1, 'SERVICIO FIBRA PENDIENTE', 'CLIENTE PRUEBA TULA', '7471000004', '2026-06-01', '2026-06-15', 'FIBRA 50 MB', 399.00, 'TUL-001' FROM comunidades WHERE nombre = 'TULA';

INSERT OR IGNORE INTO clientes (comunidad_id, numero_cliente, num_servicio_nombre, nombre, telefono, fecha_instalacion, fecha_pago, paquete, precio, alfa_numerico)
SELECT id, 1, 'SERVICIO FIBRA PENDIENTE', 'CLIENTE PRUEBA SAN AGUSTIN OSTOTIPAN', '7471000005', '2026-06-01', '2026-06-15', 'FIBRA 50 MB', 399.00, 'SAO-001' FROM comunidades WHERE nombre = 'SAN AGUSTIN OSTOTIPAN';

INSERT OR IGNORE INTO clientes (comunidad_id, numero_cliente, num_servicio_nombre, nombre, telefono, fecha_instalacion, fecha_pago, paquete, precio, alfa_numerico)
SELECT id, 1, 'SERVICIO FIBRA PENDIENTE', 'CLIENTE PRUEBA ATETETLA', '7471000006', '2026-06-01', '2026-06-15', 'FIBRA 50 MB', 399.00, 'ATE-001' FROM comunidades WHERE nombre = 'ATETETLA';

INSERT OR IGNORE INTO clientes (comunidad_id, numero_cliente, num_servicio_nombre, nombre, telefono, fecha_instalacion, fecha_pago, paquete, precio, alfa_numerico)
SELECT id, 1, 'SERVICIO FIBRA PENDIENTE', 'CLIENTE PRUEBA PALAPA', '7471000007', '2026-06-01', '2026-06-15', 'FIBRA 50 MB', 399.00, 'PLP-001' FROM comunidades WHERE nombre = 'PALAPA';

INSERT OR IGNORE INTO clientes (comunidad_id, numero_cliente, num_servicio_nombre, nombre, telefono, fecha_instalacion, fecha_pago, paquete, precio, alfa_numerico)
SELECT id, 1, 'SERVICIO FIBRA PENDIENTE', 'CLIENTE PRUEBA COEXCONCLAN', '7471000008', '2026-06-01', '2026-06-15', 'FIBRA 50 MB', 399.00, 'CXC-001' FROM comunidades WHERE nombre = 'COEXCONCLAN';

UPDATE comunidades
SET siguiente_numero_cliente = (
  SELECT CASE
    WHEN comunidades.numero_inicial_cliente IS NOT NULL
      AND COALESCE(MAX(clientes.numero_cliente) + 1, comunidades.numero_inicial_cliente) < comunidades.numero_inicial_cliente
      THEN comunidades.numero_inicial_cliente + 1
    ELSE COALESCE(MAX(clientes.numero_cliente) + 1, comunidades.numero_inicial_cliente, siguiente_numero_cliente)
  END
  FROM clientes
  WHERE clientes.comunidad_id = comunidades.id
);
