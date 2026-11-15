CREATE TABLE `chat_conversation` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_message` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`message` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_message_conv` ON `chat_message` (`conversation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `chat_message_conv_id` ON `chat_message` (`conversation_id`,`id`);--> statement-breakpoint
CREATE TABLE `ciqual_food` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_norm` text NOT NULL,
	`group_name` text,
	`kcal` real,
	`protein` real,
	`carbs` real,
	`fat` real,
	`fibre` real
);
--> statement-breakpoint
CREATE INDEX `ciqual_food_name_norm` ON `ciqual_food` (`name_norm`);--> statement-breakpoint
CREATE TABLE `ingredient` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`name_norm` text NOT NULL,
	`aisle` text DEFAULT 'autre' NOT NULL,
	`kcal` real,
	`protein` real,
	`carbs` real,
	`fat` real,
	`fibre` real,
	`ciqual_code` text,
	`source` text DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingredient_name_unique` ON `ingredient` (`name`);--> statement-breakpoint
CREATE TABLE `meal` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`name_norm` text NOT NULL,
	`kind` text DEFAULT 'plat' NOT NULL,
	`status` text DEFAULT 'regular' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plan_entry` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slot_id` integer NOT NULL,
	`meal_id` integer NOT NULL,
	`recipe_id` integer,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`slot_id`) REFERENCES `plan_slot`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`meal_id`) REFERENCES `meal`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `plan_entry_slot` ON `plan_entry` (`slot_id`);--> statement-breakpoint
CREATE INDEX `plan_entry_meal` ON `plan_entry` (`meal_id`);--> statement-breakpoint
CREATE TABLE `plan_slot` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`moment` text NOT NULL,
	`servings` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_slot_date_moment` ON `plan_slot` (`date`,`moment`);--> statement-breakpoint
CREATE TABLE `recipe` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`meal_id` integer NOT NULL,
	`name` text NOT NULL,
	`servings` integer DEFAULT 4 NOT NULL,
	`duration_min` integer,
	`steps` text DEFAULT '[]' NOT NULL,
	`source_url` text,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`meal_id`) REFERENCES `meal`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_meal` ON `recipe` (`meal_id`);--> statement-breakpoint
CREATE TABLE `recipe_ingredient` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipe_id` integer NOT NULL,
	`ingredient_id` integer NOT NULL,
	`quantity` real,
	`unit` text DEFAULT '' NOT NULL,
	`grams` real,
	`grams_estimated` integer DEFAULT false NOT NULL,
	`note` text,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredient`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recipe_ingredient_recipe` ON `recipe_ingredient` (`recipe_id`);--> statement-breakpoint
CREATE TABLE `setting` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shopping_check` (
	`week` text NOT NULL,
	`ingredient_id` integer NOT NULL,
	PRIMARY KEY(`week`, `ingredient_id`),
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredient`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `shopping_extra` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week` text NOT NULL,
	`label` text NOT NULL,
	`checked` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `shopping_extra_week` ON `shopping_extra` (`week`);