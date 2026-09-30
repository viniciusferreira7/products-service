import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { envSchema } from './env';

const baseEnv = {
  DB_HOST: 'localhost',
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'postgres',
  DB_DATABASE: 'products_db',
  OTEL_SERVICE_NAME: 'products-service',
  OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
  JWT_SECRET: 'a'.repeat(32),
};

describe('envSchema', () => {
  it('applies the NODE_ENV, PORT, LOG_LEVEL and drain delay defaults', () => {
    const env = envSchema.parse(baseEnv);

    expect(env.NODE_ENV).toBe('dev');
    expect(env.PORT).toBe(3001);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.SHUTDOWN_DRAIN_DELAY_MS).toBe(10_000);
  });

  it('defaults DB_PORT to the port docker compose publishes', () => {
    expect(envSchema.parse(baseEnv).DB_PORT).toBe(5437);
  });

  it('coerces PORT and DB_PORT from strings', () => {
    const env = envSchema.parse({ ...baseEnv, PORT: '4000', DB_PORT: '6000' });

    expect(env.PORT).toBe(4000);
    expect(env.DB_PORT).toBe(6000);
  });

  it.each([
    ['empty', ''],
    ['blank', ' '],
    ['zero', '0'],
    ['negative', '-5'],
    ['fractional', '3.5'],
    ['out of range', '65536'],
    ['not a number', 'abc'],
  ])('rejects a PORT that is %s', (_label, value) => {
    // Plain coercion turns '' into 0, and port 0 listens on a random port.
    expect(() => envSchema.parse({ ...baseEnv, PORT: value })).toThrow();
  });

  it.each([
    ['empty', ''],
    ['blank', ' '],
    ['out of range', '70000'],
  ])('rejects a DB_PORT that is %s', (_label, value) => {
    expect(() => envSchema.parse({ ...baseEnv, DB_PORT: value })).toThrow();
  });

  it.each(['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE'] as const)(
    'rejects a missing or empty %s',
    (key) => {
      const { [key]: _omitted, ...without } = baseEnv;

      expect(() => envSchema.parse(without)).toThrow();
      expect(() => envSchema.parse({ ...baseEnv, [key]: '' })).toThrow();
    }
  );

  it('rejects a negative drain delay', () => {
    expect(() =>
      envSchema.parse({ ...baseEnv, SHUTDOWN_DRAIN_DELAY_MS: '-1' })
    ).toThrow();
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() =>
      envSchema.parse({ ...baseEnv, NODE_ENV: 'staging' })
    ).toThrow();
  });

  it('rejects an invalid OTEL_EXPORTER_OTLP_ENDPOINT', () => {
    expect(() =>
      envSchema.parse({ ...baseEnv, OTEL_EXPORTER_OTLP_ENDPOINT: 'nope' })
    ).toThrow();
  });

  it('rejects an unknown LOG_LEVEL', () => {
    expect(() =>
      envSchema.parse({ ...baseEnv, LOG_LEVEL: 'verbose' })
    ).toThrow();
  });

  it('rejects a missing JWT_SECRET', () => {
    const { JWT_SECRET: _, ...withoutSecret } = baseEnv;

    expect(() => envSchema.parse(withoutSecret)).toThrow();
  });

  it('rejects a JWT_SECRET shorter than 32 characters', () => {
    expect(() =>
      envSchema.parse({ ...baseEnv, JWT_SECRET: 'a'.repeat(31) })
    ).toThrow();
  });

  it('accepts a JWT_SECRET of exactly 32 characters', () => {
    expect(envSchema.parse(baseEnv).JWT_SECRET).toBe('a'.repeat(32));
  });

  it('refuses to boot on the JWT_SECRET placeholder from .env.example', () => {
    // `cp .env.example .env` must not start a service that trusts tokens
    // signed with a publicly known key.
    const example = readFileSync('.env.example', 'utf8');
    const placeholder = example.match(/^JWT_SECRET=(.*)$/m)?.[1];

    expect(placeholder).toBeDefined();
    expect(() =>
      envSchema.parse({ ...baseEnv, JWT_SECRET: placeholder })
    ).toThrow();
  });
});
