-- Migration: Soporte - Alertas de casos sin atender
-- Crea la tabla de control para no repetir el correo de alerta por caso.
--
-- Regla: ticket en estado 'nuevo' sin primera respuesta (first_response_at)
-- que supera N horas laborables (lunes a viernes) desde su registro.
--
-- Idempotente. El backend tambien la asegura al arrancar (SoporteSchemaService).

CREATE TABLE IF NOT EXISTS sigespweb.ticket_alertas (
  id                  SERIAL PRIMARY KEY,
  ticket_id           INTEGER NOT NULL REFERENCES sigespweb.tickets(id) ON DELETE CASCADE,
  tipo                VARCHAR(30) NOT NULL DEFAULT 'sin_atender_24h',
  detectado_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_limite        TIMESTAMPTZ,
  horas_transcurridas NUMERIC(10,2),
  correo_enviado_at   TIMESTAMPTZ,
  destinatarios       TEXT,
  UNIQUE (ticket_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_ticket_alertas_tipo
  ON sigespweb.ticket_alertas (tipo, correo_enviado_at);

-- Reversion:
-- DROP TABLE IF EXISTS sigespweb.ticket_alertas;
