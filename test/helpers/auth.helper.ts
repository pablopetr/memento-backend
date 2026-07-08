import { INestApplication } from '@nestjs/common';
import request from 'supertest';

export async function loginAsTestUser(app: INestApplication): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      email: 'demo@example.com',
      password: 'password123',
    })
    .expect(200);

  return response.body.accessToken;
}
