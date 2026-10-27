-- ============================================================================
-- REVERSION (down) de 1790000000000-sgh-scrin-summary-por-nota.sql
-- ============================================================================
-- Devuelve el resumen del Monitor de Horas al esquema ANTERIOR:
-- una sola fila por (usuario + proyecto + rango), sin separar por nota.
--
-- ⚠️ ADVERTENCIAS IMPORTANTES (leer antes de ejecutar)
--
-- 1) El indice antiguo NO SE PUEDE CREAR si ya existen varios resumenes del
--    mismo usuario + proyecto + rango (que es justo lo que aporta esta mejora).
--    Postgres fallara con:
--      ERROR: no se pudo crear el indice unico «uq_scrin_summary_group»
--      DETALLE: La llave (id_user, scrin_project_id, date_from, date_to)=(...)
--               esta duplicada.
--    Si eso ocurre, usa el MODO 2 (forzado, al final de este archivo).
--
-- 2) El indice y el codigo son una PAREJA. El backend nuevo hace UPSERT con
--    ON CONFLICT (..., md5(btrim(coalesce(note,'')))) y ademas ScrinSchemaService
--    vuelve a crear ese indice AL ARRANCAR. Por lo tanto:
--      - Si revierte el indice pero deja el codigo nuevo, la pantalla fallara
--        ("no hay restriccion unica... ON CONFLICT") y el arranque lo repondra.
--      - Para revertir de verdad hay que revertir TAMBIEN el codigo.
--
-- 3) La tabla de respaldo sgh_scrin_summary_bkp_20260929 solo existe si se
--    ejecuto la migracion hacia adelante y nadie la borro.
-- ============================================================================

BEGIN;

-- 1) Quitar el indice nuevo y el de apoyo.
DROP INDEX IF EXISTS uq_scrin_summary_group;
DROP INDEX IF EXISTS idx_scrin_summary_user_proyecto;

-- 2) Restaurar los resumenes previos, SOLO si existe el respaldo.
DO $$
BEGIN
  IF to_regclass('sgh_scrin_summary_bkp_20260929') IS NOT NULL THEN
    RAISE NOTICE 'Restaurando desde sgh_scrin_summary_bkp_20260929...';
    DELETE FROM sgh_scrin_summary;
    INSERT INTO sgh_scrin_summary
      SELECT * FROM sgh_scrin_summary_bkp_20260929;
  ELSE
    RAISE NOTICE 'No existe sgh_scrin_summary_bkp_20260929: se conservan los resumenes actuales.';
  END IF;
END $$;

-- 3) Volver al indice antiguo (solo proyecto + rango).
CREATE UNIQUE INDEX uq_scrin_summary_group
  ON sgh_scrin_summary (id_user, scrin_project_id, date_from, date_to);

COMMIT;


-- ============================================================================
-- MODO 2 - REVERSION FORZADA (destructiva)
-- ============================================================================
-- Descomentar y ejecutar SOLO si el MODO 1 fallo por llaves duplicadas.
-- PIERDE la separacion por nota: deja un unico resumen por proyecto + rango.
--
-- BEGIN;
-- DROP INDEX IF EXISTS uq_scrin_summary_group;
-- DROP INDEX IF EXISTS idx_scrin_summary_user_proyecto;
--
-- -- Consolidar: conservar 1 fila por (usuario + proyecto + rango).
-- -- Se conserva la procesada / con proyecto asignado / mas reciente.
-- DELETE FROM sgh_scrin_summary s
--   USING sgh_scrin_summary d
--  WHERE s.id_scrin_summary <> d.id_scrin_summary
--    AND s.id_user IS NOT DISTINCT FROM d.id_user
--    AND s.scrin_project_id IS NOT DISTINCT FROM d.scrin_project_id
--    AND s.date_from IS NOT DISTINCT FROM d.date_from
--    AND s.date_to IS NOT DISTINCT FROM d.date_to
--    AND (s.status, (s.id_proyect IS NOT NULL)::int, s.id_scrin_summary)
--      < (d.status, (d.id_proyect IS NOT NULL)::int, d.id_scrin_summary);
--
-- -- Volver al esquema sin notas.
-- UPDATE sgh_scrin_summary SET note = NULL;
--
-- CREATE UNIQUE INDEX uq_scrin_summary_group
--   ON sgh_scrin_summary (id_user, scrin_project_id, date_from, date_to);
-- COMMIT;
-- ============================================================================
