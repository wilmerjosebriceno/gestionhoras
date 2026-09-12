import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Sistema } from '../permisos/entities/sistema.entity';
import { CreateSistemaDto } from './dto/create-sistema.dto';
import { UpdateSistemaDto } from './dto/update-sistema.dto';

@Injectable()
export class SistemasService {
  constructor(
    @InjectRepository(Sistema)
    private readonly sistemaRepository: Repository<Sistema>,
  ) {}

  async create(dto: CreateSistemaDto) {
    const existente = await this.sistemaRepository.findOne({
      where: { sistema: dto.sistema },
    });
    if (existente) {
      throw new ConflictException(`El sistema ${dto.sistema} ya existe`);
    }
    const sistema = this.sistemaRepository.create({
      idSistema: uuid(),
      sistema: dto.sistema,
      denominacion: dto.denominacion,
      descripcion: dto.descripcion ?? null,
      ruta: dto.ruta ?? null,
      estatus: dto.estatus ?? 1,
    });
    return this.sistemaRepository.save(sistema);
  }

  async findAll() {
    return this.sistemaRepository.find({
      order: { denominacion: 'ASC' },
    });
  }

  async findOne(sistema: string) {
    const result = await this.sistemaRepository.findOne({
      where: { sistema },
    });
    if (!result) throw new NotFoundException(`Sistema ${sistema} no encontrado`);
    return result;
  }

  async update(sistema: string, dto: UpdateSistemaDto) {
    const result = await this.findOne(sistema);
    if (dto.denominacion !== undefined) {
      result.denominacion = dto.denominacion;
    }
    if (dto.descripcion !== undefined) {
      result.descripcion = dto.descripcion;
    }
    if (dto.ruta !== undefined) {
      result.ruta = dto.ruta;
    }
    if (dto.estatus !== undefined) {
      result.estatus = dto.estatus;
    }
    return this.sistemaRepository.save(result);
  }

  async remove(sistema: string) {
    const result = await this.findOne(sistema);
    return this.sistemaRepository.remove(result);
  }
}
