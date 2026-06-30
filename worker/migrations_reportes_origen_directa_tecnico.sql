PRAGMA foreign_keys = off;

CREATE TABLE "reportes_new" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "fecha_reportada" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "comunidad_id" INTEGER NOT NULL,
  "tipo_reporte" TEXT NOT NULL CHECK ("tipo_reporte" IN ('DETALLE','INSTALACION')),
  "origen" TEXT NOT NULL DEFAULT 'PROSPECTO' CHECK ("origen" IN ('PROSPECTO','DIRECTA_TECNICO')),
  "cliente_id" INTEGER,
  "prospecto_id" INTEGER,
  "comentario" TEXT NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK ("estado" IN ('PENDIENTE','ASIGNADO','EN_PROCESO','PENDIENTE_CONFIRMACION','NO_LOCALIZADO','COMPLETADO','CANCELADO')),
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
  CHECK (
    ("tipo_reporte" = 'DETALLE' AND "cliente_id" IS NOT NULL AND "prospecto_id" IS NULL)
    OR
    ("tipo_reporte" = 'INSTALACION' AND "origen" = 'PROSPECTO' AND "prospecto_id" IS NOT NULL AND "cliente_id" IS NULL)
    OR
    ("tipo_reporte" = 'INSTALACION' AND "origen" = 'DIRECTA_TECNICO' AND "prospecto_id" IS NULL AND "cliente_id" IS NULL)
  )
);

INSERT INTO "reportes_new" (
  id, fecha_reportada, comunidad_id, tipo_reporte, origen, cliente_id, prospecto_id,
  comentario, estado, prioridad, creado_por_usuario_id, tecnico_id,
  asignado_por_usuario_id, fecha_asignacion, fecha_programada, orden_ruta,
  fecha_completado, comentario_cierre
)
SELECT
  id, fecha_reportada, comunidad_id, tipo_reporte, 'PROSPECTO', cliente_id, prospecto_id,
  comentario, estado, prioridad, creado_por_usuario_id, tecnico_id,
  asignado_por_usuario_id, fecha_asignacion, fecha_programada, orden_ruta,
  fecha_completado, comentario_cierre
FROM "reportes";

CREATE TABLE "reportes_seguimiento_new" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "reporte_id" INTEGER NOT NULL,
  "usuario_id" INTEGER NOT NULL,
  "estado" TEXT NOT NULL CHECK ("estado" IN ('PENDIENTE','ASIGNADO','EN_PROCESO','PENDIENTE_CONFIRMACION','NO_LOCALIZADO','COMPLETADO','CANCELADO')),
  "comentario" TEXT NOT NULL,
  "fecha_registro" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_seguimiento_reporte" FOREIGN KEY ("reporte_id") REFERENCES "reportes" ("id") ON DELETE CASCADE,
  CONSTRAINT "fk_seguimiento_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id")
);

INSERT INTO "reportes_seguimiento_new" (
  id, reporte_id, usuario_id, estado, comentario, fecha_registro
)
SELECT id, reporte_id, usuario_id, estado, comentario, fecha_registro
FROM "reportes_seguimiento";

DROP TABLE "reportes_seguimiento";
DROP TABLE "reportes";

ALTER TABLE "reportes_new" RENAME TO "reportes";
ALTER TABLE "reportes_seguimiento_new" RENAME TO "reportes_seguimiento";

CREATE INDEX "idx_reportes_asignador" ON "reportes" ("asignado_por_usuario_id");
CREATE INDEX "idx_reportes_cliente" ON "reportes" ("cliente_id");
CREATE INDEX "idx_reportes_comunidad" ON "reportes" ("comunidad_id");
CREATE INDEX "idx_reportes_creador" ON "reportes" ("creado_por_usuario_id");
CREATE INDEX "idx_reportes_origen" ON "reportes" ("origen");
CREATE INDEX "idx_reportes_prospecto" ON "reportes" ("prospecto_id");
CREATE INDEX "idx_reportes_tecnico" ON "reportes" ("tecnico_id");
CREATE INDEX "idx_seguimiento_reporte" ON "reportes_seguimiento" ("reporte_id");
CREATE INDEX "idx_seguimiento_usuario" ON "reportes_seguimiento" ("usuario_id");

PRAGMA foreign_keys = on;
