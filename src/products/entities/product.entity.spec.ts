import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { decimalToNumberTransformer } from '../transformers/decimal-to-number.transformer';
import { Product } from './product.entity';

const storage = () => getMetadataArgsStorage();

const columnsOf = () => storage().columns.filter((c) => c.target === Product);

const column = (propertyName: string) => {
  const found = columnsOf().find((c) => c.propertyName === propertyName);

  if (!found) {
    throw new Error(`Product has no column "${propertyName}"`);
  }

  return found;
};

describe('Product entity', () => {
  it('maps to the products table', () => {
    expect(storage().tables.find((t) => t.target === Product)?.name).toBe(
      'products'
    );
  });

  it('declares exactly the nine product fields', () => {
    expect(
      columnsOf()
        .map((c) => c.propertyName)
        .sort()
    ).toEqual(
      [
        'createdAt',
        'description',
        'id',
        'isActive',
        'name',
        'price',
        'sellerId',
        'stock',
        'updatedAt',
      ].sort()
    );
  });

  it('generates a uuid primary key', () => {
    const generation = storage().generations.find(
      (g) => g.target === Product && g.propertyName === 'id'
    );

    expect(column('id').options.primary).toBe(true);
    expect(generation?.strategy).toBe('uuid');
  });

  it('stores the name as varchar(255) and the description as text', () => {
    expect(column('name').options).toMatchObject({
      type: 'varchar',
      length: 255,
    });
    expect(column('description').options.type).toBe('text');
  });

  it('stores the price as decimal(10,2) read back as a number', () => {
    expect(column('price').options).toMatchObject({
      type: 'decimal',
      precision: 10,
      scale: 2,
      transformer: decimalToNumberTransformer,
    });
  });

  it('defaults the stock to 0 and the product to active', () => {
    expect(column('stock').options).toMatchObject({ type: 'int', default: 0 });
    expect(column('isActive').options).toMatchObject({
      name: 'is_active',
      type: 'boolean',
      default: true,
    });
  });

  it('references the seller by uuid without a relation', () => {
    expect(column('sellerId').options).toMatchObject({
      name: 'seller_id',
      type: 'uuid',
    });
    // Users live in another service's database: no FK, no relation.
    expect(storage().relations.filter((r) => r.target === Product)).toEqual([]);
  });

  it('rejects negative prices and stock in the database', () => {
    const checks = storage()
      .checks.filter((c) => c.target === Product)
      .map(({ name, expression }) => ({ name, expression }));

    expect(checks).toEqual(
      expect.arrayContaining([
        {
          name: 'CHK_products_price_non_negative',
          expression: `"price" >= 0 AND "price" <> 'NaN'`,
        },
        { name: 'CHK_products_stock_non_negative', expression: '"stock" >= 0' },
      ])
    );
  });

  it('timestamps creation and update automatically', () => {
    expect(column('createdAt')).toMatchObject({
      mode: 'createDate',
      options: { name: 'created_at', type: 'timestamptz' },
    });
    expect(column('updatedAt')).toMatchObject({
      mode: 'updateDate',
      options: { name: 'updated_at', type: 'timestamptz' },
    });
  });
});
