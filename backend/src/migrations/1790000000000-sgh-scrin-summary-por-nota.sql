-- Migration: SGH - Monitor de Horas (Scrin)
-- Cambia la agrupacion del resumen: antes era solo por PROYECTO, ahora es por
-- PROYECTO + NOTA. Cada nota distinta de un mismo proyecto genera su propio
-- registro en sgh_scrin_summary (y su propia actividad al procesar).
--
-- IMPORTANTE: el backend nuevo hace UPSERT con
--   ON CONFLICT (id_user, scrin_project_id, date_from, date_to, md5(btrim(coalesce(note,''))))
-- por lo que ESTE INDICE ES OBLIGATORIO. Si falta, la pantalla falla con
-- "no hay restriccion unica o de exclusion que coincida con la especificacion ON CONFLICT".
--
-- Ejecutar contra PostgreSQL antes de iniciar el backend con el cambio.
-- Idempotente: puede ejecutarse mas de una vez.

-- 1) Respaldo de los resumenes existentes (por si se requiere reversar).
--    Solo se crea la primera vez (si ya existe, conserva el respaldo original).
CREATE TABLE IF NOT EXISTS sgh_scrin_summary_bkp_20260929 AS
SELECT * FROM sgh_scrin_summary;

-- 2) Eliminar SOLO los resumenes PENDIENTES que venian agrupados por proyecto
--    (nota nula): ya no encajan con la nueva agrupacion y se regeneraran desde
--    la pantalla. Se conservan los pendientes que ya tienen nota y los
--    procesados (status = 1) como historial.
DELETE FROM sgh_scrin_summary WHERE status = 0 AND note IS NULL;

-- 3) Limpiar el vinculo de los registros aun no procesados (se regenera).
UPDATE sgh_scrin_activity SET id_scrin_summary = NULL WHERE sync_status = 0;

-- 4) Por seguridad: si existieran duplicados exactos de la nueva clave, se
--    conserva el mas reciente antes de crear el indice unico.
DELETE FROM sgh_scrin_summary s
USING sgh_scrin_summary d
WHERE s.id_scrin_summary > d.id_scrin_summary
  AND s.id_user IS NOT DISTINCT FROM d.id_user
  AND s.scrin_project_id IS NOT DISTINCT FROM d.scrin_project_id
  AND s.date_from IS NOT DISTINCT FROM d.date_from
  AND s.date_to IS NOT DISTINCT FROM d.date_to
  AND md5(btrim(coalesce(s.note, ''))) = md5(btrim(coalesce(d.note, '')));

-- 5) La clave unica del resumen ahora incluye la nota. Se usa el hash porque
--    "note" es TEXT (un indice btree no admite TEXT completo).
DROP INDEX IF EXISTS uq_scrin_summary_group;
CREATE UNIQUE INDEX IF NOT EXISTS uq_scrin_summary_group
  ON sgh_scrin_summary (
    id_user,
    scrin_project_id,
    date_from,
    date_to,
    md5(btrim(coalesce(note, '')))
  );

-- 6) Indice de apoyo para el buscador de grupo (proyecto + nota + rango).
CREATE INDEX IF NOT EXISTS idx_scrin_summary_user_proyecto
  ON sgh_scrin_summary (id_user, scrin_project_id, date_from, date_to);
