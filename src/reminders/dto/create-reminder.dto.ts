import { IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateReminderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsISO8601()
  scheduledAt: string;
}
