CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`season_start` text NOT NULL,
	`season_end` text NOT NULL,
	`stake_text` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`pin_hash` text NOT NULL,
	`avatar` text DEFAULT '🧑' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
