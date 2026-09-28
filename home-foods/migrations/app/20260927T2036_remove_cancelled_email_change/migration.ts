#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/16e95f66860db533af7e42ceba52221c73927c8c4667586b2931f661cb6e7671/contract';
import endContract from '../../snapshots/16e95f66860db533af7e42ceba52221c73927c8c4667586b2931f661cb6e7671/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e6b80217a72e5809d8ca5d3a4adf2ec47102eae64c7db4cc6406ad151a80aa4e/contract';
import startContract from '../../snapshots/e6b80217a72e5809d8ca5d3a4adf2ec47102eae64c7db4cc6406ad151a80aa4e/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [this.dropTable({ schema: 'public', table: 'emailChangeRequest' })];
  }
}

MigrationCLI.run(import.meta.url, M);
