-- ============================================================================
-- COTIZACIONES - Tarifas por REGION + RANGO DE USUARIOS + MODALIDAD
-- Release: 2026-10-09
--
-- Objetivo:
--   Dejar lista la estructura y los datos que usa el modulo de Cotizaciones:
--     * cot_region.code  (codigo de zona) + precios normativos
--     * cot_rango_usuario (rangos por numero de usuarios)
--     * cot_tarifa        (region + rango + modalidad)
--     * cot_budget.nro_user / id_rango
--     * cot_dt_budget.id_tarifa / tarifa_aplicada
--
-- IMPORTANTE:
--   * HACER RESPALDO antes de ejecutar:  pg_dump -Fc -f respaldo.dump <db>
--   * Idempotente: puede ejecutarse varias veces sin duplicar datos.
--   * Se ejecuta con psql (NO con pgAdmin), apuntando a la BD de Cotizaciones:
--       psql -h <host> -U <user> -d <basedatos> -v ON_ERROR_STOP=1 \
--            -f 2026-10-09_cot_tarifas_regiones_rango.sql
--   * Estrategia de regiones: se CONSERVAN las regiones existentes (se les
--     asigna codigo y precio normativo); solo se insertan las que falten.
--     Si detecta duplicados (region legacy + region con code), los fusiona.
-- ============================================================================

-- ============================================================================
-- 1) ESTRUCTURA
-- ============================================================================

-- 1.1 Codigo de zona en las regiones existentes
ALTER TABLE cot_region ADD COLUMN IF NOT EXISTS code VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cot_region_code ON cot_region (code);

-- 1.2 Maestro de rangos de usuarios
CREATE TABLE IF NOT EXISTS cot_rango_usuario (
  id_rango    SERIAL PRIMARY KEY,
  desde       INT NOT NULL,
  hasta       INT NOT NULL,                 -- 2000000000 = "sin tope"
  descripcion VARCHAR(60),
  activo      SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT chk_rango_orden CHECK (hasta >= desde),
  CONSTRAINT uq_rango UNIQUE (desde, hasta)
);

-- Evita rangos solapados (si el motor no soporta la restriccion, no aborta)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ex_cot_rango_no_overlap') THEN
    BEGIN
      ALTER TABLE cot_rango_usuario
        ADD CONSTRAINT ex_cot_rango_no_overlap
        EXCLUDE USING gist (int4range(desde, hasta, '[]') WITH &&);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'No se pudo crear ex_cot_rango_no_overlap: %', SQLERRM;
    END;
  END IF;
END $$;

-- 1.3 Tarifas por region + rango + modalidad
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

-- 1.4 Cabecera de cotizacion: nro_user + rango asociado
ALTER TABLE cot_budget ADD COLUMN IF NOT EXISTS nro_user INT;
ALTER TABLE cot_budget ADD COLUMN IF NOT EXISTS id_rango INT
  REFERENCES cot_rango_usuario(id_rango) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cot_budget_nro_user ON cot_budget (nro_user);
CREATE INDEX IF NOT EXISTS idx_cot_budget_rango    ON cot_budget (id_rango);

-- 1.5 Detalle de cotizacion: snapshot de la tarifa aplicada
ALTER TABLE cot_dt_budget ADD COLUMN IF NOT EXISTS id_tarifa INT
  REFERENCES cot_tarifa(id_tarifa) ON DELETE SET NULL;
ALTER TABLE cot_dt_budget ADD COLUMN IF NOT EXISTS tarifa_aplicada NUMERIC(18,4);
CREATE INDEX IF NOT EXISTS idx_cot_dt_budget_tarifa ON cot_dt_budget (id_tarifa);

-- ============================================================================
-- 2) REGIONES: conservar las existentes y fusionar duplicados
--    (globales: id_client IS NULL)
-- ============================================================================
DO $$
DECLARE
  z        RECORD;
  canon_id INTEGER;
  n_dup    INTEGER;
