#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/9636a180b67df33196eb8f00f33510a028873aadd78aef8d9dd88d146aefeb41/contract';
import startContract from '../../snapshots/9636a180b67df33196eb8f00f33510a028873aadd78aef8d9dd88d146aefeb41/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/c6efd07880ad27401c510e16bfbebcb6684aa9cb6a766e78966c16ae4500141a/contract';
import endContract from '../../snapshots/c6efd07880ad27401c510e16bfbebcb6684aa9cb6a766e78966c16ae4500141a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'menuItem',
        column: col('modifierGroups', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
