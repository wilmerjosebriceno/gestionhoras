import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon } from 'sweetalert2';

export interface ConfirmarOpciones {
  titulo: string;
  texto?: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  icono?: SweetAlertIcon;
}

export interface EntradaOpciones {
  titulo: string;
  texto?: string;
  placeholder?: string;
  valor?: string;
  textoConfirmar?: string;
}

export interface TextoLargoOpciones {
  titulo: string;
  valor?: string;
  alturaFilas?: number;
}

@Injectable({ providedIn: 'root' })
export class SwalService {
  private toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
  });

  exito(titulo: string, texto?: string): Promise<unknown> {
    return this.toast.fire({ icon: 'success', title: titulo, text: texto });
  }

  info(titulo: string, texto?: string): Promise<unknown> {
    return this.toast.fire({ icon: 'info', title: titulo, text: texto });
  }

  advertencia(titulo: string, texto?: string): Promise<unknown> {
    return Swal.fire({
      icon: 'warning',
      title: titulo,
      text: texto,
      confirmButtonColor: '#d97706',
    });
  }

  error(titulo: string, texto?: string): Promise<unknown> {
    return Swal.fire({
      icon: 'error',
      title: titulo,
      text: texto,
      confirmButtonColor: '#dc2626',
    });
  }

  confirmar(opciones: ConfirmarOpciones): Promise<boolean> {
    return Swal.fire({
      title: opciones.titulo,
      text: opciones.texto,
      icon: opciones.icono ?? 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280',
      confirmButtonText: opciones.textoConfirmar ?? 'Sí, continuar',
      cancelButtonText: opciones.textoCancelar ?? 'Cancelar',
    }).then((r) => r.isConfirmed);
  }

  entrada(opciones: EntradaOpciones): Promise<string | null> {
    return Swal.fire({
      title: opciones.titulo,
      text: opciones.texto,
      input: 'text',
      inputPlaceholder: opciones.placeholder,
      inputValue: opciones.valor,
      inputValidator: (v) => (v && v.trim() ? null : 'El valor es obligatorio'),
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280',
      confirmButtonText: opciones.textoConfirmar ?? 'Aceptar',
    }).then((r) => (r.isConfirmed && r.value ? String(r.value) : null));
  }

  /**
   * Diálogo con un textarea editable y hasta 3 acciones (para el auto-cierre
   * desde Mantis). Devuelve la acción elegida y el texto editado.
   */
  confirmarConTexto(opciones: {
    titulo: string;
    html?: string;
    valor?: string;
    textoPrincipal: string;
    textoSecundario?: string;
    textoCancelar?: string;
    icono?: SweetAlertIcon;
  }): Promise<{ accion: 'principal' | 'secundario' | 'cancelar'; texto: string }> {
    const id = 'swal_texto_accion';
    const estilo =
      'width:100%;box-sizing:border-box;margin:12px 0 0;height:230px;' +
      'min-height:160px;max-height:55vh;resize:vertical;font-size:13px;line-height:1.45;';
    const area =
      `<textarea id="${id}" class="swal2-textarea" style="${estilo}">${opciones.valor ?? ''}</textarea>`;
    const leer = () =>
      (document.getElementById(id) as HTMLTextAreaElement | null)?.value ?? '';
    return Swal.fire({
      title: opciones.titulo,
      html: (opciones.html ?? '') + area,
      icon: opciones.icono,
      width: '80%',
      showDenyButton: !!opciones.textoSecundario,
      showCancelButton: true,
      confirmButtonText: opciones.textoPrincipal,
      denyButtonText: opciones.textoSecundario,
      cancelButtonText: opciones.textoCancelar ?? 'Más tarde',
      confirmButtonColor: '#047857',
      denyButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280',
      focusConfirm: false,
      didOpen: () => {
        const ta = document.getElementById(id) as HTMLTextAreaElement | null;
        ta?.focus();
      },
      preConfirm: leer,
      preDeny: leer,
    }).then((r) => ({
      accion: r.isConfirmed ? 'principal' : r.isDenied ? 'secundario' : 'cancelar',
      texto: typeof r.value === 'string' ? r.value : '',
    }));
  }

  cargando(titulo?: string): void {
    Swal.fire({
      title: titulo ?? 'Procesando...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
  }

  cerrar(): void {
    Swal.close();
  }

  /**
   * Popup de edición de texto largo (réplica de la función `putText` del
   * sistema anterior): ventana amplia con textarea grande y validación de
   * caracteres. Devuelve el texto guardado o `null` si se cancela.
   */
  editarTextoLargo(opciones: TextoLargoOpciones): Promise<string | null> {
    const idTexto = 'ttexto_largo';
    const patronValido = /[^a-zA-Z0-9 @\-()%*#$!:;,+_.\s]/g;
    // La clase .swal2-textarea de SweetAlert2 fija height:6.75em y anula el
    // atributo rows. Se aplica un alto mayor en linea para tener espacio real
    // al registrar notas / situaciones.
    const filas = Math.max(12, opciones.alturaFilas ?? 14);
    const altoPx = filas * 26;
    // SweetAlert2 usa `width:auto` y margenes laterales de 2em en el textarea,
    // por lo que no ocupa el ancho del modal. Se fuerza width:100% y se
    // desactivan esos margenes para que se ajuste a la ventana.
    const estilo =
      'width:100%;box-sizing:border-box;margin:0;' +
      `height:${altoPx}px;min-height:220px;max-height:65vh;` +
      'resize:vertical;font-size:14px;line-height:1.4;';
    return Swal.fire({
      title: opciones.titulo,
      html: `<textarea id="${idTexto}" class="swal2-textarea" rows="${filas}" style="${estilo}">${opciones.valor ?? ''}</textarea>`,
      width: '90%',
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      didOpen: () => {
        const ta = document.getElementById(idTexto) as HTMLTextAreaElement | null;
        ta?.focus();
        ta?.addEventListener('input', () => {
          ta.value = ta.value.replace(patronValido, '');
        });
      },
      preConfirm: () => {
        const ta = document.getElementById(idTexto) as HTMLTextAreaElement | null;
        const v = ta ? ta.value : '';
        if (!v.trim()) {
          Swal.showValidationMessage('El valor es obligatorio');
          return false;
        }
        return v;
      },
    }).then((r) => (r.isConfirmed && typeof r.value === 'string' ? r.value : null));
  }
}
