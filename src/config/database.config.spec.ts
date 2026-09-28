import type { EnvService } from '../env/env.service';
import { databaseConfig } from './database.config';

const values: Record<string, unknown> = {
  NODE_ENV: 'dev',
  DB_HOST: 'db.internal',
  DB_PORT: 5437,
  DB_USERNAME: 'catalog',
  DB_PASSWORD: 'secret',
  DB_DATABASE: 'products_db',
};

function makeEnv(overrides: Record<string, unknown> = {}): EnvService {
  const env = { ...values, ...overrides };

  return { get: vi.fn((key: string) => env[key]) } as unknown as EnvService;
}

describe('databaseConfig', () => {
  it('builds a postgres connection from the DB_* variables', () => {
    expect(databaseConfig(makeEnv())).toMatchObject({
      type: 'postgres',
      host: 'db.internal',
      port: 5437,
      username: 'catalog',
      password: 'secret',
      database: 'products_db',
      autoLoadEntities: true,
    });
  });

  it('synchronizes the schema only in dev', () => {
    expect(databaseConfig(makeEnv({ NODE_ENV: 'dev' }))).toMatchObject({
      synchronize: true,
    });

    // A schema sync against test or production data would drop columns the
    // entities no longer declare.
    expect(databaseConfig(makeEnv({ NODE_ENV: 'test' }))).toMatchObject({
      synchronize: false,
    });
    expect(databaseConfig(makeEnv({ NODE_ENV: 'production' }))).toMatchObject({
      synchronize: false,
    });
  });

  it('silences query logging in production only', () => {
    expect(databaseConfig(makeEnv({ NODE_ENV: 'production' }))).toMatchObject({
      logging: false,
    });
    expect(databaseConfig(makeEnv({ NODE_ENV: 'dev' }))).toMatchObject({
      logging: true,
    });
  });

  it('reads the connection from EnvService, never from process.env', () => {
    const env = makeEnv();

    databaseConfig(env);

    for (const key of [
      'DB_HOST',
      'DB_PORT',
      'DB_USERNAME',
      'DB_PASSWORD',
      'DB_DATABASE',
    ]) {
      expect(env.get).toHaveBeenCalledWith(key);
    }
  });
});
