import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'api';

/**
 * Describes this service for the OpenAPI document.
 *
 * The description is written flush left on purpose: Swagger UI renders it as
 * markdown, so indented lines would come out as a code block.
 */
export function buildSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('Products Service')
    .setDescription(
      [
        'Product catalog for the Marketplace system.',
        '',
        'Responsibilities:',
        '- Owns the products: name, description, price and stock',
        '- References each product seller by user id (users live in the users service)',
        '- Tracks whether a product is active',
        '',
        'Authentication:',
        '- Use a JWT Bearer token for protected routes',
      ].join('\n')
    )
    .setVersion('1.0')
    .setContact(
      'Marketplace Team',
      'https://marketplace.com',
      'dev@marketplace.com'
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth'
    )
    .addTag('Products', 'Product catalog endpoints')
    .addTag('Health', 'Health monitoring endpoints')
    .build();
}

/** Mounts Swagger UI at {@link SWAGGER_PATH}. */
export function setupSwagger(app: INestApplication): void {
  const document = SwaggerModule.createDocument(app, buildSwaggerConfig());

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'Products Service Documentation',
    customfavIcon: './favicon',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #3b82f6 }
    `,
  });
}
