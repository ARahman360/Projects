#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/00e23e3d7ceda2a37b199cbc93e401c3343e9b89621d14ea43dfb524fd293c1f/contract';
import endContract from '../../snapshots/00e23e3d7ceda2a37b199cbc93e401c3343e9b89621d14ea43dfb524fd293c1f/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/483a954ac3cb24c433552e25a120bfef44c63c2764f9a4c2c2877da3e9365266/contract';
import startContract from '../../snapshots/483a954ac3cb24c433552e25a120bfef44c63c2764f9a4c2c2877da3e9365266/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'passwordResetToken',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'passwordResetToken',
        constraint: 'passwordResetToken_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'passwordResetToken',
        index: 'passwordResetToken_userId_createdAt_idx_f726f04a',
        columns: ['userId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'passwordResetToken',
        index: 'passwordResetToken_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'passwordResetToken',
        foreignKey: {
          name: 'passwordResetToken_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
