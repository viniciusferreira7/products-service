import { LogLevel } from '@viniciusferreira7/signals';
import { z } from 'zod';

const LOG_LEVELS: LogLevel[] = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
] as const;

// `z.coerce.number()` alone turns an empty value into 0, and port 0 makes the
// server listen on a random port without complaining.
const port = z.coerce.number().int().min(1).max(65_535);

export const envSchema = z.object({
  NODE_ENV: z.enum(['dev', 'test', 'production']).default('dev'),
  PORT: port.default(3001),
  SHUTDOWN_DRAIN_DELAY_MS: z.coerce.number().int().min(0).default(10_000),

  DB_HOST: z.string().min(1),
  DB_PORT: port.default(5437),
  DB_USERNAME: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_DATABASE: z.string().min(1),

  OTEL_SERVICE_NAME: z.string().min(1),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url(),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
});

export type Env = z.infer<typeof envSchema>;
