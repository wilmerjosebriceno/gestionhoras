-- ============================================================================
-- VERIFICACION (SOLO LECTURA) · Release 2026-10-03 · Soporte + MantisBT
-- ----------------------------------------------------------------------------
-- NO modifica nada. Ejecutelo ANTES del consolidado para saber que falta.
--
--   psql -U <usuario> -h <host> -p 5434 -d db_gestionhoras_sigesp \
--        -f 2026-10-03_verificar_mantis.sql
-- ============================================================================

\echo '=== 1) Columna sigespweb.tickets.mantis_issue_id ==='
SELECT CASE WHEN count(*) = 1
            THEN 'YA EXISTE'
            ELSE 'FALTA -> aplica el bloque 1 del consolidado' END AS estado
  FROM information_schema.columns
 WHERE table_schema = 'sigespweb'
   AND table_name = 'tickets'
   AND column_name = 'mantis_issue_id';

\echo '=== 2) Tablas del espejo local de Mantis ==='
SELECT 'sigespweb.mantis_issue' AS objeto,
       CASE WHEN to_regclass('sigespweb.mantis_issue') IS NULL
            THEN 'FALTA -> aplica el bloque 2' ELSE 'YA EXISTE' END AS estado
UNION ALL
SELECT 'sigespweb.mantis_sync_state',
       CASE WHEN to_regclass('sigespweb.mantis_sync_state') IS NULL
            THEN 'FALTA -> aplica el bloque 2' ELSE 'YA EXISTE' END;

\echo '=== 3) Indices del espejo (esperado 6 + clave primaria) ==='
SELECT indexname
  FROM pg_indexes
 WHERE schemaname = 'sigespweb' AND tablename = 'mantis_issue'
 ORDER BY 1;

\echo '=== 4) Mapeo cliente -> proyecto de Mantis ==='
SELECT count(*) AS clientes_total,
       count(*) FILTER (WHERE COALESCE(id_mantis_proyect, 0) > 0) AS ya_mapeados,
       count(*) FILTER (WHERE COALESCE(id_mantis_proyect, 0) = 0) AS sin_mapear
  FROM public.sgh_client;

\echo '=== 5) Respaldo previo del mapeo ==='
SELECT CASE WHEN to_regclass('public.sgh_client_bkp_mantis_20261002') IS NULL
            THEN 'No existe (el consolidado lo crea)' ELSE 'Ya existe' END AS respaldo;

\echo '=== 6) Casos en el espejo (si ya existe) ==='
SELECT COALESCE((SELECT count(*)::text FROM sigespweb.mantis_issue), 'tabla no existe') AS casos_en_espejo;

-- ============================================================================
-- Si todo dice "YA EXISTE" y el mapeo ya esta cargado, el consolidado no hace
-- cambios (es idempotente). Si algo dice "FALTA", ejecute el consolidado.
-- ============================================================================
