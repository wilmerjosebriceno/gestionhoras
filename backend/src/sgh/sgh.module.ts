import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Proceso } from './entities/proceso.entity';
import { ItemActividad } from './entities/item-actividad.entity';
import { Categoria } from './entities/categoria.entity';
import { TipoActividad } from './entities/tipo-actividad.entity';
import { Cliente } from './entities/cliente.entity';
import { UsuarioSgh } from './entities/usuario-sgh.entity';
import { EstructuraProyecto } from './entities/estructura-proyecto.entity';
import { Proyecto } from './entities/proyecto.entity';
import { ProyectoActividad } from './entities/proyecto-actividad.entity';
import { Actividad } from './entities/actividad.entity';
import { DetalleActividad } from './entities/detalle-actividad.entity';
import { MetadataActividad } from './entities/metadata-actividad.entity';
import { CronProyecto } from './entities/cron-proyecto.entity';
import { CronHito } from './entities/cron-hito.entity';
import { CronSeguimiento } from './entities/cron-seguimiento.entity';
import { SghId } from './entities/sgh-id.entity';
import { CatalogosService } from './catalogos.service';
import { EstructuraService } from './estructura.service';
import { ProyectosService } from './proyectos.service';
import { ActividadesService } from './actividades.service';
import { PdfReportsService } from './pdf-reports.service';
import { LogosService } from './logos.service';
import { CronogramaService } from './cronograma.service';
import { DashboardService } from './dashboard.service';
import { ProcesosController } from './procesos.controller';
import { ItemsController } from './items.controller';
import { CategoriasController } from './categorias.controller';
import { TiposController } from './tipos.controller';
import { ClientesController } from './clientes.controller';
import { UsuariosSghController } from './usuarios-sgh.controller';
import { EstructuraController } from './estructura.controller';
import { ProyectosController } from './proyectos.controller';
import { ActividadesController } from './actividades.controller';
import { LogosController } from './logos.controller';
import { CronogramaController } from './cronograma.controller';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
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
    ]),
  ],
  providers: [
    CatalogosService,
    EstructuraService,
    ProyectosService,
    ActividadesService,
    PdfReportsService,
    LogosService,
    CronogramaService,
    DashboardService,
  ],
  controllers: [
    ProcesosController,
    ItemsController,
    CategoriasController,
    TiposController,
    ClientesController,
    UsuariosSghController,
    EstructuraController,
    ProyectosController,
    ActividadesController,
    LogosController,
    CronogramaController,
    DashboardController,
  ],
  exports: [ProyectosService, ActividadesService, CatalogosService],
})
export class SghModule {}
