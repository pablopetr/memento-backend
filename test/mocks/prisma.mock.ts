import { PrismaService } from '../../src/prisma/prisma.service';

export function createMockPrismaService(): jest.Mocked<PrismaService> {
  return {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    reminder: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    deviceToken: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  } as unknown as jest.Mocked<PrismaService>;
}
