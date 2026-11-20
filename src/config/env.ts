import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('30d'),
  INITIAL_OWNER_EMAIL: z.string().email().default('lead@example.com'),
  INITIAL_OWNER_PASSWORD: z.string().min(8).default('ChangeMeImmediately123!'),
  INITIAL_OWNER_NAME: z.string().default('Team Lead'),
  INITIAL_OWNER_TIMEZONE: z.string().default('Asia/Karachi'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./uploads'),
  CORS_ORIGIN: z.string().default('http://localhost:4200'),
  VAPID_PUBLIC_KEY: z.string().default('BJOGCNTZjCBaU70HIeXw47o5Y0aXDEYgm-vizoICOrUvIYf6g0uJEo_mEBHzbrNQeDE92fu1Ka5b8Gc7vq6cw84'),
  VAPID_PRIVATE_KEY: z.string().default('93QNPZcybAmqHolE4Q-L3S-MqkihvtlHdscP4CjBF0g'),
  VAPID_SUBJECT: z.string().default('mailto:lead@example.com'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
