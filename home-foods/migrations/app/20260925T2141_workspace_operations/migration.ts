#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/37b167813551276fe914048c2deb52e2fa481a874010ec010cc4dacbcbe20af2/contract';
import startContract from '../../snapshots/37b167813551276fe914048c2deb52e2fa481a874010ec010cc4dacbcbe20af2/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/9eceda9b225dd63549754bab80b6e3f7be12106a9c15e93f43ffbbebe2aa6007/contract';
import endContract from '../../snapshots/9eceda9b225dd63549754bab80b6e3f7be12106a9c15e93f43ffbbebe2aa6007/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'adminAuditLog',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('actorId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('entityId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('entityType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('nextValue', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('previousValue', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'rider',
        column: col('isVerified', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'shop',
        column: col('isOnline', 'bool', {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('accountStatus', 'text', {
          notNull: true,
          default: lit('ACTIVE'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'adminAuditLog',
        index: 'adminAuditLog_entityType_entityId_createdAt_idx_e9eb579f',
        columns: ['entityType', 'entityId', 'createdAt'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
