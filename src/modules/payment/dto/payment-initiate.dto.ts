import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Shared body for Pro monthly/yearly payment initiate. */
export class InitiateProPaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  mobile!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  email?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  redirectUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  voucherCode?: string;
}

export class InitiateExtraMenusPaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  mobile!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  email?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  redirectUrl!: string;
}
