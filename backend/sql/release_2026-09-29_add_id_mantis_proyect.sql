-- ============================================================================
-- RELEASE: adición de id_mantis_proyect en sgh_client
-- Fecha: 2026-09-29
-- Propósito: almacenar el ID de proyecto/cliente de Mantis (BT) para poder
--            cruzarlo en el futuro con los registros de Mantis (id_mantis_proyect).
-- Tipo: integer (INT4), default 0, nullable.
-- Idempotente: seguro de ejecutar varias veces (no falla si ya existe).
--
-- Aplicar en:
--   1) Base de datos de PRUEBAS
--   2) Base de datos de PRODUCCIÓN (vía VPN / servidor de producción)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'sgh_client'
      AND column_name  = 'id_mantis_proyect'
  ) THEN
    ALTER TABLE sgh_client
      ADD COLUMN id_mantis_proyect integer NOT NULL DEFAULT 0;

    COMMENT ON COLUMN sgh_client.id_mantis_proyect IS
      'ID de proyecto/cliente en Mantis (BT) para cruce futuro con sus registros.';
  END IF;
END $$;
