#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/00e23e3d7ceda2a37b199cbc93e401c3343e9b89621d14ea43dfb524fd293c1f/contract';
import startContract from '../../snapshots/00e23e3d7ceda2a37b199cbc93e401c3343e9b89621d14ea43dfb524fd293c1f/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/667c319a2f06c59b92e2d035cc4f3d25d5d3aa48ed227879cf988fabfa2a5ad2/contract';
import endContract from '../../snapshots/667c319a2f06c59b92e2d035cc4f3d25d5d3aa48ed227879cf988fabfa2a5ad2/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'kitchenFavorite',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('customerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('shopId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'kitchenFavorite',
        constraint: 'kitchenFavorite_customerId_shopId_key',
        columns: ['customerId', 'shopId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'kitchenFavorite',
        index: 'kitchenFavorite_customerId_idx_b2a8a46c',
        columns: ['customerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'kitchenFavorite',
        index: 'kitchenFavorite_shopId_idx_e9207c6b',
        columns: ['shopId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'kitchenFavorite',
        foreignKey: {
          name: 'kitchenFavorite_customerId_fkey',
          columns: ['customerId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'kitchenFavorite',
        foreignKey: {
          name: 'kitchenFavorite_shopId_fkey',
          columns: ['shopId'],
          references: { schema: 'public', table: 'shop', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
