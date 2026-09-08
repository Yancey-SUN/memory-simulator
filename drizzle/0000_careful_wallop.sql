CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`persona_id` text NOT NULL,
	`phase` text NOT NULL,
	`session_id` text NOT NULL,
	`timestamp` text NOT NULL,
	`speaker` text NOT NULL,
	`content` text NOT NULL,
	`sequence` integer NOT NULL,
	`model` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `messages_run_persona_idx` ON `chat_messages` (`run_id`,`persona_id`);--> statement-breakpoint
CREATE INDEX `messages_timestamp_idx` ON `chat_messages` (`timestamp`);--> statement-breakpoint
CREATE TABLE `memory_fragments` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`persona_id` text NOT NULL,
	`day_key` text NOT NULL,
	`phase` text NOT NULL,
	`domain` text NOT NULL,
	`kind` text NOT NULL,
	`content` text NOT NULL,
	`confidence` integer NOT NULL,
	`evidence_type` text NOT NULL,
	`privacy` text NOT NULL,
	`social_intent` integer NOT NULL,
	`source_message_ids_json` text NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `memory_run_persona_idx` ON `memory_fragments` (`run_id`,`persona_id`);--> statement-breakpoint
CREATE INDEX `memory_day_idx` ON `memory_fragments` (`day_key`);--> statement-breakpoint
CREATE TABLE `simulation_failures` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`persona_id` text NOT NULL,
	`phase` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `failures_run_idx` ON `simulation_failures` (`run_id`);--> statement-breakpoint
CREATE TABLE `simulation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`historical_days` integer NOT NULL,
	`future_days` integer NOT NULL,
	`density_scale` integer NOT NULL,
	`selected_count` integer NOT NULL,
	`completed_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`error_summary` text,
	`selected_ids_json` text NOT NULL
);
