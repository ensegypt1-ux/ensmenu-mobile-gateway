import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { NOTIFICATION_EVENTS } from '../notification-events';

export class SendNotificationDto {
  @IsInt()
  @Min(1)
  userId!: number;

  @IsString()
  @IsIn([...NOTIFICATION_EVENTS])
  event!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  body!: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, string>;
}
