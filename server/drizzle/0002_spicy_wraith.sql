CREATE UNIQUE INDEX `regions_slug` ON `regions` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `school_sessions_region` ON `school_sessions` (`region_id`);