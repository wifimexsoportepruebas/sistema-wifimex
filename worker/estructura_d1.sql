-- Converted from C:\Users\wifim\OneDrive\Desktop\estrcutra.sql for Cloudflare D1 / SQLite.
-- Source dump date: 2026-06-27 10:49:21
PRAGMA foreign_keys = OFF;

-- Legacy project tables not present in the MySQL source dump.
DROP TABLE IF EXISTS "sesiones";

DROP TABLE IF EXISTS "usuario_roles";
DROP TABLE IF EXISTS "pagos";
DROP TABLE IF EXISTS "reportes_seguimiento";
DROP TABLE IF EXISTS "reportes";
DROP TABLE IF EXISTS "puntos_cobro";
DROP TABLE IF EXISTS "servicios_fibra";
DROP TABLE IF EXISTS "clientes";
DROP TABLE IF EXISTS "prospectos";
DROP TABLE IF EXISTS "paquetes";
DROP TABLE IF EXISTS "ciclos_corte";
DROP TABLE IF EXISTS "comunidades";
DROP TABLE IF EXISTS "usuarios";
DROP TABLE IF EXISTS "roles";

PRAGMA foreign_keys = ON;

CREATE TABLE "roles" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "nombre" TEXT NOT NULL UNIQUE,
  "descripcion" TEXT,
  "activo" INTEGER NOT NULL DEFAULT 1
);

INSERT INTO "roles" ("id", "nombre", "descripcion", "activo") VALUES (1, 'ADMIN', 'Acceso total al sistema', 1);
INSERT INTO "roles" ("id", "nombre", "descripcion", "activo") VALUES (2, 'ATENCION_CLIENTE', 'Registra prospectos y reportes', 1);
INSERT INTO "roles" ("id", "nombre", "descripcion", "activo") VALUES (3, 'SOPORTE', 'Consulta y atiende reportes técnicos', 1);
INSERT INTO "roles" ("id", "nombre", "descripcion", "activo") VALUES (4, 'TECNICO', 'Atiende reportes asignados', 1);
INSERT INTO "roles" ("id", "nombre", "descripcion", "activo") VALUES (6, 'COBRADOR', 'Registra pagos en puntos de cobro', 1);

CREATE TABLE "usuarios" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "numero_empleado" TEXT NOT NULL UNIQUE,
  "nombres" TEXT NOT NULL,
  "apellido_paterno" TEXT,
  "apellido_materno" TEXT,
  "password_hash" TEXT NOT NULL,
  "activo" INTEGER NOT NULL DEFAULT 1,
  "fecha_registro" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "usuarios" ("id", "numero_empleado", "nombres", "apellido_paterno", "apellido_materno", "password_hash", "activo", "fecha_registro") VALUES (1, 'admin', 'Administrador', 'Sistema', NULL, '$2a$10$LHaQ4tRvJ54wZLILrXrDK.IpmEtV4w3yfkN/.1QQVvli8USvUmZpK', 1, '2026-06-25 17:58:22');
INSERT INTO "usuarios" ("id", "numero_empleado", "nombres", "apellido_paterno", "apellido_materno", "password_hash", "activo", "fecha_registro") VALUES (3, 'atencion', 'Atencion', 'Sistema', NULL, '$2a$10$LHaQ4tRvJ54wZLILrXrDK.IpmEtV4w3yfkN/.1QQVvli8USvUmZpK', 1, '2026-06-25 17:58:22');
INSERT INTO "usuarios" ("id", "numero_empleado", "nombres", "apellido_paterno", "apellido_materno", "password_hash", "activo", "fecha_registro") VALUES (4, 'ADMIN001', 'Administrador', 'Sistema', NULL, '$2a$10$.OT2cxPIQ6AcW9fcPz4y8egcuBJm2VDSV9JZJLPP7RRMMyzFxRbwO', 1, '2026-06-25 20:07:16');

CREATE TABLE "comunidades" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "nombre" TEXT NOT NULL UNIQUE,
  "prefijo" TEXT,
  "numero_inicial_cliente" INTEGER,
  "siguiente_numero_cliente" INTEGER,
  "latitud" REAL,
  "longitud" REAL,
  "activo" INTEGER NOT NULL DEFAULT 1
);

