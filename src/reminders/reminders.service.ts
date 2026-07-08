import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Reminder } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';

@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateReminderDto, userId: string): Promise<Reminder> {
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt < new Date()) {
      throw new BadRequestException('scheduledAt must be in the future');
    }

    return this.prisma.reminder.create({
      data: {
        title: dto.title,
        description: dto.description,
        scheduledAt,
        userId,
      },
    });
  }

  async findAll(
    userId: string,
    take: number = 20,
    skip: number = 0,
  ): Promise<Reminder[]> {
    return this.prisma.reminder.findMany({
      where: { userId },
      take,
      skip,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string): Promise<Reminder> {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id, userId },
    });
    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }
    return reminder;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateReminderDto,
  ): Promise<Reminder> {
    // Verify ownership before updating
    await this.findOne(id, userId);

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.scheduledAt !== undefined) {
      const scheduledAt = new Date(dto.scheduledAt);
      if (scheduledAt < new Date()) {
        throw new BadRequestException('scheduledAt must be in the future');
      }
      data.scheduledAt = scheduledAt;
    }

    return this.prisma.reminder.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, userId: string): Promise<Reminder> {
    // Verify ownership before deleting
    await this.findOne(id, userId);

    return this.prisma.reminder.delete({ where: { id } });
  }
}
