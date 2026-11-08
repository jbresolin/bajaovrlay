CREATE TABLE `operator_sessions` (
	`sessionId` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`station` text NOT NULL,
	`createdAt` text NOT NULL,
	`expiresAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `server_secrets` (
	`name` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
