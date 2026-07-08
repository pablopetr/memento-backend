import { Test, TestingModule } from '@nestjs/testing';
import { ReminderSchedulerService } from './reminder-scheduler.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { createMockPrismaService } from '../../test/mocks/prisma.mock';

describe('ReminderSchedulerService', () => {
  let service: ReminderSchedulerService;
  let mockPrisma: jest.Mocked<PrismaService>;
  let mockNotifications: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockNotifications = {
      sendReminderNotification: jest.fn(),
    } as unknown as jest.Mocked<NotificationsService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReminderSchedulerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<ReminderSchedulerService>(ReminderSchedulerService);
  });

  describe('handleDueReminders', () => {
    it('finds only PENDING reminders with scheduledAt <= now', async () => {
      mockPrisma.reminder.findMany.mockResolvedValue([]);

      await service.handleDueReminders();

      expect(mockPrisma.reminder.findMany).toHaveBeenCalledWith({
        where: {
          status: 'PENDING',
          scheduledAt: { lte: expect.any(Date) },
        },
        take: 50,
      });
    });

    it('marks reminder TRIGGERED after successful notification', async () => {
      const reminder = {
        id: 'r-1',
        title: 'Test',
        userId: 'user-1',
        status: 'PENDING',
      };
      mockPrisma.reminder.findMany.mockResolvedValue([reminder as any]);
      mockNotifications.sendReminderNotification.mockResolvedValue(undefined);
      mockPrisma.reminder.update.mockResolvedValue({ ...reminder, status: 'TRIGGERED' } as any);

      await service.handleDueReminders();

      expect(mockNotifications.sendReminderNotification).toHaveBeenCalledWith(
        reminder,
      );
      expect(mockPrisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'r-1' },
        data: { status: 'TRIGGERED' },
      });
    });

    it('leaves reminder PENDING when notification fails', async () => {
      const reminder = {
        id: 'r-1',
        title: 'Test',
        userId: 'user-1',
        status: 'PENDING',
      };
      mockPrisma.reminder.findMany.mockResolvedValue([reminder as any]);
      mockNotifications.sendReminderNotification.mockRejectedValue(
        new Error('FCM error'),
      );

      await service.handleDueReminders();

      expect(mockPrisma.reminder.update).not.toHaveBeenCalled();
    });
  });
});
