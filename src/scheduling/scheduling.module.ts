import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReminderSchedulerService } from './reminder-scheduler.service';

@Module({
  imports: [NotificationsModule],
  providers: [ReminderSchedulerService],
})
export class SchedulingModule {}
