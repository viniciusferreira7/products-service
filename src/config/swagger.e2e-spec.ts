import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import { readOpenApiDocument } from 'test/config/openapi';
import { makeModuleRef, startApp } from 'test/factories/make-module-ref';
import { SWAGGER_PATH, setupSwagger } from './swagger.config';

describe('Swagger (e2e)', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    app = await startApp(await makeModuleRef(), {
      beforeInit: async (nestApp) => {
        setupSwagger(nestApp);
      },
    });

    document = await readOpenApiDocument(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the Swagger UI at /api', async () => {
    const response = await request(app.getHttpServer())
      .get(`/${SWAGGER_PATH}`)
      .expect(200);

    expect(response.text).toContain('swagger-ui');
  });

  it('describes the service', () => {
    expect(document.info.title).toBe('Products Service');
  });

  it('documents every route the application exposes', () => {
    expect(Object.keys(document.paths).sort()).toEqual([
      '/',
      '/health',
      '/health/live',
      '/health/ready',
      '/health/startup',
      '/products',
      '/products/seller/{sellerId}',
      '/products/{id}',
    ]);
  });

  it('groups the probes and the greeting under Health', () => {
    for (const path of Object.keys(document.paths).filter(
      (path) => path === '/' || path.startsWith('/health')
    )) {
      expect(document.paths[path].get?.tags).toEqual(['Health']);
      expect(document.paths[path].get?.summary).toBeTruthy();
    }
  });

  it.each([
    ['/products', ['200']],
    ['/products/seller/{sellerId}', ['200', '400']],
    ['/products/{id}', ['200', '400', '404']],
  ])('documents GET %s under Products, without a token', (path, statuses) => {
    const operation = document.paths[path].get;

    expect(operation?.tags).toEqual(['Products']);
    expect(operation?.summary).toBeTruthy();
    expect(operation?.security).toBeUndefined();
    expect(Object.keys(operation?.responses ?? {}).sort()).toEqual(statuses);
  });

  it('documents POST /products under Products, behind the bearer token', () => {
    const operation = document.paths['/products'].post;

    expect(operation?.tags).toEqual(['Products']);
    expect(operation?.summary).toBeTruthy();
    expect(operation?.security).toEqual([{ 'JWT-auth': [] }]);
    expect(Object.keys(operation?.responses ?? {}).sort()).toEqual([
      '201',
      '400',
      '401',
      '403',
    ]);
  });
});
