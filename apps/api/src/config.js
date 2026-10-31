import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../../.env') });

const isProd = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET || 'dev-access-secret-change-me-please-0123456789';
const refreshSecret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me-please-0123456789';

if (isProd && (jwtSecret.startsWith('dev-') || jwtSecret.startsWith('change-me') || refreshSecret.startsWith('dev-') || refreshSecret.startsWith('change-me'))) {
  console.error('Refusing to start in production with default JWT secrets. Set JWT_SECRET and JWT_REFRESH_SECRET in .env');
  process.exit(1);
}

export const config = {
  isProd,
  port: Number(process.env.PORT || 4000),
  mongoUrl: process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/judgebox',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  jwtSecret,
  refreshSecret,
  cookieSecure: process.env.COOKIE_SECURE === 'true',
};
