import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { decimalToNumberTransformer } from '../transformers/decimal-to-number.transformer';

@Entity('products')
// Postgres sorts NaN above every number, so `>= 0` alone would accept it.
@Check('CHK_products_price_non_negative', `"price" >= 0 AND "price" <> 'NaN'`)
@Check('CHK_products_stock_non_negative', '"stock" >= 0')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalToNumberTransformer,
  })
  price: number;

  @Column({ type: 'int', default: 0 })
  stock: number;

  /**
   * The seller's user id. Users live in the users service's own database, so
   * there is no foreign key: nothing here checks that the seller exists.
   */
  @Column({ name: 'seller_id', type: 'uuid' })
  sellerId: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
