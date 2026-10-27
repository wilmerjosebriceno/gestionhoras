-- Migration: GPI - Linea base (baseline)
-- Agrega columnas para guardar la linea base y comparar plan vs. real.
-- Idempotente. El backend tambien lo asegura al arrancar (GpiSchemaService).
-- Nota: se evitan caracteres no-LATIN9 en el SQL.

ALTER TABLE gpi.actividad ADD COLUMN IF NOT EXISTS fecha_ini_base DATE;
ALTER TABLE gpi.actividad ADD COLUMN IF NOT EXISTS fecha_fin_base DATE;
ALTER TABLE gpi.actividad ADD COLUMN IF NOT EXISTS horas_base     NUMERIC(10,2);

ALTER TABLE gpi.proyecto  ADD COLUMN IF NOT EXISTS fecha_ini_base DATE;
ALTER TABLE gpi.proyecto  ADD COLUMN IF NOT EXISTS fecha_fin_base DATE;
ALTER TABLE gpi.proyecto  ADD COLUMN IF NOT EXISTS baseline_at    TIMESTAMPTZ;

-- Reversion:
-- ALTER TABLE gpi.actividad DROP COLUMN IF EXISTS fecha_ini_base, DROP COLUMN IF EXISTS fecha_fin_base, DROP COLUMN IF EXISTS horas_base;
-- ALTER TABLE gpi.proyecto  DROP COLUMN IF EXISTS fecha_ini_base, DROP COLUMN IF EXISTS fecha_fin_base, DROP COLUMN IF EXISTS baseline_at;
