import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { makeCreateProductBody } from 'test/factories/make-create-product-body';
import { makeModuleRef, startApp } from 'test/factories/make-module-ref';
import { signTestToken } from 'test/factories/make-token';
import { assertTestDatabase } from 'test/utils/assert-test-database';
import { DataSource, type Repository } from 'typeorm';
import { Product } from './entities/product.entity';

const UNAUTHORIZED = { message: 'Unauthorized', statusCode: 401 };
const FORBIDDEN = { message: 'Forbidden', statusCode: 403 };

describe('Products routes (E2E)', () => {
  let app: INestApplication;
  let products: Repository<Product>;

  const seller = { id: randomUUID(), email: 'ana@marketplace.dev' };
  const tokenFor = (role: string, id = seller.id) =>
    signTestToken({ sub: id, email: seller.email, role }, { expiresIn: '24h' });

  const create = (body: object, authorization?: string) => {
    const call = request(app.getHttpServer()).post('/products').send(body);

    return authorization ? call.set('Authorization', authorization) : call;
  };

  beforeAll(async () => {
    assertTestDatabase(process.env.DB_DATABASE);

    const moduleRef = await makeModuleRef();

    // `synchronize` is off outside dev, so build the schema on the throwaway
    // database from the entity itself.
    await moduleRef.get(DataSource).synchronize(true);

    app = await startApp(moduleRef);
    products = moduleRef.get(getRepositoryToken(Product));
  });

  beforeEach(async () => {
    await products.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /products', () => {
    it('answers 201 with the product, owned by the seller in the token and active', async () => {
      const response = await create(
        makeCreateProductBody(),
        `Bearer ${tokenFor('seller')}`
      ).expect(201);

      expect(response.body).toEqual({
        id: expect.any(String),
        name: 'Mechanical keyboard',
        description: 'Hot-swappable, 75% layout',
        price: 349.9,
        stock: 10,
        sellerId: seller.id,
        isActive: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('stores the product in the database', async () => {
      const response = await create(
        makeCreateProductBody({ price: 0.01, stock: 0 }),
        `Bearer ${tokenFor('seller')}`
      ).expect(201);

      await expect(
        products.findOneByOrFail({ id: response.body.id })
      ).resolves.toMatchObject({
        price: 0.01,
        stock: 0,
        sellerId: seller.id,
        isActive: true,
      });
    });

    it('answers 400 when the body carries a sellerId, and stores nothing', async () => {
      const response = await create(
        makeCreateProductBody({ sellerId: randomUUID() }),
        `Bearer ${tokenFor('seller')}`
      ).expect(400);

      expect(response.body.message).toEqual([
        'property sellerId should not exist',
      ]);
      await expect(products.count()).resolves.toBe(0);
    });

    it('answers 400 when the body tries to set isActive', async () => {
      await create(
        makeCreateProductBody({ isActive: false }),
        `Bearer ${tokenFor('seller')}`
      ).expect(400);
    });

    it('answers 400 listing what is wrong with each field', async () => {
      const response = await create(
        { name: '', description: 'ok', price: 19.999, stock: -1 },
        `Bearer ${tokenFor('seller')}`
      ).expect(400);

      expect(response.body).toEqual({
        error: 'Bad Request',
        statusCode: 400,
        message: expect.arrayContaining([
          'name should not be empty',
          'price must be a number with at most 2 decimal places',
          'stock must not be less than 0',
        ]),
      });
    });

    it('answers 400 to an empty body', async () => {
      await create({}, `Bearer ${tokenFor('seller')}`).expect(400);
    });

    it('answers 401 without a token', async () => {
      const response = await create(makeCreateProductBody()).expect(401);

      expect(response.body).toEqual(UNAUTHORIZED);
    });

    it('answers 401 to an invalid token', async () => {
      const response = await create(
        makeCreateProductBody(),
        'Bearer not-a-token'
      ).expect(401);

      expect(response.body).toEqual(UNAUTHORIZED);
    });

    it('answers 403 to a buyer, and stores nothing', async () => {
      const response = await create(
        makeCreateProductBody(),
        `Bearer ${tokenFor('buyer')}`
      ).expect(403);

      expect(response.body).toEqual(FORBIDDEN);
      await expect(products.count()).resolves.toBe(0);
    });

    it('answers 403 to a buyer before looking at the body', async () => {
      const response = await create(
        { sellerId: 'x' },
        `Bearer ${tokenFor('buyer')}`
      ).expect(403);

      expect(response.body).toEqual(FORBIDDEN);
    });
  });
});
