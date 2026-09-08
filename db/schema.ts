import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const simulationRuns = sqliteTable('simulation_runs', {
  id: text('id').primaryKey(), name: text('name').notNull(), status: text('status').notNull(), createdAt: text('created_at').notNull(), completedAt: text('completed_at'), provider: text('provider').notNull(), model: text('model').notNull(), historicalDays: integer('historical_days').notNull(), futureDays: integer('future_days').notNull(), densityScale: integer('density_scale').notNull(), selectedCount: integer('selected_count').notNull(), completedCount: integer('completed_count').notNull().default(0), failedCount: integer('failed_count').notNull().default(0), errorSummary: text('error_summary'), selectedIdsJson: text('selected_ids_json').notNull(),
});

export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(), runId: text('run_id').notNull(), personaId: text('persona_id').notNull(), phase: text('phase').notNull(), sessionId: text('session_id').notNull(), timestamp: text('timestamp').notNull(), speaker: text('speaker').notNull(), content: text('content').notNull(), sequence: integer('sequence').notNull(), model: text('model').notNull(),
}, (table) => [index('messages_run_persona_idx').on(table.runId, table.personaId), index('messages_timestamp_idx').on(table.timestamp)]);

export const memoryFragments = sqliteTable('memory_fragments', {
  id: text('id').primaryKey(), runId: text('run_id').notNull(), personaId: text('persona_id').notNull(), dayKey: text('day_key').notNull(), phase: text('phase').notNull(), domain: text('domain').notNull(), kind: text('kind').notNull(), content: text('content').notNull(), confidence: integer('confidence').notNull(), evidenceType: text('evidence_type').notNull(), privacy: text('privacy').notNull(), socialIntent: integer('social_intent', { mode: 'boolean' }).notNull(), sourceMessageIdsJson: text('source_message_ids_json').notNull(), status: text('status').notNull(),
}, (table) => [index('memory_run_persona_idx').on(table.runId, table.personaId), index('memory_day_idx').on(table.dayKey)]);

export const simulationFailures = sqliteTable('simulation_failures', {
  id: text('id').primaryKey(), runId: text('run_id').notNull(), personaId: text('persona_id').notNull(), phase: text('phase').notNull(), message: text('message').notNull(), createdAt: text('created_at').notNull(),
}, (table) => [index('failures_run_idx').on(table.runId)]);
