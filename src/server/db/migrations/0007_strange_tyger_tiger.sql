CREATE TABLE `shopping_bought` (
	`ingredient_id` integer NOT NULL,
	`date` text NOT NULL,
	`moment` text NOT NULL,
	`meal_id` integer NOT NULL,
	PRIMARY KEY(`ingredient_id`, `date`, `moment`, `meal_id`),
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredient`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`meal_id`) REFERENCES `meal`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `shopping_extra` ADD `checked_on` text;--> statement-breakpoint
-- ticks "bought up to a day" become "bought for the meals planned (and counted) up to that day"
INSERT OR IGNORE INTO `shopping_bought` (`ingredient_id`, `date`, `moment`, `meal_id`)
SELECT DISTINCT ri.`ingredient_id`, ps.`date`, ps.`moment`, pe.`meal_id`
FROM `shopping_check` sc
JOIN `recipe_ingredient` ri ON ri.`ingredient_id` = sc.`ingredient_id`
JOIN `plan_entry` pe ON pe.`recipe_id` = ri.`recipe_id` AND pe.`excluded` = 0
JOIN `plan_slot` ps ON ps.`id` = pe.`slot_id` AND ps.`date` <= sc.`until` AND ps.`date` >= date('now', 'localtime');--> statement-breakpoint
-- lines already ticked go away tomorrow
UPDATE `shopping_extra` SET `checked_on` = date('now', 'localtime') WHERE `checked` = 1;
