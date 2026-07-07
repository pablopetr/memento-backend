# 06 — Notification Integration (Firebase Cloud Messaging)

**Estimated time:** ~20 minutes

## Description

Send push notifications to the React Native app when a reminder is
triggered by the scheduler (from
[reminder-scheduling.md](./05-reminder-scheduling.md)), so the user is
notified even when the app is closed or backgrounded.

## Dependencies / Libraries

- `firebase-admin` (server-side SDK)
- A Firebase project with Cloud Messaging enabled, plus a service-account
  JSON credential file
- React Native side (out of scope here, noted for context): `@react-native-firebase/app` + `@react-native-firebase/messaging`

```bash
npm install firebase-admin
```

## Design

1. **Device token registration** — extend `User` (or add a small
   `DeviceToken` model) to store the FCM token the mobile app registers
   after login:
   ```prisma
   model DeviceToken {
     id        String   @id @default(uuid())
     token     String   @unique
     user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
     userId    String
     createdAt DateTime @default(now())

     @@index([userId])
   }
   ```
   Add `POST /users/me/device-token` (protected route) for the app to
   register/update its token.

2. **`NotificationsService`** — a thin abstraction the scheduler depends
   on (dependency inversion), so the FCM implementation can be swapped
   without touching scheduling logic:
   ```ts
   @Injectable()
   export class NotificationsService {
     constructor(private readonly prisma: PrismaService) {
       if (!admin.apps.length) {
         admin.initializeApp({
           credential: admin.credential.cert(
             JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
           ),
         });
       }
     }

     async sendReminderNotification(reminder: Reminder) {
       const tokens = await this.prisma.deviceToken.findMany({
         where: { userId: reminder.userId },
         select: { token: true },
       });
       if (tokens.length === 0) return;

       await admin.messaging().sendEachForMulticast({
         tokens: tokens.map((t) => t.token),
         notification: {
           title: 'Reminder',
           body: reminder.title,
         },
         data: { reminderId: reminder.id },
       });
     }
   }
   ```

3. **Cleanup invalid tokens** — inspect `sendEachForMulticast`'s
   response and delete tokens that returned
   `messaging/registration-token-not-registered` to keep the table tidy.

## Environment / Docker configuration

- Store the Firebase service-account JSON **outside the image**:
  - Preferred: mount it as a Docker secret or bind-mounted file, and
    point `FIREBASE_SERVICE_ACCOUNT_JSON` (or a `_FILE` path variant) at
    it via `.env` — never commit the credential file or bake it into
    the `Dockerfile`.
  - Example `docker-compose.yml` addition:
    ```yaml
    services:
      backend:
        environment:
          - FIREBASE_SERVICE_ACCOUNT_JSON=${FIREBASE_SERVICE_ACCOUNT_JSON}
    ```
    with the JSON (minified) stored in the host `.env` file, or mounted as:
    ```yaml
        volumes:
          - ./secrets/firebase-service-account.json:/app/secrets/firebase.json:ro
        environment:
          - GOOGLE_APPLICATION_CREDENTIALS=/app/secrets/firebase.json
    ```
  - Add `secrets/` to `.gitignore` and `.dockerignore`.
- No extra container is required — `firebase-admin` runs in-process
  within the existing `backend` service.

## High-Level Plan

1. Create the Firebase project (console.firebase.google.com), enable
   Cloud Messaging, download the service-account key.
2. Add `DeviceToken` model + migration.
3. Implement `NotificationsModule`/`NotificationsService` as above.
4. Wire `NotificationsService` into `ReminderSchedulerService`.
5. Add the device-token registration endpoint for the mobile client.
6. Mount the credential file into the container and set the env var as
   described above; restart with `docker compose up -d --force-recreate backend`.
7. Manually verify: register a token from a real/emulated device, create
   a reminder scheduled ~15s out, confirm the push arrives.

## Notes

- Keep the FCM specifics (`firebase-admin` calls) isolated inside
  `NotificationsService` — if the project ever swaps providers (e.g.
  OneSignal), only this module needs to change (single responsibility,
  open/closed).
