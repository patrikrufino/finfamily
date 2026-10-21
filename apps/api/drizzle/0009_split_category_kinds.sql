-- Categories are now either income or expense. Old "both" categories become expense categories; when income
-- already used one, an income twin (same name and icon) is created and that income is moved to it. Nothing is lost.
INSERT INTO `categories` (`name`, `kind`, `icon`, `archived`)
SELECT c.`name`, 'income', c.`icon`, c.`archived`
FROM `categories` c
WHERE c.`kind` = 'both'
  AND (
    EXISTS (SELECT 1 FROM `transactions` t WHERE t.`category_id` = c.`id` AND t.`kind` = 'income')
    OR EXISTS (SELECT 1 FROM `recurring_rules` r WHERE r.`category_id` = c.`id` AND r.`kind` = 'income')
  );--> statement-breakpoint
UPDATE `transactions`
SET `category_id` = (
  SELECT i.`id` FROM `categories` o JOIN `categories` i ON i.`name` = o.`name` AND i.`kind` = 'income'
  WHERE o.`id` = `transactions`.`category_id`
)
WHERE `kind` = 'income' AND `category_id` IN (SELECT `id` FROM `categories` WHERE `kind` = 'both');--> statement-breakpoint
UPDATE `recurring_rules`
SET `category_id` = (
  SELECT i.`id` FROM `categories` o JOIN `categories` i ON i.`name` = o.`name` AND i.`kind` = 'income'
  WHERE o.`id` = `recurring_rules`.`category_id`
)
WHERE `kind` = 'income' AND `category_id` IN (SELECT `id` FROM `categories` WHERE `kind` = 'both');--> statement-breakpoint
UPDATE `categories` SET `kind` = 'expense' WHERE `kind` = 'both';
