#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/16a02d759e17f3ae76431786d2338f23fdba0539ead099c54eb46d48af3857f2/contract';
import startContract from '../../snapshots/16a02d759e17f3ae76431786d2338f23fdba0539ead099c54eb46d48af3857f2/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/bf04e8e7681d760be26fcc8111dabb7179643be520b742d5d9a2a3f75aad296c/contract';
import endContract from '../../snapshots/bf04e8e7681d760be26fcc8111dabb7179643be520b742d5d9a2a3f75aad296c/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'subscription',
        column: col('addressId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'subscription',
        column: col('deliveryTime', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'subscription',
        column: col('portions', 'int4', {
          notNull: true,
          default: lit(1),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'subscription',
        column: col('stripeSubscriptionId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'subscriptionPlan',
        column: col('currency', 'text', {
          notNull: true,
          default: lit('GBP'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'subscription',
        constraint: 'subscription_stripeSubscriptionId_key',
        columns: ['stripeSubscriptionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'subscription',
        index: 'subscription_addressId_idx_a5ddb548',
        columns: ['addressId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'subscription',
        foreignKey: {
          name: 'subscription_addressId_fkey',
          columns: ['addressId'],
          references: { schema: 'public', table: 'address', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
