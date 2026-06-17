import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  deviceId!: string;

  @IsString()
  @IsIn(['android', 'ios'])
  platform!: 'android' | 'ios';

  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  fcmToken!: string;
}
