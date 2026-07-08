import { Injectable } from '@nestjs/common';
import { Reminder } from '@prisma/client';

@Injectable()
export class NotificationsService {
  // Placeholder for task 06 — will be implemented with actual notification
  // delivery logic (Firebase Cloud Messaging, WebSocket, etc).
  async sendReminderNotification(reminder: Reminder): Promise<void> {
    // TODO: implement in task 06
    console.log(`[Notification] Reminder ${reminder.id}: ${reminder.title}`);
  }
}
