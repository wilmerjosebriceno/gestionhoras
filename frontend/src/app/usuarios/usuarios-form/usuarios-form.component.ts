import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UsuarioService } from '../../core/services/usuario.service';
import { GrupoService } from '../../core/services/grupo.service';
import { SwalService } from '../../core/services/swal.service';
import { Grupo } from '../../core/models/grupo.model';

@Component({
  selector: 'app-usuarios-form',
  standalone: false,
  templateUrl: './usuarios-form.component.html',
})
export class UsuariosFormComponent implements OnInit {
  dto: any = {
    login: '', password: '', cedula: '', nombres: '', apellidos: '',
    telefono: '', email: '', cargo: '', idGrupo: '', estatus: 1,
  };
  grupos: Grupo[] = [];
  editando = false;
  error = '';
  loading = false;
  private login?: string;

  // Firma digitalizada
  firmaDataUri = '';
  firmaSubiendo = false;
  firmaArchivo: File | null = null;

  constructor(
    private usuarioService: UsuarioService,
    private grupoService: GrupoService,
    private route: ActivatedRoute,
    private router: Router,
    private swal: SwalService,
  ) {}

  ngOnInit(): void {
    this.grupoService.findAll().subscribe((g) => (this.grupos = g));
    this.login = this.route.snapshot.params['login'];
    if (this.login) {
      this.editando = true;
      this.usuarioService.findOne(this.login).subscribe((u) => {
        // Construir un dto limpio: solo los campos que se editan en el formulario
        // (evita enviar idUser/login/adminUser/firma/grupo/etc al actualizar)
        this.dto = {
          login: u.login,
          password: '',
          cedula: u.cedula ?? '',
          nombres: u.nombres ?? '',
          apellidos: u.apellidos ?? '',
          telefono: u.telefono ?? '',
          email: u.email ?? '',
          cargo: u.cargo ?? '',
          idGrupo: u.idGrupo ?? '',
          estatus: u.estatus ?? 1,
        };
      });
      this.usuarioService.getFirma(this.login).subscribe((r) => (this.firmaDataUri = r.dataUri || ''));
    }
  }

  onFirmaSeleccionada(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/image\/(jpeg|png|gif)/.test(file.type)) {
      this.swal.error('Firma', 'Solo se permiten imágenes .jpg, .jpeg, .png o .gif');
      return;
    }
    this.firmaArchivo = file;
  }

  subirFirma(): void {
    if (!this.login || !this.firmaArchivo) return;
    this.firmaSubiendo = true;
    this.usuarioService.subirFirma(this.login, this.firmaArchivo).subscribe({
      next: (r) => {
        this.firmaSubiendo = false;
        this.firmaDataUri = r.dataUri;
        this.firmaArchivo = null;
        this.swal.exito('Firma', 'Firma digitalizada actualizada');
      },
      error: (e) => {
        this.firmaSubiendo = false;
        this.swal.error('Firma', e.error?.message || 'No se pudo subir la firma');
      },
    });
  }

  eliminarFirma(): void {
    if (!this.login) return;
    this.usuarioService.eliminarFirma(this.login).subscribe({
      next: () => {
        this.firmaDataUri = '';
        this.swal.exito('Firma', 'Firma eliminada');
      },
      error: (e) => this.swal.error('Firma', e.error?.message || 'No se pudo eliminar la firma'),
    });
  }

  guardar(): void {
    this.error = '';
    this.loading = true;

    // Mapeo seguro: convertir vacíos opcionales a undefined para no romper
    // la validación (email/IsEmail) ni enviar campos fuera del DTO.
    const email = String(this.dto.email ?? '').trim();
    const base = {
      cedula: this.dto.cedula || undefined,
      nombres: this.dto.nombres || undefined,
      apellidos: this.dto.apellidos || undefined,
      telefono: this.dto.telefono || undefined,
      email: email || undefined,
      cargo: this.dto.cargo || undefined,
      idGrupo: this.dto.idGrupo || undefined,
      estatus: Number(this.dto.estatus),
    };
    const payload = this.editando ? base : { ...base, login: this.dto.login, password: this.dto.password };

    const obs = this.editando
      ? this.usuarioService.update(this.login!, payload as any)
      : this.usuarioService.create(payload as any);
    obs.subscribe({
      next: () => {
        this.swal.exito(this.editando ? 'Usuario actualizado' : 'Usuario creado');
        this.router.navigate(['/sec/usuarios']);
      },
      error: (err) => {
        const msg = err.error?.message;
        this.error = Array.isArray(msg) ? msg.join('. ') : (msg || 'Error al guardar');
        this.swal.error('Error al guardar', Array.isArray(msg) ? msg.join('. ') : (msg || 'No se pudo guardar el usuario'));
        this.loading = false;
      },
    });
  }
}
