import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async enviarCotizacion(
    destinatario: string,
    asunto: string,
    texto: string,
    pdfBuffer: Buffer,
    nombreArchivo = 'cotizacion.pdf',
  ): Promise<void> {
    const transport = nodemailer.createTransport({
      host: process.env.MAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.MAIL_PORT || '587', 10),
      secure: process.env.MAIL_SECURE === 'true',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    const res = await transport.sendMail({
      from: process.env.MAIL_FROM_NAME ? `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM || process.env.MAIL_USER}>` : (process.env.MAIL_FROM || process.env.MAIL_USER),
      to: destinatario,
      subject: asunto,
      text: texto,
      attachments: [
        {
          filename: nombreArchivo,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    this.logger.log(`Correo enviado a ${destinatario} (id: ${(res as any).messageId})`);
  }
}