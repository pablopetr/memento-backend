import { Injectable } from '@nestjs/common';
import { DeviceToken } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async registerDeviceToken(
    userId: string,
    dto: RegisterDeviceTokenDto,
  ): Promise<DeviceToken> {
    return this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      update: {},
      create: { token: dto.token, userId },
    });
  }
}
