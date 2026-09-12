import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SwalService } from '../../core/services/swal.service';

@Component({
  selector: 'app-cambio-password',
  standalone: false,
  templateUrl: './cambio-password.component.html',
})
export class CambioPasswordComponent {
  passwordActual = '';
  passwordNuevo = '';
  passwordConfirmacion = '';
  loading = false;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly swal: SwalService,
  ) {}

  private validar(): string[] {
    const errores: string[] = [];
    if (!this.passwordActual) errores.push('Ingrese su contraseña actual.');
    if (this.passwordNuevo.length < 8) {
      errores.push('La nueva contraseña debe tener al menos 8 caracteres.');
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(this.passwordNuevo)) {
      errores.push('La nueva contraseña debe contener mayúscula, minúscula y número.');
    }
    if (this.passwordNuevo !== this.passwordConfirmacion) {
      errores.push('La confirmación no coincide con la nueva contraseña.');
    }
    return errores;
  }

  guardar(): void {
    this.loading = true;
    const errores = this.validar();
    if (errores.length) {
      this.loading = false;
      this.swal.advertencia('Valide los datos', errores.join(' · '));
      return;
    }

    this.swal.cargando('Cambiando contraseña...');
    this.auth
      .cambiarPassword({
        passwordActual: this.passwordActual,
        passwordNuevo: this.passwordNuevo,
        passwordConfirmacion: this.passwordConfirmacion,
      })
      .subscribe({
        next: () => {
          this.swal.cerrar();
          this.swal.exito('Contraseña actualizada', 'Ingrese nuevamente con su nueva contraseña.');
          this.auth.clearSession();
          this.router.navigate(['/login']);
        },
        error: (e) => {
          this.swal.cerrar();
          this.loading = false;
          const msg = e?.error?.message;
          this.swal.error('Error', Array.isArray(msg) ? msg.join(' · ') : msg || 'No se pudo cambiar la contraseña');
        },
      });
  }
}
