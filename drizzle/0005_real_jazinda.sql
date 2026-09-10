CREATE TABLE `simulation_tasks` (
	`run_id` text NOT NULL,
	`persona_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`next_session` integer DEFAULT 0 NOT NULL,
	`total_sessions` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`run_id`, `persona_id`)
);
--> statement-breakpoint
CREATE INDEX `tasks_run_status_idx` ON `simulation_tasks` (`run_id`,`status`);