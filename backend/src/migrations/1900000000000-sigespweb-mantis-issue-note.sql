-- ============================================================================
-- Migración 190: Espejo de comentarios (notas) de Mantis — Fase 2
--
-- Guarda los comentarios de cada caso para que el reporte PDF no dependa de
-- consultar Mantis en vivo. Se puebla durante la sincronización del espejo
-- (MantisSyncService). Idempotente: puede ejecutarse varias veces.
--
-- El backend también la asegura solo al arrancar (SoporteSchemaService).
--
-- Ejecutar con psql:
--   psql -h localhost -U postgres -d <db> -v ON_ERROR_STOP=1 \
--        -f 1900000000000-sigespweb-mantis-issue-note.sql
-- ============================================================================

-- Marca de "notas ya capturadas" por caso (para no confundir 0 notas reales
-- con "no sincronizado").
ALTER TABLE sigespweb.mantis_issue
  ADD COLUMN IF NOT EXISTS notes_synced BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS sigespweb.mantis_issue_note (
  id          INTEGER PRIMARY KEY,   -- id de la nota en Mantis
  issue_id    INTEGER NOT NULL,      -- id de la incidencia
  autor       VARCHAR(150),
  reporter_id INTEGER,
  created_at  TIMESTAMPTZ,
  texto       TEXT,
  privada     BOOLEAN NOT NULL DEFAULT FALSE,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mantis_note_issue
  ON sigespweb.mantis_issue_note (issue_id);

-- Reversion:
--   DROP TABLE IF EXISTS sigespweb.mantis_issue_note;
--   ALTER TABLE sigespweb.mantis_issue DROP COLUMN IF EXISTS notes_synced;
