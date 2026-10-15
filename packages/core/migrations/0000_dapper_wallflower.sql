CREATE TABLE `idea_signals` (
	`idea_id` integer NOT NULL,
	`signal_id` integer NOT NULL,
	PRIMARY KEY(`idea_id`, `signal_id`),
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`signal_id`) REFERENCES `signals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ideas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`pitch` text,
	`notes` text,
	`status` text DEFAULT 'inbox' NOT NULL,
	`origin` text DEFAULT 'manual' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ideas_status` ON `ideas` (`status`);--> statement-breakpoint
CREATE TABLE `signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text DEFAULT 'other' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`title` text NOT NULL,
	`url` text,
	`note` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`external_id` text,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signals_source_external_id` ON `signals` (`source`,`external_id`);--> statement-breakpoint
CREATE INDEX `signals_status_created` ON `signals` (`status`,`created_at`);