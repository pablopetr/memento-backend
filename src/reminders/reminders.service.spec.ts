import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrismaService } from '../../test/mocks/prisma.mock';

describe('RemindersService', () => {
  let service: RemindersService;
  let mockPrisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemindersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RemindersService>(RemindersService);
  });

  describe('create', () => {
    it('creates reminder with future scheduledAt', async () => {
      const futureDate = new Date(Date.now() + 60000);
      const dto = {
        title: 'Test',
        scheduledAt: futureDate.toISOString(),
      };
      const reminder = { id: '1', ...dto, userId: 'user-1' };
      mockPrisma.reminder.create.mockResolvedValue(reminder as any);

      const result = await service.create(dto, 'user-1');

      expect(result).toEqual(reminder);
      expect(mockPrisma.reminder.create).toHaveBeenCalledWith({
        data: {
          title: dto.title,
          description: undefined,
          scheduledAt: expect.any(Date),
          userId: 'user-1',
        },
      });
    });

    it('rejects scheduledAt in the past', async () => {
      const pastDate = new Date(Date.now() - 1000);
      const dto = {
        title: 'Test',
        scheduledAt: pastDate.toISOString(),
      };

      await expect(service.create(dto, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findOne', () => {
    it('returns reminder when owned by user', async () => {
      const reminder = { id: '1', title: 'Test', userId: 'user-1' };
      mockPrisma.reminder.findFirst.mockResolvedValue(reminder as any);

      const result = await service.findOne('1', 'user-1');

      expect(result).toEqual(reminder);
      expect(mockPrisma.reminder.findFirst).toHaveBeenCalledWith({
        where: { id: '1', userId: 'user-1' },
      });
    });

    it('throws NotFoundException when reminder not found', async () => {
      mockPrisma.reminder.findFirst.mockResolvedValue(null);

      await expect(service.findOne('1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when reminder owned by different user', async () => {
      mockPrisma.reminder.findFirst.mockResolvedValue(null);

      await expect(service.findOne('1', 'user-2')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.reminder.findFirst).toHaveBeenCalledWith({
        where: { id: '1', userId: 'user-2' },
      });
    });
  });

  describe('findAll', () => {
    it('scopes query to userId', async () => {
      mockPrisma.reminder.findMany.mockResolvedValue([]);

      await service.findAll('user-1', 10, 0);

      expect(mockPrisma.reminder.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        take: 10,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('update', () => {
    it('throws NotFoundException for reminder owned by different user', async () => {
      mockPrisma.reminder.findFirst.mockResolvedValue(null);

      await expect(
        service.update('1', 'user-2', { title: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException for reminder owned by different user', async () => {
      mockPrisma.reminder.findFirst.mockResolvedValue(null);

      await expect(service.remove('1', 'user-2')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
