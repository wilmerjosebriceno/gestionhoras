import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { Observable, first } from 'rxjs';
import {
  DetalleActividadRow,
  EstructuraProceso,
  ItemActividad,
} from '../../models/sgh.models';
import { SwalService } from '../../../core/services/swal.service';

export interface FilaDetalle extends DetalleActividadRow {
  _opcionesProceso?: EstructuraProceso[];
  _cargando?: boolean;
}

/**
 * Grilla dinámica de detalle de horas (SRP: solo administra filas y el
 * picker de proceso por ítem). Recibe la misma referencia del arreglo del
 * padre, así que las mutaciones se reflejan automáticamente.
 */
@Component({
  selector: 'app-detalle-horas',
  standalone: false,
  templateUrl: './detalle-horas.component.html',
})
export class DetalleHorasComponent implements OnChanges {
  @Input() items: ItemActividad[] = [];
  @Input() filas: FilaDetalle[] = [];
  @Input() cargarProcesos!: (idItem: number) => Observable<EstructuraProceso[]>;

  constructor(private swal: SwalService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filas']) this.cargarOpcionesFaltantes();
  }

  /**
   * Edición de Situación / Nota en ventana amplia (réplica de `putText`).
   */
  editarTexto(campo: 'situation' | 'note', fila: FilaDetalle): void {
    this.swal
      .editarTextoLargo({
        titulo: campo === 'situation' ? 'Editar Situación' : 'Editar Nota',
        valor: fila[campo],
      })
      .then((v) => {
        if (v !== null) fila[campo] = v;
      });
  }

  agregarFila(): void {
    this.filas.push({
      idItemActivity: undefined,
      idProcess: undefined,
      situation: '',
      hours: 0,
      note: '',
      mantis: '',
      online: 0,
    });
  }

  quitarFila(i: number): void {
    this.filas.splice(i, 1);
  }

  onItemChange(fila: FilaDetalle, idItem: number | undefined): void {
    fila.idItemActivity = idItem;
    fila.idProcess = undefined;
    fila._opcionesProceso = [];
    if (!idItem) {
      fila._cargando = false;
      return;
    }
    fila._cargando = true;
    this.cargarProcesos(idItem)
      .pipe(first())
      .subscribe({
        next: (opciones) => {
          fila._opcionesProceso = opciones;
          fila._cargando = false;
        },
        error: () => {
          fila._opcionesProceso = [];
          fila._cargando = false;
        },
      });
  }

  private cargarOpcionesFaltantes(): void {
    this.filas?.forEach((fila) => {
      if (fila.idItemActivity && !fila._opcionesProceso) {
        this.cargarProcesos(fila.idItemActivity)
          .pipe(first())
          .subscribe((opciones) => {
            fila._opcionesProceso = opciones;
          });
      }
    });
  }
}
