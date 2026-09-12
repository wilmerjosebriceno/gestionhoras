import { Component, OnInit } from '@angular/core';
import { SghService } from '../services/sgh.service';
import { SwalService } from '../../core/services/swal.service';

type LogoFila = {
  empresa: string;
  nombre: string;
  existe: boolean;
  dataUri: string;
  archivo?: File;
};

@Component({
  selector: 'app-sgh-logos',
  standalone: false,
  templateUrl: './logos.component.html',
})
export class LogosComponent implements OnInit {
  filas: LogoFila[] = [];
  loading = false;
  error = '';
  subiendo = false;

  constructor(private service: SghService, private swal: SwalService) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.error = '';
    this.service.listLogos().subscribe({
      next: (d) => {
        this.filas = d.map((x) => ({ empresa: x.empresa, nombre: x.nombre, existe: x.existe, dataUri: x.dataUri }));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'No se pudieron cargar los logos de las empresas';
      },
    });
  }

  onSeleccionar(fila: LogoFila, input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) return;
    const allowed = /\.(jpe?g|png|gif)$/i;
    if (!allowed.test(file.name)) {
      this.swal.error('Archivo no válido', 'Solo se permiten imágenes .jpg, .jpeg, .png o .gif');
      input.value = '';
      return;
    }
    fila.archivo = file;
    const reader = new FileReader();
    reader.onload = () => (fila.dataUri = reader.result as string);
    reader.readAsDataURL(file);
  }

  subir(fila: LogoFila, input: HTMLInputElement): void {
    if (!fila.archivo) {
      this.swal.error('Seleccione una imagen', `Debe elegir un archivo para ${fila.empresa}`);
      return;
    }
    this.subiendo = true;
    this.service.uploadLogo(fila.empresa, fila.archivo).subscribe({
      next: () => {
        this.subiendo = false;
        this.swal.exito(`Logo de ${fila.empresa} actualizado`);
        this.cargar();
      },
      error: (err) => {
        this.subiendo = false;
        const msg = err.error?.message;
        this.swal.error('Error al subir', Array.isArray(msg) ? msg.join('. ') : (msg || 'No se pudo subir el logo'));
      },
    });
  }
}
