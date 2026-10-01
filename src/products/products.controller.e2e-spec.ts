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
const NOT_FOUND = {
  message: 'Product not found',
  error: 'Not Found',
  statusCode: 404,
};
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

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

  describe('catalog reads', () => {
    const otherSellerId = randomUUID();
    const minutesAgo = (minutes: number) =>
      new Date(Date.now() - minutes * 60_000);

    const seed = (overrides: Partial<Product>) =>
      products.save(
        products.create({
          name: 'Mechanical keyboard',
          description: 'Hot-swappable, 75% layout',
          price: 349.9,
          stock: 10,
          sellerId: seller.id,
          isActive: true,
          ...overrides,
        })
      );

    const get = (path: string) => request(app.getHttpServer()).get(path);
    const namesOf = (body: { name: string }[]) => body.map(({ name }) => name);

    let oldest: Product;
    let inactive: Product;

    beforeEach(async () => {
      oldest = await seed({ name: 'Oldest', createdAt: minutesAgo(30) });
      await seed({ name: 'Newest', createdAt: minutesAgo(1) });
      await seed({
        name: 'Other seller',
        sellerId: otherSellerId,
        createdAt: minutesAgo(10),
      });
      inactive = await seed({
        name: 'Inactive',
        isActive: false,
        createdAt: minutesAgo(5),
      });
    });

    describe('GET /products', () => {
      it('lists only active products, newest first, without a token', async () => {
        const response = await get('/products').expect(200);

        expect(namesOf(response.body)).toEqual([
          'Newest',
          'Other seller',
          'Oldest',
        ]);
      });

      it('answers each product in the public shape', async () => {
        const response = await get('/products').expect(200);

        expect(response.body.at(-1)).toEqual({
          id: oldest.id,
          name: 'Oldest',
          description: 'Hot-swappable, 75% layout',
          price: 349.9,
          stock: 10,
          sellerId: seller.id,
          isActive: true,
          createdAt: oldest.createdAt.toISOString(),
          updatedAt: expect.any(String),
        });
      });

      it('ignores a bad token', async () => {
        await get('/products')
          .set('Authorization', 'Bearer not-a-token')
          .expect(200);
      });
    });

    describe('GET /products/seller/:sellerId', () => {
      it("lists only the seller's active products, newest first", async () => {
        const response = await get(`/products/seller/${seller.id}`).expect(200);

        expect(namesOf(response.body)).toEqual(['Newest', 'Oldest']);
      });

      it('answers an empty list for a seller with no products', async () => {
        const response = await get(`/products/seller/${UNKNOWN_ID}`).expect(
          200
        );

        expect(response.body).toEqual([]);
      });

      it('answers 400 for a seller id that is not a uuid', async () => {
        await get('/products/seller/not-a-uuid').expect(400);
      });
    });

    describe('GET /products/:id', () => {
      it('answers the product without a token', async () => {
        const response = await get(`/products/${oldest.id}`).expect(200);

        expect(response.body).toMatchObject({ id: oldest.id, name: 'Oldest' });
      });

      it('answers 404 for an id no product has', async () => {
        const response = await get(`/products/${UNKNOWN_ID}`).expect(404);

        expect(response.body).toEqual(NOT_FOUND);
      });

      it('answers 404 for an inactive product', async () => {
        const response = await get(`/products/${inactive.id}`).expect(404);

        expect(response.body).toEqual(NOT_FOUND);
      });

      it('answers 400 for an id that is not a uuid', async () => {
        await get('/products/not-a-uuid').expect(400);
      });
    });
  });
});
