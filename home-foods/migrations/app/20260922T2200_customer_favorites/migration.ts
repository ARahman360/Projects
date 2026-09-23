#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/7ad92bdca27c3f6f7041531016d63714510b7d93e9f387b1f253f28643a09128/contract';
import endContract from '../../snapshots/7ad92bdca27c3f6f7041531016d63714510b7d93e9f387b1f253f28643a09128/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/bf04e8e7681d760be26fcc8111dabb7179643be520b742d5d9a2a3f75aad296c/contract';
import startContract from '../../snapshots/bf04e8e7681d760be26fcc8111dabb7179643be520b742d5d9a2a3f75aad296c/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'favorite',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('customerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('menuItemId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('shopId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'favorite',
        constraint: 'favorite_customerId_menuItemId_key',
        columns: ['customerId', 'menuItemId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'favorite',
        index: 'favorite_customerId_idx_b2a8a46c',
        columns: ['customerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'favorite',
        index: 'favorite_menuItemId_idx_715cce4c',
        columns: ['menuItemId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'favorite',
        index: 'favorite_shopId_idx_e9207c6b',
        columns: ['shopId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'favorite',
        foreignKey: {
          name: 'favorite_customerId_fkey',
          columns: ['customerId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'favorite',
        foreignKey: {
          name: 'favorite_shopId_fkey',
          columns: ['shopId'],
          references: { schema: 'public', table: 'shop', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'favorite',
        foreignKey: {
          name: 'favorite_menuItemId_fkey',
          columns: ['menuItemId'],
          references: { schema: 'public', table: 'menuItem', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
