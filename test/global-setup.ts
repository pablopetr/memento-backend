import { execSync } from 'child_process';

export default async function globalSetup() {
  console.log('Setting up test database...');
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    execSync('npx prisma db seed', { stdio: 'inherit' });
    console.log('Test database ready');
  } catch (error) {
    console.error('Failed to set up test database', error);
    throw error;
  }
}
