import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Grupo } from '../grupos/entities/grupo.entity';
import { AccesoUsuario } from '../permisos/entities/acceso-usuario.entity';
import { AccesoGrupo } from '../permisos/entities/acceso-grupo.entity';
import { Sistema } from '../permisos/entities/sistema.entity';
import { Log } from '../auditoria/entities/log.entity';
import { Evento } from '../auditoria/entities/evento.entity';
import { SessionLog } from '../auditoria/entities/session-log.entity';
import { Proceso } from '../sgh/entities/proceso.entity';
import { ItemActividad } from '../sgh/entities/item-actividad.entity';
import { Categoria } from '../sgh/entities/categoria.entity';
import { TipoActividad } from '../sgh/entities/tipo-actividad.entity';
import { Cliente } from '../sgh/entities/cliente.entity';
import { UsuarioSgh } from '../sgh/entities/usuario-sgh.entity';
import { EstructuraProyecto } from '../sgh/entities/estructura-proyecto.entity';
import { Proyecto } from '../sgh/entities/proyecto.entity';
import { ProyectoActividad } from '../sgh/entities/proyecto-actividad.entity';
import { Actividad } from '../sgh/entities/actividad.entity';
import { DetalleActividad } from '../sgh/entities/detalle-actividad.entity';
import { MetadataActividad } from '../sgh/entities/metadata-actividad.entity';
import { CronProyecto } from '../sgh/entities/cron-proyecto.entity';
import { CronHito } from '../sgh/entities/cron-hito.entity';
import { CronSeguimiento } from '../sgh/entities/cron-seguimiento.entity';
import { SghId } from '../sgh/entities/sgh-id.entity';
import { CotClient } from '../cotizaciones/entities/cot-client.entity';
import { Region } from '../cotizaciones/entities/region.entity';
import { CotTemplate } from '../cotizaciones/entities/cot-template.entity';
import { Budget } from '../cotizaciones/entities/budget.entity';
import { CotDtBudget } from '../cotizaciones/entities/cot-dt-budget.entity';
import { CotBudgetHistory } from '../cotizaciones/entities/cot-budget-history.entity';
import { Correlativo } from '../cotizaciones/entities/cot-correlativo.entity';
import { CotEmpresa } from '../cotizaciones/entities/cot-empresa.entity';
import { CotTasaIva } from '../cotizaciones/entities/cot-tasa-iva.entity';

dotenv.config();

const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5434', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '11786822',
  database: process.env.DB_NAME || 'db_labv5_comercial',
  entities: [
    Usuario,
    Grupo,
    AccesoUsuario,
    AccesoGrupo,
    Sistema,
    Log,
    Evento,
    SessionLog,
    Proceso,
    ItemActividad,
    Categoria,
    TipoActividad,
    Cliente,
    UsuarioSgh,
    EstructuraProyecto,
    Proyecto,
    ProyectoActividad,
    Actividad,
    DetalleActividad,
    MetadataActividad,
    CronProyecto,
    CronHito,
    CronSeguimiento,
    SghId,
    CotClient,
    Region,
    CotTemplate,
    Budget,
    CotDtBudget,
    CotBudgetHistory,
    Correlativo,
    CotEmpresa,
    CotTasaIva,
  ],
  synchronize: false,
  logging: ['query', 'error'],
  logger: 'advanced-console',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

export default databaseConfig;
