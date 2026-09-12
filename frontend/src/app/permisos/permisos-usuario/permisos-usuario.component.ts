import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, map, timeout, finalize } from 'rxjs/operators';
import { PermisoService, ArbolItem } from '../../core/services/permiso.service';
import { SwalService } from '../../core/services/swal.service';

@Component({
  selector: 'app-permisos-usuario',
  standalone: false,
  templateUrl: './permisos-usuario.component.html',
})
export class PermisosUsuarioComponent implements OnInit {
  tipoListar = 'U';
  sistemas: any[] = [];
  sistemaSel = '';
  arbolItems: ArbolItem[] = [];
  flatPages: { nombre: string; pagina: string }[] = [];
  paginaSel = '';
  denPaginaSel = '';
  usuarios: any[] = [];
  grupos: any[] = [];
  selectedItems: string[] = [];
  permisosExistentes: any[] = [];

  acceso = false;
  buscar = false;
  incluir = false;
  modificar = false;
  eliminar = false;
  procesar = false;
  imprimir = false;
  anular = false;

  loading = false;
  error = '';
  success = '';

  constructor(private service: PermisoService, private cdr: ChangeDetectorRef, private swal: SwalService) {}

  ngOnInit(): void {
    this.service.getSistemas().subscribe((s) => (this.sistemas = s));
    this.cargarLista();
  }

  cargarLista(): void {
    if (this.tipoListar === 'U') {
      this.service.getListarUsuarios().subscribe((u) => (this.usuarios = u));
    } else {
      this.service.getListarGrupos().subscribe((g) => (this.grupos = g));
    }
  }

  onCambioSistema(): void {
    this.flatPages = [];
    this.paginaSel = '';
    if (!this.sistemaSel) return;
    this.service.getArbol(this.sistemaSel).subscribe({
      next: (items) => {
        this.arbolItems = items;
        this.flatPages = this.flattenArbol(items, '');
        this.flatPages.unshift({ nombre: 'Todo el Sistema', pagina: 'all' });
      },
      error: () => (this.error = 'No se pudo cargar el arbol del sistema'),
    });
  }

  private flattenArbol(items: ArbolItem[], prefix: string): { nombre: string; pagina: string }[] {
    const result: { nombre: string; pagina: string }[] = [];
    for (const item of items) {
      if (item.hijos && item.hijos.length > 0) {
        result.push(...this.flattenArbol(item.hijos, prefix + item.nombre + ' > '));
      } else if (item.pagina) {
        result.push({ nombre: prefix + item.nombre, pagina: item.pagina });
      }
    }
    return result;
  }

  onCambioPagina(): void {
    this.selectedItems = [];
    this.limpiarPermisos();
    if (!this.paginaSel || this.paginaSel === 'all') return;
    const found = this.flatPages.find((p) => p.pagina === this.paginaSel);
    this.denPaginaSel = found?.nombre || '';
  }

  toggleItem(login: string): void {
    const idx = this.selectedItems.indexOf(login);
    if (idx >= 0) this.selectedItems.splice(idx, 1);
    else this.selectedItems.push(login);
  }

  toggleAllItems(): void {
    const items = this.tipoListar === 'U' ? this.usuarios.map((u) => u.login) : this.grupos.map((g) => g.grupo);
    if (this.selectedItems.length === items.length) {
      this.selectedItems = [];
    } else {
      this.selectedItems = [...items];
    }
  }

