-- ============================================================================
-- Migración 189: SEED - Tarifas por región + rango de usuarios + modalidad
--                Normativa SIGESP ERP - Octubre 2026
--
-- Idempotente: puede ejecutarse varias veces.
-- Requiere la migración 188 (estructura).
--
-- Ejecutar con psql:
--   psql -h localhost -U postgres -d <db> -v ON_ERROR_STOP=1 \
--        -f 1890000000000-cot-tarifas-rango-seed.sql
-- ============================================================================

-- 1) Zonas globales en cot_region (id_client = NULL) -------------------------
--    Estrategia NO duplicadora:
--      a) Se asigna `code` y los precios de la normativa a las regiones que ya
--         existan identificadas por su nombre legacy (CENTRAL, ORIENTE,
--         CENTROCCIDENTE, OCCIDENTE). Se conserva su nombre original.
--      b) Solo se insertan las zonas que no existan por `code` (instalaciones
--         nuevas). En conflicto se actualizan precios/estado, sin renombrar.
UPDATE cot_region SET code = 'ORIENTAL',        price = 115, price_online = 55, active = 1
  WHERE (code IS NULL OR code = '') AND name ILIKE 'ORIENTE%';
UPDATE cot_region SET code = 'CENTRAL',         price =  90, price_online = 55, active = 1
  WHERE (code IS NULL OR code = '') AND name ILIKE 'CENTRAL';
UPDATE cot_region SET code = 'CENTROCCIDENTAL', price =  70, price_online = 55, active = 1
  WHERE (code IS NULL OR code = '') AND name ILIKE 'CENTROCCIDENTE%';
UPDATE cot_region SET code = 'OCCIDENTAL',      price = 105, price_online = 55, active = 1
  WHERE (code IS NULL OR code = '') AND name ILIKE 'OCCIDENTE%';

INSERT INTO cot_region (id_client, name, code, price, price_online, active) VALUES
  (NULL, 'ZONA ORIENTAL',        'ORIENTAL',        115, 55, 1),
  (NULL, 'ZONA CENTRAL',         'CENTRAL',          90, 55, 1),
  (NULL, 'ZONA CENTROCCIDENTAL', 'CENTROCCIDENTAL',  70, 55, 1),
  (NULL, 'ZONA OCCIDENTAL',      'OCCIDENTAL',      105, 55, 1)
ON CONFLICT (code) DO UPDATE
  SET price        = EXCLUDED.price,
      price_online = EXCLUDED.price_online,
      active       = 1;

-- 2) Rangos de usuarios ------------------------------------------------------
INSERT INTO cot_rango_usuario (desde, hasta, descripcion, activo) VALUES
  (1,   30,         'Hasta 30 usuarios',        1),
  (31,  50,         '31 a 50 usuarios',         1),
  (51,  100,        '51 a 100 usuarios',        1),
  (101, 150,        '101 a 150 usuarios',       1),
  (151, 2000000000, 'Más de 150 (levantamiento)', 1)
ON CONFLICT (desde, hasta) DO UPDATE
  SET descripcion = EXCLUDED.descripcion,
      activo      = EXCLUDED.activo;

-- 3) Tarifas PRESENCIALES por región (mismo valor en todos los rangos) -------
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

-- 4) Tarifas ONLINE (55 $/h uniforme; se excluye el rango >150) --------------
INSERT INTO cot_tarifa (id_region, id_rango, modalidad, tarifa, activo)
SELECT r.id_region, g.id_rango, 'ONLINE', 55.0000, 1
FROM cot_region r
CROSS JOIN cot_rango_usuario g
WHERE r.code IN ('ORIENTAL','CENTRAL','CENTROCCIDENTAL','OCCIDENTAL')
  AND g.descripcion <> 'Más de 150 (levantamiento)'
ON CONFLICT (id_region, id_rango, modalidad)
DO UPDATE SET tarifa = EXCLUDED.tarifa, activo = EXCLUDED.activo;

-- 5) Verificación rápida -----------------------------------------------------
SELECT 'rangos'  AS tabla, COUNT(*) AS filas FROM cot_rango_usuario
UNION ALL SELECT 'tarifas', COUNT(*) FROM cot_tarifa
ORDER BY tabla;
