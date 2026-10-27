import { CotizacionesService } from '../../cotizaciones/cotizaciones.service';
import { DefinicionHerramienta } from '../agente.tipos';

const ESTADOS: Record<number, string> = {
  0: 'BORRADOR',
  1: 'ENVIADA',
  2: 'ACEPTADA',
  3: 'RECHAZADA',
  4: 'ELIMINADA',
};

/**
 * Herramientas de SOLO LECTURA sobre el módulo de cotizaciones (Fase 1).
 * Reutilizan directamente el CotizacionesService del negocio.
 */
export function crearHerramientasCotizaciones(
  service: CotizacionesService,
): DefinicionHerramienta[] {
  return [
    {
      name: 'listar_cotizaciones',
      sistema: 'COT',
      pagina: 'cotizaciones',
      description:
        'Lista cotizaciones con filtros opcionales de estado, texto, rango de fechas y paginación. ' +
        'Devuelve un resumen por cotización (código, fecha, cliente, estado y montos).',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'integer',
            description: 'Estado: 0 BORRADOR, 1 ENVIADA, 2 ACEPTADA, 3 RECHAZADA',
          },
          q: { type: 'string', description: 'Texto a buscar en el nombre o RIF del cliente' },
          de: { type: 'string', description: 'Fecha inicial (YYYY-MM-DD)' },
          hasta: { type: 'string', description: 'Fecha final (YYYY-MM-DD)' },
          page: { type: 'integer', description: 'Página (desde 1)' },
          limit: { type: 'integer', description: 'Cantidad por página (máx. 200)' },
        },
      },
      execute: async (args: any) => {
        const res = await service.listarBudgets({
          status: args?.status,
          q: args?.q,
          de: args?.de,
          hasta: args?.hasta,
          page: args?.page,
          limit: args?.limit,
        });
        return {
          total: res.meta.total,
          page: res.meta.page,
          totalPages: res.meta.totalPages,
          cotizaciones: (res.data as any[]).map((b) => ({
            id: b.idBudget,
            codigo: b.codeBudget,
            fecha: b.dateBudget,
            vencimiento: b.vencimiento,
            estado: ESTADOS[b.status] ?? b.status,
            montoUsd: b.totalUsd,
            cliente: b.client?.nameClient ?? b.cliente ?? null,
          })),
        };
      },
    },
    {
      name: 'obtener_cotizacion',
      sistema: 'COT',
      pagina: 'cotizaciones',
      description:
        'Devuelve el detalle completo de una cotización por su id, incluyendo cliente, líneas de detalle y totales.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'Id de la cotización (idBudget)' },
        },
        required: ['id'],
      },
      execute: async (args: any) => service.getBudget(Number(args?.id)),
    },
    {
      name: 'resumen_cotizaciones',
      sistema: 'COT',
      pagina: 'kpis',
      description:
        'KPIs agregados de cotizaciones: total, por estado, montos aceptados, tendencia mensual, top clientes, por región y top plantillas. ' +
        'Útil para preguntas como "¿cuántas cotizaciones hay por región?" o "¿cuál es el monto aceptado?".',
      parameters: {
        type: 'object',
        properties: {
          de: { type: 'string', description: 'Fecha inicial (YYYY-MM-DD)' },
          hasta: { type: 'string', description: 'Fecha final (YYYY-MM-DD)' },
          idEmpresa: { type: 'integer', description: 'Filtrar por empresa' },
          idClient: { type: 'integer', description: 'Filtrar por cliente' },
        },
      },
      execute: async (args: any) => service.obtenerKpis({
        de: args?.de,
        hasta: args?.hasta,
        idEmpresa: args?.idEmpresa,
        idClient: args?.idClient,
      }),
    },
    {
      name: 'cotizaciones_vencidas',
      sistema: 'COT',
      pagina: 'cotizaciones',
      description:
        'Lista las cotizaciones vencidas y próximas a vencer según los días de alerta indicados.',
      parameters: {
        type: 'object',
        properties: {
          diasAlerta: { type: 'integer', description: 'Días hacia atrás para considerar vencidas (por defecto 15)' },
          diasPorVencer: { type: 'integer', description: 'Días hacia adelante para por vencer (por defecto 5)' },
        },
      },
      execute: async (args: any) =>
        service.listarVencidas(
          args?.diasAlerta ? Number(args.diasAlerta) : 15,
          args?.diasPorVencer ? Number(args.diasPorVencer) : 5,
        ),
    },
    {
      name: 'buscar_clientes',
      sistema: 'COT',
      pagina: 'clientes',
      description: 'Busca clientes de cotización por nombre o RIF.',
      parameters: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Texto a buscar (nombre o RIF). Vacío devuelve todos.' },
        },
      },
      execute: async (args: any) => service.listarClientes(args?.q),
    },
    {
      name: 'listar_regiones',
      sistema: 'COT',
      pagina: 'regiones',
      description: 'Lista las regiones activas con sus precios presencial y online.',
      parameters: { type: 'object', properties: {} },
      execute: async () => service.listarRegiones(),
    },
    {
      name: 'listar_plantillas',
      sistema: 'COT',
      pagina: 'plantillas',
      description: 'Lista las plantillas de cotización con su código, precio y horas.',
      parameters: { type: 'object', properties: {} },
      execute: async () => service.listarPlantillas(),
    },
    {
      name: 'listar_tasas_iva',
      sistema: 'COT',
      pagina: 'tasas-iva',
      description: 'Lista las tasas de IVA configuradas (porcentaje y estado).',
      parameters: {
        type: 'object',
        properties: {
          incluirInactivos: { type: 'boolean', description: 'Incluir tasas inactivas' },
        },
      },
      execute: async (args: any) => service.listarTasas(!!args?.incluirInactivos),
    },
  ];
}
