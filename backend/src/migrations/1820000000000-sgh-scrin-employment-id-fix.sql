-- ============================================================================
-- Migration: Correccion de IDs de ScreenMonitor (employment) en sgh_users
-- ============================================================================
-- Contexto:
--   El Monitor de Horas envia a Scrin el `scrin_employment_id` guardado aqui,
--   SIN validarlo. Cuando ese ID no existe en ScreenMonitor, Scrin responde
--   HTTP 200 con lista vacia -> la pantalla muestra 0 horas y parece un fallo
--   de la aplicacion.
--
--   Estos usuarios tenian guardado un ID inexistente en su cuenta de Scrin.
--   Los IDs correctos fueron verificados EN VIVO contra Scrin
--   (GetCommonData: catalogo de empleados del token + GetActivities).
--
--   login    | persona           | ID anterior (invalido) | ID correcto
--   ---------|-------------------|------------------------|------------
--   cguedez  | CARLOS GUEDEZ     | 275280                 | 469373
--   ivanv    | IVAN VALECILLOS   | 275278                 | 469370
--   JESUSC   | JESUS CORDERO     | 275279                 | 469375
--   ivanll   | IVAN LLANOS       | 275278 (invalido)      | *no registrado en Scrin*
--
-- Es idempotente: se puede ejecutar mas de una vez sin efectos secundarios.
-- ============================================================================

BEGIN;

-- 1) Respaldo de los valores anteriores (permite revertir).
CREATE TABLE IF NOT EXISTS sgh_users_bkp_scrin_employment_20260930 AS
SELECT id_user, login, name_user, scrin_company_id, scrin_employment_id
  FROM public.sgh_users
 WHERE login IN ('cguedez', 'ivanv', 'JESUSC', 'ivanll');

-- 2) Correccion de los IDs de ScreenMonitor.
UPDATE public.sgh_users SET scrin_employment_id = 469373 WHERE login = 'cguedez'; -- CARLOS GUEDEZ
UPDATE public.sgh_users SET scrin_employment_id = 469370 WHERE login = 'ivanv';   -- IVAN VALECILLOS
UPDATE public.sgh_users SET scrin_employment_id = 469375 WHERE login = 'JESUSC';  -- JESUS CORDERO

-- 3) ivanll (IVAN LLANOS): no existe en el catalogo de ningun token de Scrin.
--    Queda pendiente de crearle/obtenerle un token propio.
--    UPDATE public.sgh_users SET scrin_employment_id = <id> WHERE login = 'ivanll';

COMMIT;

-- ============================================================================
-- VERIFICACION
-- ============================================================================
-- SELECT login, scrin_employment_id FROM public.sgh_users
--  WHERE login IN ('cguedez','ivanv','JESUSC','ivanll') ORDER BY login;
--
-- Y en la aplicacion: Monitor de Horas -> "Probar conexion" (debe dar OK),
-- o POST /api/v1/sgh/scrin/monitor/config/verificar

-- ============================================================================
-- REVERSION
-- ============================================================================
-- UPDATE public.sgh_users u
--    SET scrin_employment_id = b.scrin_employment_id
--   FROM sgh_users_bkp_scrin_employment_20260930 b
--  WHERE b.id_user = u.id_user;
-- ============================================================================
