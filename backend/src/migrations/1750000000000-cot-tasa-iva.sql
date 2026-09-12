-- Migration: Parametrizar el cálculo de IVA en Cotizaciones
-- Ejecutar contra la base de datos antes de iniciar el backend.

-- 1) Tabla de parámetros de tasas de IVA
CREATE TABLE IF NOT EXISTS cot_tasa_iva (
  id_tasa_iva SERIAL PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL,
  porcentaje INTEGER NOT NULL DEFAULT 0,
  activo SMALLINT NOT NULL DEFAULT 1,
  orden INT NOT NULL DEFAULT 0,
  UNIQUE (porcentaje, nombre)
);

-- 2) Datos por defecto (0% EXENTO, 8% ALÍCUOTA REDUCIDA, 16% ALÍCUOTA GENERAL)
INSERT INTO cot_tasa_iva (nombre, porcentaje, activo, orden) VALUES
  ('EXENTO (0%)', 0, 1, 1),
  ('ALÍCUOTA REDUCIDA (8%)', 8, 1, 2),
  ('ALÍCUOTA GENERAL (16%)', 16, 1, 3)
ON CONFLICT (porcentaje, nombre) DO NOTHING;

-- 3) Vincular cada línea de cotización a su tasa de IVA
ALTER TABLE cot_dt_budget
  ADD COLUMN IF NOT EXISTS id_tasa_iva INT NULL,
  ADD CONSTRAINT fk_cot_dt_budget_tasa_iva FOREIGN KEY (id_tasa_iva)
    REFERENCES cot_tasa_iva (id_tasa_iva) ON DELETE SET NULL;

-- Indice para búsquedas por tasa
CREATE INDEX IF NOT EXISTS idx_cot_dt_budget_tasa_iva ON cot_dt_budget (id_tasa_iva);

-- 4) Backfill: asignar id_tasa_iva a líneas existentes según su % de IVA
UPDATE cot_dt_budget d
SET id_tasa_iva = t.id_tasa_iva
FROM cot_tasa_iva t
WHERE d.id_tasa_iva IS NULL AND ABS(COALESCE(d.tax, 0) - t.porcentaje) < 0.01;
