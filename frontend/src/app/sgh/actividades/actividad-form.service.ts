import { Injectable } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { SghService } from '../services/sgh.service';
import {
  TipoActividad,
  ItemActividad,
  UsuarioSgh,
  Cliente,
  ProyectoCliente,
  EstructuraProceso,
  DetalleActividadRow,
  Actividad,
  ActividadHeader,
} from '../models/sgh.models';

export interface CatalogoActividad {
  tipos: TipoActividad[];
  items: ItemActividad[];
  usuarios: UsuarioSgh[];
}

export interface ActividadCargada {
  header: ActividadHeader;
  detalles: DetalleActividadRow[];
  cliente?: Cliente;
}

/**
 * Orquestación del formulario de Actividad/Horas (SRP + DIP).
 * Aísla el acceso a datos, el mapeo de DTOs y la carga de catálogos para
 * que el componente solo se encargue de la presentación.
 */
@Injectable()
export class ActividadFormService {
  private tipos: TipoActividad[] = [];
  private items: ItemActividad[] = [];
  private usuarios: UsuarioSgh[] = [];

  constructor(
    private readonly sgh: SghService,
  ) {}

  /** Carga los catálogos estáticos del formulario un única vez. */
  cargarCatalogos(force = false): Observable<CatalogoActividad> {
    if (!force && (this.tipos.length || this.items.length || this.usuarios.length)) {
      return of({ tipos: this.tipos, items: this.items, usuarios: this.usuarios });
    }
    return forkJoin({
      tipos: this.sgh.listTipos(1),
      items: this.sgh.listItems(1),
      usuarios: this.sgh.listUsuariosSgh(1),
    }).pipe(
      map((c) => {
        this.tipos = c.tipos;
        this.items = c.items;
        this.usuarios = c.usuarios;
        return c;
      }),
    );
  }

  /** Usuario SGH correspondiente a la sesión autenticada (readonly en cabecera). */
  usuarioDefault(): UsuarioSgh | null {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('currentUser') : null;
    if (!raw) return null;
    const login = (JSON.parse(raw) as { login?: string })?.login;
    if (!login) return null;
    return this.usuarios.find((u) => u.login === login) ?? null;
  }

  /** Búsqueda de clientes (RIF / nombre). */
  buscarClientes(termino: string): Observable<Cliente[]> {
    const t = termino?.trim();
    if (!t) return of([]);
    return this.sgh.listClientes(undefined, t);
  }

  /** Proyectos activos de un cliente. */
  proyectosDelCliente(idClient: number): Observable<ProyectoCliente[]> {
    return this.sgh.proyectosDelCliente(idClient);
  }

  /** Procesos válidos para un ítem (vía estructura de proyecto, como el popup legado). */
  procesosDelItem(idItem: number): Observable<EstructuraProceso[]> {
    if (!idItem) return of([]);
    return this.sgh.asignacionEstructura(idItem).pipe(
      map((filas) =>
        filas
          .filter((f) => f.active === 1)
          .map((f) => ({
            idProcess: f.idProcess,
            nameProcess: f.nameProcess ?? '',
            orden: f.orden ?? 0,
            hours: f.hours,
            active: f.active,
          })),
      ),
    );
  }

  /** Carga una actividad existente y la convierte a cabecera + detalle editable. */
  cargarActividad(id: number): Observable<ActividadCargada> {
    return this.cargarCatalogos().pipe(
      switchMap(() => this.sgh.getActividad(id)),
      map((a: Actividad) => this.aEditable(a)),
    );
  }

  private aEditable(a: Actividad): ActividadCargada {
    const header: ActividadHeader = {
      idActivity: a.idActivity,
      numdoc: a.numdoc,
      idClient: a.idClient,
      idType: a.idType,
      idUser: a.idUser,
      idProyect: a.idProyect,
      responsible: a.responsible,
      dateDocument: this.aFechaInput(a.dateDocument),
      note: a.note ?? '',
      visit: a.visit,
      file: a.metadata?.[0]?.file ?? '',
    };
    const detalles: DetalleActividadRow[] = (a.detalles ?? []).map((d) => ({
      idDetail: d.idDetail,
      idActivity: d.idActivity,
      idItemActivity: d.idItemActivity,
      idProcess: d.idProcess,
      situation: d.situation,
      hours: d.hours,
      note: d.note,
      mantis: d.mantis,
    }));
    const cliente = a.cliente
      ? { idClient: a.cliente.idClient, rif: a.cliente.rif, name: a.cliente.name, active: 1 } as Cliente
      : undefined;
    return { header, detalles, cliente };
  }

  /** DTO de guardado (solo los campos declarados, sin propagar relacionales). */
  buildDto(header: ActividadHeader, detalles: DetalleActividadRow[]) {
    const filas = detalles
      .filter((d) => d.idProcess && d.idProcess !== 0)
      .map((d) => ({
        idDetail: d.idDetail || undefined,
        idItemActivity: d.idItemActivity,
        idProcess: d.idProcess,
        situation: d.situation,
        hours: d.hours,
        note: d.note,
        mantis: d.mantis,
      }));
    return {
      idClient: header.idClient,
      idType: header.idType,
      idUser: header.idUser,
      idProyect: header.idProyect ?? 0,
      responsible: header.responsible,
      dateDocument: header.dateDocument,
      note: header.note,
      visit: header.visit,
      file: header.file || undefined,
      detalles: filas,
    };
  }

  guardar(header: ActividadHeader, detalles: DetalleActividadRow[]): Observable<Actividad> {
    const dto = this.buildDto(header, detalles);
    if (header.idActivity) {
      return this.sgh.updateActividad(header.idActivity, dto as any);
    }
    return this.sgh.createActividad(dto as any);
  }

  private aFechaInput(fecha: Date | string | undefined): string {
    if (!fecha) return '';
    // Las columnas `date` llegan como "YYYY-MM-DD". Se usan tal cual para no
    // restar un dia al pasar por `new Date()` (que interpreta como UTC).
    if (typeof fecha === 'string') {
      const m = /^(\d{4}-\d{2}-\d{2})/.exec(fecha);
      if (m) return m[1];
    }
    const d = new Date(fecha);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
  }
}
