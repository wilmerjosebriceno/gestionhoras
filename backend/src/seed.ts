import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsuariosService } from './usuarios/usuarios.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Grupo } from './grupos/entities/grupo.entity';
import { Sistema } from './permisos/entities/sistema.entity';
import { Evento } from './auditoria/entities/evento.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const usuariosService = app.get(UsuariosService);
  const grupoRepo = app.get<Repository<Grupo>>(getRepositoryToken(Grupo));
  const sistemaRepo = app.get<Repository<Sistema>>(getRepositoryToken(Sistema));
  const eventoRepo = app.get<Repository<Evento>>(getRepositoryToken(Evento));

  // 1. Crear eventos de auditoría
  const eventosNombres = ['CRITICO', 'INSERT', 'UPDATE', 'DELETE', 'SELECT', 'LOGIN', 'LOGOUT', 'CAMBIO_PASSWORD'];
  for (const nombre of eventosNombres) {
    const existe = await eventoRepo.findOne({ where: { evento: nombre } });
    if (!existe) {
      await eventoRepo.save({ idEvento: uuid(), evento: nombre, denominacion: nombre });
      console.log(`Evento creado: ${nombre}`);
    }
  }

  // 2. Crear grupo ADMINISTRADORES
  let grupo = await grupoRepo.findOne({ where: { grupo: 'ADMINISTRADORES' } });
  if (!grupo) {
    grupo = await grupoRepo.save({
      idGrupo: uuid(),
      grupo: 'ADMINISTRADORES',
      denominacion: 'Administradores del Sistema',
      estatus: 1,
    });
    console.log('Grupo ADMINISTRADORES creado');
  }

  // 3. Crear sistemas (módulos)
  const sistemasDef = [
    { sistema: 'SFV', denominacion: 'Comercial', descripcion: 'Facturación, ventas y cuentas por cobrar', ruta: '/sfv' },
    { sistema: 'SIV', denominacion: 'Inventario', descripcion: 'Control de inventario y almacenes', ruta: '/siv' },
    { sistema: 'LAB', denominacion: 'Laboratorio', descripcion: 'Gestión de análisis de laboratorio', ruta: '/lab' },
    { sistema: 'SEC', denominacion: 'Seguridad', descripcion: 'Control de perfiles, accesos de usuarios y log de transacciones', ruta: '/sec' },
    { sistema: 'SGH', denominacion: 'Gestion de Horas', descripcion: 'Registro de actividades y horas a clientes', ruta: '/sgh' },
    { sistema: 'COT', denominacion: 'Cotizaciones', descripcion: 'Cotizaciones, tarifas y normativa', ruta: '/cot' },
    { sistema: 'SOP', denominacion: 'Soporte', descripcion: 'Incidencias y tickets de soporte', ruta: '/soporte' },
    { sistema: 'GPI', denominacion: 'Proyectos Internos', descripcion: 'Gestion de proyectos internos: equipo, actividades, fechas y horas', ruta: '/gpi' },
  ];
  for (const def of sistemasDef) {
    let sistema = await sistemaRepo.findOne({ where: { sistema: def.sistema } });
    if (!sistema) {
      sistema = await sistemaRepo.save({
        idSistema: uuid(),
        sistema: def.sistema,
        denominacion: def.denominacion,
        descripcion: def.descripcion,
        ruta: def.ruta,
        estatus: 1,
      });
      console.log(`Sistema ${def.sistema} creado`);
    } else {
      await sistemaRepo.update(sistema.idSistema, {
        denominacion: def.denominacion,
        descripcion: def.descripcion,
        ruta: def.ruta,
        estatus: 1,
      });
    }
  }

  // 4. Crear usuario administrador
  const adminUser = {
    login: 'SOFTBRI',
    password: 'SigespAdmin2026!',
    nombres: 'ADMINISTRADOR',
    apellidos: 'DEL SISTEMA',
    cedula: 'V-00000000',
    email: 'admin@sigesp.com',
    estatus: 1,
    nivelGeneral: 1,
    idGrupo: grupo.idGrupo,
  };

  try {
    const usuario = await usuariosService.create(adminUser);
    console.log(`Usuario administrador creado: ${usuario.login}`);
  } catch (error: any) {
    if (error.code === '23505') {
      console.log('El usuario administrador ya existe');
    } else {
      throw error;
    }
  }

  await app.close();
  console.log('Seed completado');
}

seed().catch((err) => {
  console.error('Seed falló:', err);
  process.exit(1);
});
