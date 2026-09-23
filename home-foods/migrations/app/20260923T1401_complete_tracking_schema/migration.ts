#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/12cd9fd27dd67397c0cad8bb6be9122d87fd3c51ef8df6537f537762d8942ea3/contract';
import startContract from '../../snapshots/12cd9fd27dd67397c0cad8bb6be9122d87fd3c51ef8df6537f537762d8942ea3/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/42700e96dd0a086cdc56de8e4702a3a84565634c4bb1eec6273535d8b4d83a62/contract';
import endContract from '../../snapshots/42700e96dd0a086cdc56de8e4702a3a84565634c4bb1eec6273535d8b4d83a62/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'scheduledMeal',
        column: col('billingEventKey', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'scheduledMeal',
        column: col('sequence', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'scheduledMeal',
        constraint: 'scheduledMeal_subscriptionId_billingEventKey_sequence_key',
        columns: ['subscriptionId', 'billingEventKey', 'sequence'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
