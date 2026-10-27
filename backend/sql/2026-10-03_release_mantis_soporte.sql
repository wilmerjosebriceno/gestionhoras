-- ============================================================================
-- RELEASE 2026-10-03 · Soporte + integracion con MantisBT
-- ============================================================================
-- Consolida TODOS los cambios de estructura y de datos de la integracion:
--
--   1) sigespweb.tickets.mantis_issue_id     -> vinculo ticket <-> caso de Mantis
--   2) sigespweb.mantis_issue + _sync_state  -> espejo local (dashboard de KPIs)
--   3) public.sgh_client.id_mantis_proyect   -> 59 clientes mapeados
--
-- ORDEN: (1) estructura del ticket -> (2) espejo -> (3) datos de clientes
--
-- SEGURIDAD
--   - Es IDEMPOTENTE: puede ejecutarse varias veces sin error ni duplicados.
--   - NO borra ni trunca nada.
--   - El bloque de datos deja respaldo en public.sgh_client_bkp_mantis_20261002.
--
-- EJECUCION (VPS)
--   psql -U <usuario> -h <host> -p 5434 -d db_gestionhoras_sigesp -v ON_ERROR_STOP=1 -f 2026-10-03_release_mantis_soporte.sql
--
-- NOTA IMPORTANTE (bloque 3)
--   Los clientes se mapean por id_client (misma base del ERP). Si en el servidor
--   los id_client no coinciden, revise/ajuste desde:
--     SGH -> Catalogos -> Clientes -> "ID Mantis Proyecto"
-- ============================================================================


-- ############################################################################
-- 1) VINCULO TICKET <-> MANTIS   (migracion 184)
-- ############################################################################
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


-- ############################################################################
-- 2) ESPEJO LOCAL DE MANTIS      (migracion 186)
-- ############################################################################
-- ============================================================================
-- Migration: espejo local de los casos de MantisBT (para el dashboard)
-- ============================================================================
-- MantisBT no ofrece agregaciones y consultar 10.000 casos en vivo tarda ~4,5
-- minutos. Por eso se mantiene una copia local que un sincronizador refresca;
-- el dashboard consulta SQL local (respuesta en menos de 1 segundo).
--
-- Fuente: GET /api/rest/issues (page_size=1000). El listado YA trae el
-- historial de cada caso, del que se extraen las fechas de cada estado:
--   acknowledged_at · assigned_at · resolved_at · closed_at
--
-- Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS sigespweb.mantis_issue (
  id              INTEGER PRIMARY KEY,
  summary         VARCHAR(300),
  project_id      INTEGER,
  project_name    VARCHAR(250),
  category_id     INTEGER,
  category_name   VARCHAR(150),
  status_id       INTEGER,
  status_name     VARCHAR(50),
  resolution_id   INTEGER,
  resolution_name VARCHAR(60),
  priority_id     INTEGER,
  priority_name   VARCHAR(40),
  severity_id     INTEGER,
  severity_name   VARCHAR(40),
  handler_id      INTEGER,
  handler_name    VARCHAR(150),
  reporter_id     INTEGER,
  reporter_name   VARCHAR(150),
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  assigned_at     TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  reopened_count  INTEGER NOT NULL DEFAULT 0,
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mantis_issue_proyecto ON sigespweb.mantis_issue (project_id);
CREATE INDEX IF NOT EXISTS idx_mantis_issue_estado   ON sigespweb.mantis_issue (status_id);
CREATE INDEX IF NOT EXISTS idx_mantis_issue_handler  ON sigespweb.mantis_issue (handler_id);
CREATE INDEX IF NOT EXISTS idx_mantis_issue_creado   ON sigespweb.mantis_issue (created_at);
CREATE INDEX IF NOT EXISTS idx_mantis_issue_resuelto ON sigespweb.mantis_issue (resolved_at);
CREATE INDEX IF NOT EXISTS idx_mantis_issue_cerrado  ON sigespweb.mantis_issue (closed_at);

-- Estado del sincronizador (una sola fila)
CREATE TABLE IF NOT EXISTS sigespweb.mantis_sync_state (
  id          SMALLINT PRIMARY KEY DEFAULT 1,
  ultima_sync TIMESTAMPTZ,
  en_proceso  BOOLEAN NOT NULL DEFAULT FALSE,
  total       INTEGER NOT NULL DEFAULT 0,
  detalle     TEXT
);

INSERT INTO sigespweb.mantis_sync_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- VERIFICACION
-- ============================================================================
--   SELECT count(*) FROM sigespweb.mantis_issue;
--   SELECT * FROM sigespweb.mantis_sync_state;

-- ============================================================================
-- REVERSION
-- ============================================================================
--   DROP TABLE IF EXISTS sigespweb.mantis_issue;
--   DROP TABLE IF EXISTS sigespweb.mantis_sync_state;
-- ============================================================================


-- ############################################################################
-- 3) PROYECTO DE MANTIS POR CLIENTE   (datos; 59 registros)
-- ############################################################################

