import { defineMetrics } from '@viniciusferreira7/signals';

export const metrics = defineMetrics(
  {
    products_created: {
      kind: 'counter',
      description: 'Products created by sellers, by outcome',
    },
    product_price: {
      kind: 'histogram',
      description: 'Price of each product created',
      unit: '{amount}',
    },
    catalog_reads: {
      kind: 'counter',
      description: 'Catalog queries, by query and outcome',
    },
    catalog_read_duration: {
      kind: 'histogram',
      description: 'Time spent answering one catalog query',
      unit: 'ms',
    },
  },
  'products-service'
);
