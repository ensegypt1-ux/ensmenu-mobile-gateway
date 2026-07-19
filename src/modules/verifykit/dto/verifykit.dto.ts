import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class VerifykitStartDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  lang!: string;

  @IsOptional()
  @IsBoolean()
  deeplink?: boolean;
}

export class VerifykitReferenceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  reference!: string;
}

export class VerifykitSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  sessionId!: string;
}
