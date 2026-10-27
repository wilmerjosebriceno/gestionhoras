-- ============================================================================
-- PRE-CHECK (SOLO LECTURA) - Cotizaciones: regiones / rangos / tarifas
-- Ejecutar en produccion ANTES de 2026-10-09_cot_tarifas_regiones_rango.sql
-- No modifica nada.
--   psql -h <host> -U <user> -d <basedatos> -f 2026-10-09_cot_tarifas_regiones_rango_precheck.sql
-- ============================================================================

-- a) Columnas que la migracion agregara (si faltan, la migracion es necesaria)
SELECT table_name, column_name
  FROM information_schema.columns
 WHERE (table_name = 'cot_region'    AND column_name = 'code')
    OR (table_name = 'cot_budget'    AND column_name IN ('nro_user','id_rango'))
    OR (table_name = 'cot_dt_budget' AND column_name IN ('id_tarifa','tarifa_aplicada'))
 ORDER BY table_name, column_name;

-- b) Tablas nuevas (si no aparecen, se crearan)
SELECT to_regclass('cot_rango_usuario') AS cot_rango_usuario,
       to_regclass('cot_tarifa')        AS cot_tarifa;

-- c) Regiones actuales (nombre entre corchetes para detectar espacios)
SELECT id_region, id_client, '[' || name || ']' AS nombre, code, price, price_online, active
  FROM cot_region
 ORDER BY name;

-- d) Regiones referenciadas por detalles historicos (para no romper datos)
SELECT DISTINCT d.id_region, r.name
  FROM cot_dt_budget d
  LEFT JOIN cot_region r ON r.id_region = d.id_region
 WHERE d.id_region IS NOT NULL
 ORDER BY d.id_region;
