import { Component, Input, Output, EventEmitter } from '@angular/core';
import { PermisoItem } from '../../core/models/permiso.model';

@Component({
  selector: 'app-permisos-grid',
  standalone: false,
  templateUrl: './permisos-grid.component.html',
})
export class PermisosGridComponent {
  @Input() permisos: PermisoItem[] = [];
  @Output() save = new EventEmitter<PermisoItem[]>();
}
