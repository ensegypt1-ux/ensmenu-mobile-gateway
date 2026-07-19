import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { NOTIFICATION_EVENTS } from '../notification-events';

@ValidatorConstraint({ name: 'notificationDataBounds', async: false })
class NotificationDataBoundsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value == null) return true;
    if (typeof value !== 'object' || Array.isArray(value)) return false;
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 20) return false;
    for (const [k, v] of entries) {
      if (typeof k !== 'string' || k.length > 64) return false;
      if (typeof v !== 'string' || v.length > 500) return false;
    }
    return true;
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'data must be a string map with at most 20 entries';
  }
}

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
  @Validate(NotificationDataBoundsConstraint)
  data?: Record<string, string>;
}
