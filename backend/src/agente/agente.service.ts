import { Injectable } from '@nestjs/common';
import { env } from '../config/env.config';
import { LlmService } from './llm.service';
import { AgenteTools } from './agente.tools';
import { ChatAgenteDto } from './dto/chat.dto';
import { ContextoHerramienta, MensajeLlm } from './agente.tipos';

const SYSTEM_PROMPT = `Eres el asistente de IA del sistema SIGESP (empresa de servicios).
Respondes en español, de forma clara y breve.

Alcance actual (Fase 1): SOLO CONSULTAS DE LECTURA. No puedes crear, modificar ni eliminar registros.
Si el usuario pide ejecutar una acción, indícalo con amabilidad: por ahora solo puedes consultar información.

Puedes consultar:
- Cotizaciones: listados, detalle, KPIs, vencidas, clientes, regiones, plantillas y tasas de IVA.
- Horas / Gestión de proyectos: proyectos, detalle de proyecto (horas plan vs ejecutadas),
  actividades registradas, resumen de horas por usuario/proyecto/cliente y clientes.

Reglas:
- Usa las herramientas disponibles para obtener datos reales; nunca inventes cifras ni nombres.
- Para reportes de incidencias/bugs de MantisBT usa filtros_mantis (catálogos de proyectos/usuarios/estados),
  consultar_issues_mantis (lista) y resumen_issues_mantis (agregados). Si el usuario da nombres,
  primero usa filtros_mantis para obtener los IDs.
- Solo dispones de las herramientas de los módulos a los que tu perfil tiene acceso.
  Si no puedes consultar un módulo, indica con claridad que no tienes acceso a esa información.
- Las herramientas respetan los permisos del usuario: si no es administrador, solo verá sus
  propios registros de horas. Si una herramienta devuelve "sin permisos", infórmalo con transparencia.
- Si una herramienta devuelve un error o vacío, dilo con transparencia.
- Cuando tenga sentido, presenta los resultados en tablas markdown compactas.
- Los montos están en USD salvo que se indique lo contrario.
- Las fechas usan formato YYYY-MM-DD.
- Si la pregunta es ambigua (por ejemplo, un rango de fechas), pide la aclaración necesaria o usa un criterio razonable y explícalo.`;

@Injectable()
export class AgenteService {
  constructor(
    private readonly llm: LlmService,
    private readonly tools: AgenteTools,
  ) {}

  configurado(): boolean {
    return this.llm.configurado;
  }

  async chat(dto: ChatAgenteDto, ctx: ContextoHerramienta) {
    const mensajes: MensajeLlm[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(dto.contexto
        ? [{ role: 'system' as const, content: `Contexto de pantalla: ${dto.contexto}` }]
        : []),
      ...dto.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const permitidas = await this.tools.permitidas(ctx.login);
    const definiciones = this.tools.definiciones(permitidas);
    const usadas = new Set<string>();
    let pasos = 0;

    while (pasos < env.agente.maxSteps) {
      pasos++;
      const mensaje = await this.llm.completar(mensajes, definiciones);
      mensajes.push(mensaje);

      const llamadas = mensaje.tool_calls ?? [];
      if (!llamadas.length) {
        return {
          respuesta: mensaje.content ?? '',
          pasos,
          herramientasUsadas: [...usadas],
        };
      }

      for (const llamada of llamadas) {
        usadas.add(llamada.function.name);
        const resultado = await this.tools.ejecutar(
          llamada.function.name,
          llamada.function.arguments,
          ctx,
        );
        mensajes.push({
          role: 'tool',
          tool_call_id: llamada.id,
          name: llamada.function.name,
          content: JSON.stringify(resultado),
        });
      }
    }

    return {
      respuesta:
        'No pude completar la consulta dentro del límite de pasos. Intenta reformular la pregunta.',
      pasos,
      herramientasUsadas: [...usadas],
    };
  }
}
