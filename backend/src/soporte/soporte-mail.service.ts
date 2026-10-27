import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface CorreoAdjunto {
  filename: string;
  path?: string;
  content?: Buffer;
  contentType?: string;
}

export interface CorreoHtml {
  para: string;
  /** Copia (uno o varios correos). */
  cc?: string | string[];
  asunto: string;
  html: string;
  texto?: string;
  responderA?: string;
  adjuntos?: CorreoAdjunto[];
}

/**
 * Correo saliente de la mesa de ayuda (cartas formales de cierre al cliente).
 *
 * Reutiliza las mismas credenciales SMTP del sistema (MAIL_*), pero con el
 * remitente de Soporte. Si el SMTP no esta configurado, no falla: registra el
 * intento en el log (util en desarrollo).
 */
@Injectable()
export class SoporteMailService {
  private readonly logger = new Logger(SoporteMailService.name);
  private readonly transporte: Transporter | null;
  private readonly remitente: string;

  readonly configurado: boolean;

  constructor() {
    const host = (process.env.MAIL_HOST || '').trim();
    const user = (process.env.MAIL_USER || '').trim();
    const pass = process.env.MAIL_PASS || '';
    const desde = (process.env.MAIL_FROM || user || 'soporte@sigesp.com.ve').trim();

    this.configurado = !!host && !!user;
    this.remitente = `SIGESP Soporte <${desde}>`;

    if (this.configurado) {
      this.transporte = nodemailer.createTransport({
        host,
        port: parseInt(process.env.MAIL_PORT || '587', 10),
        secure: process.env.MAIL_SECURE === 'true',
        auth: { user, pass },
      });
      this.logger.log(`Correo de soporte configurado via ${host}`);
    } else {
      this.transporte = null;
      this.logger.warn('SMTP no configurado: las cartas de cierre no se enviaran');
    }
  }

  /** Envia un correo HTML. Devuelve si salio o si quedo simulado (sin SMTP). */
  async enviar(correo: CorreoHtml): Promise<{ enviado: boolean; simulado: boolean }> {
    if (!this.transporte) {
      this.logger.warn(
        `[CORREO NO ENVIADO] Para: ${correo.para} | Asunto: ${correo.asunto}`,
      );
      return { enviado: false, simulado: true };
    }

    try {
      const res = await this.transporte.sendMail({
        from: this.remitente,
        to: correo.para,
        cc: correo.cc,
        replyTo: correo.responderA,
        subject: correo.asunto,
        html: correo.html,
        text: correo.texto,
        attachments: correo.adjuntos,
      });
      this.logger.log(`Carta enviada a ${correo.para} (id: ${(res as any).messageId})`);
      return { enviado: true, simulado: false };
    } catch (e: any) {
      this.logger.error(`Error enviando correo a ${correo.para}: ${e?.message ?? e}`);
      throw new BadRequestException(`No se pudo enviar el correo: ${e?.message ?? e}`);
    }
  }
}