-- Respaldo de los valores actuales (permite revertir).
CREATE TABLE IF NOT EXISTS public.sgh_client_bkp_mantis_20261002 AS
SELECT id_client, id_mantis_proyect, now() AS respaldo_en FROM public.sgh_client;

BEGIN;

UPDATE public.sgh_client SET id_mantis_proyect = 331 WHERE id_client = 3 AND COALESCE(id_mantis_proyect,0) <> 331;
UPDATE public.sgh_client SET id_mantis_proyect = 316 WHERE id_client = 4 AND COALESCE(id_mantis_proyect,0) <> 316;
UPDATE public.sgh_client SET id_mantis_proyect = 335 WHERE id_client = 6 AND COALESCE(id_mantis_proyect,0) <> 335;
UPDATE public.sgh_client SET id_mantis_proyect = 343 WHERE id_client = 7 AND COALESCE(id_mantis_proyect,0) <> 343;
UPDATE public.sgh_client SET id_mantis_proyect = 241 WHERE id_client = 14 AND COALESCE(id_mantis_proyect,0) <> 241;
UPDATE public.sgh_client SET id_mantis_proyect = 213 WHERE id_client = 24 AND COALESCE(id_mantis_proyect,0) <> 213;
UPDATE public.sgh_client SET id_mantis_proyect = 329 WHERE id_client = 29 AND COALESCE(id_mantis_proyect,0) <> 329;
UPDATE public.sgh_client SET id_mantis_proyect = 345 WHERE id_client = 32 AND COALESCE(id_mantis_proyect,0) <> 345;
UPDATE public.sgh_client SET id_mantis_proyect = 336 WHERE id_client = 33 AND COALESCE(id_mantis_proyect,0) <> 336;
UPDATE public.sgh_client SET id_mantis_proyect = 355 WHERE id_client = 41 AND COALESCE(id_mantis_proyect,0) <> 355;
UPDATE public.sgh_client SET id_mantis_proyect = 354 WHERE id_client = 47 AND COALESCE(id_mantis_proyect,0) <> 354;
UPDATE public.sgh_client SET id_mantis_proyect = 294 WHERE id_client = 48 AND COALESCE(id_mantis_proyect,0) <> 294;
UPDATE public.sgh_client SET id_mantis_proyect = 48 WHERE id_client = 51 AND COALESCE(id_mantis_proyect,0) <> 48;
UPDATE public.sgh_client SET id_mantis_proyect = 271 WHERE id_client = 53 AND COALESCE(id_mantis_proyect,0) <> 271;
UPDATE public.sgh_client SET id_mantis_proyect = 27 WHERE id_client = 55 AND COALESCE(id_mantis_proyect,0) <> 27;
UPDATE public.sgh_client SET id_mantis_proyect = 296 WHERE id_client = 58 AND COALESCE(id_mantis_proyect,0) <> 296;
UPDATE public.sgh_client SET id_mantis_proyect = 349 WHERE id_client = 62 AND COALESCE(id_mantis_proyect,0) <> 349;
UPDATE public.sgh_client SET id_mantis_proyect = 287 WHERE id_client = 64 AND COALESCE(id_mantis_proyect,0) <> 287;
UPDATE public.sgh_client SET id_mantis_proyect = 347 WHERE id_client = 66 AND COALESCE(id_mantis_proyect,0) <> 347;
UPDATE public.sgh_client SET id_mantis_proyect = 350 WHERE id_client = 72 AND COALESCE(id_mantis_proyect,0) <> 350;
UPDATE public.sgh_client SET id_mantis_proyect = 364 WHERE id_client = 93 AND COALESCE(id_mantis_proyect,0) <> 364;
UPDATE public.sgh_client SET id_mantis_proyect = 276 WHERE id_client = 105 AND COALESCE(id_mantis_proyect,0) <> 276;
UPDATE public.sgh_client SET id_mantis_proyect = 341 WHERE id_client = 109 AND COALESCE(id_mantis_proyect,0) <> 341;
UPDATE public.sgh_client SET id_mantis_proyect = 121 WHERE id_client = 112 AND COALESCE(id_mantis_proyect,0) <> 121;
UPDATE public.sgh_client SET id_mantis_proyect = 199 WHERE id_client = 114 AND COALESCE(id_mantis_proyect,0) <> 199;
UPDATE public.sgh_client SET id_mantis_proyect = 315 WHERE id_client = 118 AND COALESCE(id_mantis_proyect,0) <> 315;
UPDATE public.sgh_client SET id_mantis_proyect = 110 WHERE id_client = 120 AND COALESCE(id_mantis_proyect,0) <> 110;
UPDATE public.sgh_client SET id_mantis_proyect = 324 WHERE id_client = 122 AND COALESCE(id_mantis_proyect,0) <> 324;
UPDATE public.sgh_client SET id_mantis_proyect = 327 WHERE id_client = 125 AND COALESCE(id_mantis_proyect,0) <> 327;
UPDATE public.sgh_client SET id_mantis_proyect = 353 WHERE id_client = 129 AND COALESCE(id_mantis_proyect,0) <> 353;
UPDATE public.sgh_client SET id_mantis_proyect = 338 WHERE id_client = 130 AND COALESCE(id_mantis_proyect,0) <> 338;
UPDATE public.sgh_client SET id_mantis_proyect = 183 WHERE id_client = 133 AND COALESCE(id_mantis_proyect,0) <> 183;
UPDATE public.sgh_client SET id_mantis_proyect = 342 WHERE id_client = 136 AND COALESCE(id_mantis_proyect,0) <> 342;
UPDATE public.sgh_client SET id_mantis_proyect = 146 WHERE id_client = 140 AND COALESCE(id_mantis_proyect,0) <> 146;
UPDATE public.sgh_client SET id_mantis_proyect = 337 WHERE id_client = 156 AND COALESCE(id_mantis_proyect,0) <> 337;
UPDATE public.sgh_client SET id_mantis_proyect = 236 WHERE id_client = 163 AND COALESCE(id_mantis_proyect,0) <> 236;
UPDATE public.sgh_client SET id_mantis_proyect = 304 WHERE id_client = 171 AND COALESCE(id_mantis_proyect,0) <> 304;
UPDATE public.sgh_client SET id_mantis_proyect = 346 WHERE id_client = 172 AND COALESCE(id_mantis_proyect,0) <> 346;
UPDATE public.sgh_client SET id_mantis_proyect = 339 WHERE id_client = 173 AND COALESCE(id_mantis_proyect,0) <> 339;
UPDATE public.sgh_client SET id_mantis_proyect = 321 WHERE id_client = 174 AND COALESCE(id_mantis_proyect,0) <> 321;
UPDATE public.sgh_client SET id_mantis_proyect = 357 WHERE id_client = 175 AND COALESCE(id_mantis_proyect,0) <> 357;
UPDATE public.sgh_client SET id_mantis_proyect = 358 WHERE id_client = 176 AND COALESCE(id_mantis_proyect,0) <> 358;
UPDATE public.sgh_client SET id_mantis_proyect = 351 WHERE id_client = 178 AND COALESCE(id_mantis_proyect,0) <> 351;
UPDATE public.sgh_client SET id_mantis_proyect = 332 WHERE id_client = 179 AND COALESCE(id_mantis_proyect,0) <> 332;
UPDATE public.sgh_client SET id_mantis_proyect = 89 WHERE id_client = 180 AND COALESCE(id_mantis_proyect,0) <> 89;
UPDATE public.sgh_client SET id_mantis_proyect = 191 WHERE id_client = 181 AND COALESCE(id_mantis_proyect,0) <> 191;
UPDATE public.sgh_client SET id_mantis_proyect = 348 WHERE id_client = 182 AND COALESCE(id_mantis_proyect,0) <> 348;
UPDATE public.sgh_client SET id_mantis_proyect = 319 WHERE id_client = 185 AND COALESCE(id_mantis_proyect,0) <> 319;
UPDATE public.sgh_client SET id_mantis_proyect = 313 WHERE id_client = 187 AND COALESCE(id_mantis_proyect,0) <> 313;
UPDATE public.sgh_client SET id_mantis_proyect = 340 WHERE id_client = 189 AND COALESCE(id_mantis_proyect,0) <> 340;
UPDATE public.sgh_client SET id_mantis_proyect = 314 WHERE id_client = 191 AND COALESCE(id_mantis_proyect,0) <> 314;
UPDATE public.sgh_client SET id_mantis_proyect = 359 WHERE id_client = 192 AND COALESCE(id_mantis_proyect,0) <> 359;
UPDATE public.sgh_client SET id_mantis_proyect = 360 WHERE id_client = 193 AND COALESCE(id_mantis_proyect,0) <> 360;
UPDATE public.sgh_client SET id_mantis_proyect = 148 WHERE id_client = 195 AND COALESCE(id_mantis_proyect,0) <> 148;
UPDATE public.sgh_client SET id_mantis_proyect = 362 WHERE id_client = 197 AND COALESCE(id_mantis_proyect,0) <> 362;
UPDATE public.sgh_client SET id_mantis_proyect = 361 WHERE id_client = 198 AND COALESCE(id_mantis_proyect,0) <> 361;
UPDATE public.sgh_client SET id_mantis_proyect = 174 WHERE id_client = 199 AND COALESCE(id_mantis_proyect,0) <> 174;
UPDATE public.sgh_client SET id_mantis_proyect = 365 WHERE id_client = 200 AND COALESCE(id_mantis_proyect,0) <> 365;
UPDATE public.sgh_client SET id_mantis_proyect = 363 WHERE id_client = 201 AND COALESCE(id_mantis_proyect,0) <> 363;

