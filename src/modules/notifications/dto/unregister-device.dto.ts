import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UnregisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  deviceId!: string;
}
