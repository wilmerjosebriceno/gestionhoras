-- ============================================================================
-- Script de actualización: agrega el campo "mantenimiento" a la tabla sgh_client
-- Tipo: integer (0/1). Se ejecuta de forma independiente (synchronize=false).
-- Idempotente: no falla si la columna ya existe.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'sgh_client'
      AND column_name  = 'mantenimiento'
  ) THEN
    ALTER TABLE sgh_client
      ADD COLUMN mantenimiento integer NOT NULL DEFAULT 0;

    COMMENT ON COLUMN sgh_client.mantenimiento IS
      'Indica si el cliente está en modo mantenimiento (0=no, 1=sí).';
  END IF;
END $$;
