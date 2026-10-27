-- ============================================================================
-- Migration: vinculo entre los tickets y MantisBT
-- ============================================================================
-- Los tickets viven en el esquema `sigespweb` (compartido con el portal web).
-- Para enviar un ticket a Mantis de forma manual (boton "Enviar a Mantis") y
-- luego poder abrirlo, se guarda el id de la incidencia creada.
--
--   - El proyecto destino sale del cliente:  public.sgh_client.id_mantis_proyect
--   - `mantis_issue_id` NULL = todavia no se ha enviado a Mantis.
--
-- Idempotente: se puede aplicar varias veces sin error.
-- ============================================================================

ALTER TABLE sigespweb.tickets
  ADD COLUMN IF NOT EXISTS mantis_issue_id INTEGER NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_mantis_issue
  ON sigespweb.tickets (mantis_issue_id);

-- ============================================================================
-- VERIFICACION
-- ============================================================================
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema = 'sigespweb'
--      AND table_name = 'tickets'
--      AND column_name = 'mantis_issue_id';
--
--   -- Tickets ya enviados a Mantis:
--   SELECT id, number, mantis_issue_id FROM sigespweb.tickets
--    WHERE mantis_issue_id IS NOT NULL;

-- ============================================================================
-- REVERSION
-- ============================================================================
--   DROP INDEX IF EXISTS sigespweb.idx_tickets_mantis_issue;
--   ALTER TABLE sigespweb.tickets DROP COLUMN IF EXISTS mantis_issue_id;
-- ============================================================================
