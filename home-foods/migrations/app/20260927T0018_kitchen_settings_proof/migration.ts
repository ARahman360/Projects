#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0fe0ed3c2aa866e7753fe5451a619e873ca63c88fa77a80f6749417055d11430/contract';
import endContract from '../../snapshots/0fe0ed3c2aa866e7753fe5451a619e873ca63c88fa77a80f6749417055d11430/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/9eceda9b225dd63549754bab80b6e3f7be12106a9c15e93f43ffbbebe2aa6007/contract';
import startContract from '../../snapshots/9eceda9b225dd63549754bab80b6e3f7be12106a9c15e93f43ffbbebe2aa6007/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('pickupSnapshot', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'shop',
        column: col('locationVerificationHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'shop',
        column: col('locationVerifiedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'shop',
        column: col('profileCompletedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
