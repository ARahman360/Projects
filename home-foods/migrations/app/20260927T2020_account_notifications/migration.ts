#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0fe0ed3c2aa866e7753fe5451a619e873ca63c88fa77a80f6749417055d11430/contract';
import startContract from '../../snapshots/0fe0ed3c2aa866e7753fe5451a619e873ca63c88fa77a80f6749417055d11430/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e6b80217a72e5809d8ca5d3a4adf2ec47102eae64c7db4cc6406ad151a80aa4e/contract';
import endContract from '../../snapshots/e6b80217a72e5809d8ca5d3a4adf2ec47102eae64c7db4cc6406ad151a80aa4e/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'emailChangeRequest',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
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
      this.createTable({
        schema: 'public',
        table: 'notification',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('eventKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('href', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('readAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('authVersion', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'emailChangeRequest',
        constraint: 'emailChangeRequest_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'notification',
        constraint: 'notification_eventKey_key',
        columns: ['eventKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'emailChangeRequest',
        index: 'emailChangeRequest_userId_createdAt_idx_f726f04a',
        columns: ['userId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'emailChangeRequest',
        index: 'emailChangeRequest_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notification',
        index: 'notification_userId_createdAt_idx_f726f04a',
        columns: ['userId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notification',
        index: 'notification_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'emailChangeRequest',
        foreignKey: {
          name: 'emailChangeRequest_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'notification',
        foreignKey: {
          name: 'notification_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
