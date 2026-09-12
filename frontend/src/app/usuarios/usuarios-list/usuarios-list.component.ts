import { Component, OnInit } from '@angular/core';
import { UsuarioService } from '../../core/services/usuario.service';
import { SwalService } from '../../core/services/swal.service';
import { AuthService } from '../../core/services/auth.service';
import { Usuario, QueryUsuario } from '../../core/models/usuario.model';

@Component({
  selector: 'app-usuarios-list',
  standalone: false,
  templateUrl: './usuarios-list.component.html',
})
export class UsuariosListComponent implements OnInit {
  usuarios: Usuario[] = [];
  filtros: QueryUsuario = {};
  meta = { total: 0, page: 1, limit: 25, totalPages: 0 };
  loading = false;
  private timeout: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private service: UsuarioService,
    private swal: SwalService,
    private authService: AuthService,
  ) {}

  get esAdmin(): boolean {
    return this.authService.currentUser?.adminUser === 1;
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.service.findAll({ ...this.filtros, page: this.meta.page }).subscribe({
      next: (r) => {
        this.usuarios = r.data;
        this.meta = r.meta;
      },
      error: () => (this.loading = false),
      complete: () => (this.loading = false),
    });
  }

  buscar(): void {
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      this.meta.page = 1;
      this.cargar();
    }, 300);
  }

  cambiarPagina(delta: number): void {
    this.meta.page += delta;
    this.cargar();
  }

  async eliminar(u: Usuario): Promise<void> {
    const ok = await this.swal.confirmar({
      titulo: `¿Eliminar usuario ${u.login}?`,
      textoConfirmar: 'Sí, eliminar',
    });
    if (!ok) return;
    this.loading = true;
    this.service.remove(u.login).subscribe({
      next: () => this.swal.exito('Usuario eliminado'),
      error: (err) => {
        this.loading = false;
        const msg = err.error?.message;
        this.swal.error('Error al eliminar', Array.isArray(msg) ? msg.join('. ') : (msg || 'No se pudo eliminar el usuario'));
      },
      complete: () => {
        this.loading = false;
        this.cargar();
      },
    });
  }

  async resetear(u: Usuario): Promise<void> {
    const ok = await this.swal.confirmar({
      titulo: `¿Resetear contraseña de ${u.login}?`,
      texto: 'Se restablecerá a la contraseña predeterminada "123". El usuario deberá cambiarla en su próximo inicio de sesión.',
      textoConfirmar: 'Sí, resetear',
    });
    if (!ok) return;
    this.loading = true;
    this.service.resetPassword(u.login).subscribe({
      next: (r) => this.swal.exito('Contraseña reseteada', r.message),
      error: (err) => {
        this.loading = false;
        const msg = err.error?.message;
        this.swal.error('Error al resetear', Array.isArray(msg) ? msg.join('. ') : (msg || 'No se pudo resetear la contraseña'));
      },
      complete: () => (this.loading = false),
    });
  }

  /** Backfill: sincroniza la firma de los usuarios desde storage/firmas. */
  async sincronizarFirmas(): Promise<void> {
    const ok = await this.swal.confirmar({
      titulo: 'Sincronizar firmas',
      texto: 'Actualiza el campo de firma de los usuarios a partir de las imágenes existentes en storage/firmas.',
      textoConfirmar: 'Sí, sincronizar',
    });
    if (!ok) return;
    this.loading = true;
    this.service.sincronizarFirmas().subscribe({
      next: (r) => this.swal.exito('Firmas sincronizadas', `${r.actualizados} de ${r.revisados} archivos actualizados`),
      error: (err) => {
        this.loading = false;
        const msg = err.error?.message;
        this.swal.error('Error al sincronizar', Array.isArray(msg) ? msg.join('. ') : (msg || 'No se pudieron sincronizar las firmas'));
      },
      complete: () => {
        this.loading = false;
        this.cargar();
      },
    });
  }
}
