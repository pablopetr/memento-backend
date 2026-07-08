import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DeviceToken } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users/me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('device-token')
  @ApiOperation({
    summary: 'Register or update device token for push notifications',
  })
  @ApiResponse({
    status: 201,
    description: 'Device token registered',
    schema: {
      example: {
        id: 'token-id',
        token: 'eY3u...',
        userId: 'user-id',
        createdAt: '2026-07-07T12:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  registerDeviceToken(
    @Body() dto: RegisterDeviceTokenDto,
    @CurrentUser() userId: string,
  ): Promise<DeviceToken> {
    return this.usersService.registerDeviceToken(userId, dto);
  }
}
