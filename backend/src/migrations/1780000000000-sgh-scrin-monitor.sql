-- Migration: SGH - Monitor de Horas (integracion Scrin.io)
-- Ejecutar contra PostgreSQL antes de iniciar el backend.
-- Vincula al usuario SGH con su identidad Scrin y almacena el staging
-- de actividades importadas, el resumen por proyecto y el mapeo durable.

-- 1) Credenciales Scrin por usuario SGH
ALTER TABLE sgh_users
  ADD COLUMN IF NOT EXISTS scrin_company_id INT,
  ADD COLUMN IF NOT EXISTS scrin_employment_id INT,
  ADD COLUMN IF NOT EXISTS scrin_token TEXT;

-- 2) Staging de actividades importadas de Scrin
CREATE TABLE IF NOT EXISTS sgh_scrin_activity (
  id_scrin_activity   SERIAL PRIMARY KEY,
  id_user             INT REFERENCES sgh_users(id_user),
  activity_id         VARCHAR(64) NOT NULL,
  employee_id         INT,
  employee_name       VARCHAR(250),
  scrin_project_id    VARCHAR(64),
  scrin_project_name  VARCHAR(250),
  from_ts             BIGINT,
  to_ts               BIGINT,
  date_activity       DATE,
  hour_ini            TIME,
  hour_fin            TIME,
  duration_minutes    INT DEFAULT 0,
  offline             SMALLINT DEFAULT 0,
  note                TEXT,
  selected            SMALLINT DEFAULT 0,
  sync_status         SMALLINT DEFAULT 0,
  id_proyect          INT,
  id_client           INT,
  id_type             INT,
  id_process          INT,
  id_item_activity    INT,
  id_scrin_summary    INT,
  id_activity         INT,
  date_sync           TIMESTAMP DEFAULT NOW(),
  processed_at        TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_scrin_activity_dedupe
  ON sgh_scrin_activity (id_user, activity_id);
CREATE INDEX IF NOT EXISTS idx_scrin_activity_user_status
  ON sgh_scrin_activity (id_user, sync_status);
CREATE INDEX IF NOT EXISTS idx_scrin_activity_date
  ON sgh_scrin_activity (date_activity);

-- 3) Resumen por proyecto Scrin (agrupacion de registros marcados)
CREATE TABLE IF NOT EXISTS sgh_scrin_summary (
  id_scrin_summary    SERIAL PRIMARY KEY,
  id_user             INT REFERENCES sgh_users(id_user),
  scrin_project_id    VARCHAR(64),
  scrin_project_name  VARCHAR(250),
  date_from           DATE,
  date_to             DATE,
  activities_count    INT DEFAULT 0,
  total_minutes       INT DEFAULT 0,
  id_proyect          INT,
  id_client           INT,
  id_type             INT,
  id_process          INT,
  id_item_activity    INT,
  note                TEXT,
  status              SMALLINT DEFAULT 0,
  id_activity         INT,
  processed_at        TIMESTAMP,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_scrin_summary_group
  ON sgh_scrin_summary (id_user, scrin_project_id, date_from, date_to);
CREATE INDEX IF NOT EXISTS idx_scrin_summary_user_status
  ON sgh_scrin_summary (id_user, status);

-- 4) Memoria de mapeo proyecto Scrin (GUID) -> proyecto SGH
CREATE TABLE IF NOT EXISTS sgh_scrin_project_map (
  id_scrin_project_map SERIAL PRIMARY KEY,
  id_user              INT REFERENCES sgh_users(id_user),
  scrin_project_id     VARCHAR(64) NOT NULL,
  scrin_project_name   VARCHAR(250),
  id_proyect           INT,
  id_client            INT,
  active               SMALLINT DEFAULT 1,
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_scrin_project_map
  ON sgh_scrin_project_map (id_user, scrin_project_id);
