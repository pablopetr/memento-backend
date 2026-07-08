import { INestApplication, ValidationPipe, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { loginAsTestUser } from './helpers/auth.helper';

describe('App E2E', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors) =>
          new BadRequestException({
            message: 'Validation failed',
            details: errors.map((e) => ({
              field: e.property,
              constraint: Object.values(e.constraints ?? {}).join(', '),
            })),
          }),
      }),
    );
    await app.init();

    // Login once for all tests
    token = await loginAsTestUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth', () => {
    it('POST /auth/login with valid credentials → 200 + accessToken', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'demo@example.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(typeof response.body.accessToken).toBe('string');
    });

    it('POST /auth/login with wrong password → 401', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'demo@example.com',
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('POST /auth/login with malformed body → 400 + validation details', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'demo@example.com',
          // missing password
        })
        .expect(400);

      expect(response.body.message).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
      expect(Array.isArray(response.body.details)).toBe(true);
    });
  });

  describe('Reminders (authenticated)', () => {
    let reminderId: string;

    it('POST /reminders with valid payload → 201', async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString();
      const response = await request(app.getHttpServer())
        .post('/reminders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Test reminder',
          description: 'E2E test',
          scheduledAt: futureDate,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Test reminder');
      expect(response.body.status).toBe('PENDING');
      reminderId = response.body.id;
    });

    it('POST /reminders with past scheduledAt → 400', async () => {
      const pastDate = new Date(Date.now() - 1000).toISOString();
      await request(app.getHttpServer())
        .post('/reminders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Past reminder',
          scheduledAt: pastDate,
        })
        .expect(400);
    });

    it('GET /reminders → 200, returns user\'s reminders', async () => {
      const response = await request(app.getHttpServer())
        .get('/reminders')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Seeded user has one reminder, we created one more
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });

    it('GET /reminders/:id → 200, returns reminder', async () => {
      const response = await request(app.getHttpServer())
        .get(`/reminders/${reminderId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.id).toBe(reminderId);
    });

    it('PATCH /reminders/:id → 200, updates reminder', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/reminders/${reminderId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated title' })
        .expect(200);

      expect(response.body.title).toBe('Updated title');
    });

    it('DELETE /reminders/:id → 200, deletes reminder', async () => {
      await request(app.getHttpServer())
        .delete(`/reminders/${reminderId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Verify it's gone
      await request(app.getHttpServer())
        .get(`/reminders/${reminderId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('GET /reminders/:id for non-existent reminder → 404', async () => {
      await request(app.getHttpServer())
        .get('/reminders/does-not-exist')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('Auth required', () => {
    it('GET /reminders without Authorization header → 401', async () => {
      await request(app.getHttpServer())
        .get('/reminders')
        .expect(401);
    });

    it('POST /reminders without Authorization header → 401', async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString();
      await request(app.getHttpServer())
        .post('/reminders')
        .send({
          title: 'No auth',
          scheduledAt: futureDate,
        })
        .expect(401);
    });
  });

  describe('Public endpoints', () => {
    it('GET / → 200', async () => {
      await request(app.getHttpServer())
        .get('/')
        .expect(200);
    });

    it('POST /auth/login → 200', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'demo@example.com',
          password: 'password123',
        })
        .expect(200);
    });
  });
});
