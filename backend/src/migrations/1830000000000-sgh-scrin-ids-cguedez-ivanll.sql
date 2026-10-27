-- ============================================================================
-- Migration: corrige IDs de ScreenMonitor mal asignados (mismo ID en 3 usuarios)
-- ============================================================================
-- Se detecto que varios usuarios apuntaban al MISMO employmentId (469370, que
-- pertenece a IVAN VALECILLOS): eso carga las horas de una persona en la
-- cuenta de otra.
--
--   login    | persona        | ID anterior (malo)  | ID correcto
--   ---------|----------------|---------------------|--------------------------
--   cguedez  | CARLOS GUEDEZ  | 469370 (de IVAN)    | 469373
--   ivanll   | IVAN LLANOS    | 469370 (de IVAN)    | (sin ID: no existe en Scrin)
--
-- IDs verificados en vivo contra Scrin (GetCommonData + GetActivities), y con
-- el boton "Probar conexion" (Monitor de Horas / Usuarios SGH -> Validar Scrin).
-- Idempotente.
-- ============================================================================

BEGIN;

-- 1) Respaldo de los valores anteriores (permite revertir).
CREATE TABLE IF NOT EXISTS sgh_users_bkp_scrin_20261001 AS
SELECT id_user, login, name_user, scrin_company_id, scrin_employment_id
  FROM public.sgh_users
 WHERE login IN ('cguedez', 'ivanll');

-- 2) Correcciones.
--    Carlos: su ID real en la API v2 (Scrin) es 469373, empresa 275277.
UPDATE public.sgh_users
   SET scrin_employment_id = 469373, scrin_company_id = 275277
 WHERE login = 'cguedez';

--    Ivan Llanos: NO existe en el catalogo de Scrin de ningun token. Se deja sin
--    ID para que la app avise "No tiene ID de Scrin configurado" en lugar de
--    traer silenciosamente las horas de otra persona.
UPDATE public.sgh_users
   SET scrin_employment_id = NULL, scrin_company_id = NULL
 WHERE login = 'ivanll';

COMMIT;

-- ============================================================================
-- 3) LIMPIEZA DE HORAS MAL DESCARGADAS (opcional / revisar antes de ejecutar)
-- ============================================================================
-- Las horas que se bajaron con el ID equivocado quedaron en la bandeja del
-- usuario equivocado. En la base local se ejecuto:
--
--   CREATE TABLE IF NOT EXISTS sgh_scrin_activity_bkp_20261001 AS
--     SELECT * FROM sgh_scrin_activity WHERE id_user IN (7, 16);
--   DELETE FROM sgh_scrin_activity WHERE id_user IN (7, 16);
--
-- (id_user 7 = cguedez, 16 = ivanv). Ajustar los ids segun la base destino.

-- ============================================================================
-- VERIFICACION
-- ============================================================================
--   SELECT login, scrin_employment_id, scrin_company_id
--     FROM public.sgh_users WHERE login IN ('cguedez','ivanll');

-- ============================================================================
-- REVERSION
-- ============================================================================
--   UPDATE public.sgh_users u
--      SET scrin_employment_id = b.scrin_employment_id,
--          scrin_company_id   = b.scrin_company_id
--     FROM sgh_users_bkp_scrin_20261001 b
--    WHERE b.id_user = u.id_user;
--   -- y, si se borraron, restaurar las actividades:
--   INSERT INTO sgh_scrin_activity SELECT * FROM sgh_scrin_activity_bkp_20261001;
-- ============================================================================