COMMIT;


-- ############################################################################
-- VERIFICACION (ejecute estas consultas al terminar)
-- ############################################################################
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_schema='sigespweb' AND table_name='tickets' AND column_name='mantis_issue_id';
--
--   SELECT to_regclass('sigespweb.mantis_issue') AS espejo,
--          to_regclass('sigespweb.mantis_sync_state') AS estado_sync;
--
--   SELECT count(*) AS clientes_con_proyecto
--     FROM public.sgh_client WHERE COALESCE(id_mantis_proyect,0) > 0;   -- esperado: 59


-- ############################################################################
-- REVERSION
-- ############################################################################
--   -- Bloque 3 (datos de clientes)
--   UPDATE public.sgh_client c SET id_mantis_proyect = b.id_mantis_proyect
--     FROM public.sgh_client_bkp_mantis_20261002 b WHERE b.id_client = c.id_client;
--
--   -- Bloque 2 (espejo)
--   DROP TABLE IF EXISTS sigespweb.mantis_issue;
--   DROP TABLE IF EXISTS sigespweb.mantis_sync_state;
--
--   -- Bloque 1 (columna del ticket)
--   DROP INDEX IF EXISTS sigespweb.idx_tickets_mantis_issue;
--   ALTER TABLE sigespweb.tickets DROP COLUMN IF EXISTS mantis_issue_id;
-- ============================================================================
