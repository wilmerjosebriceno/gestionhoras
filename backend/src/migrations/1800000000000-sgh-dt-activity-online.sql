-- Migration: SGH - Modalidad ONLINE por detalle de actividad
-- Agrega el campo `online` a sgh_dt_activity:
--   1 = la actividad se realizo en modalidad ONLINE
--   0 = presencial
--
-- El backend (`buildSummary`/actividades) lo usa para el filtro "Modalidad" del
-- Generador de Reportes. Al agregarlo con DEFAULT 0, los registros existentes
-- quedan como presenciales.
--
-- Ejecutar contra PostgreSQL antes de iniciar el backend con el cambio.
-- Idempotente: puede ejecutarse mas de una vez.
-- (El backend tambien lo asegura solo al arrancar: ActividadesSchemaService.)

ALTER TABLE sgh_dt_activity
  ADD COLUMN IF NOT EXISTS online INT2 NULL DEFAULT 0;

-- Reversion:
-- ALTER TABLE sgh_dt_activity DROP COLUMN IF EXISTS online;