INSERT INTO "comunidades" ("id", "nombre", "prefijo", "numero_inicial_cliente", "siguiente_numero_cliente", "latitud", "longitud", "activo") VALUES (1, 'AMOJILECA', 'AMJ', 1000, 1000, NULL, NULL, 1);
INSERT INTO "comunidades" ("id", "nombre", "prefijo", "numero_inicial_cliente", "siguiente_numero_cliente", "latitud", "longitud", "activo") VALUES (2, 'AMEYALTEPEC', 'AMP', 9000, 9000, NULL, NULL, 1);
INSERT INTO "comunidades" ("id", "nombre", "prefijo", "numero_inicial_cliente", "siguiente_numero_cliente", "latitud", "longitud", "activo") VALUES (3, 'LLANO GRANDE', 'LLG', 8000, 8000, NULL, NULL, 1);
INSERT INTO "comunidades" ("id", "nombre", "prefijo", "numero_inicial_cliente", "siguiente_numero_cliente", "latitud", "longitud", "activo") VALUES (4, 'SAN AGUSTIN OAPAN', 'SAO', 11000, 11000, NULL, NULL, 1);
INSERT INTO "comunidades" ("id", "nombre", "prefijo", "numero_inicial_cliente", "siguiente_numero_cliente", "latitud", "longitud", "activo") VALUES (5, 'SAN FRANCISCO OZOMATLAN', 'SFO', 12000, 12000, NULL, NULL, 1);
INSERT INTO "comunidades" ("id", "nombre", "prefijo", "numero_inicial_cliente", "siguiente_numero_cliente", "latitud", "longitud", "activo") VALUES (6, 'SAN JUAN TETELCINGO', 'SJT', 6000, 6000, NULL, NULL, 1);
INSERT INTO "comunidades" ("id", "nombre", "prefijo", "numero_inicial_cliente", "siguiente_numero_cliente", "latitud", "longitud", "activo") VALUES (7, 'SAN MARCOS', 'SMC', 6000, 6071, NULL, NULL, 1);
INSERT INTO "comunidades" ("id", "nombre", "prefijo", "numero_inicial_cliente", "siguiente_numero_cliente", "latitud", "longitud", "activo") VALUES (8, 'SAN MIGUEL TECUIPAN', 'SMT', 10000, 10000, NULL, NULL, 1);
INSERT INTO "comunidades" ("id", "nombre", "prefijo", "numero_inicial_cliente", "siguiente_numero_cliente", "latitud", "longitud", "activo") VALUES (9, 'TLAMAMACAN', 'TMM', 7000, 7000, NULL, NULL, 1);
INSERT INTO "comunidades" ("id", "nombre", "prefijo", "numero_inicial_cliente", "siguiente_numero_cliente", "latitud", "longitud", "activo") VALUES (10, 'TONALAPAN', 'TNL', 2000, 2000, NULL, NULL, 1);
INSERT INTO "comunidades" ("id", "nombre", "prefijo", "numero_inicial_cliente", "siguiente_numero_cliente", "latitud", "longitud", "activo") VALUES (11, 'VENTA PALULA', 'VPN', 3000, 3000, NULL, NULL, 1);
INSERT INTO "comunidades" ("id", "nombre", "prefijo", "numero_inicial_cliente", "siguiente_numero_cliente", "latitud", "longitud", "activo") VALUES (12, 'XALITLA', 'XAL', 4000, 4000, NULL, NULL, 1);
INSERT INTO "comunidades" ("id", "nombre", "prefijo", "numero_inicial_cliente", "siguiente_numero_cliente", "latitud", "longitud", "activo") VALUES (13, 'SAN JUAN', NULL, NULL, NULL, NULL, NULL, 1);
INSERT INTO "comunidades" ("id", "nombre", "prefijo", "numero_inicial_cliente", "siguiente_numero_cliente", "latitud", "longitud", "activo") VALUES (14, 'PALULA', NULL, NULL, NULL, NULL, NULL, 1);
INSERT INTO "comunidades" ("id", "nombre", "prefijo", "numero_inicial_cliente", "siguiente_numero_cliente", "latitud", "longitud", "activo") VALUES (15, 'SAN MIGUEL', NULL, NULL, NULL, NULL, NULL, 1);
INSERT INTO "comunidades" ("id", "nombre", "prefijo", "numero_inicial_cliente", "siguiente_numero_cliente", "latitud", "longitud", "activo") VALUES (16, 'TULA', NULL, NULL, NULL, NULL, NULL, 1);
INSERT INTO "comunidades" ("id", "nombre", "prefijo", "numero_inicial_cliente", "siguiente_numero_cliente", "latitud", "longitud", "activo") VALUES (17, 'SAN AGUSTIN OSTOTIPAN', NULL, NULL, NULL, NULL, NULL, 1);
INSERT INTO "comunidades" ("id", "nombre", "prefijo", "numero_inicial_cliente", "siguiente_numero_cliente", "latitud", "longitud", "activo") VALUES (18, 'ATETETLA', NULL, NULL, NULL, NULL, NULL, 1);
INSERT INTO "comunidades" ("id", "nombre", "prefijo", "numero_inicial_cliente", "siguiente_numero_cliente", "latitud", "longitud", "activo") VALUES (19, 'PALAPA', NULL, NULL, NULL, NULL, NULL, 1);
INSERT INTO "comunidades" ("id", "nombre", "prefijo", "numero_inicial_cliente", "siguiente_numero_cliente", "latitud", "longitud", "activo") VALUES (20, 'COEXCONCLAN', NULL, NULL, NULL, NULL, NULL, 1);

CREATE TABLE "ciclos_corte" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "nombre" TEXT NOT NULL UNIQUE,
  "dia_inicio" INTEGER NOT NULL CHECK ("dia_inicio" BETWEEN 1 AND 31),
  "dia_fin" INTEGER NOT NULL CHECK ("dia_fin" BETWEEN 1 AND 31),
  "activo" INTEGER NOT NULL DEFAULT 1,
  CHECK ("dia_inicio" <= "dia_fin")
);

INSERT INTO "ciclos_corte" ("id", "nombre", "dia_inicio", "dia_fin", "activo") VALUES (1, 'CORTE 1-5', 1, 5, 1);
INSERT INTO "ciclos_corte" ("id", "nombre", "dia_inicio", "dia_fin", "activo") VALUES (2, 'CORTE 15-20', 15, 20, 1);

CREATE TABLE "paquetes" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "comunidad_id" INTEGER NOT NULL,
  "nombre" TEXT NOT NULL,
  "velocidad_megas" INTEGER,
  "precio_mensual" REAL NOT NULL,
  "activo" INTEGER NOT NULL DEFAULT 1,
  UNIQUE ("comunidad_id", "nombre"),
  CONSTRAINT "fk_paquetes_comunidad" FOREIGN KEY ("comunidad_id") REFERENCES "comunidades" ("id")
);
CREATE INDEX "idx_paquetes_comunidad" ON "paquetes" ("comunidad_id");

INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (1, 1, 'Paquete Básico 10 Megas', 10, 299, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (2, 1, 'Paquete Plus 20 Megas', 20, 349, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (3, 1, 'Paquete Premium 30 Megas', 30, 449, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (4, 18, 'Paquete Básico 10 Megas', 10, 299, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (5, 18, 'Paquete Plus 20 Megas', 20, 349, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (6, 18, 'Paquete Premium 30 Megas', 30, 449, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (7, 19, 'Paquete Básico 10 Megas', 10, 299, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (8, 19, 'Paquete Plus 20 Megas', 20, 349, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (9, 19, 'Paquete Premium 30 Megas', 30, 449, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (10, 20, 'Paquete Básico 10 Megas', 10, 299, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (11, 20, 'Paquete Plus 20 Megas', 20, 349, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (12, 20, 'Paquete Premium 30 Megas', 30, 449, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (13, 13, 'Paquete Plus 20 Megas', 20, 349, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (14, 13, 'Paquete Premium 30 Megas', 30, 449, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (15, 7, 'Paquete Plus 20 Megas', 20, 349, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (16, 7, 'Paquete Premium 30 Megas', 30, 449, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (17, 9, 'Paquete Básico 10 Megas', 10, 299, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (18, 9, 'Paquete Plus 20 Megas', 20, 349, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (19, 9, 'Paquete Premium 30 Megas', 30, 449, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (20, 2, 'Paquete Básico 10 Megas', 10, 299, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (21, 2, 'Paquete Plus 20 Megas', 20, 349, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (22, 2, 'Paquete Premium 30 Megas', 30, 449, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (23, 3, 'Paquete Plus 20 Megas', 20, 349, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (24, 3, 'Paquete Premium 30 Megas', 30, 449, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (25, 10, 'Paquete Básico 10 Megas', 10, 299, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (26, 10, 'Paquete Plus 20 Megas', 20, 349, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (27, 10, 'Paquete Premium 30 Megas', 30, 449, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (28, 12, 'Paquete Plus 20 Megas', 20, 349, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (29, 12, 'Paquete Premium 30 Megas', 30, 449, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (30, 14, 'Paquete Básico 10 Megas', 10, 299, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (31, 14, 'Paquete Plus 20 Megas', 20, 349, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (32, 14, 'Paquete Premium 30 Megas', 30, 449, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (33, 8, 'Paquete Básico 10 Megas', 10, 319, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (34, 8, 'Paquete Plus 20 Megas', 20, 349, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (35, 8, 'Paquete Premium 30 Megas', 30, 469, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (36, 5, 'Paquete Básico 10 Megas', 10, 299, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (37, 5, 'Paquete Plus 20 Megas', 20, 349, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (38, 5, 'Paquete Premium 30 Megas', 30, 449, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (39, 4, 'Paquete Básico 10 Megas', 10, 299, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (40, 4, 'Paquete Plus 20 Megas', 20, 349, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (41, 4, 'Paquete Premium 30 Megas', 30, 449, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (42, 11, 'Paquete Básico 10 Megas', 10, 299, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (43, 11, 'Paquete Plus 20 Megas', 20, 349, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (44, 11, 'Paquete Premium 30 Megas', 30, 449, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (45, 16, 'Paquete Básico 10 Megas', 10, 299, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (46, 16, 'Paquete Plus 20 Megas', 20, 349, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (47, 16, 'Paquete Premium 30 Megas', 30, 449, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (48, 6, 'Paquete Básico 10 Megas', 10, 299, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (49, 6, 'Paquete Plus 20 Megas', 20, 349, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (50, 6, 'Paquete Premium 30 Megas', 30, 449, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (51, 17, 'Paquete Básico 10 Megas', 10, 299, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (52, 17, 'Paquete Plus 20 Megas', 20, 349, 1);
INSERT INTO "paquetes" ("id", "comunidad_id", "nombre", "velocidad_megas", "precio_mensual", "activo") VALUES (53, 17, 'Paquete Premium 30 Megas', 30, 449, 1);

CREATE TABLE "prospectos" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "nombres" TEXT NOT NULL,
  "apellido_paterno" TEXT,
  "apellido_materno" TEXT,
  "telefono" TEXT NOT NULL,
  "direccion" TEXT,
  "referencia" TEXT,
  "comunidad_id" INTEGER NOT NULL,
  "paquete_interes_id" INTEGER,
  "comentario" TEXT,
  "fecha_registro" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_prospectos_comunidad" FOREIGN KEY ("comunidad_id") REFERENCES "comunidades" ("id"),
  CONSTRAINT "fk_prospectos_paquete" FOREIGN KEY ("paquete_interes_id") REFERENCES "paquetes" ("id")
);
CREATE INDEX "idx_prospectos_comunidad" ON "prospectos" ("comunidad_id");
CREATE INDEX "idx_prospectos_paquete" ON "prospectos" ("paquete_interes_id");

INSERT INTO "prospectos" ("id", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "paquete_interes_id", "comentario", "fecha_registro") VALUES (3, 'ELIAN', 'GGGG', 'GGG', '54643465', '', '', 1, 1, '', '2026-06-25 21:21:16');

CREATE TABLE "clientes" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "numero_cliente" TEXT NOT NULL UNIQUE,
  "nombres" TEXT NOT NULL,
  "apellido_paterno" TEXT,
  "apellido_materno" TEXT,
  "telefono" TEXT,
  "direccion" TEXT,
  "referencia" TEXT,
  "comunidad_id" INTEGER NOT NULL,
  "prospecto_id" INTEGER,
  "estado_cliente" TEXT NOT NULL CHECK ("estado_cliente" IN ('ACTIVO','CANCELADO','REVISION','SUSPENDIDO')),
  "qr_token" TEXT UNIQUE,
  "fecha_registro" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_clientes_comunidad" FOREIGN KEY ("comunidad_id") REFERENCES "comunidades" ("id"),
  CONSTRAINT "fk_clientes_prospecto" FOREIGN KEY ("prospecto_id") REFERENCES "prospectos" ("id")
);
CREATE INDEX "idx_clientes_comunidad" ON "clientes" ("comunidad_id");
CREATE INDEX "idx_clientes_prospecto" ON "clientes" ("prospecto_id");

INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (141, 'SMC-6001', 'SILVIA', 'BARRERA', 'MARTINEZ', NULL, '', '', 7, NULL, 'ACTIVO', 'c1493332d89d48bd852cbf3d8a786507', '2026-06-27 15:22:19');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (142, 'SMC-6002', 'ISELA', 'MARTINEZ', 'FELIPE', NULL, '', '', 7, NULL, 'ACTIVO', 'fa5d03f784e3443fb6d4a6020f916c22', '2026-06-27 15:22:19');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (143, 'SMC-6003', 'VICTORINO', 'BERNAL', 'DAMIAN', NULL, '', '', 7, NULL, 'ACTIVO', 'c5f8d4ae8812496984b9d8c5810be6ac', '2026-06-27 15:22:19');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (144, 'SMC-6004', 'OCTAVIO', 'ATILANO', 'MILLAN', NULL, '', '', 7, NULL, 'ACTIVO', '29b1937541944bd181afb0d5ad24d97b', '2026-06-27 15:22:19');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (145, 'SMC-6005', 'FELIPA', 'BERNAL', 'BERNAL', NULL, '', '', 7, NULL, 'ACTIVO', 'aba4fa1233404cb5a8c7f5978758287f', '2026-06-27 15:22:19');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (146, 'SMC-6006', 'SANDRA', 'GONZALEZ', 'MILLAN', NULL, '', '', 7, NULL, 'ACTIVO', '4393f57ce4cc4c69b3cd32d46f20b081', '2026-06-27 15:22:20');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (147, 'SMC-6007', 'JESSICA', 'BERNAL', 'MILLAN', NULL, '', '', 7, NULL, 'ACTIVO', '8767ba48cd9047deac0b0e72689b9fda', '2026-06-27 15:22:20');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (148, 'SMC-6008', 'MIGUELA', 'APOLINIO', 'ALEJO', NULL, '', '', 7, NULL, 'ACTIVO', '03391ae5f5e345e0bb4fa9e873fb8c6c', '2026-06-27 15:22:20');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (149, 'SMC-6009', 'FABIOLA', 'GONZALEZ', 'MILLAN', NULL, '', '', 7, NULL, 'ACTIVO', 'a2367ea10742454da1d9f1cd7da3de76', '2026-06-27 15:22:20');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (150, 'SMC-6010', 'MARIO', 'BERNAL', 'DAMIAN', NULL, '', '', 7, NULL, 'ACTIVO', '945bfcbea9004460bd6189316fecc213', '2026-06-27 15:22:20');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (151, 'SMC-6011', 'REYNALDA', 'CAMPOS', 'TRINIDAD', NULL, '', '', 7, NULL, 'ACTIVO', '65e51faff449468fbee17d7401c66afc', '2026-06-27 15:22:20');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (152, 'SMC-6012', 'ANGELICA DE', 'JESUS', 'MILLAN', NULL, '', '', 7, NULL, 'ACTIVO', '907bc9f8e1fe4a49bbca7df3b7545376', '2026-06-27 15:22:20');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (153, 'SMC-6013', 'ELEAZAR', 'DIAZ', 'MARTINEZ', NULL, '', '', 7, NULL, 'ACTIVO', 'ba18468df3ca4e1c857ba0495b223208', '2026-06-27 15:22:21');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (154, 'SMC-6014', 'RAFAEL DE', 'JESUS', 'ALEJO', NULL, '', '', 7, NULL, 'ACTIVO', '7314808eda774cc28427f68ed323c65a', '2026-06-27 15:22:21');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (155, 'SMC-6015', 'SUSANALINARESFELIPE', NULL, NULL, NULL, '', '', 7, NULL, 'ACTIVO', '4d8c83257b6a475ab77688ae25f98f28', '2026-06-27 15:22:21');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (156, 'SMC-6016', 'EUCARIA', 'MILLAN', 'MILLAN', NULL, '', '', 7, NULL, 'ACTIVO', '20fa8f03be1342f494f0a625883fe375', '2026-06-27 15:22:21');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (157, 'SMC-6017', 'MAXIMO', 'MARTINO', 'JIMENEZ', NULL, '', '', 7, NULL, 'ACTIVO', '9ee08f49a6d14cd28758febd7ee66401', '2026-06-27 15:22:21');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (158, 'SMC-6018', 'FLORENCIA', 'FELIPE', 'APOLONIO', NULL, '', '', 7, NULL, 'ACTIVO', '1cd1bc9765b148b1b810e2874bcf911a', '2026-06-27 15:22:21');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (159, 'SMC-6019', 'NICANDRA', 'FELIPE', 'APOLONIO', NULL, '', '', 7, NULL, 'ACTIVO', '9e62e9b881f44e3292f191d1944088f1', '2026-06-27 15:22:22');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (160, 'SMC-6020', 'ANGEL DE', 'JESUS', 'ALEJO', NULL, '', '', 7, NULL, 'ACTIVO', 'b131565b66ee40a78ba73eb1683a26c3', '2026-06-27 15:22:22');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (161, 'SMC-6021', 'SANTOS', 'MARTINEZ', 'GERMAN', NULL, '', '', 7, NULL, 'ACTIVO', '12facf82957a461990a657671ab4013b', '2026-06-27 15:22:22');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (162, 'SMC-6022', 'VIRGINIA', 'GEMARTINO', 'MAXIMO', NULL, '', '', 7, NULL, 'ACTIVO', 'e55af54f73cc4ba0b222ea0e54ce7885', '2026-06-27 15:22:22');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (163, 'SMC-6023', 'SOFIA', 'BERNAL', 'RAMIREZ', NULL, '', '', 7, NULL, 'ACTIVO', '59fe97451fa84fbca69767b65147a378', '2026-06-27 15:22:22');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (164, 'SMC-6024', 'ESTEFANIA LORENZO', 'DE', 'JESUS', NULL, '', '', 7, NULL, 'ACTIVO', '5e787038f7154840816f4cae22c9a6ef', '2026-06-27 15:22:22');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (165, 'SMC-6025', 'SANTA LUCIA', 'FELIPE', 'NARCISO', NULL, '', '', 7, NULL, 'ACTIVO', '5d5ecc1f1c4543689e6c3c6ce52425fb', '2026-06-27 15:22:22');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (166, 'SMC-6026', 'JUANA', 'RAMIREZ', 'GONZALEZ', NULL, '', '', 7, NULL, 'ACTIVO', '97d35888437d465eab3ef6b8248beac3', '2026-06-27 15:22:22');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (167, 'SMC-6027', 'AZUCEN', 'JIMENEZ', 'CAMPOS', NULL, '', '', 7, NULL, 'ACTIVO', '6b2dceb8b69943bd87261db3e19bc8bb', '2026-06-27 15:22:23');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (168, 'SMC-6028', 'MAUROALEJOAPOLONIO', NULL, NULL, NULL, '', '', 7, NULL, 'ACTIVO', '8f6e5d2b718b4594bbd3c1f34c48efac', '2026-06-27 15:22:23');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (169, 'SMC-6029', 'ARMANDOCAMPOSJIMENEZ', NULL, NULL, NULL, '', '', 7, NULL, 'ACTIVO', 'ba65244d45ef4ac8946d0b25e5107a0f', '2026-06-27 15:22:23');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (170, 'SMC-6030', 'CESARIOMARCELINODIAZ', NULL, NULL, NULL, '', '', 7, NULL, 'ACTIVO', 'af40f6766bb84250a50a40dff266e6b4', '2026-06-27 15:22:23');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (171, 'SMC-6031', 'TEOFILA', 'DIAZ', 'CAMPOS', NULL, '', '', 7, NULL, 'ACTIVO', 'f76c20f3b7d348e2ad272cbb6389ed56', '2026-06-27 15:22:23');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (172, 'SMC-6032', 'VERENICE', 'MARTINEZ', 'GERMAN', NULL, '', '', 7, NULL, 'ACTIVO', '30627c5efd8744be978f46147a79d660', '2026-06-27 15:22:23');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (173, 'SMC-6033', 'EUGENIA', 'MILLAN', 'MILLAN', NULL, '', '', 7, NULL, 'ACTIVO', 'a041b60da840455d8a249969187f8ae7', '2026-06-27 15:22:24');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (174, 'SMC-6034', 'YULET YURIDIA', 'VENANCIO', 'CATALAN', NULL, '', '', 7, NULL, 'ACTIVO', 'aaa9544c225d4f0c86d65701d6f15f53', '2026-06-27 15:22:24');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (175, 'SMC-6035', 'YANETH', 'LINARES', 'CHIQUITO', NULL, '', '', 7, NULL, 'ACTIVO', '487e1cbf4ab946ae9a14219b21c54a2a', '2026-06-27 15:22:24');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (176, 'SMC-6036', 'JOSE', 'CAMPOS', 'GEMARTINO', NULL, '', '', 7, NULL, 'ACTIVO', '9a621aa32f4540e5baf386ea639e4e6c', '2026-06-27 15:22:24');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (177, 'SMC-6037', 'ELVIALORENZODEJESUS', NULL, NULL, NULL, '', '', 7, NULL, 'ACTIVO', 'ea385001a86443c6aa2436b027242905', '2026-06-27 15:22:24');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (178, 'SMC-6038', 'EVAMACARIAMARCELINOMILLAN', NULL, NULL, NULL, '', '', 7, NULL, 'ACTIVO', '3fbfff36d64348158bd5ea89f651547f', '2026-06-27 15:22:24');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (179, 'SMC-6040', 'DOMINGO', 'ATILANO', 'MILLAN', NULL, '', '', 7, NULL, 'ACTIVO', '6ecb018630c74c4fb42892885e1a6de6', '2026-06-27 15:22:25');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (180, 'SMC-6041', 'LORENA', 'FELIPE', 'NARCIZO', NULL, '', '', 7, NULL, 'ACTIVO', '7bb7d7ab865f46b39e470feefb7f9e33', '2026-06-27 15:22:25');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (181, 'SMC-6042', 'SERGIO', 'MARTINES', 'JIMENEZ', NULL, '', '', 7, NULL, 'ACTIVO', 'fc54c724b3ba434b962cc7f42e391ea7', '2026-06-27 15:22:25');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (182, 'SMC-6043', 'JOEL', 'LORENZO', 'GEMARTINO', NULL, '', '', 7, NULL, 'ACTIVO', '39c582aeb64c41709ad57ca08b287bca', '2026-06-27 15:22:25');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (183, 'SMC-6044', 'GUILLERMO', 'MARCELINO', 'MARTINO', NULL, '', '', 7, NULL, 'ACTIVO', 'e08d82772e8046ab8a741ece8b2c6c97', '2026-06-27 15:22:25');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (184, 'SMC-6045', 'GAUDENCIO DE', 'JESÚS', 'MILLAN', NULL, '', '', 7, NULL, 'ACTIVO', 'c76d78ad7d90455aa60df353d55a3bc4', '2026-06-27 15:22:25');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (185, 'SMC-6046', 'RAFAELA', 'NARCISO', 'LINARES', NULL, '', '', 7, NULL, 'ACTIVO', 'a9685c6596e545c8ae7ad342cdee3005', '2026-06-27 15:22:25');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (186, 'SMC-6047', 'MARIA DE LOURDES', 'BERNAL', 'CAMPO', NULL, '', '', 7, NULL, 'ACTIVO', '6faf3c20de3344558e2f69df90858374', '2026-06-27 15:22:26');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (187, 'SMC-6048', 'ELEUTERIA', 'CAMPOS', 'BERNAL', NULL, '', '', 7, NULL, 'ACTIVO', '777e99b65a9a4f5389f5a2e37d0a128b', '2026-06-27 15:22:26');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (188, 'SMC-6049', 'ADELA', 'MAXIMO', 'CAMPOS', NULL, '', '', 7, NULL, 'ACTIVO', 'aaa3b757ff7242b08b97ba73f0eb17dd', '2026-06-27 15:22:26');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (189, 'SMC-6050', 'LUIS', 'FELIPE', 'RAMIREZ', NULL, '', '', 7, NULL, 'ACTIVO', '1b050882d5f04e5ab3b81171202d4b01', '2026-06-27 15:22:26');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (190, 'SMC-6051', 'CECILIA', 'ATILANO', 'TRINIDAD', NULL, '', '', 7, NULL, 'ACTIVO', 'd9f4eabacb1f4a54a18ebcc9bdb40f99', '2026-06-27 15:22:26');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (191, 'SMC-6052', 'ELEAZAR', 'CAMPOS', NULL, NULL, '', '', 7, NULL, 'ACTIVO', '35c49163eac94fedbf471556dfa1ada8', '2026-06-27 15:22:26');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (192, 'SMC-6053', 'EUSTOLIA', 'APOLONIO', 'ATILANO', NULL, '', '', 7, NULL, 'ACTIVO', '216dda5bfcdb4d06a152fe3ebcbc74d9', '2026-06-27 15:22:26');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (193, 'SMC-6054', 'GENOVEVA DE', 'JESUS', 'MILLAN', NULL, '', '', 7, NULL, 'ACTIVO', 'f824c649d36b46598ecf47911e5ddc10', '2026-06-27 15:22:26');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (194, 'SMC-6055', 'ELEUTERIA', 'JIMENEZ', 'TOLENTINO', NULL, '', '', 7, NULL, 'ACTIVO', 'bc7ed4a0d00b4540854073dcde661b0f', '2026-06-27 15:22:26');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (195, 'SMC-6056', 'EVA', 'ITURBIDE', 'FLORES', NULL, '', '', 7, NULL, 'ACTIVO', '08439218a291485d87da906fbf900471', '2026-06-27 15:22:26');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (196, 'SMC-6057', 'LEONARDA', 'BERNAL', 'CAMPOS', NULL, '', '', 7, NULL, 'ACTIVO', '22fac73dcbb34b58a46f1200ea471a74', '2026-06-27 15:22:27');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (197, 'SMC-6058', 'RICARDA', 'JIMENEZ', NULL, NULL, '', '', 7, NULL, 'ACTIVO', '85abc92234254eb3a5a3904a36b78fb5', '2026-06-27 15:22:27');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (198, 'SMC-6059', 'ROSA LINDA', 'ROMAN', 'ORTIZ', NULL, '', '', 7, NULL, 'ACTIVO', '755e0a173c07499b9f6f7ef39b9a11d1', '2026-06-27 15:22:27');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (199, 'SMC-6060', 'MAGDALENA', 'DIAZ', 'SOSTENES', NULL, '', '', 7, NULL, 'ACTIVO', 'b453aef9b171497a9aea2fbd8443436f', '2026-06-27 15:22:27');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (200, 'SMC-6061', 'VIRGINIO', 'ATILANO', 'VERNAL', NULL, '', '', 7, NULL, 'ACTIVO', '7d48d2b90cc74509a2f59c89d6896425', '2026-06-27 15:22:27');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (201, 'SMC-6062', 'LEONADA', 'CAMPOS', 'TRINIDAD', NULL, '', '', 7, NULL, 'ACTIVO', '6e25f7d743bb4111a6886813f1639357', '2026-06-27 15:22:27');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (202, 'SMC-6063', 'VIRGINIA', 'ATILANO', 'MILLAN', NULL, '', '', 7, NULL, 'ACTIVO', '9f3da9a491ce4ee4b2e7f1677619317d', '2026-06-27 15:22:27');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (203, 'SMC-6064', 'SOFIA', 'ATILANO', 'NARCISO', NULL, '', '', 7, NULL, 'ACTIVO', '530e541369974d8a932ce09ce757c671', '2026-06-27 15:22:27');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (204, 'SMC-6065', 'GUADALUPE', 'MILLAN', 'ATILANO', NULL, '', '', 7, NULL, 'ACTIVO', '1491f20bf023450f8cf5ffb8445a8577', '2026-06-27 15:22:27');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (205, 'SMC-6066', 'ISIDORA RAMIREZ', 'DE', 'JESUS', NULL, '', '', 7, NULL, 'ACTIVO', '9279aff15c804090a3899d7663be2c90', '2026-06-27 15:22:28');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (206, 'SMC-6067', 'FELIX', 'ATILANO', 'MARTINEZ', NULL, '', '', 7, NULL, 'ACTIVO', 'dce2242404de4b4a8abe9761e32514a1', '2026-06-27 15:22:28');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (207, 'SMC-6068', 'BERENICE', 'CRUZ', 'VEGA', NULL, '', '', 7, NULL, 'ACTIVO', '2ba5106094794421be0165182cc04be6', '2026-06-27 15:22:28');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (208, 'SMC-6069', 'SANDRA', 'GEMARTINO', 'APOLONIO', NULL, '', '', 7, NULL, 'ACTIVO', '1e94aee737a84acea93553dd0859fc2a', '2026-06-27 15:22:28');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (209, 'SMC-6070', 'DOMINGO', 'ATILANO', 'MILLAN', NULL, '', '', 7, NULL, 'ACTIVO', 'f21855ad53d74804bafaf38f8206af43', '2026-06-27 15:22:28');
INSERT INTO "clientes" ("id", "numero_cliente", "nombres", "apellido_paterno", "apellido_materno", "telefono", "direccion", "referencia", "comunidad_id", "prospecto_id", "estado_cliente", "qr_token", "fecha_registro") VALUES (210, 'SMC-6071', 'CLEMENTE', 'CAMPOS', 'MILLAN', NULL, '', '', 7, NULL, 'ACTIVO', 'fc8556559069483786455668701bcd9d', '2026-06-27 15:22:28');

CREATE TABLE "servicios_fibra" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "cliente_id" INTEGER NOT NULL,
  "paquete_id" INTEGER NOT NULL,
  "ciclo_corte_id" INTEGER NOT NULL,
  "alfanumerico_equipo" TEXT,
  "ip_asignada" TEXT,
  "fecha_instalacion" TEXT,
  "precio_mensual" REAL NOT NULL,
  "estado_servicio" TEXT NOT NULL CHECK ("estado_servicio" IN ('ACTIVO','CANCELADO','PENDIENTE','REVISION','SUSPENDIDO')),
  CONSTRAINT "fk_servicios_ciclo" FOREIGN KEY ("ciclo_corte_id") REFERENCES "ciclos_corte" ("id"),
  CONSTRAINT "fk_servicios_cliente" FOREIGN KEY ("cliente_id") REFERENCES "clientes" ("id") ON DELETE CASCADE,
  CONSTRAINT "fk_servicios_paquete" FOREIGN KEY ("paquete_id") REFERENCES "paquetes" ("id")
);
CREATE INDEX "idx_servicios_cliente" ON "servicios_fibra" ("cliente_id");
CREATE INDEX "idx_servicios_paquete" ON "servicios_fibra" ("paquete_id");
CREATE INDEX "idx_servicios_ciclo" ON "servicios_fibra" ("ciclo_corte_id");

INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (141, 141, 15, 1, 'HWTC4b8fb6b6', '', '2026-04-10', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (142, 142, 15, 2, 'HWTC4b8f8ab6', '', '2026-04-10', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (143, 143, 15, 2, 'ZTEG24381218', '', '2026-04-11', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (144, 144, 15, 2, 'ZTEG244051b5', '', '2026-04-11', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (145, 145, 15, 2, 'FHTTc1a5be0f', '', '2026-04-11', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (146, 146, 15, 2, 'HWTC58b1f5b5', '', '2026-04-12', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (147, 147, 15, 2, 'HWTCee6fcbb5', '', '2026-04-12', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (148, 148, 15, 2, 'HWTC0e5236b1', '', '2026-04-12', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (149, 149, 15, 2, '', '', '2026-04-12', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (150, 150, 15, 2, 'HWTC48ce53b1', '', '2026-04-12', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (151, 151, 15, 2, 'HWTC4c30f2b5', '', '2026-04-13', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (152, 152, 15, 2, '', '', '2026-04-13', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (153, 153, 15, 2, 'HWTC4c26eab5', '', '2026-04-13', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (154, 154, 15, 2, 'HWTC4c88e6b0', '', '2026-04-13', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (155, 155, 15, 2, 'ATWT162a55aa', '', '2026-04-14', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (156, 156, 15, 2, 'ZTEG24301b77', '', '2026-04-14', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (157, 157, 15, 2, 'ZTEG253455b5', '', '2026-04-14', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (158, 158, 15, 2, 'ZTEG25345fe7', '', '2026-04-14', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (159, 159, 15, 2, 'ZTEG25341f31', '', '2026-04-14', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (160, 160, 15, 1, 'HWTCff7800b5', '', '2026-04-14', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (161, 161, 15, 2, '', '', '2026-04-14', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (162, 162, 15, 2, 'ZTEG25343314', '', '2026-04-14', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (163, 163, 15, 2, 'ZTEG25345ff9', '', '2026-04-14', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (164, 164, 15, 2, 'ZTEG25346008', '', '2026-04-14', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (165, 165, 15, 2, 'HWTCbfb905b5', '', '2026-04-14', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (166, 166, 15, 2, 'ZTEG253452d7', '', '2026-04-15', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (167, 167, 15, 2, '', '', '2026-04-15', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (168, 168, 15, 2, '', '', '2026-04-15', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (169, 169, 15, 2, 'ALCLfe093b59', '', '2026-04-15', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (170, 170, 15, 2, '', '', '2026-04-15', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (171, 171, 15, 2, 'HWTCd1efe0b5', '', '2026-04-16', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (172, 172, 15, 2, '', '', '2026-04-16', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (173, 173, 15, 2, 'ATWT16234ae3', '', '2026-04-16', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (174, 174, 15, 2, '', '', '2026-04-16', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (175, 175, 15, 2, 'HWTCc063f1ac', '', '2026-04-16', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (176, 176, 15, 2, 'HWTC7272a1b0', '', '2026-04-16', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (177, 177, 15, 2, 'ATWT16231ef5', '', '2026-04-16', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (178, 178, 15, 2, '', '', '2026-04-16', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (179, 179, 15, 2, '', '', '2026-04-21', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (180, 180, 15, 2, '', '', '2026-04-21', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (181, 181, 15, 2, '', '', '2026-04-21', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (182, 182, 15, 2, 'HWTC4b8c79b6', '', '2026-04-21', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (183, 183, 15, 2, 'HWTC4b8e50b6', '', '2026-04-21', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (184, 184, 15, 2, '', '', '2026-04-21', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (185, 185, 15, 2, '', '', '2026-04-21', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (186, 186, 15, 2, '', '', '2026-04-22', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (187, 187, 15, 2, '', '', '2026-04-22', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (188, 188, 15, 2, '', '', '2026-04-23', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (189, 189, 15, 2, 'HWTC4b8565b6', '', '2026-04-23', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (190, 190, 15, 2, '', '', '2026-04-23', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (191, 191, 15, 2, '', '', '2026-04-23', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (192, 192, 15, 2, '', '', '2026-04-23', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (193, 193, 15, 2, '', '', '2026-04-24', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (194, 194, 15, 2, '', '', '2026-04-25', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (195, 195, 15, 2, 'HWTC3b882ca4', '', '2026-04-25', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (196, 196, 15, 1, 'HWTC4b8264b6', '', '2026-05-01', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (197, 197, 15, 1, '', '', '2026-05-01', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (198, 198, 15, 1, '', '', '2026-05-01', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (199, 199, 15, 1, 'HWTC4b8028b6', '', '2026-05-05', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (200, 200, 15, 2, 'HWTC4b88f3b6', '', '2026-05-24', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (201, 201, 15, 1, 'HWTC673794b5', '', '2026-06-02', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (202, 202, 15, 1, 'HWTC673d36b5', '', '2026-06-02', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (203, 203, 15, 1, 'HWTC67516db5', '', '2026-06-03', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (204, 204, 15, 1, 'ZTEG2601498e', '', '2026-06-06', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (205, 205, 15, 2, 'HWTCD232E6A1', '', '2026-06-16', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (206, 206, 15, 2, 'ALCLB46DCC78', '', '2026-06-17', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (207, 207, 15, 2, 'ZTEG242807CD', '', '2026-06-17', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (208, 208, 16, 2, '', '', '2026-06-17', 449, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (209, 209, 15, 2, '', '', '2026-06-17', 349, 'ACTIVO');
INSERT INTO "servicios_fibra" ("id", "cliente_id", "paquete_id", "ciclo_corte_id", "alfanumerico_equipo", "ip_asignada", "fecha_instalacion", "precio_mensual", "estado_servicio") VALUES (210, 210, 15, 1, 'HWTC4b8e6cb6', '', '2026-04-11', 349, 'ACTIVO');

CREATE TABLE "puntos_cobro" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "comunidad_id" INTEGER NOT NULL,
  "nombre" TEXT NOT NULL,
  "direccion" TEXT,
  "telefono" TEXT,
  "token_acceso" TEXT NOT NULL UNIQUE,
  "activo" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "fk_puntos_comunidad" FOREIGN KEY ("comunidad_id") REFERENCES "comunidades" ("id")
);
CREATE INDEX "idx_puntos_comunidad" ON "puntos_cobro" ("comunidad_id");

CREATE TABLE "reportes" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "fecha_reportada" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "comunidad_id" INTEGER NOT NULL,
  "tipo_reporte" TEXT NOT NULL CHECK ("tipo_reporte" IN ('DETALLE','INSTALACION')),
  "cliente_id" INTEGER,
  "prospecto_id" INTEGER,
  "comentario" TEXT NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK ("estado" IN ('PENDIENTE','ASIGNADO','EN_PROCESO','COMPLETADO','CANCELADO')),
  "prioridad" TEXT NOT NULL DEFAULT 'NORMAL' CHECK ("prioridad" IN ('BAJA','NORMAL','ALTA','URGENTE')),
  "creado_por_usuario_id" INTEGER NOT NULL,
  "tecnico_id" INTEGER,
  "asignado_por_usuario_id" INTEGER,
  "fecha_asignacion" TEXT,
  "fecha_programada" TEXT,
  "orden_ruta" INTEGER,
  "fecha_completado" TEXT,
  "comentario_cierre" TEXT,
  CONSTRAINT "fk_reportes_asignador" FOREIGN KEY ("asignado_por_usuario_id") REFERENCES "usuarios" ("id"),
  CONSTRAINT "fk_reportes_cliente" FOREIGN KEY ("cliente_id") REFERENCES "clientes" ("id"),
  CONSTRAINT "fk_reportes_comunidad" FOREIGN KEY ("comunidad_id") REFERENCES "comunidades" ("id"),
  CONSTRAINT "fk_reportes_creador" FOREIGN KEY ("creado_por_usuario_id") REFERENCES "usuarios" ("id"),
  CONSTRAINT "fk_reportes_prospecto" FOREIGN KEY ("prospecto_id") REFERENCES "prospectos" ("id"),
  CONSTRAINT "fk_reportes_tecnico" FOREIGN KEY ("tecnico_id") REFERENCES "usuarios" ("id"),
  CHECK (("tipo_reporte" = 'DETALLE' AND "cliente_id" IS NOT NULL AND "prospecto_id" IS NULL) OR ("tipo_reporte" = 'INSTALACION' AND "prospecto_id" IS NOT NULL AND "cliente_id" IS NULL))
);
CREATE INDEX "idx_reportes_comunidad" ON "reportes" ("comunidad_id");
CREATE INDEX "idx_reportes_cliente" ON "reportes" ("cliente_id");
CREATE INDEX "idx_reportes_prospecto" ON "reportes" ("prospecto_id");
CREATE INDEX "idx_reportes_creador" ON "reportes" ("creado_por_usuario_id");
CREATE INDEX "idx_reportes_tecnico" ON "reportes" ("tecnico_id");
CREATE INDEX "idx_reportes_asignador" ON "reportes" ("asignado_por_usuario_id");

CREATE TABLE "reportes_seguimiento" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "reporte_id" INTEGER NOT NULL,
  "usuario_id" INTEGER NOT NULL,
  "estado" TEXT NOT NULL CHECK ("estado" IN ('ASIGNADO','EN_PROCESO','COMPLETADO','CANCELADO')),
  "comentario" TEXT NOT NULL,
  "fecha_registro" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_seguimiento_reporte" FOREIGN KEY ("reporte_id") REFERENCES "reportes" ("id") ON DELETE CASCADE,
  CONSTRAINT "fk_seguimiento_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id")
);
CREATE INDEX "idx_seguimiento_reporte" ON "reportes_seguimiento" ("reporte_id");
CREATE INDEX "idx_seguimiento_usuario" ON "reportes_seguimiento" ("usuario_id");

CREATE TABLE "pagos" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "cliente_id" INTEGER NOT NULL,
  "servicio_id" INTEGER NOT NULL,
  "punto_cobro_id" INTEGER NOT NULL,
  "monto" REAL NOT NULL,
  "metodo_pago" TEXT NOT NULL DEFAULT 'EFECTIVO' CHECK ("metodo_pago" IN ('EFECTIVO','TRANSFERENCIA','QR','MERCADO_PAGO')),
  "periodo_pagado" TEXT,
  "referencia" TEXT,
  "fecha_pago" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "estado_pago" TEXT NOT NULL DEFAULT 'APROBADO' CHECK ("estado_pago" IN ('APROBADO','PENDIENTE','CANCELADO')),
  "observacion" TEXT,
  CONSTRAINT "fk_pagos_cliente" FOREIGN KEY ("cliente_id") REFERENCES "clientes" ("id"),
  CONSTRAINT "fk_pagos_punto" FOREIGN KEY ("punto_cobro_id") REFERENCES "puntos_cobro" ("id"),
  CONSTRAINT "fk_pagos_servicio" FOREIGN KEY ("servicio_id") REFERENCES "servicios_fibra" ("id")
);
CREATE INDEX "idx_pagos_cliente" ON "pagos" ("cliente_id");
CREATE INDEX "idx_pagos_servicio" ON "pagos" ("servicio_id");
CREATE INDEX "idx_pagos_punto" ON "pagos" ("punto_cobro_id");

CREATE TABLE "usuario_roles" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "usuario_id" INTEGER NOT NULL,
  "rol_id" INTEGER NOT NULL,
  UNIQUE ("usuario_id", "rol_id"),
  CONSTRAINT "fk_usuario_roles_rol" FOREIGN KEY ("rol_id") REFERENCES "roles" ("id") ON DELETE CASCADE,
  CONSTRAINT "fk_usuario_roles_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE
);
CREATE INDEX "idx_usuario_roles_rol" ON "usuario_roles" ("rol_id");

INSERT INTO "usuario_roles" ("id", "usuario_id", "rol_id") VALUES (1, 1, 1);
INSERT INTO "usuario_roles" ("id", "usuario_id", "rol_id") VALUES (3, 3, 2);
INSERT INTO "usuario_roles" ("id", "usuario_id", "rol_id") VALUES (4, 4, 1);
