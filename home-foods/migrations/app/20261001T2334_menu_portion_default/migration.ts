#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/16e95f66860db533af7e42ceba52221c73927c8c4667586b2931f661cb6e7671/contract';
import startContract from '../../snapshots/16e95f66860db533af7e42ceba52221c73927c8c4667586b2931f661cb6e7671/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/a3025b17bc2a7f4b33a262e2278d844ebb037c87b889c7594c7af5f45a271712/contract';
import endContract from '../../snapshots/a3025b17bc2a7f4b33a262e2278d844ebb037c87b889c7594c7af5f45a271712/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'menuItemOption',
        column: col('isDefault', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
