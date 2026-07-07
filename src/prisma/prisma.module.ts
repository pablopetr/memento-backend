import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// @Global() so PrismaService can be injected anywhere without re-importing
// the module in every feature module (DRY).
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