  buscarPermisos(): void {
    this.error = '';
    this.success = '';
    // Solo necesitamos sistema y usuario/grupo, sin necesidad de paginaSel
    if (!this.sistemaSel || !this.selectedItems.length) {
      this.error = 'Seleccione sistema y al menos un usuario/grupo';
      return;
    }
    // Se elimina this.loading = true y finalize para garantizar que el spinner no se bloquee
    this.cdr.detectChanges();

    this.permisosExistentes = [];
    const observables = [];

    // Buscamos permisos por cada usuario/grupo de forma paralela
    for (const item of this.selectedItems) {
      const obs = (this.tipoListar === 'U'
        ? this.service.getPermisosUsuario(item, this.sistemaSel)
        : this.service.getPermisosGrupo(item, this.sistemaSel)
      ).pipe(
        timeout(15000), // Incrementamos el tiempo de espera a 15 segundos
        catchError(() => of([])), // Ignoramos errores de peticiones individuales
      );
      observables.push(obs);
    }

    if (observables.length === 0) {
      this.error = 'No hay usuarios/grupos seleccionados';
      this.cdr.detectChanges();
      return;
    }

    forkJoin(observables).subscribe({
      next: (results) => {
        // Flatten results por si alguno de los calls regresa arrays
        const allPermisos = [];
        for (const result of results) {
          if (Array.isArray(result)) {
            allPermisos.push(...result);
          } else if (result) {
            allPermisos.push(result);
          }
        }
        this.permisosExistentes = allPermisos;
        this.aplicarPermisos();
      },
      error: () => {
        this.error = 'Error al consultar permisos de uno o m\u00e1s usuarios/grupos';
        this.cdr.detectChanges();
      },
    });
  }

  private aplicarPermisos(): void {
    this.loading = false;
    const allOn = this.permisosExistentes.every(
      (p) => p.acceso && p.seleccionar && p.insertar && p.actualizar &&
             p.eliminar && p.ejecutar && p.imprimir && p.anular,
    );
    if (allOn) {
      this.acceso = this.buscar = this.incluir = this.modificar = true;
      this.eliminar = this.procesar = this.imprimir = this.anular = true;
    } else if (this.permisosExistentes.length > 0) {
      const p = this.permisosExistentes[0];
      this.acceso = p.acceso === 1;
      this.buscar = p.seleccionar === 1;
      this.incluir = p.insertar === 1;
      this.modificar = p.actualizar === 1;
      this.eliminar = p.eliminar === 1;
      this.procesar = p.ejecutar === 1;
      this.imprimir = p.imprimir === 1;
      this.anular = p.anular === 1;
    }
  }

  toggleAllPermisos(): void {
    const val = !this.acceso;
    this.acceso = this.buscar = this.incluir = this.modificar = val;
    this.eliminar = this.procesar = this.imprimir = this.anular = val;
  }

  guardarPermisos(): void {
    this.error = '';
    this.success = '';
    if (!this.sistemaSel || !this.selectedItems.length || !this.paginaSel) {
      this.error = 'Seleccione sistema, pagina y usuario(s)/grupo(s)';
      return;
    }
    // Spinner desactivado para evitar bloqueos
    this.loading = false;

    const targetPages = this.paginaSel === 'all'
      ? this.flatPages.filter((p) => p.pagina !== 'all')
      : [{ nombre: this.denPaginaSel, pagina: this.paginaSel }];

    const dto = {
      tipo: this.tipoListar as 'U' | 'G',
      sistema: this.sistemaSel,
      logins: this.tipoListar === 'U' ? this.selectedItems : undefined,
      grupos: this.tipoListar === 'G' ? this.selectedItems : undefined,
      permisos: targetPages.map((p) => ({
        pagina: p.pagina,
        denpagina: p.nombre,
        acceso: this.acceso ? 1 : 0,
        seleccionar: this.buscar ? 1 : 0,
        insertar: this.incluir ? 1 : 0,
        actualizar: this.modificar ? 1 : 0,
        eliminar: this.eliminar ? 1 : 0,
        ejecutar: this.procesar ? 1 : 0,
        imprimir: this.imprimir ? 1 : 0,
        anular: this.anular ? 1 : 0,
      })),
    };

    this.service.guardarPermisos(dto).pipe(
      timeout(15000),
    ).subscribe({
      next: () => {
        this.success = 'Permisos guardados exitosamente';
        this.swal.exito('Permisos guardados exitosamente');
        this.cdr.detectChanges();
      },
      error: (err) => {
        const msg = err.error?.message;
        this.error = Array.isArray(msg) ? msg.join('. ') : (msg || 'Error al guardar permisos');
        this.swal.error('Error al guardar permisos', Array.isArray(msg) ? msg.join('. ') : (msg || 'No se pudieron guardar los permisos'));
        this.cdr.detectChanges();
      },
    });
  }

  private limpiarPermisos(): void {
    this.acceso = this.buscar = this.incluir = this.modificar = false;
    this.eliminar = this.procesar = this.imprimir = this.anular = false;
    this.permisosExistentes = [];
  }
}
