import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { FindOptionsOrder, Repository } from 'typeorm';
import type { CreateProductDto } from './dtos/create-product.dto';
import { Product } from './entities/product.entity';

/** Newest first, with the id as a tie-breaker, so the order is stable. */
const NEWEST_FIRST: FindOptionsOrder<Product> = {
  createdAt: 'DESC',
  id: 'ASC',
};

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>
  ) {}

  findActive(): Promise<Product[]> {
    return this.products.find({
      where: { isActive: true },
      order: NEWEST_FIRST,
    });
  }

  findActiveBySeller(sellerId: string): Promise<Product[]> {
    return this.products.find({
      where: { sellerId, isActive: true },
      order: NEWEST_FIRST,
    });
  }

  /** An inactive product is left out of the catalog, so it answers null too. */
  findActiveById(id: string): Promise<Product | null> {
    return this.products.findOneBy({ id, isActive: true });
  }

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
