import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Proyecto } from './entities/proyecto.entity';
import { LogosService, empresaKey } from './logos.service';

type FilaReporte = {
  name?: string;
  numdoc?: string;
  dateDocument?: string;
  nameProcess?: string;
  nameUser?: string;
  nameType?: string;
  situation?: string;
  detalleNota?: string;
  note?: string;
  hours?: number | string;
  mantis?: string;
  status?: number;
};

/**
 * Genera PDFs (pdfmake) replicando la metodología y el formato del sistema
 * anterior (mPDF - "INFORME DIARIO DE ACTIVIDADES" y reporte de actividades).
 * Lee de la BD V5 (misma del backend) vía TypeORM, por lo que incluye
 * actividades recién guardadas.
 */
@Injectable()
export class PdfReportsService {
  private readonly logger = new Logger(PdfReportsService.name);
  private printer: any;

  constructor(
    @InjectRepository(Proyecto)
    private readonly proyectoRepo: Repository<Proyecto>,
    private readonly logos: LogosService,
  ) {}

  private getPrinter(): any {
    if (this.printer) return this.printer;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PdfPrinter = require('pdfmake');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vfsRaw = require('pdfmake/build/vfs_fonts.js');
    const vfs = vfsRaw?.pdfMake?.vfs ?? vfsRaw;
    const b64 = (k: string) => Buffer.from(vfs[k], 'base64');
    const fonts = {
      Roboto: {
        normal: b64('Roboto-Regular.ttf'),
        bold: b64('Roboto-Medium.ttf'),
        italics: b64('Roboto-Italic.ttf'),
        bolditalics: b64('Roboto-MediumItalic.ttf'),
      },
    };
    this.printer = new PdfPrinter(fonts);
    return this.printer;
  }

