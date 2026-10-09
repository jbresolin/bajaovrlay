CREATE TABLE `event_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ts` text NOT NULL,
	`actor` text NOT NULL,
	`command` text NOT NULL,
	`payload` text NOT NULL,
	`result` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `slices` (
	`name` text PRIMARY KEY NOT NULL,
	`json` text NOT NULL,
	`updatedAt` text NOT NULL
);
