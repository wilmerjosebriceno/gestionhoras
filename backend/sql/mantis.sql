-- ============================================================================
-- Seguridad · Carga la opcion "Dashboard Mantis" (SOP/mantis) y da los permisos
-- ============================================================================
-- La OPCION se declara en el arbol de seguridad (asi aparece en la pantalla de
-- Permisos para poder asignarla):
--
--     backend/permisos/xml/sec_arbol_sop.xml
--         <menu nombre="Procesos">
--           <item nombre="Incidencias / Tickets" pagina="tickets"/>
--           <item nombre="Dashboard Mantis"     pagina="mantis"/>   <-- NUEVA
--         </menu>
--
-- Este script otorga el permiso SOP/mantis a TODOS los usuarios y grupos que hoy
-- tienen SOP/tickets, copiando exactamente sus mismos flags. Es IDEMPOTENTE:
-- si ya existe, no duplica.
--
--   psql -U <usuario> -h <host> -p 5434 -d db_gestionhoras_sigesp \
--        -v ON_ERROR_STOP=1 -f 2026-10-03_add_permiso_mantis_sop.sql
-- ============================================================================

BEGIN;

-- 1) Usuarios que ya tienen SOP/tickets  ->  reciben SOP/mantis
INSERT INTO public.sec_acceso_user
  (id_acceso, id_sistema, id_user, sistema_code, pagina, denpagina,
   eaccess, einsert, edelete, eupdate, eselect, erun, eprint, eannul)
SELECT gen_random_uuid(), a.id_sistema, a.id_user, a.sistema_code, 'mantis', 'Dashboard Mantis',
       a.eaccess, a.einsert, a.edelete, a.eupdate, a.eselect, a.erun, a.eprint, a.eannul
  FROM public.sec_acceso_user a
 WHERE a.sistema_code = 'SOP'
   AND a.pagina = 'tickets'
   AND NOT EXISTS (
     SELECT 1 FROM public.sec_acceso_user x
      WHERE x.id_user = a.id_user
        AND x.sistema_code = 'SOP'
        AND x.pagina = 'mantis'
   );

-- 2) Grupos que ya tienen SOP/tickets  ->  reciben SOP/mantis
INSERT INTO public.sec_acceso_grupo
  (id_acceso_grupo, id_grupo, id_sistema, id_user, sistema_code, pagina, denpagina,
   eaccess, einsert, edelete, eupdate, eselect, erun, eprint, eannul)
SELECT gen_random_uuid(), a.id_grupo, a.id_sistema, a.id_user, a.sistema_code, 'mantis', 'Dashboard Mantis',
       a.eaccess, a.einsert, a.edelete, a.eupdate, a.eselect, a.erun, a.eprint, a.eannul
  FROM public.sec_acceso_grupo a
 WHERE a.sistema_code = 'SOP'
   AND a.pagina = 'tickets'
   AND NOT EXISTS (
     SELECT 1 FROM public.sec_acceso_grupo x
      WHERE x.id_grupo = a.id_grupo
        AND x.sistema_code = 'SOP'
        AND x.pagina = 'mantis'
   );

COMMIT;

-- ============================================================================
-- VERIFICACION
-- ============================================================================
SELECT u.logins, a.pagina, a.eaccess AS acceso, a.eselect AS seleccionar,
       a.einsert AS insertar, a.eupdate AS actualizar
  FROM public.sec_acceso_user a
  LEFT JOIN public.sec_user u ON u.id_user = a.id_user
 WHERE a.sistema_code = 'SOP'
 ORDER BY u.logins, a.pagina;

-- ============================================================================
-- REVERSION
-- ============================================================================
--   DELETE FROM public.sec_acceso_user  WHERE sistema_code = 'SOP' AND pagina = 'mantis';
--   DELETE FROM public.sec_acceso_grupo WHERE sistema_code = 'SOP' AND pagina = 'mantis';
-- ============================================================================
