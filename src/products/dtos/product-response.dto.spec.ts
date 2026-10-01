import type { Product } from '../entities/product.entity';
import { ProductResponseDto } from './product-response.dto';

const createdAt = new Date('2026-10-01T12:00:00.000Z');

const product = {
  id: 'product-1',
  name: 'Mechanical keyboard',
  description: 'Hot-swappable, 75% layout',
  price: 349.9,
  stock: 10,
  sellerId: 'seller-1',
  isActive: true,
  createdAt,
  updatedAt: createdAt,
} satisfies Product;

describe('ProductResponseDto.from', () => {
  it('copies exactly the product fields', () => {
    expect({ ...ProductResponseDto.from(product) }).toEqual(product);
  });

  it('drops anything else the entity object carries', () => {
    const loaded = { ...product, internalNote: 'do not expose' };

    expect(ProductResponseDto.from(loaded)).not.toHaveProperty('internalNote');
  });
});
