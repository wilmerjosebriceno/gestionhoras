import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Auto-reparacion del esquema del modulo GPI (Gestion de Proyectos Internos).
 *
 * Crea el esquema `gpi`, sus tablas, indices y la vista; y registra el sistema
 * en `public.sec_sistema` (modulo de Seguridad) si falta. Replica
 * 1930000000000-gpi-schema.sql (idempotente). Es un modulo independiente de SGH.
 */
@Injectable()
export class GpiSchemaService implements OnApplicationBootstrap {
  private readonly logger = new Logger(GpiSchemaService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.dataSource.query(DDL);
      await this.dataSource.query(SEED_SISTEMA);
    } catch (e: any) {
      this.logger.error(
        `No se pudo verificar/crear el esquema gpi: ${e?.message ?? e}`,
      );
    }
  }
}

const DDL = `
CREATE SCHEMA IF NOT EXISTS gpi;

DO $$ BEGIN
  CREATE TYPE gpi.estado_proyecto AS ENUM ('planificado','en_ejecucion','en_pausa','cerrado','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE gpi.estado_actividad AS ENUM ('pendiente','en_proceso','bloqueada','completada','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE gpi.tipo_actividad AS ENUM ('tarea','resumen','hito');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE gpi.tipo_dependencia AS ENUM ('FS','SS','FF','SF');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE gpi.tipo_recurso AS ENUM ('consultor','desarrollador','analista','lider','qa','soporte','otro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS gpi.recurso (
  id_recurso        SERIAL PRIMARY KEY,
  id_usuario        INTEGER,
  nombre            VARCHAR(150) NOT NULL,
  email             VARCHAR(150),
  cargo             VARCHAR(100),
  tipo              gpi.tipo_recurso NOT NULL DEFAULT 'consultor',
  area              VARCHAR(100),
  capacidad_semanal NUMERIC(5,2)  NOT NULL DEFAULT 40,
  tarifa_hora       NUMERIC(12,2),
  activo            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gpi.rol (
  id_rol  SERIAL PRIMARY KEY,
  codigo  VARCHAR(20) NOT NULL UNIQUE,
  nombre  VARCHAR(80) NOT NULL,
  activo  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS gpi.proyecto (
  id_proyecto     SERIAL PRIMARY KEY,
  codigo          VARCHAR(20)  NOT NULL UNIQUE,
  nombre          VARCHAR(200) NOT NULL,
  descripcion     TEXT,
  id_area         INTEGER,
  id_gerente      INTEGER REFERENCES gpi.recurso(id_recurso),
  estado          gpi.estado_proyecto NOT NULL DEFAULT 'planificado',
  prioridad       SMALLINT NOT NULL DEFAULT 3,
  fecha_ini_plan  DATE,
  fecha_fin_plan  DATE,
  fecha_ini_real  DATE,
  fecha_fin_real  DATE,
  horas_estimadas NUMERIC(10,2) NOT NULL DEFAULT 0,
  horas_reales    NUMERIC(10,2) NOT NULL DEFAULT 0,
  avance_pct      NUMERIC(5,2)  NOT NULL DEFAULT 0,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fecha_ini_plan IS NULL OR fecha_fin_plan IS NULL OR fecha_ini_plan <= fecha_fin_plan)
);

CREATE TABLE IF NOT EXISTS gpi.proyecto_miembro (
  id_miembro       SERIAL PRIMARY KEY,
  id_proyecto      INTEGER NOT NULL REFERENCES gpi.proyecto(id_proyecto) ON DELETE CASCADE,
  id_recurso       INTEGER NOT NULL REFERENCES gpi.recurso(id_recurso),
  id_rol           INTEGER REFERENCES gpi.rol(id_rol),
  dedicacion_pct   NUMERIC(5,2)  NOT NULL DEFAULT 100,
  horas_asignadas  NUMERIC(10,2) NOT NULL DEFAULT 0,
  fecha_alta       DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_baja       DATE,
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (id_proyecto, id_recurso)
);

CREATE TABLE IF NOT EXISTS gpi.actividad (
  id_actividad    SERIAL PRIMARY KEY,
  id_proyecto     INTEGER NOT NULL REFERENCES gpi.proyecto(id_proyecto) ON DELETE CASCADE,
  id_padre        INTEGER REFERENCES gpi.actividad(id_actividad) ON DELETE CASCADE,
  codigo_wbs      VARCHAR(30),
  nombre          VARCHAR(250) NOT NULL,
  descripcion     TEXT,
  tipo            gpi.tipo_actividad NOT NULL DEFAULT 'tarea',
  id_responsable  INTEGER REFERENCES gpi.recurso(id_recurso),
  estado          gpi.estado_actividad NOT NULL DEFAULT 'pendiente',
  prioridad       SMALLINT NOT NULL DEFAULT 3,
  fecha_ini_plan  DATE,
  fecha_fin_plan  DATE,
  fecha_ini_real  DATE,
  fecha_fin_real  DATE,
  horas_estimadas NUMERIC(10,2) NOT NULL DEFAULT 0,
  horas_reales    NUMERIC(10,2) NOT NULL DEFAULT 0,
  avance_pct      NUMERIC(5,2)  NOT NULL DEFAULT 0,
  orden           INTEGER NOT NULL DEFAULT 0,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fecha_ini_plan IS NULL OR fecha_fin_plan IS NULL OR fecha_ini_plan <= fecha_fin_plan)
);

CREATE TABLE IF NOT EXISTS gpi.actividad_dependencia (
  id_dependencia  SERIAL PRIMARY KEY,
  id_actividad    INTEGER NOT NULL REFERENCES gpi.actividad(id_actividad) ON DELETE CASCADE,
  id_predecesora  INTEGER NOT NULL REFERENCES gpi.actividad(id_actividad) ON DELETE CASCADE,
  tipo            gpi.tipo_dependencia NOT NULL DEFAULT 'FS',
  lag_dias        INTEGER NOT NULL DEFAULT 0,
  CHECK (id_actividad <> id_predecesora),
  UNIQUE (id_actividad, id_predecesora)
);

CREATE TABLE IF NOT EXISTS gpi.asignacion (
  id_asignacion   SERIAL PRIMARY KEY,
  id_actividad    INTEGER NOT NULL REFERENCES gpi.actividad(id_actividad) ON DELETE CASCADE,
  id_miembro      INTEGER NOT NULL REFERENCES gpi.proyecto_miembro(id_miembro) ON DELETE CASCADE,
  horas_estimadas NUMERIC(10,2) NOT NULL DEFAULT 0,
  fecha_ini       DATE,
  fecha_fin       DATE,
  porcentaje      NUMERIC(5,2),
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (id_actividad, id_miembro)
);

CREATE TABLE IF NOT EXISTS gpi.asignacion_horas (
  id              SERIAL PRIMARY KEY,
  id_asignacion   INTEGER NOT NULL REFERENCES gpi.asignacion(id_asignacion) ON DELETE CASCADE,
  fecha           DATE NOT NULL,
  horas_estimadas NUMERIC(6,2) NOT NULL DEFAULT 0,
  UNIQUE (id_asignacion, fecha)
);

CREATE TABLE IF NOT EXISTS gpi.parte_horas (
  id            SERIAL PRIMARY KEY,
  id_asignacion INTEGER NOT NULL REFERENCES gpi.asignacion(id_asignacion) ON DELETE CASCADE,
  fecha         DATE NOT NULL,
  horas         NUMERIC(6,2) NOT NULL DEFAULT 0,
  descripcion   VARCHAR(300),
  estado        VARCHAR(20) NOT NULL DEFAULT 'borrador',
  aprobado_por  INTEGER,
  aprobado_at   TIMESTAMPTZ,
  created_by    INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_asignacion, fecha)
);

CREATE TABLE IF NOT EXISTS gpi.calendario (
  id_calendario SERIAL PRIMARY KEY,
  id_proyecto   INTEGER REFERENCES gpi.proyecto(id_proyecto) ON DELETE CASCADE,
  nombre        VARCHAR(80) NOT NULL,
  lunes         BOOLEAN NOT NULL DEFAULT TRUE,
  martes        BOOLEAN NOT NULL DEFAULT TRUE,
  miercoles     BOOLEAN NOT NULL DEFAULT TRUE,
  jueves        BOOLEAN NOT NULL DEFAULT TRUE,
  viernes       BOOLEAN NOT NULL DEFAULT TRUE,
  sabado        BOOLEAN NOT NULL DEFAULT FALSE,
  domingo       BOOLEAN NOT NULL DEFAULT FALSE,
  horas_por_dia NUMERIC(5,2) NOT NULL DEFAULT 8
);

CREATE TABLE IF NOT EXISTS gpi.calendario_excepcion (
  id            SERIAL PRIMARY KEY,
  id_calendario INTEGER NOT NULL REFERENCES gpi.calendario(id_calendario) ON DELETE CASCADE,
  fecha         DATE NOT NULL,
  laborable     BOOLEAN NOT NULL DEFAULT FALSE,
  horas         NUMERIC(5,2) NOT NULL DEFAULT 0,
  motivo        VARCHAR(150),
  UNIQUE (id_calendario, fecha)
);

CREATE INDEX IF NOT EXISTS idx_proyecto_estado      ON gpi.proyecto(estado);
CREATE INDEX IF NOT EXISTS idx_miembro_proyecto     ON gpi.proyecto_miembro(id_proyecto);
CREATE INDEX IF NOT EXISTS idx_actividad_proyecto   ON gpi.actividad(id_proyecto);
CREATE INDEX IF NOT EXISTS idx_actividad_padre      ON gpi.actividad(id_padre);
CREATE INDEX IF NOT EXISTS idx_actividad_fechas     ON gpi.actividad(id_proyecto, fecha_ini_plan, fecha_fin_plan);
CREATE INDEX IF NOT EXISTS idx_asignacion_actividad ON gpi.asignacion(id_actividad);
CREATE INDEX IF NOT EXISTS idx_asignacion_miembro   ON gpi.asignacion(id_miembro);
CREATE INDEX IF NOT EXISTS idx_ashoras_fecha        ON gpi.asignacion_horas(fecha);
CREATE INDEX IF NOT EXISTS idx_parte_fecha          ON gpi.parte_horas(fecha);

CREATE OR REPLACE VIEW gpi.v_horas_actividad_fecha AS
SELECT act.id_proyecto, ah.fecha, act.id_actividad, act.nombre AS actividad,
       r.id_recurso, r.nombre AS recurso, ah.horas_estimadas
  FROM gpi.asignacion_horas ah
  JOIN gpi.asignacion       a   ON a.id_asignacion = ah.id_asignacion
  JOIN gpi.actividad        act ON act.id_actividad = a.id_actividad
  JOIN gpi.proyecto_miembro m   ON m.id_miembro = a.id_miembro
  JOIN gpi.recurso          r   ON r.id_recurso = m.id_recurso;

-- Linea base (baseline) para comparar plan vs. real
ALTER TABLE gpi.actividad ADD COLUMN IF NOT EXISTS fecha_ini_base DATE;
ALTER TABLE gpi.actividad ADD COLUMN IF NOT EXISTS fecha_fin_base DATE;
ALTER TABLE gpi.actividad ADD COLUMN IF NOT EXISTS horas_base     NUMERIC(10,2);
ALTER TABLE gpi.proyecto  ADD COLUMN IF NOT EXISTS fecha_ini_base DATE;
ALTER TABLE gpi.proyecto  ADD COLUMN IF NOT EXISTS fecha_fin_base DATE;
ALTER TABLE gpi.proyecto  ADD COLUMN IF NOT EXISTS baseline_at    TIMESTAMPTZ;
`;

const SEED_SISTEMA = `
INSERT INTO public.sec_sistema (id_sistema, sistema, denominacion, descripcion, ruta, estatus)
SELECT 'a1b2c3d4-0000-4000-8000-000000000001'::uuid, 'GPI', 'Proyectos Internos',
       'Gestion de proyectos internos: equipo, actividades, fechas y horas', '/gpi', 1
WHERE NOT EXISTS (SELECT 1 FROM public.sec_sistema WHERE sistema = 'GPI');
`;
