import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SwalService } from '../../core/services/swal.service';
import { LoginRequest } from '../../core/models/auth.model';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
})
export class LoginComponent {
  login: LoginRequest = { login: '', password: '' };
  loading = false;
  error = '';

  constructor(
    private authService: AuthService,
    private swal: SwalService,
    private router: Router,
  ) {}

  onSubmit(): void {
    this.loading = true;
    this.error = '';
    this.authService.login(this.login).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.mustChangePassword) {
          this.swal
            .advertencia(
              'Debe cambiar su contraseña',
              'La contraseña actual es la predeterminada (123). Por seguridad, cámbiela antes de continuar.',
            )
            .then(() => this.router.navigate(['/sec/cambio-password']));
          return;
        }
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.loading = false;
        const msg = err.error?.message;
        this.error = Array.isArray(msg) ? msg.join('. ') : (msg || 'Error al iniciar sesión');
      },
    });
  }
}
