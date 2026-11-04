import { z } from 'zod';

/** Lambda configuration, validated once when the function starts (cold start). */
export const env = z
  .object({
    TABLE_NAME: z.string().min(1),
  })
  .parse(process.env);
