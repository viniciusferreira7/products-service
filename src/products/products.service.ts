import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { CreateProductDto } from './dtos/create-product.dto';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>
  ) {}

  /**
   * Inserts an active product owned by `sellerId` and reads it back, so the
   * result carries the database-generated fields. Fields are copied one by
   * one: nothing else on `dto` can reach the row.
   */
  async create(dto: CreateProductDto, sellerId: string): Promise<Product> {
    const { id } = await this.products.save(
      this.products.create({
        name: dto.name,
        description: dto.description,
        price: dto.price,
        stock: dto.stock,
        sellerId,
        isActive: true,
      })
    );

    return this.products.findOneByOrFail({ id });
  }
}
