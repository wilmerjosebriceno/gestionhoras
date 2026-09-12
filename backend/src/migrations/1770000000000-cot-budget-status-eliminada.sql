-- Migration: Estatus ELIMINADA (borrado lógico) en cotizaciones
-- Ejecutar contra la base de datos antes de iniciar el backend.

-- El constraint original solo permitía los estatus 0 y 1. Se reemplaza para
-- permitir 0=BORRADOR, 1=ENVIADA, 2=ACEPTADA, 3=RECHAZADA y 4=ELIMINADA.
ALTER TABLE cot_budget DROP CONSTRAINT IF EXISTS ckc_status_cot_budg;

ALTER TABLE cot_budget
  ADD CONSTRAINT ckc_status_cot_budg
  CHECK (status IS NULL OR status IN (0, 1, 2, 3, 4));
