import { IsOptional, IsInt, IsString, IsNumber, IsIn, MaxLength, ValidateNested, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

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
  @IsNumber({ maxDecimalPlaces: 2 })
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
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
  @IsIn([0, 1, 2, 3])
  status?: number;

  @IsOptional()
  @Type(() => Number)
  tasaBcv?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  montoSubtotal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  montoExento?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  montoBaseImponible?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  montoIva?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  montoTotal?: number;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => BudgetDetailDto)
  @ArrayMaxSize(500)
  detalles?: BudgetDetailDto[];
}

export class UpdateBudgetDto extends CreateBudgetDto {}