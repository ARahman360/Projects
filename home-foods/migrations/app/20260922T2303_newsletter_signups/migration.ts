#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/483a954ac3cb24c433552e25a120bfef44c63c2764f9a4c2c2877da3e9365266/contract';
import endContract from '../../snapshots/483a954ac3cb24c433552e25a120bfef44c63c2764f9a4c2c2877da3e9365266/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/7ad92bdca27c3f6f7041531016d63714510b7d93e9f387b1f253f28643a09128/contract';
import startContract from '../../snapshots/7ad92bdca27c3f6f7041531016d63714510b7d93e9f387b1f253f28643a09128/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'newsletterSubscriber',
        columns: [
          col('consentAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'newsletterSubscriber',
        constraint: 'newsletterSubscriber_email_key',
        columns: ['email'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
