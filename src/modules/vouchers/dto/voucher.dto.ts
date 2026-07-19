import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ValidateVoucherDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code!: string;

  @IsString()
  @IsIn(['monthly', 'yearly'])
  billingCycle!: 'monthly' | 'yearly';
}

export class RedeemDurationVoucherDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code!: string;
}
