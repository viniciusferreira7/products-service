import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { makeCreateProductBody } from 'test/factories/make-create-product-body';
import { CreateProductDto } from './create-product.dto';

/** Mirrors the global ValidationPipe options in `src/app.setup.ts`. */
async function validationErrorsOf(body: Record<string, unknown>) {
  return validate(plainToInstance(CreateProductDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

async function invalidPropertiesOf(body: Record<string, unknown>) {
  const errors = await validationErrorsOf(body);

  return errors.map((error) => error.property);
}

async function messagesFor(overrides: Record<string, unknown>) {
  const [error] = await validationErrorsOf(makeCreateProductBody(overrides));

  return Object.values(error?.constraints ?? {});
}

describe('CreateProductDto', () => {
  it('accepts a valid body', async () => {
    await expect(invalidPropertiesOf(makeCreateProductBody())).resolves.toEqual(
      []
    );
  });

  it.each([
    ['name', 'missing', { name: undefined }],
    ['name', 'empty', { name: '' }],
    ['name', 'whitespace only', { name: '   ' }],
    ['name', 'a number', { name: 42 }],
    ['name', 'longer than 255 characters', { name: 'a'.repeat(256) }],
    // Postgres rejects NUL in text columns (22021).
    ['name', 'holding a NUL character', { name: 'Key\u0000board' }],
    ['name', 'holding a line break', { name: 'Key\nboard' }],
    ['name', 'holding a lone surrogate', { name: 'Key\ud800board' }],
    ['description', 'missing', { description: undefined }],
    ['description', 'empty', { description: '' }],
    ['description', 'whitespace only', { description: ' \n ' }],
    ['description', 'a number', { description: 42 }],
    ['description', 'holding a NUL character', { description: 'Hot\u0000' }],
    ['description', 'holding a lone surrogate', { description: 'Hot\udc00' }],
    ['price', 'missing', { price: undefined }],
    ['price', 'null', { price: null }],
    ['price', 'a numeric string', { price: '19.90' }],
    ['price', 'zero', { price: 0 }],
    ['price', 'negative', { price: -1 }],
    ['price', 'below 0.01', { price: 0.009 }],
    ['price', 'with 3 decimal places', { price: 19.999 }],
    ['price', 'NaN', { price: Number.NaN }],
    ['price', 'Infinity', { price: Number.POSITIVE_INFINITY }],
    ['price', 'beyond decimal(10,2)', { price: 100000000 }],
    ['stock', 'missing', { stock: undefined }],
    ['stock', 'a numeric string', { stock: '10' }],
    ['stock', 'negative', { stock: -1 }],
    ['stock', 'a decimal', { stock: 1.5 }],
    ['sellerId', 'sent by the client', { sellerId: crypto.randomUUID() }],
    ['isActive', 'sent by the client', { isActive: false }],
    ['id', 'sent by the client', { id: crypto.randomUUID() }],
  ])('rejects %s when it is %s', async (property, _case, overrides) => {
    await expect(
      invalidPropertiesOf(makeCreateProductBody(overrides))
    ).resolves.toEqual([property]);
  });

  it.each([
    ['the minimum price', { price: 0.01 }],
    ['the largest decimal(10,2) price', { price: 99999999.99 }],
    ['a whole price', { price: 20 }],
    ['a price with 1 decimal place', { price: 19.9 }],
    ['no stock', { stock: 0 }],
    ['a 255-character name', { name: 'a'.repeat(255) }],
    ['a name with accents and emoji', { name: 'Teclado mecânico ⌨️' }],
    [
      'a multi-line description',
      { description: 'Hot-swappable.\r\n\tRGB backlight.' },
    ],
  ])('accepts %s', async (_case, overrides) => {
    await expect(
      invalidPropertiesOf(makeCreateProductBody(overrides))
    ).resolves.toEqual([]);
  });

  it.each([
    [{ name: '   ' }, 'name must not be blank'],
    [
      { name: 'a'.repeat(256) },
      'name must be shorter than or equal to 255 characters',
    ],
    [{ description: '' }, 'description must not be blank'],
    [{ price: 19.999 }, 'price must be a number with at most 2 decimal places'],
    [{ price: 0 }, 'price must not be less than 0.01'],
    [{ stock: 1.5 }, 'stock must be an integer number'],
    [{ stock: -1 }, 'stock must not be less than 0'],
  ])('explains what is wrong with %o', async (overrides, message) => {
    await expect(messagesFor(overrides)).resolves.toContain(message);
  });
});
