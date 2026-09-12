import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Budget } from './entities/budget.entity';
import { CotDtBudget } from './entities/cot-dt-budget.entity';
import { CotClient } from './entities/cot-client.entity';
import { CotEmpresa } from './entities/cot-empresa.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';

@Injectable()
export class PdfCotizacionService {
  private readonly logger = new Logger(PdfCotizacionService.name);
  private printer: any;
  private readonly mimes: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif' };

  constructor(
    @InjectRepository(Budget) private readonly budgetRepo: Repository<Budget>,
    @InjectRepository(CotDtBudget) private readonly dtRepo: Repository<CotDtBudget>,
    @InjectRepository(CotClient) private readonly clientRepo: Repository<CotClient>,
    @InjectRepository(CotEmpresa) private readonly empresaRepo: Repository<CotEmpresa>,
    @InjectRepository(Usuario) private readonly userRepo: Repository<Usuario>,
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

  private async buildPdf(dd: any): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = this.getPrinter().createPdfKitDocument(dd);
      const chunks: any[] = [];
      doc.on('data', (c: any) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }

  /** Busca y devuelve el logo de la empresa como dataURI (para pdfmake). */
  private leerLogo(empresa?: CotEmpresa | null): string | null {
    const candidatos: string[] = [];
    if (empresa?.logo) {
      candidatos.push(path.resolve(process.cwd(), 'storage', 'logos-legacy', empresa.logo));
      candidatos.push(path.resolve(process.cwd(), 'storage', 'logos', empresa.logo));
    }
    // Por nombre de empresa
    if (empresa?.company) {
      const byName = empresa.company.toUpperCase().includes('IEAGER') ? 'logo_ieager.jpg'
        : empresa.company.toUpperCase().includes('CHINCHIN') ? 'logo_chinchin.jpg' : 'logo.jpg';
      candidatos.push(path.resolve(process.cwd(), 'storage', 'logos-legacy', byName));
    }
    for (const p of candidatos) {
      try {
        if (fs.existsSync(p)) {
          const ext = path.extname(p).toLowerCase();
          const mime = this.mimes[ext] ?? 'image/jpeg';
          const buf = fs.readFileSync(p);
          return `data:${mime};base64,${buf.toString('base64')}`;
        }
      } catch { /* seguir */ }
    }
    return null;
  }

  /** Directorios candidatos donde se guardan las firmas (según cwd y según el build). */
  private basesFirmas(): string[] {
    const bases = [
      path.resolve(process.cwd(), 'storage', 'firmas'),
      path.resolve(__dirname, '..', '..', 'storage', 'firmas'),
      path.resolve(__dirname, '..', '..', '..', 'storage', 'firmas'),
    ];
    return [...new Set(bases)];
  }

  private leerImagenComoDataUri(p: string): string | null {
    try {
      if (!fs.existsSync(p)) return null;
      const ext = path.extname(p).toLowerCase();
      const mime = this.mimes[ext] ?? 'image/png';
      return `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
    } catch {
      return null;
    }
  }

  /**
   * Devuelve la firma digitalizada del usuario como dataURI (si existe).
   * Estrategia:
   *  1) Si ya viene como dataURI, se usa tal cual.
   *  2) Por nombre de archivo (columna sec_user.firma).
   *  3) Por login: busca "<login>.<ext>" en storage/firmas. Esto cubre el caso
   *     en que la columna `firma` está vacía pero la imagen existe en disco
   *     (igual que lo hace el endpoint getFirma del módulo de usuarios).
   */
  private resolverFirma(firma?: string | null, login?: string | null): string | null {
    if (firma && firma.startsWith('data:image')) return firma;
    // 2) por nombre de archivo en la columna firma
    if (firma) {
      for (const base of this.basesFirmas()) {
        const uri = this.leerImagenComoDataUri(path.join(base, firma));
        if (uri) return uri;
      }
    }
    // 3) por login (robusto ante columna firma vacía)
    const loginNorm = (login || '').trim().toLowerCase();
    if (loginNorm) {
      for (const base of this.basesFirmas()) {
        try {
          if (!fs.existsSync(base)) continue;
          const archivo = fs.readdirSync(base).find((f) => f.toLowerCase().startsWith(`${loginNorm}.`));
          if (archivo) {
            const uri = this.leerImagenComoDataUri(path.join(base, archivo));
            if (uri) return uri;
          }
        } catch { /* seguir */ }
      }
    }
    return null;
  }

  /** Genera el PDF de una cotización con formato elegante. */
  async generarPdf(idCotizacion: number): Promise<Buffer> {
    const cot = await this.budgetRepo.findOne({ where: { idBudget: idCotizacion }, relations: ['client'] });
    if (!cot) throw new NotFoundException('Cotización no encontrada');

    const detalles = await this.dtRepo.find({ where: { idBudget: idCotizacion }, order: { secuencia: 'ASC' }, relations: ['template', 'region', 'tasaIva'] });
    const empresa = await this.empresaRepo.findOne({ where: { idEmpresa: cot.idEmpresa ?? 0 } });
    const cliente = cot.client || (await this.clientRepo.findOne({ where: { idClient: cot.idClient } as any }));
    const logo = this.leerLogo(empresa);

    // Firmante: el usuario que registró la cotización (login en cot_budget.usuario)
    const firmante = cot.usuario ? await this.userRepo.findOne({ where: { login: cot.usuario } }) : null;
    const nombreFirmante = firmante ? [firmante.nombres, firmante.apellidos].filter(Boolean).join(' ').trim() : (cot.usuario || '');
    const cargoFirmante = firmante?.cargo?.trim() || 'Firmante';
    const firmaImg = this.resolverFirma(firmante?.firma, firmante?.login ?? cot.usuario);

    const moneda = (v: number) => (v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Etiqueta corta de IVA por línea: 'Exento' o 'X%'
    const etiquetaIva = (d: any): string => {
      const p = d?.tasaIva ? Number(d.tasaIva.porcentaje) : Number(d?.tax ?? 0);
      if (!p || p === 0) return 'Exento';
      return `${p}%`;
    };

    // Etiqueta del IVA en totales: '0%', '8%', '16%' o '8% + 16%' según tasas aplicadas
    const tasasAplicadas = [...new Set(detalles
      .map((d) => d.tasaIva ? Number(d.tasaIva.porcentaje) : Number(d.tax ?? 0))
      .filter((p) => p > 0))].sort((a, b) => a - b);
    const ivaLabel = tasasAplicadas.length === 0 ? '0%'
      : tasasAplicadas.length === 1 ? `${tasasAplicadas[0]}%`
      : tasasAplicadas.map((r) => `${r}%`).join(' + ');

    const tablaDetalle = detalles.map((d, i) => ([
      { text: String(i + 1), style: 'cellText', alignment: 'center' },
      { text: d.template?.code || '', style: 'cellText', alignment: 'center' },
      { text: d.description || (d.template?.name ?? ''), style: 'cellText', alignment: 'left' },
      { text: d.modalidad ?? '', style: 'cellText', alignment: 'center', fontSize: 8 },
      { text: moneda(Number(d.quantity ?? 0)), style: 'cellTextNum', alignment: 'right' },
      { text: moneda(Number(d.price ?? 0)), style: 'cellTextNum', alignment: 'right' },
      { text: etiquetaIva(d), style: 'cellText', alignment: 'center' },
      { text: moneda(Number(d.subtotal ?? 0)), style: 'cellTextNum', alignment: 'right' },
    ]));

    const logoImage = logo ? { image: logo, width: 56, fit: [56, 40] } : null;

    const headerColumns: any = logoImage
      ? [
          { width: 60, stack: [logoImage] },
        ]
      : [
          {
            width: '*',
            stack: [
              { text: empresa?.company || 'EMPRESA', style: 'empresa' },
              empresa?.telephone ? { text: `Tel: ${empresa.telephone}`, fontSize: 9, color: '#4b5563' } : null,
              empresa?.email ? { text: `Email: ${empresa.email}`, fontSize: 9, color: '#4b5563' } : null,
              empresa?.web ? { text: `Web: ${empresa.web}`, fontSize: 9, color: '#4b5563' } : null,
            ].filter(Boolean),
          },
        ];

    const dd: any = {
      pageSize: 'LETTER',
      pageMargins: [36, 40, 36, 40],
      header: (current: any) => ({
        columns: [
          { text: empresa?.company || '', fontSize: 8, color: '#9ca3af' },
          { text: `Cotización ${cot.codeBudget}`, alignment: 'right', fontSize: 8, color: '#9ca3af' },
        ],
        margin: [36, 12, 36, 0],
      }),
      footer: (current: any, pageCount: any) => ({
        columns: [
          { text: `${empresa?.company || ''} · ${empresa?.email || ''} · Tel: ${empresa?.telephone || ''}`, alignment: 'left', fontSize: 8, color: '#9ca3af' },
          { text: `Página ${current} de ${pageCount}`, alignment: 'right', fontSize: 8, color: '#9ca3af' },
        ],
        margin: [36, 12, 36, 0],
      }),
      content: [
        // Cabecera: logo + empresa (izq) / Título (der)
        {
          columns: [
            ...headerColumns,
            { width: '*', stack: [
              { text: 'COTIZACIÓN', style: 'titulo', alignment: 'right' },
              { text: `No.: ${cot.codeBudget}`, style: 'numCot', alignment: 'right' },
              { text: `Fecha: ${cot.dateBudget}`, style: 'fecha', alignment: 'right' },
              { text: `Vence: ${cot.vencimiento || '—'}`, style: 'fecha', alignment: 'right' },
            ]},
          ],
          margin: [0, 0, 0, 4],
        },
        // Banda de color
        { canvas: [{ type: 'rect', x: 36, y: 0, w: 519, h: 10, r: 2, color: '#1e40af' }], margin: [0, 0, 0, 8] },

        // Datos del cliente
        { text: 'DATOS DEL CLIENTE', style: 'seccion', margin: [0, 6, 0, 2] },
        {
          columns: [
            { width: '*', stack: [
              { text: `Cliente: ${cliente?.nameClient || ''}`, style: 'negrita' },
              { text: `RIF: ${cliente?.rif || '-'}`, fontSize: 9, color: '#374151' },
              { text: `Dirección: ${cliente?.adressClient || '-'}`, fontSize: 9, color: '#374151' },
            ]},
            { width: 'auto', stack: [
              cliente?.contactName ? { text: `Contacto: ${cliente.contactName}`, fontSize: 9, color: '#374151' } : null,
              cliente?.contactPhone ? { text: `Tel: ${cliente.contactPhone}`, fontSize: 9, color: '#374151' } : null,
              cliente?.contactEmail ? { text: `Email: ${cliente.contactEmail}`, fontSize: 9, color: '#374151' } : null,
            ].filter(Boolean)},
          ],
        },

        // Tabla de detalle
        { text: 'DETALLE DE LA COTIZACIÓN', style: 'seccion', margin: [0, 10, 0, 3] },
        {
          table: {
            headerRows: 1,
            widths: [28, 40, '*', 48, 42, 50, 42, 50],
            body: [
              [
                { text: '#', style: 'th', alignment: 'center' },
                { text: 'Cód.', style: 'th', alignment: 'center' },
                { text: 'Descripción / Concepto', style: 'th' },
                { text: 'Modalidad', style: 'th', alignment: 'center' },
                { text: 'Horas', style: 'th', alignment: 'right' },
                { text: 'Precio', style: 'th', alignment: 'right' },
                { text: 'IVA %', style: 'th', alignment: 'center' },
                { text: 'Subtotal', style: 'th', alignment: 'right' },
              ],
              ...tablaDetalle,
            ],
          },
          layout: {
            hLineColor: '#e5e7eb',
            vLineColor: '#f3f4f6',
            hLineWidth: () => 0.6,
            fillColor: (rowIndex: number) => (rowIndex % 2 === 0 ? '#f9fafb' : null),
            paddingTop: () => 2,
            paddingBottom: () => 2,
          },
        },

        // Totales (tabla separada de 2 columnas, alineada a la derecha)
        {
          table: {
            widths: ['*', 'auto'],
            body: [
              [
                { text: 'Subtotal', style: 'totalLabel', alignment: 'right' },
                { text: `$${moneda(Number(cot.montoSubtotal ?? (Number(cot.totalUsd) - Number(cot.ivaUsd))))}`, style: 'totalVal', alignment: 'right' },
              ],
              [
                { text: 'Exento', style: 'totalLabel', alignment: 'right' },
                { text: `$${moneda(Number(cot.montoExento ?? 0))}`, style: 'totalLabel2', alignment: 'right' },
              ],
              [
                { text: 'Base imponible', style: 'totalLabel', alignment: 'right' },
                { text: `$${moneda(Number(cot.montoBaseImponible ?? (Number(cot.totalUsd) - Number(cot.ivaUsd))))}`, style: 'totalLabel2', alignment: 'right' },
              ],
              [
                { text: `IVA (${ivaLabel})`, style: 'totalLabel', alignment: 'right' },
                { text: `$${moneda(Number(cot.montoIva ?? cot.ivaUsd))}`, style: 'totalLabel2', alignment: 'right' },
              ],
              [
                { text: 'TOTAL USD', style: 'totalGrande', alignment: 'right' },
                { text: `$${moneda(Number(cot.montoTotal ?? cot.totalUsd))}`, style: 'totalGrande', alignment: 'right' },
              ],
            ],
          },
          layout: 'noBorders',
          margin: [0, 2, 0, 0],
        },

        // Condiciones
        { text: 'CONDICIONES DE LA COTIZACIÓN', style: 'seccion', margin: [0, 8, 0, 2] },
        {
          columns: [
            { width: '*', stack: [
              cot.soporte ? { text: cot.soporte, style: 'nota' } : null,
              cot.modalidad ? { text: cot.modalidad, style: 'nota', margin: [0, 4, 0, 0] } : null,
              cot.note ? { text: `Observación: ${cot.note}`, style: 'nota', italics: true, margin: [0, 4, 0, 0] } : null,
            ].filter(Boolean)},
          ],
        },

        // Firmante
        {
          columns: [
            { width: '*', stack: [] },
            { width: 210, stack: [
              firmaImg
                ? { image: firmaImg, fit: [180, 40], alignment: 'center' }
                : { canvas: [{ type: 'rect', x: 0, y: 0, w: 180, h: 36, fillColor: '#f9fafb', lineColor: '#d1d5db', lineWidth: 0.6 }] },
              { text: '_____________________', alignment: 'center', color: '#374151', fontSize: 9, margin: [0, 4, 0, 1] },
              { text: nombreFirmante || ' ', style: 'negrita', alignment: 'center' },
              { text: cargoFirmante, alignment: 'center', fontSize: 7.5, color: '#4b5563', margin: [0, 1, 0, 0] },
              { text: 'COTIZACIÓN ELABORADA POR', alignment: 'center', fontSize: 6.5, color: '#9ca3af', margin: [0, 3, 0, 0] },
            ] },
          ],
          margin: [0, 12, 0, 0],
        },
      ],
      styles: {
        empresa: { fontSize: 16, bold: true, color: '#1e40af' },
        titulo: { fontSize: 20, bold: true, color: '#1e40af' },
        numCot: { fontSize: 11, bold: true, color: '#111827', margin: [0, 2, 0, 0] },
        fecha: { fontSize: 8, color: '#6b7280', margin: [0, 1, 0, 0] },
        seccion: { fontSize: 10, bold: true, color: '#1e3a8a', margin: [0, 0, 0, 0] },
        negrita: { fontSize: 9, bold: true, color: '#111827' },
        th: { fontSize: 8, bold: true, color: '#ffffff', fillColor: '#1e40af' },
        cellText: { fontSize: 8, color: '#1f2937' },
        cellTextNum: { fontSize: 8, color: '#1f2937' },
        totalLabel: { fontSize: 8, bold: true, color: '#374151' },
        totalLabel2: { fontSize: 8, bold: true, color: '#4b5563' },
        totalVal: { fontSize: 8, bold: true, color: '#1e40af' },
        totalGrande: { fontSize: 13, bold: true, color: '#1e40af' },
        nota: { fontSize: 7.5, color: '#1f2937', margin: [0, 1, 0, 1] },
      },
    };

    try {
      return await this.buildPdf(dd);
    } catch (e) {
      this.logger.error('Error generando PDF cotización', e as Error);
      throw e;
    }
  }
}