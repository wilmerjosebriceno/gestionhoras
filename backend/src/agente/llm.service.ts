import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { env } from '../config/env.config';
import { MensajeLlm } from './agente.tipos';

/**
 * Cliente mínimo para APIs de chat compatibles con OpenAI.
 * Funciona con OpenCode Zen (https://opencode.ai/zen/v1) u otro proveedor
 * compatible (OpenAI, Groq, Ollama, etc.) sin dependencias externas.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  get configurado(): boolean {
    return env.agente.enabled && !!env.agente.apiKey;
  }

  /** Ejecuta una llamada de chat completions y devuelve el mensaje del asistente. */
  async completar(
    mensajes: MensajeLlm[],
    herramientas: any[] = [],
  ): Promise<MensajeLlm> {
    if (!this.configurado) {
      throw new ServiceUnavailableException(
        'El agente de IA no está configurado (defina AGENTE_API_KEY)',
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.agente.timeoutMs);

    try {
      const respuesta = await fetch(`${env.agente.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.agente.apiKey}`,
        },
        body: JSON.stringify({
          model: env.agente.model,
          messages: mensajes,
          temperature: env.agente.temperature,
          ...(herramientas.length
            ? { tools: herramientas, tool_choice: 'auto' }
            : {}),
        }),
        signal: controller.signal,
      });

      if (!respuesta.ok) {
        const detalle = await respuesta.text();
        this.logger.error(`LLM ${respuesta.status}: ${detalle}`);
        throw new ServiceUnavailableException(this.mensajeError(respuesta.status));
      }

      const data: any = await respuesta.json();
      const mensaje = data?.choices?.[0]?.message;
      if (!mensaje) {
        throw new ServiceUnavailableException('El servicio de IA no devolvió respuesta');
      }
      return mensaje as MensajeLlm;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new ServiceUnavailableException('El servicio de IA tardó demasiado en responder');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Mensaje amigable segun el codigo HTTP del proveedor de IA. */
  private mensajeError(status: number): string {
    switch (status) {
      case 401:
        return 'La clave del servicio de IA es inválida o expiró.';
      case 402:
        return 'La cuenta del proveedor de IA no tiene saldo disponible.';
      case 403:
        return 'El modelo de IA seleccionado no está habilitado para esta cuenta (revise AGENTE_MODEL).';
      case 404:
        return 'El modelo de IA indicado (AGENTE_MODEL) no existe en el proveedor.';
      case 429:
        return 'Se superó el límite de solicitudes del proveedor de IA. Intente en unos segundos.';
      default:
        return 'El servicio de IA devolvió un error. Intente nuevamente.';
    }
  }
}
