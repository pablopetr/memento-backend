import { Injectable, Logger } from '@nestjs/common';
import admin from 'firebase-admin';
import { Reminder } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseInitialized = false;

  constructor(private readonly prisma: PrismaService) {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    try {
      const credsJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      if (!credsJson) {
        this.logger.warn(
          'FIREBASE_SERVICE_ACCOUNT_JSON not set — notifications disabled',
        );
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(admin as any).apps || (admin as any).apps.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const creds = (admin as any).credential.cert(JSON.parse(credsJson));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (admin as any).initializeApp({
          credential: creds,
        });
      }
      this.firebaseInitialized = true;
      this.logger.log('Firebase initialized for push notifications');
    } catch (err) {
      this.logger.error(
        `Failed to initialize Firebase: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async sendReminderNotification(reminder: Reminder): Promise<void> {
    if (!this.firebaseInitialized) {
      this.logger.debug(
        `Skipping notification for reminder ${reminder.id} (Firebase disabled)`,
      );
      return;
    }

    try {
      const tokens = await this.prisma.deviceToken.findMany({
        where: { userId: reminder.userId },
        select: { token: true, id: true },
      });

      if (tokens.length === 0) {
        this.logger.debug(
          `No device tokens for user ${reminder.userId}, skipping notification`,
        );
        return;
      }

      const tokenStrings = tokens.map((t) => t.token);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (admin as any).messaging().sendEachForMulticast({
        tokens: tokenStrings,
        notification: {
          title: 'Reminder',
          body: reminder.title,
        },
        data: { reminderId: reminder.id },
      });

      this.logger.debug(
        `Sent reminder ${reminder.id} to ${response.successCount}/${tokens.length} devices`,
      );

      // Clean up invalid tokens
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((res, idx) => {
          if (
            !res.success &&
            res.error?.code === 'messaging/registration-token-not-registered'
          ) {
            failedTokens.push(tokens[idx].id);
          }
        });

        if (failedTokens.length > 0) {
          await this.prisma.deviceToken.deleteMany({
            where: { id: { in: failedTokens } },
          });
          this.logger.debug(`Deleted ${failedTokens.length} invalid tokens`);
        }
      }
    } catch (err) {
      this.logger.error(
        `Failed to send notification for reminder ${reminder.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
