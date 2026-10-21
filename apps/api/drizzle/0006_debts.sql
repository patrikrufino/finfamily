CREATE TABLE `debt_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`debt_id` integer NOT NULL,
	`kind` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`date` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `debts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`creditor` text NOT NULL,
	`original_cents` integer NOT NULL,
	`opened_on` text NOT NULL,
	`category_id` integer,
	`person_id` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `debt_id` integer REFERENCES debts(id);