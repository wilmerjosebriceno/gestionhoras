-- Migration: SGH - Documentos adjuntos por actividad
-- Crea la tabla `sgh_activity_attachment`, donde se registran los archivos
-- (PDF/JPG/PNG) que el usuario sube desde el formulario de Actividad/Horas.
--
-- Los archivos fisicos se guardan en disco organizados por anio y numdoc:
--   <SGH_ACTIVIDADES_STORAGE_ROOT | backend/storage/actividades>/{yyyy}/{numdoc}/
--
-- Idempotente: puede ejecutarse mas de una vez.
-- (El backend tambien la asegura solo al arrancar: ActividadesSchemaService.)

CREATE TABLE IF NOT EXISTS sgh_activity_attachment (
  id             SERIAL PRIMARY KEY,
  id_activity    INTEGER NOT NULL,
  filename       VARCHAR(255) NOT NULL,
  stored_name    VARCHAR(500) NOT NULL,
  carpeta        VARCHAR(255) NOT NULL,
  mimetype       VARCHAR(150) NOT NULL,
  size_bytes     BIGINT NOT NULL,
  hash_sha256    CHAR(64) NULL,
  uploaded_by    INTEGER NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_sgh_attach_activity
  ON sgh_activity_attachment (id_activity)
  WHERE deleted_at IS NULL;

-- Reversion:
-- DROP TABLE IF EXISTS sgh_activity_attachment;
