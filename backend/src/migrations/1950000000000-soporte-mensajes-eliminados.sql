-- Baja logica de comentarios de tickets de Soporte.
-- Permite eliminar un comentario sin borrarlo fisicamente (recuperable) y
-- deja registro de quien lo elimino.
-- (Tambien se aplica automaticamente al arrancar el backend, ver
--  SoporteSchemaService.asegurarBorradoMensajes.)

ALTER TABLE sigespweb.ticket_messages
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE sigespweb.ticket_messages
  ADD COLUMN IF NOT EXISTS deleted_by INTEGER;

CREATE INDEX IF NOT EXISTS idx_ticket_messages_vigentes
  ON sigespweb.ticket_messages (ticket_id) WHERE deleted_at IS NULL;
