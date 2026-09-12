-- Migration: Campo de vencimiento en cotizaciones
-- Ejecutar contra la base de datos antes de iniciar el backend.

-- 1) Columna vencimiento (fecha de vencimiento de la cotización)
ALTER TABLE cot_budget
  ADD COLUMN IF NOT EXISTS vencimiento DATE NULL;

-- 2) Índice para las consultas de vencidas / por vencer
CREATE INDEX IF NOT EXISTS idx_cot_budget_vencimiento ON cot_budget (vencimiento);

-- 3) Backfill: cotizaciones existentes => fecha de emisión + 30 días
UPDATE cot_budget
   SET vencimiento = (date_budget + INTERVAL '30 days')::date
 WHERE vencimiento IS NULL AND date_budget IS NOT NULL;
