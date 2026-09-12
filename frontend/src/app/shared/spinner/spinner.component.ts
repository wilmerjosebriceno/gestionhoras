import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  standalone: false,
  template: `
    <div *ngIf="visible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="bg-white rounded-xl p-6 flex flex-col items-center space-y-3 shadow-xl">
        <div class="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-gray-600 text-sm">{{ message }}</span>
      </div>
    </div>
  `,
})
export class SpinnerComponent {
  @Input() visible = false;
  @Input() message = 'Procesando...';
}
