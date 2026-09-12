import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Grupo } from './entities/grupo.entity';
import { CreateGrupoDto } from './dto/create-grupo.dto';
import { UpdateGrupoDto } from './dto/update-grupo.dto';
import { Usuario } from '../usuarios/entities/usuario.entity';

@Injectable()
export class GruposService {
  constructor(
    @InjectRepository(Grupo)
    private readonly grupoRepository: Repository<Grupo>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {}

  async create(dto: CreateGrupoDto): Promise<Grupo> {
    const existe = await this.grupoRepository.findOne({
      where: { grupo: dto.grupo },
    });

    if (existe) {
      throw new ConflictException(`El grupo ${dto.grupo} ya existe`);
    }

    const grupo = this.grupoRepository.create({
      idGrupo: uuid(),
      grupo: dto.grupo.toUpperCase(),
      denominacion: dto.denominacion.toUpperCase(),
    });

    return this.grupoRepository.save(grupo);
  }

  async findAll() {
    return this.grupoRepository.find({
      order: { denominacion: 'ASC' },
    });
  }

  async findOne(grupo: string) {
    const grupoEntity = await this.grupoRepository.findOne({
      where: { grupo },
    });

    if (!grupoEntity) {
      throw new NotFoundException(`Grupo ${grupo} no encontrado`);
    }

    const usuarios = await this.usuarioRepository.find({
      where: { idGrupo: grupoEntity.idGrupo, estatus: 1 },
      select: {
        idUser: true,
        login: true,
        nombres: true,
        apellidos: true,
        email: true,
      } as any,
    });

    return {
      ...grupoEntity,
      usuarios,
    };
  }

  async update(grupo: string, dto: UpdateGrupoDto): Promise<Grupo> {
    const grupoEntity = await this.grupoRepository.findOne({
      where: { grupo },
    });

    if (!grupoEntity) {
      throw new NotFoundException(`Grupo ${grupo} no encontrado`);
    }

    if (dto.denominacion !== undefined) {
      grupoEntity.denominacion = dto.denominacion.toUpperCase();
    }

    return this.grupoRepository.save(grupoEntity);
  }

  async remove(grupo: string): Promise<void> {
    const grupoEntity = await this.grupoRepository.findOne({
      where: { grupo },
    });

    if (!grupoEntity) {
      throw new NotFoundException(`Grupo ${grupo} no encontrado`);
    }

    const usuariosEnGrupo = await this.usuarioRepository.count({
      where: { idGrupo: grupoEntity.idGrupo },
    });

    if (usuariosEnGrupo > 0) {
      throw new ConflictException(
        `No se puede eliminar el grupo ${grupo}: tiene ${usuariosEnGrupo} usuario(s) asignado(s)`,
      );
    }

    await this.grupoRepository.remove(grupoEntity);
  }

  async asignarUsuarios(grupo: string, logins: string[]): Promise<void> {
    const grupoEntity = await this.grupoRepository.findOne({
      where: { grupo },
    });

    if (!grupoEntity) {
      throw new NotFoundException(`Grupo ${grupo} no encontrado`);
    }

    for (const login of logins) {
      await this.usuarioRepository.update(
        { login },
        { idGrupo: grupoEntity.idGrupo },
      );
    }
  }
}
