-- The sessions written before this migration hold plain ids, which a copy of the database
-- could turn into working cookies (gate 2 of PR #51); they are dropped, so each operator
-- logs in once more. From now on the row keeps the SHA-256 of the id, never the id.
DELETE FROM `operator_sessions`;--> statement-breakpoint
ALTER TABLE `operator_sessions` RENAME COLUMN `sessionId` TO `sessionIdHash`;