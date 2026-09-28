import { randomUUID } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { assertTestDatabase } from 'test/utils/assert-test-database';
import { sqlStateOf } from 'test/utils/sql-state-of';
import { DataSource, type Repository } from 'typeorm';
import { databaseConfig } from '@/config/database.config';
import { envSchema } from '@/env/env';
import { EnvModule } from '@/env/env.module';
import { EnvService } from '@/env/env.service';
import { Product } from './entities/product.entity';
import { ProductsModule } from './products.module';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function makeProduct(overrides: Partial<Product> = {}): Partial<Product> {
  return {
    name: 'Mechanical keyboard',
    description: 'Hot-swappable, 75% layout',
    price: 19.9,
    sellerId: randomUUID(),
    ...overrides,
  };
}

describe('Product persistence (integration)', () => {
  let moduleRef: TestingModule;
  let products: Repository<Product>;

  beforeAll(async () => {
    assertTestDatabase(process.env.DB_DATABASE);

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: (env) => envSchema.parse(env),
        }),
        EnvModule,
        TypeOrmModule.forRootAsync({
          imports: [EnvModule],
          inject: [EnvService],
          useFactory: databaseConfig,
        }),
        ProductsModule,
      ],
    }).compile();

    // `synchronize` is off outside dev, so build the schema on the throwaway
    // database from the entity itself.
    await moduleRef.get(DataSource).synchronize(true);

    products = moduleRef.get(getRepositoryToken(Product));
  });

  beforeEach(async () => {
    await products.clear();
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('saves a product with a generated uuid', async () => {
    const saved = await products.save(products.create(makeProduct()));

    expect(saved.id).toMatch(UUID);
  });

  it('creates products with no stock and active', async () => {
    const { id } = await products.save(products.create(makeProduct()));

    const found = await products.findOneByOrFail({ id });

    expect(found.stock).toBe(0);
    expect(found.isActive).toBe(true);
  });

  it('reads the price back as a number', async () => {
    const { id } = await products.save(
      products.create(makeProduct({ price: 19.9 }))
    );

    const found = await products.findOneByOrFail({ id });

    expect(found.price).toBe(19.9);
    expect(typeof found.price).toBe('number');
  });

  it('keeps the largest decimal(10,2) price exact', async () => {
    const { id } = await products.save(
      products.create(makeProduct({ price: 99999999.99 }))
    );

    expect((await products.findOneByOrFail({ id })).price).toBe(99999999.99);
  });

  it('rejects a price beyond decimal(10,2)', async () => {
    // 22003 = numeric_value_out_of_range
    await expect(
      sqlStateOf(products.insert(makeProduct({ price: 100000000 })))
    ).resolves.toBe('22003');
  });

  it('rejects a negative price', async () => {
    // 23514 = check_violation
    await expect(
      sqlStateOf(products.insert(makeProduct({ price: -1 })))
    ).resolves.toBe('23514');
  });

  it('rejects a NaN price', async () => {
    // Postgres sorts NaN above every number, so `price >= 0` alone lets it in.
    await expect(
      sqlStateOf(products.insert(makeProduct({ price: Number.NaN })))
    ).resolves.toBe('23514');
  });

  it('rejects a negative stock', async () => {
    await expect(
      sqlStateOf(products.insert(makeProduct({ stock: -1 })))
    ).resolves.toBe('23514');
  });

  it('rejects a name longer than 255 characters', async () => {
    // 22001 = string_data_right_truncation
    await expect(
      sqlStateOf(products.insert(makeProduct({ name: 'x'.repeat(256) })))
    ).resolves.toBe('22001');
  });

  it('rejects a seller id that is not a uuid', async () => {
    // 22P02 = invalid_text_representation
    await expect(
      sqlStateOf(products.insert(makeProduct({ sellerId: 'seller-42' })))
    ).resolves.toBe('22P02');
  });

  it('accepts a seller id that matches no local user (no foreign key)', async () => {
    const sellerId = randomUUID();

    const { id } = await products.save(
      products.create(makeProduct({ sellerId }))
    );

    expect((await products.findOneByOrFail({ id })).sellerId).toBe(sellerId);
  });

  it('timestamps creation and moves updatedAt on update', async () => {
    const { id } = await products.save(products.create(makeProduct()));
    const created = await products.findOneByOrFail({ id });

    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);

    await new Promise((resolve) => setTimeout(resolve, 20));
    await products.update(id, { stock: 5 });

    const updated = await products.findOneByOrFail({ id });

    expect(updated.updatedAt.getTime()).toBeGreaterThan(
      created.updatedAt.getTime()
    );
    expect(updated.createdAt).toEqual(created.createdAt);
  });
});
