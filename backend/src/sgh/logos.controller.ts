import {
  Controller,
  Get,
  Post,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { LogosService, EMPRESAS, empresaKey } from './logos.service';

@ApiTags('SGH - Logos de Empresa')
@Controller('sgh/logos')
export class LogosController {
  constructor(private readonly logos: LogosService) {}

  /** Lista las empresas con su logo actual (dataUri para previsualización). */
  @Get()
  listar() {
    return EMPRESAS.map((empresa) => {
      const src = this.logos.getLogoDataUriForEmpresaKey(empresa);
      return { empresa, nombre: src.nombre, existe: src.existe, dataUri: src.dataUri };
    });
  }

  /** Previsualización del logo de una empresa. */
  @Get(':empresa/preview')
  preview(@Param('empresa') empresa: string) {
    const k = empresa.toUpperCase();
    if (!EMPRESAS.includes(k)) throw new BadRequestException(`Empresa inválida: ${empresa}`);
    const src = this.logos.getLogoDataUriForEmpresaKey(k);
    return { empresa: k, ...src };
  }

  /** Sube/reemplaza el logo (jpg/jpeg/png/gif) de una empresa. */
  @Post(':empresa/upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('empresa') empresa: string,
    @UploadedFile() file: any,
  ) {
    return this.logos.upload(empresa, file);
  }

  /** Sirve el archivo de logo subido de una empresa (o 404 si no existe). */
  @Get(':empresa/archivo')
  archivo(@Param('empresa') empresa: string, @Res() res: Response) {
    const k = empresa.toUpperCase();
    if (!EMPRESAS.includes(k)) {
      res.status(400).json({ message: `Empresa inválida: ${empresa}` });
      return;
    }
    const p = this.logos.getLogoPathForEmpresaKey(k);
    if (!p) {
      res.status(404).json({ message: `No hay logo subido para ${k}` });
      return;
    }
    const stream = createReadStream(p);
    const ext = p.split('.').pop()?.toLowerCase() ?? 'png';
    const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="logo.${ext}"`);
    stream.pipe(res);
  }
}
