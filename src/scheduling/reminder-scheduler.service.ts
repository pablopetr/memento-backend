import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReminderSchedulerService {
  private readonly logger = new Logger(ReminderSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleDueReminders(): Promise<void> {
    const due = await this.prisma.reminder.findMany({
      where: {
        status: 'PENDING',
        scheduledAt: { lte: new Date() },
      },
      take: 50,
    });

    if (due.length === 0) {
      return;
    }

    this.logger.debug(`Found ${due.length} due reminders`);

    for (const reminder of due) {
      try {
        await this.notifications.sendReminderNotification(reminder);
        await this.prisma.reminder.update({
          where: { id: reminder.id },
          data: { status: 'TRIGGERED' },
        });
        this.logger.debug(`Triggered reminder ${reminder.id}`);
      } catch (err) {
        this.logger.error(
          `Failed to trigger reminder ${reminder.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
        // Left as PENDING — will retry on next tick
      }
    }
  }
}
