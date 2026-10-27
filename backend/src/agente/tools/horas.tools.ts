import { CatalogosService } from '../../sgh/catalogos.service';
import { ProyectosService } from '../../sgh/proyectos.service';
import { ActividadesService } from '../../sgh/actividades.service';
import { ContextoHerramienta, DefinicionHerramienta } from '../agente.tipos';

/** Estados de una actividad en sgh_activity. */
const ESTADO_ACTIVIDAD: Record<number, string> = {
  0: 'Abierto',
  1: 'Procesado',
  2: 'Anulado',
};

/** Normaliza una fecha a YYYY-MM-DD (o null). */
function fecha(v: any): string | null {
  if (!v) return null;
  const s = String(v);
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (m) return m[1];
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Recorta una lista a un máximo razonable para no inflar el contexto del LLM. */
function limitar<T>(filas: T[], max: number): T[] {
  return (filas ?? []).slice(0, Math.min(Math.max(max, 1), 100));
}

/**
 * Herramientas de SOLO LECTURA sobre Horas/Gestión de Proyectos (SGH).
 * Reutilizan los servicios del negocio y respetan los permisos por rol del
 * usuario autenticado (login en ContextoHerramienta).
 */
export function crearHerramientasHoras(
  proyectos: ProyectosService,
  actividades: ActividadesService,
  catalogos: CatalogosService,
): DefinicionHerramienta[] {
  return [
    {
      name: 'listar_proyectos_horas',
      sistema: 'SGH',
      pagina: 'proyectos',
      description:
        'Lista proyectos del área de Horas, con su cliente, responsable, estado y horas. ' +
        'Filtros opcionales: número de documento, rango de fechas del proyecto y límite.',
      parameters: {
        type: 'object',
        properties: {
          numdoc: { type: 'string', description: 'Número de documento del proyecto (búsqueda parcial)' },
          de: { type: 'string', description: 'Fecha inicial del proyecto (YYYY-MM-DD)' },
          hasta: { type: 'string', description: 'Fecha final del proyecto (YYYY-MM-DD)' },
          limite: { type: 'integer', description: 'Máximo de proyectos a devolver (por defecto 20, máx. 100)' },
        },
      },
      execute: async (args: any) => {
        const filas = await proyectos.getCatalogo(args?.numdoc, args?.de, args?.hasta);
        const limite = Number(args?.limite) || 20;
        return {
          total: (filas as any[]).length,
          proyectos: limitar(filas as any[], limite).map((p) => ({
            idProyect: p.idProyect,
            numdoc: p.numdoc,
            cliente: p.nameClient,
            rif: p.rif,
            responsable: p.responsable,
            horas: Number(p.hours || 0),
            status: p.status === 1 ? 'Activo' : 'Inactivo',
            desde: fecha(p.dateIni),
            hasta: fecha(p.dateFin),
          })),
        };
      },
    },

    {
      name: 'detalle_proyecto_horas',
      sistema: 'SGH',
      pagina: 'proyectos',
      description:
        'Devuelve el detalle de un proyecto: horas planificadas vs ejecutadas por ítem/proceso ' +
        '(solo actividades activas) y el porcentaje de avance. Requiere el id del proyecto.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'Id del proyecto (idProyect)' },
        },
        required: ['id'],
      },
      execute: async (args: any) => {
        const id = Number(args?.id);
        if (!id) return { error: 'Debe indicar el id del proyecto' };
        const proyecto = await proyectos.findOne(id);
        const filas: any[] = await proyectos.getDetailProyect(id, true);
        let plan = 0;
        let ejec = 0;
        // Solo las filas propias del proyecto (idProyect = id); se excluyen las
        // de estructura de referencia que el detalle agrega con idProyect = 0.
        const filasProyecto = filas.filter((f) => Number(f.idProyect) === id);
        const detalle = filasProyecto.map((f) => {
          const h = Number(f.hour || 0);
          const hE = Number(f.hourE || 0);
          plan += h;
          ejec += hE;
          return { item: f.name, proceso: f.nameProcess, horasPlan: h, horasEjecutadas: hE };
        });
        return {
          proyecto: {
            idProyect: proyecto.idProyect,
            numdoc: proyecto.numdoc,
            cliente: (proyecto as any).cliente?.name ?? null,
            responsable: proyecto.responsable,
            status: proyecto.status === 1 ? 'Activo' : 'Inactivo',
          },
          totalHorasPlan: plan,
          totalHorasEjecutadas: ejec,
          avancePct: plan ? Math.round((ejec / plan) * 10000) / 100 : 0,
          actividades: detalle,
        };
      },
    },

    {
      name: 'listar_actividades_horas',
      sistema: 'SGH',
      pagina: 'actividades',
      description:
        'Lista actividades/horas registradas con filtros opcionales de número, rango de fechas y paginación. ' +
        'Respeta permisos: un usuario no administrador solo verá sus propias actividades.',
      parameters: {
        type: 'object',
        properties: {
          numdoc: { type: 'string', description: 'Número de documento de la actividad (búsqueda parcial)' },
          de: { type: 'string', description: 'Fecha inicial (YYYY-MM-DD)' },
          hasta: { type: 'string', description: 'Fecha final (YYYY-MM-DD)' },
          page: { type: 'integer', description: 'Página (desde 1)' },
          limite: { type: 'integer', description: 'Cantidad por página (por defecto 20, máx. 100)' },
        },
      },
      execute: async (args: any, ctx: ContextoHerramienta) => {
        const page = Math.max(1, Number(args?.page) || 1);
        const limite = Math.min(Math.max(Number(args?.limite) || 20, 1), 100);
        const res = await actividades.getCatalogo(
          args?.numdoc,
          args?.de,
          args?.hasta,
          ctx?.login,
          page,
          limite,
        );
        return {
          total: res.total,
          page: res.page,
          totalPages: res.totalPages,
          actividades: (res.data as any[]).map((a) => ({
            idActivity: a.idActivity,
            numdoc: a.numdoc,
            fecha: fecha(a.dateDocument),
            cliente: a.name,
            rif: a.rif,
            idProyect: a.idProyect,
            responsable: a.responsible,
            estado: ESTADO_ACTIVIDAD[a.status] ?? a.status,
            nota: a.note ?? '',
          })),
        };
      },
    },

    {
      name: 'obtener_actividad_horas',
      sistema: 'SGH',
      pagina: 'actividades',
      description:
        'Devuelve el detalle completo de una actividad por su id, incluyendo cliente, responsable, ' +
        'nota y líneas de detalle (ítem, proceso y horas).',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'Id de la actividad (idActivity)' },
        },
        required: ['id'],
      },
      execute: async (args: any, ctx: ContextoHerramienta) => {
        const id = Number(args?.id);
        if (!id) return { error: 'Debe indicar el id de la actividad' };
        const detalle: any = await actividades.getDetailActivity(id);

        // Control de acceso equivalente al resto del SGH.
        const perfil = await catalogos.rolIdPorLogin(ctx?.login);
        const esAdmin = perfil?.rol === 'A' || perfil?.rol === 'S';
        if (!esAdmin && (!perfil || detalle.idUser !== perfil.idUser)) {
          return { error: 'No tiene permisos para ver esta actividad' };
        }

        return {
          idActivity: detalle.idActivity,
          numdoc: detalle.numdoc,
          fecha: fecha(detalle.dateDocument),
          hora: detalle.hourDocument,
          cliente: detalle.cliente?.name ?? null,
          rif: detalle.cliente?.rif ?? null,
          idProyect: detalle.idProyect,
          responsable: detalle.responsible,
          estado: ESTADO_ACTIVIDAD[detalle.status] ?? detalle.status,
          nota: detalle.note ?? '',
          lineas: (detalle.detalles ?? []).map((d: any) => ({
            item: d.itemActividad?.name ?? null,
            proceso: d.proceso?.nameProcess ?? null,
            horas: Number(d.hours || 0),
            nota: d.note ?? '',
          })),
        };
      },
    },

    {
      name: 'resumen_horas',
      sistema: 'SGH',
      pagina: 'reportes',
      description:
        'KPIs de horas en un rango de fechas: total de horas y cantidad de actividades, ' +
        'agrupado por usuario, proyecto o cliente. Respeta permisos (no administrador = solo sus horas). ' +
        'Útil para "¿cuántas horas se registraron este mes?" o "horas por cliente".',
      parameters: {
        type: 'object',
        properties: {
          de: { type: 'string', description: 'Fecha inicial (YYYY-MM-DD)' },
          hasta: { type: 'string', description: 'Fecha final (YYYY-MM-DD)' },
          agrupacion: {
            type: 'string',
            enum: ['usuario', 'proyecto', 'cliente'],
            description: 'Criterio de agrupación (por defecto usuario)',
          },
          incluirAnuladas: { type: 'boolean', description: 'Incluir actividades anuladas (por defecto no)' },
        },
      },
      execute: async (args: any, ctx: ContextoHerramienta) => {
        const agrupaciones = ['usuario', 'proyecto', 'cliente'];
        const agrupacion = agrupaciones.includes(args?.agrupacion) ? args.agrupacion : 'usuario';
        const filas = await actividades.resumenHoras(
          args?.de,
          args?.hasta,
          agrupacion,
          ctx?.login,
          !!args?.incluirAnuladas,
        );
        return { agrupacion, de: args?.de ?? null, hasta: args?.hasta ?? null, filas };
      },
    },

    {
      name: 'buscar_clientes_horas',
      sistema: 'SGH',
      pagina: 'clientes',
      description: 'Busca clientes del área de Horas por nombre o RIF.',
      parameters: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Texto a buscar (nombre o RIF). Vacío devuelve todos.' },
        },
      },
      execute: async (args: any) => {
        const filas: any[] = await catalogos.findAllClientes(undefined, args?.q);
        return {
          clientes: limitar(filas, 30).map((c) => ({
            idClient: c.idClient,
            rif: c.rif,
            nombre: c.name,
            estado: c.active === 1 ? 'Activo' : 'Inactivo',
          })),
        };
      },
    },
  ];
}
