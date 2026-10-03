import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { FindOptionsOrder, Repository } from 'typeorm';
import { metrics } from '../observability/metrics';
import type { CreateProductDto } from './dtos/create-product.dto';
import { Product } from './entities/product.entity';

/** Newest first, with the id as a tie-breaker, so the order is stable. */
const NEWEST_FIRST: FindOptionsOrder<Product> = {
  createdAt: 'DESC',
  id: 'ASC',
};

type CatalogQuery = 'list' | 'by_seller' | 'by_id';
type CatalogOutcome = 'found' | 'empty' | 'not_found' | 'failed';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>
  ) {}

  /**
   * Records how one catalog query ended, once. Attributes are a closed set:
   * seller and product ids belong in the log line.
   */
  private settleRead(
    query: CatalogQuery,
    outcome: CatalogOutcome,
    startedAt: number
  ): void {
    metrics.catalog_reads.add(1, { query, outcome });
    metrics.catalog_read_duration.record(Date.now() - startedAt, {
      query,
      outcome,
    });
  }

  /** Runs a list query, settling `found`/`empty`, or `failed` and rethrowing. */
  private async readList(
    query: Exclude<CatalogQuery, 'by_id'>,
    run: () => Promise<Product[]>
  ): Promise<Product[]> {
    const startedAt = Date.now();

    try {
      const found = await run();

      this.settleRead(query, found.length > 0 ? 'found' : 'empty', startedAt);

      return found;
    } catch (error) {
      this.settleRead(query, 'failed', startedAt);
      this.logger.error(
        `Catalog query ${query} failed`,
        error instanceof Error ? error.stack : undefined
      );

      throw error;
    }
  }

  findActive(): Promise<Product[]> {
    return this.readList('list', () =>
      this.products.find({ where: { isActive: true }, order: NEWEST_FIRST })
    );
  }

  findActiveBySeller(sellerId: string): Promise<Product[]> {
    return this.readList('by_seller', () =>
      this.products.find({
        where: { sellerId, isActive: true },
        order: NEWEST_FIRST,
      })
    );
  }

  /** An inactive product is left out of the catalog, so it answers null too. */
  async findActiveById(id: string): Promise<Product | null> {
    const startedAt = Date.now();

    try {
      const product = await this.products.findOneBy({ id, isActive: true });

      if (!product) {
        this.settleRead('by_id', 'not_found', startedAt);
        this.logger.debug(`No active product ${id}`);

        return null;
      }

      this.settleRead('by_id', 'found', startedAt);

      return product;
    } catch (error) {
      this.settleRead('by_id', 'failed', startedAt);
      this.logger.error(
        'Catalog query by_id failed',
        error instanceof Error ? error.stack : undefined
      );

      throw error;
    }
  }

  /**
   * Inserts an active product owned by `sellerId` and reads it back, so the
   * result carries the database-generated fields. Fields are copied one by
   * one: nothing else on `dto` can reach the row.
   */
  async create(dto: CreateProductDto, sellerId: string): Promise<Product> {
    try {
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

      const product = await this.products.findOneByOrFail({ id });

      metrics.products_created.add(1, { outcome: 'succeeded' });
      // The price is the recorded value, never an attribute.
      metrics.product_price.record(product.price);
      this.logger.log(`Seller ${sellerId} created product ${product.id}`);

      return product;
    } catch (error) {
      metrics.products_created.add(1, { outcome: 'failed' });
      this.logger.error(
        `Product creation failed for seller ${sellerId}`,
        error instanceof Error ? error.stack : undefined
      );

      throw error;
    }
  }
}
