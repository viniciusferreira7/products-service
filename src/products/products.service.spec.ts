import type { Repository } from 'typeorm';
import { metrics } from '../observability/metrics';
import type { CreateProductDto } from './dtos/create-product.dto';
import type { Product } from './entities/product.entity';
import { ProductsService } from './products.service';

const dto: CreateProductDto = {
  name: 'Mechanical keyboard',
  description: 'Hot-swappable, 75% layout',
  price: 349.9,
  stock: 10,
};
const sellerId = '6f1c1d2e-8a4b-4c3d-9e5f-0a1b2c3d4e5f';

function makeRepository() {
  return {
    create: vi.fn((input: Partial<Product>) => ({ ...input })),
    save: vi.fn(async (entity: Partial<Product>) => ({
      ...entity,
      id: 'product-1',
    })),
    findOneByOrFail: vi.fn(async ({ id }: { id: string }) => ({
      id,
      ...dto,
      sellerId,
      isActive: true,
    })),
    findOneBy: vi.fn(),
    find: vi.fn(),
  };
}

function makeService(repository: ReturnType<typeof makeRepository>) {
  return new ProductsService(repository as unknown as Repository<Product>);
}

describe('ProductsService', () => {
  it('saves the product for the given seller, active', async () => {
    const repository = makeRepository();

    await makeService(repository).create(dto, sellerId);

    expect(repository.save).toHaveBeenCalledWith({
      ...dto,
      sellerId,
      isActive: true,
    });
  });

  it('returns the product read back by id', async () => {
    const repository = makeRepository();
    const readBack = { id: 'product-1', ...dto } as Product;
    repository.findOneByOrFail.mockResolvedValue(readBack);

    await expect(makeService(repository).create(dto, sellerId)).resolves.toBe(
      readBack
    );
    expect(repository.findOneByOrFail).toHaveBeenCalledWith({
      id: 'product-1',
    });
  });

  it('copies only the known fields, whatever else the object carries', async () => {
    const repository = makeRepository();
    const smuggled = {
      ...dto,
      sellerId: 'someone-else',
      isActive: false,
    } as CreateProductDto;

    await makeService(repository).create(smuggled, sellerId);

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ sellerId, isActive: true })
    );
  });

  it('lets a database error from save propagate untouched', async () => {
    const repository = makeRepository();
    const failure = new Error('connection lost');
    repository.save.mockRejectedValue(failure);

    await expect(makeService(repository).create(dto, sellerId)).rejects.toBe(
      failure
    );
  });

  it('lists the active products, newest first', async () => {
    const repository = makeRepository();
    const active = [{ id: 'product-1' }] as Product[];
    repository.find.mockResolvedValue(active);

    await expect(makeService(repository).findActive()).resolves.toBe(active);
    expect(repository.find).toHaveBeenCalledWith({
      where: { isActive: true },
      order: { createdAt: 'DESC', id: 'ASC' },
    });
  });

  it("lists a seller's active products, newest first", async () => {
    const repository = makeRepository();
    const active = [{ id: 'product-1' }] as Product[];
    repository.find.mockResolvedValue(active);

    await expect(
      makeService(repository).findActiveBySeller(sellerId)
    ).resolves.toBe(active);
    expect(repository.find).toHaveBeenCalledWith({
      where: { sellerId, isActive: true },
      order: { createdAt: 'DESC', id: 'ASC' },
    });
  });

  it('looks an active product up by id', async () => {
    const repository = makeRepository();
    const product = { id: 'product-1' } as Product;
    repository.findOneBy.mockResolvedValue(product);

    await expect(
      makeService(repository).findActiveById('product-1')
    ).resolves.toBe(product);
    expect(repository.findOneBy).toHaveBeenCalledWith({
      id: 'product-1',
      isActive: true,
    });
  });

  it('answers null when no active product has the id', async () => {
    const repository = makeRepository();
    repository.findOneBy.mockResolvedValue(null);

    await expect(
      makeService(repository).findActiveById('product-1')
    ).resolves.toBeNull();
  });
});

describe('ProductsService metrics', () => {
  let counters: ReturnType<typeof vi.spyOn>;
  let histograms: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // No meter provider under test: every counter is the same no-op object,
    // and so is every histogram — the attributes tell them apart.
    counters = vi.spyOn(metrics.catalog_reads, 'add');
    histograms = vi.spyOn(metrics.catalog_read_duration, 'record');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const readSettledWith = (query: string, outcome: string) => {
    expect(counters).toHaveBeenCalledWith(1, { query, outcome });
    expect(histograms).toHaveBeenCalledWith(expect.any(Number), {
      query,
      outcome,
    });
  };

  it('counts a created product and records its price', async () => {
    const repository = makeRepository();

    await makeService(repository).create(dto, sellerId);

    expect(counters).toHaveBeenCalledWith(1, { outcome: 'succeeded' });
    expect(histograms).toHaveBeenCalledWith(349.9);
  });

  it('counts a failed creation and rethrows the error', async () => {
    const repository = makeRepository();
    const failure = new Error('connection lost');
    repository.save.mockRejectedValue(failure);

    await expect(makeService(repository).create(dto, sellerId)).rejects.toBe(
      failure
    );

    expect(counters).toHaveBeenCalledWith(1, { outcome: 'failed' });
    expect(histograms).not.toHaveBeenCalledWith(349.9);
  });

  it.each([
    ['list', (service: ProductsService) => service.findActive()],
    [
      'by_seller',
      (service: ProductsService) => service.findActiveBySeller(sellerId),
    ],
  ])('counts a %s query that found products', async (query, run) => {
    const repository = makeRepository();
    repository.find.mockResolvedValue([{ id: 'product-1' }]);

    await run(makeService(repository));

    readSettledWith(query, 'found');
  });

  it.each([
    ['list', (service: ProductsService) => service.findActive()],
    [
      'by_seller',
      (service: ProductsService) => service.findActiveBySeller(sellerId),
    ],
  ])(
    'counts an empty %s query as empty, not as an error',
    async (query, run) => {
      const repository = makeRepository();
      repository.find.mockResolvedValue([]);

      await run(makeService(repository));

      readSettledWith(query, 'empty');
    }
  );

  it('counts a product found by id', async () => {
    const repository = makeRepository();
    repository.findOneBy.mockResolvedValue({ id: 'product-1' });

    await makeService(repository).findActiveById('product-1');

    readSettledWith('by_id', 'found');
  });

  it('counts an id with no active product as not_found', async () => {
    const repository = makeRepository();
    repository.findOneBy.mockResolvedValue(null);

    await makeService(repository).findActiveById('product-1');

    readSettledWith('by_id', 'not_found');
  });

  it('counts a failed query and rethrows the error', async () => {
    const repository = makeRepository();
    const failure = new Error('connection lost');
    repository.find.mockRejectedValue(failure);

    await expect(makeService(repository).findActive()).rejects.toBe(failure);

    readSettledWith('list', 'failed');
  });

  it('carries only closed-set attributes', async () => {
    const repository = makeRepository();
    repository.find.mockResolvedValue([{ id: 'product-1' }]);

    await makeService(repository).create(dto, sellerId);
    await makeService(repository).findActiveBySeller(sellerId);

    // A seller or product id as an attribute mints a series per seller.
    for (const [, attributes] of counters.mock.calls) {
      for (const key of Object.keys(attributes as object)) {
        expect(['query', 'outcome']).toContain(key);
      }
      expect(JSON.stringify(attributes)).not.toContain(sellerId);
    }
  });
});
