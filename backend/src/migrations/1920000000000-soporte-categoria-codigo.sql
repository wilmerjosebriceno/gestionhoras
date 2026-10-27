-- Migration: Soporte - codigo de modulo en las categorias de ticket
-- Agrega un codigo corto (SCG, SPG, ...) a las categorias ERP para que el
-- grafico "Incidencias por modulo" muestre el codigo corporativo.
--
-- Idempotente. El backend tambien lo asegura al arrancar (SoporteSchemaService).
-- Nota: se evitan caracteres no-LATIN9 en el SQL.

ALTER TABLE sigespweb.ticket_categories
  ADD COLUMN IF NOT EXISTS codigo VARCHAR(10);

-- Codigos iniciales para los modulos ERP (no pisa valores ya definidos).
UPDATE sigespweb.ticket_categories SET codigo = 'SCG' WHERE codigo IS NULL AND nombre ILIKE 'ERP Contabilidad';
UPDATE sigespweb.ticket_categories SET codigo = 'SPG' WHERE codigo IS NULL AND nombre ILIKE 'ERP Presupuesto';
UPDATE sigespweb.ticket_categories SET codigo = 'SCA' WHERE codigo IS NULL AND nombre ILIKE 'ERP Compras';
UPDATE sigespweb.ticket_categories SET codigo = 'SIN' WHERE codigo IS NULL AND nombre ILIKE 'ERP Inventario';
UPDATE sigespweb.ticket_categories SET codigo = 'SNM' WHERE codigo IS NULL AND nombre LIKE 'ERP N%mina';

-- Reversion:
-- ALTER TABLE sigespweb.ticket_categories DROP COLUMN IF EXISTS codigo;
