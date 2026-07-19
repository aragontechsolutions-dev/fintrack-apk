CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'cash' NOT NULL,
	`currency` text DEFAULT 'UYU' NOT NULL,
	`opening_balance_minor` integer DEFAULT 0 NOT NULL,
	`color` text,
	`icon` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL,
	`updated_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_accounts_user` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text,
	`period` text DEFAULT 'monthly' NOT NULL,
	`limit_minor` integer NOT NULL,
	`currency` text DEFAULT 'UYU' NOT NULL,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_budgets_user` ON `budgets` (`user_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`parent_id` text,
	`color` text,
	`icon` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_categories_user_kind` ON `categories` (`user_id`,`kind`);--> statement-breakpoint
CREATE TABLE `currencies` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`symbol` text NOT NULL,
	`minor_unit` integer DEFAULT 2 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `exchange_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`base` text NOT NULL,
	`quote` text NOT NULL,
	`rate_scaled` integer NOT NULL,
	`date` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rates_user_pair_date` ON `exchange_rates` (`user_id`,`base`,`quote`,`date`);--> statement-breakpoint
CREATE TABLE `savings_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`date` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`transaction_id` text,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_contrib_plan` ON `savings_contributions` (`plan_id`);--> statement-breakpoint
CREATE INDEX `idx_contrib_user` ON `savings_contributions` (`user_id`);--> statement-breakpoint
CREATE TABLE `savings_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`target_minor` integer NOT NULL,
	`currency` text DEFAULT 'UYU' NOT NULL,
	`target_date` text,
	`kind` text DEFAULT 'goal' NOT NULL,
	`account_id` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_plans_user` ON `savings_plans` (`user_id`);--> statement-breakpoint
CREATE TABLE `transaction_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`description` text NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit_price_minor` integer DEFAULT 0 NOT NULL,
	`line_total_minor` integer DEFAULT 0 NOT NULL,
	`category_id` text,
	`ocr_confidence` real,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_items_txn` ON `transaction_items` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_items_user` ON `transaction_items` (`user_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`category_id` text,
	`type` text NOT NULL,
	`date` text NOT NULL,
	`payee` text,
	`notes` text,
	`amount_minor` integer NOT NULL,
	`currency` text DEFAULT 'UYU' NOT NULL,
	`fx_rate_to_base_scaled` integer DEFAULT 1000000 NOT NULL,
	`amount_base_minor` integer NOT NULL,
	`has_line_items` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`transfer_group_id` text,
	`receipt_image_path` text,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL,
	`updated_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_txn_user_date` ON `transactions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_txn_account` ON `transactions` (`user_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `idx_txn_category` ON `transactions` (`user_id`,`category_id`);--> statement-breakpoint
CREATE INDEX `idx_txn_transfer` ON `transactions` (`transfer_group_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`base_currency` text DEFAULT 'UYU' NOT NULL,
	`biometric_enabled` integer DEFAULT false NOT NULL,
	`auto_logout_seconds` integer DEFAULT 120 NOT NULL,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL,
	`updated_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL
);
