CREATE TABLE `side_quests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`region_id` integer NOT NULL,
	`type` text NOT NULL,
	`payload_json` text NOT NULL,
	`points` integer NOT NULL,
	FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `side_quests_unique` ON `side_quests` (`date`,`region_id`,`type`);