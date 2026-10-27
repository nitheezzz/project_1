CREATE TABLE `account_challenges` (
	`id` varchar(36) NOT NULL,
	`purpose` enum('signup','password_reset') NOT NULL,
	`userId` int,
	`username` varchar(24) NOT NULL,
	`email` varchar(320) NOT NULL,
	`verificationCode` varchar(64),
	`expiresAt` timestamp NOT NULL,
	`sentAt` timestamp NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`sendWindowAt` timestamp,
	`sendCount` int NOT NULL DEFAULT 1,
	`verifiedAt` timestamp,
	`continuationHash` varchar(64),
	`continuationExpiresAt` timestamp,
	`consumedAt` timestamp,
	`legalConsentVersion` varchar(24),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `account_challenges_id` PRIMARY KEY(`id`),
	CONSTRAINT `account_challenges_purpose_username_unique` UNIQUE(`purpose`,`username`)
);
--> statement-breakpoint
CREATE INDEX `account_challenges_email_idx` ON `account_challenges` (`purpose`,`email`);--> statement-breakpoint
CREATE INDEX `account_challenges_user_idx` ON `account_challenges` (`userId`);--> statement-breakpoint
CREATE INDEX `account_challenges_expiry_idx` ON `account_challenges` (`expiresAt`);