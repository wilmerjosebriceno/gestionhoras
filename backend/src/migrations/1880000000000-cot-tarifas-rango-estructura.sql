-- ============================================================================
-- Migración 188: TARIFAS POR REGIÓN + RANGO DE USUARIOS + MODALIDAD
--                (módulo de Cotizaciones)
--
-- Cambios ADITIVOS e IDEMPOTENTES. No altera cotizaciones existentes.
-- Reemplaza el diseño anterior basado en cot_tramo/cot_normativa.
--
-- Ejecutar con psql (no pgAdmin):
--   psql -h localhost -U postgres -d <db> -v ON_ERROR_STOP=1 \
--        -f 1880000000000-cot-tarifas-rango-estructura.sql
-- ============================================================================

-- 1) Código de zona en las regiones existentes
ALTER TABLE cot_region ADD COLUMN IF NOT EXISTS code VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cot_region_code ON cot_region (code);

-- 2) Maestro de rangos de usuarios (desde / hasta)
CREATE TABLE IF NOT EXISTS cot_rango_usuario (
  id_rango    SERIAL PRIMARY KEY,
  desde       INT NOT NULL,
  hasta       INT NOT NULL,                 -- usar 2000000000 para "sin tope"
  descripcion VARCHAR(60),
  activo      SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT chk_rango_orden CHECK (hasta >= desde),
  CONSTRAINT uq_rango UNIQUE (desde, hasta)
);

-- Evita rangos solapados (p.ej. 1-30 y 25-50)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ex_cot_rango_no_overlap') THEN
    ALTER TABLE cot_rango_usuario
      ADD CONSTRAINT ex_cot_rango_no_overlap
      EXCLUDE USING gist (int4range(desde, hasta, '[]') WITH &&);
  END IF;
END $$;

-- 3) Tarifas por región + rango + modalidad
CREATE TABLE IF NOT EXISTS cot_tarifa (
  id_tarifa SERIAL PRIMARY KEY,
  id_region INT NOT NULL REFERENCES cot_region(id_region)       ON DELETE CASCADE,
  id_rango  INT NOT NULL REFERENCES cot_rango_usuario(id_rango) ON DELETE CASCADE,
  modalidad VARCHAR(10) NOT NULL CHECK (modalidad IN ('PRESENCIAL','ONLINE')),
  tarifa    NUMERIC(18,4) NOT NULL DEFAULT 0,
  activo    SMALLINT NOT NULL DEFAULT 1,
  UNIQUE (id_region, id_rango, modalidad)
);
CREATE INDEX IF NOT EXISTS idx_cot_tarifa_lookup
  ON cot_tarifa (id_region, modalidad, id_rango);

-- 4) Cabecera de cotización: nro_user + rango asociado
ALTER TABLE cot_budget ADD COLUMN IF NOT EXISTS nro_user INT;
ALTER TABLE cot_budget ADD COLUMN IF NOT EXISTS id_rango INT
  REFERENCES cot_rango_usuario(id_rango) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cot_budget_nro_user ON cot_budget (nro_user);
CREATE INDEX IF NOT EXISTS idx_cot_budget_rango    ON cot_budget (id_rango);

-- 5) Detalle de cotización: snapshot de la tarifa aplicada
ALTER TABLE cot_dt_budget ADD COLUMN IF NOT EXISTS id_tarifa INT
  REFERENCES cot_tarifa(id_tarifa) ON DELETE SET NULL;
ALTER TABLE cot_dt_budget ADD COLUMN IF NOT EXISTS tarifa_aplicada NUMERIC(18,4);
CREATE INDEX IF NOT EXISTS idx_cot_dt_budget_tarifa ON cot_dt_budget (id_tarifa);

-- ============================================================================
-- Seed de datos: 1890000000000-cot-tarifas-rango-seed.sql
-- ============================================================================
