import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SoporteController } from './soporte.controller';
import { SoporteService } from './soporte.service';
import { SoporteSchemaService } from './soporte-schema.service';
import { SoporteMailService } from './soporte-mail.service';
import { AlertasService } from './alertas.service';
import { MantisSyncService } from './mantis-sync.service';
import { MantisDashboardService } from './mantis-dashboard.service';
import { MantisReporteService } from './mantis-reporte.service';
import { MantisModule } from '../mantis/mantis.module';
import { AgenteSoporte } from './entities/agente-soporte.entity';
import { Ticket } from './entities/ticket.entity';
import { TicketMensaje } from './entities/ticket-mensaje.entity';
import { TicketHistorial } from './entities/ticket-historial.entity';
import { TicketAdjunto } from './entities/ticket-adjunto.entity';
import { TicketCategoria } from './entities/ticket-categoria.entity';
import { TicketGrupo } from './entities/ticket-grupo.entity';
import { TicketPoliticaSla } from './entities/ticket-sla.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgenteSoporte,
      Ticket,
      TicketMensaje,
      TicketHistorial,
      TicketAdjunto,
      TicketCategoria,
      TicketGrupo,
      TicketPoliticaSla,
    ]),
    MantisModule,
  ],
  controllers: [SoporteController],
  providers: [
    SoporteService,
    SoporteSchemaService,
    SoporteMailService,
    AlertasService,
    MantisSyncService,
    MantisDashboardService,
    MantisReporteService,
  ],
  exports: [SoporteService, SoporteMailService],
})
export class SoporteModule {}