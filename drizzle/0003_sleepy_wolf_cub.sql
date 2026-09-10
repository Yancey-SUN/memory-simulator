ALTER TABLE `prompt_templates` ADD `guardian_spec` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `simulation_runs` ADD `guardian_spec` text;