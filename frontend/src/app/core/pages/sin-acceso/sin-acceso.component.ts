import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sin-acceso',
  standalone: false,
  template: `
    <div class="min-h-[60vh] flex items-center justify-center">
      <div class="text-center p-10 bg-white rounded-xl shadow-2xl max-w-md">
        <div class="text-5xl mb-4">🔒</div>
        <h1 class="text-2xl font-bold text-gray-800 mb-2">Sin Acceso</h1>
        <p class="text-gray-500 mb-6">No posee permiso para acceder a este componente del sistema.</p>
        <button
          (click)="volver()"
          class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          Ir a Módulos
        </button>
      </div>
    </div>
  `,
})
export class SinAccesoComponent {
  constructor(private router: Router) {}

  volver(): void {
    this.router.navigate(['/']);
  }
}