import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_USER_POOL_ID: z.string().regex(/^[a-z]{2}-[a-z]+-\d_[0-9A-Za-z]+$/),
  NEXT_PUBLIC_USER_POOL_CLIENT_ID: z.string().min(1),
  NEXT_PUBLIC_API_URL: z.url(),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_USER_POOL_ID: process.env.NEXT_PUBLIC_USER_POOL_ID,
  NEXT_PUBLIC_USER_POOL_CLIENT_ID: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});
