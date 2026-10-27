import { Injectable } from '@nestjs/common';
import { CotizacionesService } from '../cotizaciones/cotizaciones.service';
import { CatalogosService } from '../sgh/catalogos.service';
import { ProyectosService } from '../sgh/proyectos.service';
import { ActividadesService } from '../sgh/actividades.service';
import { PermisosService } from '../permisos/permisos.service';
import { MantisService } from '../mantis/mantis.service';
import { ContextoHerramienta, DefinicionHerramienta } from './agente.tipos';
import { crearHerramientasCotizaciones } from './tools/cotizaciones.tools';
import { crearHerramientasHoras } from './tools/horas.tools';
import { crearHerramientasMantis } from './tools/mantis.tools';

/**
 * Registro central de herramientas del agente.
 * Cada herramienta declara el modulo/pagina del arbol de permisos que requiere;
 * solo se exponen (y se ejecutan) las que el perfil del usuario puede acceder.
 */
@Injectable()
export class AgenteTools {
  private readonly herramientas: DefinicionHerramienta[];
  private readonly porNombre: Map<string, DefinicionHerramienta>;
  /** Cache de paginas permitidas por login (evita repetir consultas en una conversacion). */
  private readonly cachePermisos = new Map<string, Set<string>>();

  constructor(
    cotizaciones: CotizacionesService,
    proyectos: ProyectosService,
    actividades: ActividadesService,
    catalogos: CatalogosService,
    private readonly permisos: PermisosService,
    mantis: MantisService,
  ) {
    this.herramientas = [
      ...crearHerramientasCotizaciones(cotizaciones),
      ...crearHerramientasHoras(proyectos, actividades, catalogos),
      ...crearHerramientasMantis(mantis),
    ];
    this.porNombre = new Map(this.herramientas.map((h) => [h.name, h]));
  }

  /** Definiciones en formato OpenAI tools, para la lista indicada. */
  definiciones(lista: DefinicionHerramienta[] = this.herramientas): any[] {
    return lista.map((h) => ({
      type: 'function',
      function: {
        name: h.name,
        description: h.description,
        parameters: h.parameters,
      },
    }));
  }

  /** Nombres de todas las herramientas (diagnostico). */
  nombres(): string[] {
    return this.herramientas.map((h) => h.name);
  }

  /** Paginas permitidas para el login segun el arbol de permisos. */
  private async clavesPermitidas(login: string): Promise<Set<string>> {
    const enCache = this.cachePermisos.get(login);
    if (enCache) return enCache;

    const claves = [...new Set(this.herramientas.map((h) => `${h.sistema}/${h.pagina}`))];
    const permitidas = new Set<string>();
    for (const clave of claves) {
      const [sistema, pagina] = clave.split('/');
      if (await this.permisos.verificarPermiso(login, sistema, pagina, 'acceso')) {
        permitidas.add(clave);
      }
    }
    this.cachePermisos.set(login, permitidas);
    return permitidas;
  }

  /** Herramientas que el usuario puede ver/ejecutar segun su perfil y accesos. */
  async permitidas(login: string): Promise<DefinicionHerramienta[]> {
    const permitidas = await this.clavesPermitidas(login);
    return this.herramientas.filter((h) => permitidas.has(`${h.sistema}/${h.pagina}`));
  }

  private async tienePermiso(login: string, sistema: string, pagina: string): Promise<boolean> {
    const permitidas = await this.clavesPermitidas(login);
    return permitidas.has(`${sistema}/${pagina}`);
  }

  /** Ejecuta una herramienta por nombre, validando permiso y controlando errores. */
  async ejecutar(
    nombre: string,
    argumentos: string,
    ctx: ContextoHerramienta,
  ): Promise<{ ok: boolean; data?: any; error?: string }> {
    const tool = this.porNombre.get(nombre);
    if (!tool) return { ok: false, error: `Herramienta desconocida: ${nombre}` };

    if (!(await this.tienePermiso(ctx?.login, tool.sistema, tool.pagina))) {
      return { ok: false, error: 'No tiene permisos para consultar este módulo' };
    }

    let args: any = {};
    try {
      args = argumentos ? JSON.parse(argumentos) : {};
    } catch {
      return { ok: false, error: 'Argumentos inválidos (JSON mal formado)' };
    }

    try {
      const data = await tool.execute(args, ctx);
      return { ok: true, data };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Error al ejecutar la herramienta' };
    }
  }
}
