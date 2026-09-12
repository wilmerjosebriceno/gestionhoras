-- Migration: Add security columns to existing SIGESP tables
-- Run this against your PostgreSQL database before starting the backend

-- Add new columns to sec_user for enhanced security
ALTER TABLE sec_user 
  ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMP,
  ADD COLUMN IF NOT EXISTS intentos_fallidos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultimo_login TIMESTAMP,
  ADD COLUMN IF NOT EXISTS refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Add user_agent column to sec_log for better auditing
ALTER TABLE sec_log 
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Create index for faster login lookups
CREATE INDEX IF NOT EXISTS idx_sec_user_login ON sec_user(logins);
CREATE INDEX IF NOT EXISTS idx_sec_user_estatus ON sec_user(estact);
CREATE INDEX IF NOT EXISTS idx_sec_log_fecha ON sec_log(fecha);
CREATE INDEX IF NOT EXISTS idx_sec_log_evento ON sec_log(evento);
CREATE INDEX IF NOT EXISTS idx_sec_log_login ON sec_user(logins);

-- Create index for permission lookups
CREATE INDEX IF NOT EXISTS idx_sec_acceso_user_login ON sec_acceso_user(logins);
CREATE INDEX IF NOT EXISTS idx_sec_acceso_user_sistema ON sec_acceso_user(sistema);
CREATE INDEX IF NOT EXISTS idx_sec_acceso_grupo_grupo ON sec_acceso_grupo(grupo);
