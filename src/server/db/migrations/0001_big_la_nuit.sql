ALTER TABLE `chat_conversation` ADD `updated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `chat_conversation` SET `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', `created_at`);
