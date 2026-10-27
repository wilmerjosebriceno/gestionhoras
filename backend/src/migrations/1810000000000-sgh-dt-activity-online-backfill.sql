-- ============================================================================
-- Migration: SGH - Backfill de la modalidad ONLINE en el detalle de actividad
-- ============================================================================
-- Migra los datos historicos del campo `sgh_dt_activity.online` (agregado en
-- 1800000000000-sgh-dt-activity-online.sql) a partir de la visita registrada en
-- la cabecera `sgh_activity.visit`:
--
--     visit = 1  (la visita fue PRESENCIAL)  ->  online = 0   (presencial)
--     visit = 0  (no fue visita presencial)  ->  online = 1   (online)
--
-- NOTAS
--  * Es idempotente: siempre deriva de `visit`, se puede correr mas de una vez.
--  * ADVERTENCIA: sobrescribe los ajustes manuales hechos desde la pantalla.
--    Ejecutar UNA sola vez, como parte de la migracion.
--  * Antes de ejecutar en produccion conviene respaldar la base.
-- ============================================================================

BEGIN;

-- 1) Respaldo de la modalidad actual (permite revertir).
CREATE TABLE IF NOT EXISTS sgh_dt_activity_bkp_online AS
SELECT id_detail, online FROM sgh_dt_activity;

-- 2) PRESENCIAL: detalles de actividades que SI fueron visita presencial.
UPDATE sgh_dt_activity dt
   SET online = 0
  FROM sgh_activity a
 WHERE a.id_activity = dt.id_activity
   AND COALESCE(a.visit, 0) = 1;

-- 3) ONLINE: detalles de actividades que NO fueron visita presencial.
UPDATE sgh_dt_activity dt
   SET online = 1
  FROM sgh_activity a
 WHERE a.id_activity = dt.id_activity
   AND COALESCE(a.visit, 0) = 0;

COMMIT;

-- 4) Verificacion sugerida:
--    SELECT online, count(*) FROM sgh_dt_activity GROUP BY online;
--    SELECT a.visit, dt.online, count(*) FROM sgh_dt_activity dt
--      JOIN sgh_activity a ON a.id_activity = dt.id_activity
--     GROUP BY 1,2 ORDER BY 1,2;

-- ---------------------------------------------------------------------------
-- REVERSION
-- ---------------------------------------------------------------------------
-- UPDATE sgh_dt_activity dt
--    SET online = b.online
--   FROM sgh_dt_activity_bkp_online b
--  WHERE b.id_detail = dt.id_detail;
-- ---------------------------------------------------------------------------
