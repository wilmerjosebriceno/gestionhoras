import { IsArray, IsInt, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AsignacionEstructuraRowDto {
  @IsInt()
  idProcess: number;

  @IsInt()
  idItemActivity: number;

  @IsOptional()
  @IsInt()
  active?: number;

  @IsOptional()
  hours?: number;
}

export class GuardarAsignacionDto {
  @IsInt()
  idItemActivity: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AsignacionEstructuraRowDto)
  asignaciones: AsignacionEstructuraRowDto[];
}
