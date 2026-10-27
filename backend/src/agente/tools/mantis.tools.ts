import { Injectable } from '@nestjs/common';
import { MantisService } from '../../mantis/mantis.service';
import { DefinicionHerramienta } from '../agente.tipos';

/**
 * Herramientas del Agente IA para consultar MantisBT (reportes de bugs).
 * Requieren el permiso SGH/mantis_reportes (se filtran por perfil en AgenteTools).
 */
export function crearHerramientasMantis(mantis: MantisService): DefinicionHerramienta[] {
  return [
    {
      name: 'filtros_mantis',
      description:
        'Devuelve los catálogos de MantisBT: proyectos, usuarios y estados (estatus). ' +
        'Úsalo para traducir un nombre mencionado por el usuario (proyecto, persona o estado) a su ID numérico ' +
        'antes de llamar a consultar_issues_mantis o resumen_issues_mantis.',
      sistema: 'SGH',
      pagina: 'mantis_reportes',
      parameters: {
        type: 'object',
        properties: {},
      },
      execute: async (_args: any, _ctx: any) => {
        return mantis.filtros();
      },
    },
    {
      name: 'consultar_issues_mantis',
      description:
        'Lista incidencias (bugs) de MantisBT según filtros opcionales: projectId, statusId, reporterId, ' +
        'handlerId (asignado), texto (en el resumen), desde/hasta (fechas YYYY-MM-DD) y max (límite). ' +
        'Devuelve hasta 30 incidencias con id, resumen, proyecto, informador, asignado, estado, prioridad y fecha. ' +
        'Si el usuario da nombres en lugar de IDs, primero usa filtros_mantis para obtener los IDs.',
      sistema: 'SGH',
      pagina: 'mantis_reportes',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'integer', description: 'ID del proyecto de Mantis' },
          statusId: { type: 'integer', description: 'ID del estado/estatus de Mantis' },
          reporterId: { type: 'integer', description: 'ID del informador (reporter)' },
          handlerId: { type: 'integer', description: 'ID del asignado (handler)' },
          texto: { type: 'string', description: 'Texto a buscar en el resumen' },
          desde: { type: 'string', description: 'Fecha desde (YYYY-MM-DD)' },
          hasta: { type: 'string', description: 'Fecha hasta (YYYY-MM-DD)' },
          max: { type: 'integer', description: 'Máximo de incidencias a devolver (default 30)' },
        },
      },
      execute: async (args: any, _ctx: any) => {
        const dto = {
          projectId: args.projectId,
          statusId: args.statusId,
          reporterId: args.reporterId,
          handlerId: args.handlerId,
          texto: args.texto,
          desde: args.desde,
          hasta: args.hasta,
          max: args.max ? Number(args.max) : 30,
        };
        const r = await mantis.consultar(dto);
        return {
          total: r.total,
          mostradas: r.issues.length,
          incidencias: r.issues.map((i) => ({
            id: i.id,
            resumen: i.summary,
            proyecto: i.project,
            informador: i.reporter,
            asignado: i.handler,
            estado: i.status,
            prioridad: i.priority,
            fecha: i.dateSubmitted,
          })),
        };
      },
    },
    {
      name: 'resumen_issues_mantis',
      description:
        'Resumen agregado de incidencias de MantisBT con los mismos filtros que consultar_issues_mantis. ' +
        'Devuelve total y desglose por estado, por proyecto (Top 10), por asignado (Top 10) y por mes. ' +
        'Ideal para preguntas como "¿cuántos bugs abiertos hay en el proyecto X?" o "distribución por estado".',
      sistema: 'SGH',
      pagina: 'mantis_reportes',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'integer', description: 'ID del proyecto de Mantis' },
          statusId: { type: 'integer', description: 'ID del estado/estatus de Mantis' },
          reporterId: { type: 'integer', description: 'ID del informador (reporter)' },
          handlerId: { type: 'integer', description: 'ID del asignado (handler)' },
          texto: { type: 'string', description: 'Texto a buscar en el resumen' },
          desde: { type: 'string', description: 'Fecha desde (YYYY-MM-DD)' },
          hasta: { type: 'string', description: 'Fecha hasta (YYYY-MM-DD)' },
        },
      },
      execute: async (args: any, _ctx: any) => {
        const dto = {
          projectId: args.projectId,
          statusId: args.statusId,
          reporterId: args.reporterId,
          handlerId: args.handlerId,
          texto: args.texto,
          desde: args.desde,
          hasta: args.hasta,
        };
        return mantis.resumen(dto);
      },
    },
  ];
}
