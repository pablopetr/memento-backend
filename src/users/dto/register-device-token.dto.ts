import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RegisterDeviceTokenDto {
  @ApiProperty({
    example: 'eY3u...', // Firebase FCM token (truncated for display)
    description: 'FCM device token from React Native Firebase',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}
