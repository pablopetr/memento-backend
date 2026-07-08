import { Body, Controller, Post } from '@nestjs/common';
import { DeviceToken } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { UsersService } from './users.service';

@Controller('users/me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('device-token')
  registerDeviceToken(
    @Body() dto: RegisterDeviceTokenDto,
    @CurrentUser() userId: string,
  ): Promise<DeviceToken> {
    return this.usersService.registerDeviceToken(userId, dto);
  }
}
