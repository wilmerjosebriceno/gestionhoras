import { IsOptional, IsInt, IsString, IsNumber, IsIn, MaxLength, ValidateNested, ArrayMaxSize } from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * Convierte a numero y lo redondea a `decimales`. Evita que la precision
 * flotante (p. ej. 16.080000000000002) haga fallar `@IsNumber({ maxDecimalPlaces })`.
 */
const redondear = (decimales: number) => ({ value }: { value: unknown }) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const factor = 10 ** decimales;
  return Math.round(n * factor) / factor;
};

export class BudgetDetailDto {
  @IsInt()
  idTemplate: number;

  @IsOptional()
  @IsInt()
  secuencia?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @Transform(redondear(2))
  @IsNumber({ maxDecimalPlaces: 2 })
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @Transform(redondear(4))
  @IsNumber({ maxDecimalPlaces: 4 })
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tax?: number;

  @IsOptional()
  @IsInt()
  idTasaIva?: number;

  @IsOptional()
  @IsInt()
  idRegion?: number;

  @IsOptional()
  @IsIn(['ONLINE', 'PRESENCIAL'])
  modalidad?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idTarifa?: number;
}

export class CreateBudgetDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  codeBudget?: string;

  @IsOptional()
  @IsString()
  dateBudget?: string;

  @IsOptional()
  @IsString()
  vencimiento?: string;

  @IsOptional()
  @IsString()
  hourBudget?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  soporte?: string;

  @IsOptional()
  @IsString()
  modalidad?: string;

  @IsOptional()
  @IsInt()
  idClient?: number;

  @IsOptional()
  @IsInt()
  idEmpresa?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  nroUser?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idRango?: number;

  @IsOptional()
  @IsIn([0, 1, 2, 3])
  status?: number;

  @IsOptional()
  @Type(() => Number)
  tasaBcv?: number;

  @IsOptional()
  @Type(() => Number)
  @Transform(redondear(4))
  @IsNumber({ maxDecimalPlaces: 4 })
  montoSubtotal?: number;

  @IsOptional()
  @Type(() => Number)
  @Transform(redondear(4))
  @IsNumber({ maxDecimalPlaces: 4 })
  montoExento?: number;

  @IsOptional()
  @Type(() => Number)
  @Transform(redondear(4))
  @IsNumber({ maxDecimalPlaces: 4 })
  montoBaseImponible?: number;

  @IsOptional()
  @Type(() => Number)
  @Transform(redondear(4))
  @IsNumber({ maxDecimalPlaces: 4 })
  montoIva?: number;

  @IsOptional()
  @Type(() => Number)
  @Transform(redondear(4))
  @IsNumber({ maxDecimalPlaces: 4 })
  montoTotal?: number;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => BudgetDetailDto)
  @ArrayMaxSize(500)
  detalles?: BudgetDetailDto[];
}

export class UpdateBudgetDto extends CreateBudgetDto {}