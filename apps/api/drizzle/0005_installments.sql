CREATE TABLE `installment_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`description` text NOT NULL,
	`total_cents` integer NOT NULL,
	`count` integer NOT NULL,
	`first_date` text NOT NULL,
	`account_id` integer,
	`card_id` integer,
	`category_id` integer,
	`person_id` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `plan_id` integer REFERENCES installment_plans(id);--> statement-breakpoint
ALTER TABLE `transactions` ADD `installment_number` integer;