  private async buildBuffer(dd: any): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = this.getPrinter().createPdfKitDocument(dd);
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  private num(n: number | string | null | undefined): string {
    const v = Number(n || 0);
    return v.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /** Formato "INFORME DIARIO DE ACTIVIDADES" de una actividad (formato legacy). */
  async actividad(a: any): Promise<Buffer> {
    // Empresa del proyecto asociado a la actividad (para imprimir su logo)
    let enterprise: number | null | undefined = undefined;
    if (a.idProyect && Number(a.idProyect) !== 0) {
      const proy = await this.proyectoRepo.findOne({ where: { idProyect: Number(a.idProyect) } });
      enterprise = proy?.enterprise;
    }
    const logo = this.logos.getLogoDataUri(enterprise);

    const head = {
      numdoc: a.numdoc,
      nameType: a.tipo?.nameType ?? '',
      cliente: a.cliente?.name ?? '',
      consultor: a.usuario?.nameUser ?? '',
      fecha: this.fecha(a.dateDocument),
      hora: a.hourDocument ?? '',
    };
    const detalles = (a.detalles ?? []) as any[];
    let total = 0;
    const body: any[][] = detalles.map((d) => {
      total += Number(d.hours || 0);
      return [
        { text: d.itemActividad?.name ?? '', alignment: 'center' },
        { text: d.proceso?.nameProcess ?? '', alignment: 'center' },
        { text: d.situation ?? '', alignment: 'center' },
        { text: d.note ?? '' },
        { text: this.num(d.hours), alignment: 'center' },
      ];
    });
    body.push([
      { text: '', colSpan: 3, alignment: 'center' },
      {},
      {},
      { text: 'TOTAL', bold: true, alignment: 'center', style: 'total' },
      { text: this.num(total), bold: true, alignment: 'center', style: 'total' },
    ]);

    const file = a.metadata?.[0]?.file ?? '';

    const dd = {
      pageSize: 'LETTER',
      pageMargins: [40, 48, 30, 40],
      defaultStyle: { font: 'Roboto', fontSize: 8 },
      content: [
        ...(logo.existe && logo.dataUri
          ? [{ image: logo.dataUri, width: 120, alignment: 'left', margin: [0, 0, 0, 8] }]
          : []),
        { text: 'Fecha : ' + head.fecha, alignment: 'right' },
        { text: 'Hora : ' + head.hora, alignment: 'right', margin: [0, 2, 0, 8] },
        {
          table: {
            widths: ['20%', '80%'],
            body: [[
              { text: 'DOCUMENTO:', fontSize: 7, color: '#555555', bold: true },
              { text: 'Nro. : ' + head.numdoc + '\nTipo : ' + head.nameType + '\nCliente : ' + head.cliente + '\nConsultor : ' + head.consultor, margin: [0, 4, 0, 0] },
            ]],
          },
          layout: {
            hLineWidth: () => 0.4,
            vLineWidth: () => 0.4,
            hLineColor: () => '#888888',
            vLineColor: () => '#888888',
            paddingLeft: () => 10,
            paddingRight: () => 10,
            paddingTop: () => 8,
            paddingBottom: () => 8,
          },
        },
        { text: '', margin: [0, 4] },
        {
          table: {
            headerRows: 1,
            widths: ['12%', '12%', '16%', '50%', '10%'],
            body: [
              [
                { text: 'Actividad', style: 'th' },
                { text: 'Modulo', style: 'th' },
                { text: 'Situacion', style: 'th' },
                { text: 'Nota', style: 'th' },
                { text: 'Horas', style: 'th' },
              ],
              ...body,
            ],
          },
          layout: {
            hLineWidth: () => 0.3,
            vLineWidth: () => 0.3,
            hLineColor: () => '#888888',
            vLineColor: () => '#888888',
            paddingLeft: () => 6,
            paddingRight: () => 6,
            paddingTop: () => 5,
            paddingBottom: () => 5,
          },
        },
        ...(file
          ? [
              { text: '', margin: [0, 6] },
              {
                table: {
                  widths: ['*'],
                  body: [[{ text: 'Archivo Adjunto', style: 'th' }], [{ text: file, margin: [6, 5] }]],
                },
                layout: {
                  hLineWidth: () => 0.3,
                  vLineWidth: () => 0.3,
                  hLineColor: () => '#888888',
                  vLineColor: () => '#888888',
                },
              },
            ]
          : []),
        { text: '', margin: [0, 10] },
        {
          table: {
            widths: ['*', '*'],
            body: [
              [
                { text: 'DATOS DEL CONSULTOR:\n\n\n\nFirma del Consultor :\n\n\n\n', margin: [10, 8] },
                { text: 'DATOS DEL CLIENTE\n\n\nNombre y Apellido :\n\nFirma :\n\nSello :\n\n', margin: [10, 8] },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.4,
            vLineWidth: () => 0.4,
            hLineColor: () => '#888888',
            vLineColor: () => '#888888',
            paddingLeft: () => 10,
            paddingRight: () => 10,
            paddingTop: () => 8,
            paddingBottom: () => 8,
          },
        },
      ],
      styles: {
        th: { bold: true, color: '#000000' },
        total: { fontSize: 8.5 },
      },
    };
    return this.buildBuffer(dd);
  }

  /** Reporte de actividades con filtros (equivalente al reporte integral). */
  async reporte(filas: FilaReporte[]): Promise<Buffer> {
    let total = 0;
    const body = filas.map((f) => {
      total += Number(f.hours || 0);
      return [
        { text: f.numdoc ?? '', alignment: 'center' },
        { text: f.name ?? '', alignment: 'center' },
        { text: f.nameType ?? '', alignment: 'center' },
        { text: f.nameProcess ?? '', alignment: 'center' },
        { text: f.nameUser ?? '', alignment: 'center' },
        { text: this.fecha(f.dateDocument), alignment: 'center' },
        { text: f.situation ?? '', alignment: 'center' },
        { text: f.mantis ?? '', alignment: 'center' },
        { text: this.num(f.hours), alignment: 'center' },
        { text: f.status === 0 ? 'A' : f.status === 1 ? 'P' : 'AN', alignment: 'center' },
      ];
    });

    const dd = {
      pageSize: 'LETTER',
      pageOrientation: 'landscape',
      pageMargins: [30, 40, 30, 40],
      defaultStyle: { font: 'Roboto', fontSize: 8 },
      content: [
        { text: 'REPORTE DE ACTIVIDADES', fontSize: 15, bold: true, alignment: 'center' },
        { text: '', margin: [0, 4] },
        {
          table: {
            headerRows: 1,
            widths: ['10%', '14%', '10%', '12%', '12%', '9%', '9%', '8%', '7%', '6%'],
            body: [
              [
                { text: 'Documento', style: 'th' },
                { text: 'Cliente', style: 'th' },
                { text: 'Tipo', style: 'th' },
                { text: 'Modulo/Proceso', style: 'th' },
                { text: 'Consultor', style: 'th' },
                { text: 'Fecha', style: 'th' },
                { text: 'Situacion', style: 'th' },
                { text: 'Mantis', style: 'th' },
                { text: 'Horas', style: 'th' },
                { text: 'St', style: 'th' },
              ],
              ...body,
            ],
          },
          layout: {
            hLineWidth: () => 0.3,
            vLineWidth: () => 0.3,
            hLineColor: () => '#888888',
            vLineColor: () => '#888888',
            paddingLeft: () => 4,
            paddingRight: () => 4,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
        },
        filas.length
          ? { text: 'TOTAL HORAS: ' + this.num(total), bold: true, margin: [0, 10, 0, 0], alignment: 'right' }
          : { text: 'No hay registros para los parámetros seleccionados', alignment: 'center', margin: [0, 20, 0, 0] },
      ],
      styles: { th: { bold: true } },
    };
    return this.buildBuffer(dd);
  }

  /** Color del estado (semáforo) por fase, según el reporte anterior. */
  private colorEstado(h: number, hE: number): string {
    if (h === 0) {
      return hE > 0 ? '#FF4444' : '#F3F1F8';
    }
    if (hE === 0) return '#F3F1F8';
    const calc = h / hE;
    if (calc < 1) return '#FF4444'; // sobre-ejecutado
    if (calc === 1) return '#44CC44'; // completo
    return '#F7F312'; // en avance (menor a lo contratado)
  }

  /** Formato "GESTION PROYECTO": horas contratadas vs ejecutadas por fase. */
  async proyecto(proyecto: any, filas: any[]): Promise<Buffer> {
    const cliente = proyecto.cliente ?? {};
    const logo = this.logos.getLogoDataUri(proyecto.enterprise);
    const head = {
      numdoc: proyecto.numdoc ?? '',
      rif: cliente.rif ?? '',
      nameEmpresa: cliente.name ?? '',
      dateProyect: this.fecha(proyecto.dateProyect),
      dateIni: this.fecha(proyecto.dateIni),
      dateFin: this.fecha(proyecto.dateFin),
      servicio: empresaKey(proyecto.enterprise),
      denstatus: proyecto.status === 1 ? 'ACTIVO' : 'INACTIVO',
      hora: this.horaActual(),
    };

    let total = 0;
    let totalEjec = 0;
    const body: any[][] = (filas ?? []).map((f) => {
      const h = Number(f.hour || 0);
      const hE = Number(f.hourE || 0);
      total += h;
      totalEjec += hE;
      return [
        { text: f.name ?? '', alignment: 'center' },
        { text: f.nameProcess ?? '', alignment: 'center' },
        { text: this.num(h), alignment: 'center' },
        { text: this.num(hE), alignment: 'center' },
        { text: ' ', alignment: 'center', fillColor: this.colorEstado(h, hE) },
      ];
    });
    const pct = total ? Math.round((totalEjec / total) * 10000) / 100 : 0;
    body.push([
      { text: '', alignment: 'center' },
      { text: 'TOTAL', bold: true, alignment: 'center' },
      { text: this.num(total), bold: true, alignment: 'center' },
      { text: this.num(totalEjec), bold: true, alignment: 'center' },
      { text: this.num(pct) + ' %', bold: true, alignment: 'center' },
    ]);

    const border = {
      hLineWidth: () => 0.4,
      vLineWidth: () => 0.4,
      hLineColor: () => '#888888',
      vLineColor: () => '#888888',
      paddingLeft: () => 10,
      paddingRight: () => 10,
      paddingTop: () => 8,
      paddingBottom: () => 8,
    };
    const tableBorder = {
      hLineWidth: () => 0.3,
      vLineWidth: () => 0.3,
      hLineColor: () => '#888888',
      vLineColor: () => '#888888',
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 5,
      paddingBottom: () => 5,
    };

    const dd = {
      pageSize: 'LETTER',
      pageMargins: [40, 48, 30, 40],
      defaultStyle: { font: 'Roboto', fontSize: 8 },
      content: [
        ...(logo.existe && logo.dataUri
          ? [{ image: logo.dataUri, width: 120, alignment: 'left', margin: [0, 0, 0, 8] }]
          : []),
        { text: 'Fecha : ' + head.dateProyect, alignment: 'right' },
        { text: 'Hora : ' + head.hora, alignment: 'right', margin: [0, 2, 0, 8] },
        {
          table: {
            widths: ['30%', '70%'],
            body: [[
              { text: 'PROYECTO:', fontSize: 7, color: '#555555', bold: true },
              {
                text:
                  'Nro. : ' + head.numdoc +
                  '\nRIF : ' + head.rif +
                  '\nCliente : ' + head.nameEmpresa +
                  '\nFecha Inicial : ' + head.dateIni +
                  '\nFecha Final : ' + head.dateFin +
                  '\nServicio : ' + head.servicio +
                  '\nEstatus : ' + head.denstatus,
                margin: [0, 4, 0, 0],
              },
            ]],
          },
          layout: border,
        },
        { text: '', margin: [0, 6] },
        {
          table: {
            headerRows: 1,
            widths: ['28%', '28%', '12%', '12%', '8%'],
            body: [
              [
                { text: 'Actividad', style: 'th' },
                { text: 'Modulo/Proceso', style: 'th' },
                { text: 'Horas\nContratadas', style: 'th', alignment: 'center' },
                { text: 'Ejecutadas', style: 'th', alignment: 'center' },
                { text: 'Estado', style: 'th', alignment: 'center' },
              ],
              ...body,
            ],
          },
          layout: tableBorder,
        },
        { text: '', margin: [0, 10] },
        {
          table: {
            widths: ['*', '*'],
            body: [
              [
                { text: 'DATOS DEL CONSULTOR:\n\n\n\nFirma del Consultor :\n\n\n\n', margin: [10, 8] },
                { text: 'DATOS DEL CLIENTE\n\n\nNombre y Apellido :\n\nFirma :\n\nSello :\n\n', margin: [10, 8] },
              ],
            ],
          },
          layout: border,
        },
      ],
      styles: { th: { bold: true } },
    };
    return this.buildBuffer(dd);
  }

  /** Formato de habilitación de la generación de tickets vía web (por institución/cliente). */
  async formatoHabilitacionCliente(cliente: any): Promise<Buffer> {
    const logo = this.logos.getLogoDataUri(undefined);

    const celdaEtq = (t: string) => ({
      text: t,
      bold: true,
      color: '#334155',
      fillColor: '#f1f5f9',
      margin: [0, 6, 0, 6],
    });
    const celdaValor = (t: string) => ({ text: t || ' ', bold: true, margin: [0, 6, 0, 6] });
    const celdaBlanca = () => ({ text: ' ', margin: [0, 12, 0, 12] });
    const layoutTabla = {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#cbd5e1',
      vLineColor: () => '#cbd5e1',
    };

    const dd = {
      pageSize: 'LETTER',
      pageMargins: [48, 48, 48, 46],
      defaultStyle: { font: 'Roboto', fontSize: 10, color: '#1e293b' },
      content: [
        ...(logo.existe && logo.dataUri
          ? [{ image: logo.dataUri, width: 130, alignment: 'left', margin: [0, 0, 0, 6] }]
          : [
              {
                text: 'SIGESP, C.A.',
                bold: true,
                fontSize: 16,
                color: '#0f2f5f',
                margin: [0, 0, 0, 6],
              },
            ]),
        {
          canvas: [
            { type: 'line', x1: 0, y1: 0, x2: 516, y2: 0, lineWidth: 1.2, lineColor: '#0f2f5f' },
          ],
          margin: [0, 0, 0, 14],
        },
        {
          text: 'FORMATO DE HABILITACIÓN',
          bold: true,
          fontSize: 15,
          color: '#0f2f5f',
          alignment: 'center',
        },
        {
          text: 'Generación de Tickets vía Página Web',
          fontSize: 11,
          color: '#475569',
          alignment: 'center',
          margin: [0, 2, 0, 4],
        },
        {
          text: `Fecha de emisión: ${this.fecha(new Date().toISOString())}`,
          alignment: 'right',
          fontSize: 9,
          color: '#64748b',
          margin: [0, 0, 0, 18],
        },

        {
          text: 'Datos de la institución',
          bold: true,
          fontSize: 12,
          color: '#0f2f5f',
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            widths: [150, '*'],
            body: [
              [celdaEtq('Razón social'), celdaValor(cliente?.name ?? '')],
              [celdaEtq('RIF'), celdaValor(cliente?.rif ?? '')],
            ],
          },
          layout: layoutTabla,
          margin: [0, 0, 0, 18],
        },

        {
          text: 'Datos de contacto a registrar',
          bold: true,
          fontSize: 12,
          color: '#0f2f5f',
          margin: [0, 0, 0, 2],
        },
        { text: 'Complete los siguientes campos:', fontSize: 9, color: '#64748b', margin: [0, 0, 0, 8] },
        {
          table: {
            widths: [150, '*'],
            body: [
              [celdaEtq('Contacto'), celdaBlanca()],
              [celdaEtq('Teléfono de contacto'), celdaBlanca()],
              [celdaEtq('Correo electrónico'), celdaBlanca()],
            ],
          },
          layout: layoutTabla,
          margin: [0, 0, 0, 20],
        },

        {
          text: 'Por medio del presente, la institución arriba identificada formaliza la habilitación del proceso de generación de tickets a través de la página web de la Mesa de Ayuda de SIGESP, y designa los datos de contacto indicados para la gestión y notificación de sus incidencias y requerimientos.',
          fontSize: 10,
          alignment: 'justify',
          lineHeight: 1.4,
          margin: [0, 0, 0, 28],
        },

        {
          text: 'Conformidad de la institución',
          bold: true,
          fontSize: 12,
          color: '#0f2f5f',
          margin: [0, 0, 0, 28],
        },
        {
          columns: [
            {
              width: '50%',
              stack: [
                {
                  canvas: [
                    { type: 'line', x1: 0, y1: 0, x2: 210, y2: 0, lineWidth: 0.8, lineColor: '#94a3b8' },
                  ],
                },
                { text: 'Nombre y apellido', fontSize: 9, color: '#64748b', margin: [0, 4, 0, 0] },
                { text: 'C.I.: ____________________', fontSize: 9, color: '#64748b', margin: [0, 12, 0, 0] },
                { text: 'Cargo: ___________________', fontSize: 9, color: '#64748b', margin: [0, 10, 0, 0] },
              ],
            },
            {
              width: '50%',
              stack: [
                {
                  canvas: [
                    { type: 'line', x1: 0, y1: 0, x2: 210, y2: 0, lineWidth: 0.8, lineColor: '#94a3b8' },
                  ],
                },
                { text: 'Firma y sello', fontSize: 9, color: '#64748b', margin: [0, 4, 0, 0] },
                { text: 'Fecha: __________________', fontSize: 9, color: '#64748b', margin: [0, 12, 0, 0] },
              ],
            },
          ],
        },
      ],
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          {
            text: 'SIGESP, C.A. · Mesa de Ayuda y Soporte · soporte@sigesp.com.ve',
            fontSize: 8,
            color: '#94a3b8',
            margin: [48, 0, 0, 0],
          },
          {
            text: `Página ${currentPage} de ${pageCount}`,
            fontSize: 8,
            color: '#94a3b8',
            alignment: 'right',
            margin: [0, 0, 48, 0],
          },
        ],
      }),
    };

    return this.buildBuffer(dd);
  }

  private horaActual(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  private fecha(f: Date | string | undefined): string {
    if (!f) return '';
    // Las columnas `date` llegan como "YYYY-MM-DD". Se formatean directo para
    // evitar el desfase de 1 dia que provoca `new Date("YYYY-MM-DD")` (UTC)
    // seguido de getters locales (America/Caracas, UTC-4).
    if (typeof f === 'string') {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f);
      if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    }
    const d = new Date(f);
    if (isNaN(d.getTime())) return String(f);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  }
}
