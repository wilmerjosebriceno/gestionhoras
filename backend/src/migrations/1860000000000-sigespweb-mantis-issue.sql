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
