CREATE TABLE `prompt_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`user_prompt` text NOT NULL,
	`agent_prompt` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `prompt_templates_updated_idx` ON `prompt_templates` (`updated_at`);--> statement-breakpoint
ALTER TABLE `simulation_runs` ADD `prompt_template_id` text;--> statement-breakpoint
ALTER TABLE `simulation_runs` ADD `prompt_name` text;--> statement-breakpoint
ALTER TABLE `simulation_runs` ADD `user_prompt` text;--> statement-breakpoint
ALTER TABLE `simulation_runs` ADD `agent_prompt` text;