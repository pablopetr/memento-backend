import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrismaService } from '../../test/mocks/prisma.mock';

jest.mock('firebase-admin', () => ({
  apps: [],
  messaging: jest.fn(),
  credential: { cert: jest.fn() },
  initializeApp: jest.fn(),
}));

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockPrisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('sendReminderNotification', () => {
    it('is a no-op when Firebase is disabled', async () => {
      const reminder = { id: 'r-1', title: 'Test', userId: 'user-1' };

      await service.sendReminderNotification(reminder as any);

      // Should not call prisma when Firebase is disabled
      expect(mockPrisma.deviceToken.findMany).not.toHaveBeenCalled();
    });

    it('returns early when user has no device tokens', async () => {
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{}';
      // Reinit service with Firebase enabled
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NotificationsService,
          { provide: PrismaService, useValue: mockPrisma },
        ],
      }).compile();

      const svc = module.get<NotificationsService>(NotificationsService);
      const reminder = { id: 'r-1', title: 'Test', userId: 'user-1' };
      mockPrisma.deviceToken.findMany.mockResolvedValue([]);

      await svc.sendReminderNotification(reminder as any);

      expect(mockPrisma.deviceToken.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: { token: true, id: true },
      });
    });
  });
});
