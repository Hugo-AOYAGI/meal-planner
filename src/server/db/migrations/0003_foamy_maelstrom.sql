DROP INDEX `shopping_extra_week`;--> statement-breakpoint
ALTER TABLE `shopping_extra` DROP COLUMN `week`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_shopping_check` (
	`ingredient_id` integer PRIMARY KEY NOT NULL,
	`until` text NOT NULL,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredient`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
DROP TABLE `shopping_check`;--> statement-breakpoint
ALTER TABLE `__new_shopping_check` RENAME TO `shopping_check`;--> statement-breakpoint
PRAGMA foreign_keys=ON;