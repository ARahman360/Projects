#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/12cd9fd27dd67397c0cad8bb6be9122d87fd3c51ef8df6537f537762d8942ea3/contract';
import endContract from '../../snapshots/12cd9fd27dd67397c0cad8bb6be9122d87fd3c51ef8df6537f537762d8942ea3/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/667c319a2f06c59b92e2d035cc4f3d25d5d3aa48ed227879cf988fabfa2a5ad2/contract';
import startContract from '../../snapshots/667c319a2f06c59b92e2d035cc4f3d25d5d3aa48ed227879cf988fabfa2a5ad2/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'subscriptionPlan',
        constraint: 'subscriptionPlan_type_check_b7b8ccce',
      }),
      this.createTable({
        schema: 'public',
        table: 'orderStatusEvent',
        columns: [
          col('actorId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('actorRole', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('domain', 'text', {
            notNull: true,
            default: lit('ORDER'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('message', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('orderId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'scheduledMeal',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deliveredAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('orderId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('portions', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('scheduledAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('UPCOMING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('subscriptionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('timeZone', 'text', {
            notNull: true,
            default: lit('Europe/Helsinki'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'scheduledMealEvent',
        columns: [
          col('actorId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('actorRole', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('message', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('scheduledMealId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'subscriptionPlanItem',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('menuItemId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('planId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('quantity', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'scheduledMeal',
        constraint: 'scheduledMeal_orderId_key',
        columns: ['orderId'],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'subscriptionPlan',
        constraint: 'subscriptionPlan_type_check_de9b01b6',
        expression: "\"type\" IN ('DAILY', 'THREE_DAY', 'WEEKLY', 'MONTHLY')",
      }),
      this.addUnique({
        schema: 'public',
        table: 'subscriptionPlanItem',
        constraint: 'subscriptionPlanItem_planId_menuItemId_key',
        columns: ['planId', 'menuItemId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'orderStatusEvent',
        index: 'orderStatusEvent_orderId_createdAt_idx_cf5e070a',
        columns: ['orderId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'orderStatusEvent',
        index: 'orderStatusEvent_orderId_idx_d284871b',
        columns: ['orderId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'scheduledMeal',
        index: 'scheduledMeal_status_scheduledAt_idx_62252894',
        columns: ['status', 'scheduledAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'scheduledMeal',
        index: 'scheduledMeal_subscriptionId_idx_edbe96bf',
        columns: ['subscriptionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'scheduledMeal',
        index: 'scheduledMeal_subscriptionId_scheduledAt_idx_886f07e4',
        columns: ['subscriptionId', 'scheduledAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'scheduledMealEvent',
        index: 'scheduledMealEvent_scheduledMealId_createdAt_idx_5f132ed1',
        columns: ['scheduledMealId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'scheduledMealEvent',
        index: 'scheduledMealEvent_scheduledMealId_idx_2a701afb',
        columns: ['scheduledMealId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'subscriptionPlanItem',
        index: 'subscriptionPlanItem_menuItemId_idx_715cce4c',
        columns: ['menuItemId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'subscriptionPlanItem',
        index: 'subscriptionPlanItem_planId_idx_5b32079a',
        columns: ['planId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'orderStatusEvent',
        foreignKey: {
          name: 'orderStatusEvent_orderId_fkey',
          columns: ['orderId'],
          references: { schema: 'public', table: 'order', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'scheduledMeal',
        foreignKey: {
          name: 'scheduledMeal_subscriptionId_fkey',
          columns: ['subscriptionId'],
          references: { schema: 'public', table: 'subscription', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'scheduledMeal',
        foreignKey: {
          name: 'scheduledMeal_orderId_fkey',
          columns: ['orderId'],
          references: { schema: 'public', table: 'order', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'scheduledMealEvent',
        foreignKey: {
          name: 'scheduledMealEvent_scheduledMealId_fkey',
          columns: ['scheduledMealId'],
          references: { schema: 'public', table: 'scheduledMeal', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'subscriptionPlanItem',
        foreignKey: {
          name: 'subscriptionPlanItem_planId_fkey',
          columns: ['planId'],
          references: { schema: 'public', table: 'subscriptionPlan', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'subscriptionPlanItem',
        foreignKey: {
          name: 'subscriptionPlanItem_menuItemId_fkey',
          columns: ['menuItemId'],
          references: { schema: 'public', table: 'menuItem', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
