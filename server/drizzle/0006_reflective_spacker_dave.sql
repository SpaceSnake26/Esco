DROP INDEX IF EXISTS `school_sessions_region`;--> statement-breakpoint
ALTER TABLE `school_sessions` ADD `order` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `school_sessions_region_order` ON `school_sessions` (`region_id`,`order`);