BEGIN
  FOR z IN
    SELECT * FROM (VALUES
      ('ORIENTAL',        'ORIENTE%',        115.0000),
      ('CENTRAL',         'CENTRAL',          90.0000),
      ('CENTROCCIDENTAL', 'CENTROCCIDENTE%',  70.0000),
      ('OCCIDENTAL',      'OCCIDENTE%',      105.0000)
    ) AS t(code, legacy_pat, price)
  LOOP
    -- 2.1 Region canonica: la legacy (sin code) que coincide; si no, la que ya tiene el code
    SELECT id_region INTO canon_id
      FROM cot_region
     WHERE code IS NULL AND id_client IS NULL AND name ILIKE z.legacy_pat
     ORDER BY id_region
     LIMIT 1;

    IF canon_id IS NULL THEN
      SELECT id_region INTO canon_id FROM cot_region WHERE code = z.code ORDER BY id_region LIMIT 1;
    END IF;

    -- 2.2 Si no existe, crearla
    IF canon_id IS NULL THEN
      INSERT INTO cot_region (id_client, name, code, price, price_online, active)
      VALUES (NULL, 'ZONA ' || z.code, z.code, z.price, 55, 1)
      RETURNING id_region INTO canon_id;
      RAISE NOTICE 'Region creada: % (%)', z.code, canon_id;
    END IF;

    -- 2.3 Repuntar tarifas y detalles historicos de las duplicadas hacia la canonica
    UPDATE cot_tarifa SET id_region = canon_id
     WHERE id_region IN (
       SELECT id_region FROM cot_region
        WHERE id_region <> canon_id
          AND (code = z.code OR (code IS NULL AND id_client IS NULL AND name ILIKE z.legacy_pat))
     );

    UPDATE cot_dt_budget SET id_region = canon_id
     WHERE id_region IN (
       SELECT id_region FROM cot_region
        WHERE id_region <> canon_id
          AND (code = z.code OR (code IS NULL AND id_client IS NULL AND name ILIKE z.legacy_pat))
     );

    -- 2.4 Eliminar duplicadas
    DELETE FROM cot_region
     WHERE id_region <> canon_id
       AND (code = z.code OR (code IS NULL AND id_client IS NULL AND name ILIKE z.legacy_pat));
    GET DIAGNOSTICS n_dup = ROW_COUNT;
    IF n_dup > 0 THEN
      RAISE NOTICE 'Region %: % duplicada(s) fusionada(s)', z.code, n_dup;
    END IF;

    -- 2.5 Fijar codigo y precios normativos en la canonica
    UPDATE cot_region
       SET code = z.code, price = z.price, price_online = 55, active = 1
     WHERE id_region = canon_id;
  END LOOP;
END $$;

-- ============================================================================
-- 3) RANGOS DE USUARIOS
-- ============================================================================
INSERT INTO cot_rango_usuario (desde, hasta, descripcion, activo) VALUES
  (1,   30,         'Hasta 30 usuarios',           1),
  (31,  50,         '31 a 50 usuarios',            1),
  (51,  100,        '51 a 100 usuarios',           1),
  (101, 150,        '101 a 150 usuarios',          1),
  (151, 2000000000, 'Más de 150 (levantamiento)',  1)
ON CONFLICT (desde, hasta) DO UPDATE
  SET descripcion = EXCLUDED.descripcion,
      activo      = EXCLUDED.activo;

-- ============================================================================
-- 4) TARIFAS (PRESENCIAL por region + ONLINE 55 uniforme)
--    Se excluye el rango de levantamiento (>150)
-- ============================================================================
INSERT INTO cot_tarifa (id_region, id_rango, modalidad, tarifa, activo)
SELECT r.id_region, g.id_rango, 'PRESENCIAL',
       CASE r.code
         WHEN 'ORIENTAL'        THEN 115.0000
         WHEN 'CENTRAL'         THEN  90.0000
         WHEN 'CENTROCCIDENTAL' THEN  70.0000
         WHEN 'OCCIDENTAL'      THEN 105.0000
       END,
       1
FROM cot_region r
CROSS JOIN cot_rango_usuario g
WHERE r.code IN ('ORIENTAL','CENTRAL','CENTROCCIDENTAL','OCCIDENTAL')
  AND g.descripcion <> 'Más de 150 (levantamiento)'
ON CONFLICT (id_region, id_rango, modalidad)
DO UPDATE SET tarifa = EXCLUDED.tarifa, activo = EXCLUDED.activo;

INSERT INTO cot_tarifa (id_region, id_rango, modalidad, tarifa, activo)
SELECT r.id_region, g.id_rango, 'ONLINE', 55.0000, 1
FROM cot_region r
CROSS JOIN cot_rango_usuario g
WHERE r.code IN ('ORIENTAL','CENTRAL','CENTROCCIDENTAL','OCCIDENTAL')
  AND g.descripcion <> 'Más de 150 (levantamiento)'
ON CONFLICT (id_region, id_rango, modalidad)
DO UPDATE SET tarifa = EXCLUDED.tarifa, activo = EXCLUDED.activo;

-- ============================================================================
-- 5) VERIFICACION (debe arrojar 4 regiones, 5 rangos, 32 tarifas)
-- ============================================================================
SELECT 'regiones' AS tabla, COUNT(*)::text AS filas
  FROM cot_region WHERE code IN ('ORIENTAL','CENTRAL','CENTROCCIDENTAL','OCCIDENTAL')
UNION ALL SELECT 'rangos',  COUNT(*)::text FROM cot_rango_usuario
UNION ALL SELECT 'tarifas', COUNT(*)::text FROM cot_tarifa;

SELECT r.code AS region, g.desde, g.hasta, t.modalidad, t.tarifa
  FROM cot_tarifa t
  JOIN cot_region r        ON r.id_region = t.id_region
  JOIN cot_rango_usuario g ON g.id_rango  = t.id_rango
 WHERE t.tarifa > 0
 ORDER BY r.code, g.desde, t.modalidad;
