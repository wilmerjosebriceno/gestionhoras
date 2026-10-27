import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { AgenteService, MensajeAgente } from './agente.service';

interface Burbuja {
  rol: 'user' | 'assistant' | 'error';
  texto: string;
  herramientas?: string[];
}

@Component({
  selector: 'app-agente-chat',
  standalone: false,
  templateUrl: './agente-chat.component.html',
})
export class AgenteChatComponent implements OnInit {
  abierto = false;
  enviando = false;
  configurado: boolean | null = null;
  borrador = '';
  mensajes: Burbuja[] = [];

  @ViewChild('scroll') scroll?: ElementRef<HTMLDivElement>;

  constructor(private service: AgenteService) {}

  ngOnInit(): void {
    this.service.estado().subscribe({
      next: (r) => (this.configurado = r.configurado),
      error: () => (this.configurado = false),
    });
  }

  toggle(): void {
    this.abierto = !this.abierto;
    if (this.abierto && this.mensajes.length === 0) {
      this.mensajes.push({
        rol: 'assistant',
        texto:
          'Hola, soy el asistente de SIGESP. Puedo consultar información de cotizaciones y de horas/proyectos (proyectos, horas plan vs ejecutadas, actividades y resúmenes de horas). ¿Qué deseas saber?',
      });
    }
    if (this.abierto) this.scrollAbajo();
  }

  enviar(): void {
    const texto = (this.borrador || '').trim();
    if (!texto || this.enviando || this.configurado === false) return;

    this.mensajes.push({ rol: 'user', texto });
    this.borrador = '';
    this.enviando = true;
    this.scrollAbajo();

    const historial: MensajeAgente[] = this.mensajes
      .filter((m) => m.rol === 'user' || m.rol === 'assistant')
      .map((m) => ({ role: m.rol as 'user' | 'assistant', content: m.texto }));

    this.service.chat(historial).subscribe({
      next: (r) => {
        this.mensajes.push({
          rol: 'assistant',
          texto: r.respuesta || '(sin contenido)',
          herramientas: r.herramientasUsadas,
        });
        this.enviando = false;
        this.scrollAbajo();
      },
      error: (err) => {
        this.mensajes.push({
          rol: 'error',
          texto: err?.error?.message || 'Ocurrió un error al consultar el agente.',
        });
        this.enviando = false;
        this.scrollAbajo();
      },
    });
  }

  onEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.enviar();
    }
  }

  limpiar(): void {
    this.mensajes = [];
    this.enviando = false;
    this.abierto = true;
    this.mensajes.push({ rol: 'assistant', texto: 'Conversación reiniciada. ¿Qué deseas consultar?' });
    this.scrollAbajo();
  }

  private scrollAbajo(): void {
    setTimeout(() => {
      const el = this.scroll?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }
}
