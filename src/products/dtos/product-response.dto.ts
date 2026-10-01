import { ApiProperty } from '@nestjs/swagger';
import type { Product } from '../entities/product.entity';

/**
 * The public shape of a product. Built field by field from the entity — an
 * allowlist — so a column added later is not exposed by accident.
 */
export class ProductResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Mechanical keyboard' })
  name: string;

  @ApiProperty({ example: 'Hot-swappable, 75% layout' })
  description: string;

  @ApiProperty({ example: 349.9 })
  price: number;

  @ApiProperty({ example: 10 })
  stock: number;

  @ApiProperty({
    format: 'uuid',
    description: 'The id of the seller who owns it',
  })
  sellerId: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static from(product: Product): ProductResponseDto {
    const dto = new ProductResponseDto();

    dto.id = product.id;
    dto.name = product.name;
    dto.description = product.description;
    dto.price = product.price;
    dto.stock = product.stock;
    dto.sellerId = product.sellerId;
    dto.isActive = product.isActive;
    dto.createdAt = product.createdAt;
    dto.updatedAt = product.updatedAt;

    return dto;
  }
}
