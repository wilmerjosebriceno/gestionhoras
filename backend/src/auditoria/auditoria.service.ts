import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Log } from './entities/log.entity';
import { Evento } from './entities/evento.entity';
import { RegistrarLogDto } from './dto/registrar-log.dto';
import { QueryLogDto } from './dto/query-log.dto';

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(Log)
    private readonly logRepository: Repository<Log>,
    @InjectRepository(Evento)
    private readonly eventoRepository: Repository<Evento>,
  ) {}

  async registrar(dto: RegistrarLogDto): Promise<Log | null> {
    try {
      const evento = await this.eventoRepository.findOne({
        where: { evento: dto.evento },
      });

      const now = new Date();
      const log = new Log();
      log.id = uuid();
      log.idEvento = evento?.idEvento ?? undefined;
      log.idAcceso = dto.idAcceso ?? undefined;
      log.fecha = now;
      log.hora = now.toLocaleTimeString('es-VE', { hour12: false });
      log.nota = dto.nota;
      log.tcpip = dto.tcpip;
      log.userAgent = dto.userAgent ?? undefined;
      log.estblk = dto.estblk ?? 0;

      return await this.logRepository.save(log);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Auditoria] Error al registrar log:', (error as Error).message);
      }
      return null;
    }
  }

  async findAll(query: QueryLogDto) {
    const where: Record<string, unknown> = {};

    if (query.nota) where.nota = Like(`%${query.nota}%`);

    if (query.fechaInicio && query.fechaFin) {
      where.fecha = Between(
        new Date(query.fechaInicio),
        new Date(query.fechaFin),
      );
    } else if (query.fechaInicio) {
      where.fecha = Between(
        new Date(query.fechaInicio),
        new Date(),
      );
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [logs, total] = await this.logRepository.findAndCount({
      where,
      skip,
      take: limit,
      order: { syslog: 'DESC' },
      relations: ['eventoRel'],
    });

    return {
      data: logs.map((l) => ({
        id: l.id,
        fecha: l.fecha,
        hora: l.hora,
        nota: l.nota,
        tcpip: l.tcpip,
        userAgent: l.userAgent,
        evento: l.eventoRel?.evento ?? null,
        estblk: l.estblk,
        syslog: l.syslog,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getEventos() {
    return this.eventoRepository.find({
      order: { evento: 'ASC' },
    });
  }

  async getResumen() {
    return this.logRepository
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.eventoRel', 'e')
      .select([
        'e.evento as evento',
        'e.denominacion as denominacion',
        'COUNT(*) as total',
      ])
      .groupBy('e.evento')
      .addGroupBy('e.denominacion')
      .orderBy('total', 'DESC')
      .limit(20)
      .getRawMany();
  }
}
