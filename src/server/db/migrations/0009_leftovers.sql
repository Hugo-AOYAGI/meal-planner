CREATE TABLE `leftover` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slot_id` integer,
	`meal_id` integer,
	`name` text,
	`created_on` text NOT NULL,
	`portions` integer NOT NULL,
	`done_on` text,
	`done_reason` text,
	FOREIGN KEY (`slot_id`) REFERENCES `plan_slot`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`meal_id`) REFERENCES `meal`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leftover_slot_meal` ON `leftover` (`slot_id`,`meal_id`);--> statement-breakpoint
CREATE TABLE `push_subscription` (
	`endpoint` text PRIMARY KEY NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `meal` ADD `last_keep` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `plan_entry` ADD `keep` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `plan_entry` ADD `leftover_id` integer REFERENCES leftover(id) ON DELETE set null;