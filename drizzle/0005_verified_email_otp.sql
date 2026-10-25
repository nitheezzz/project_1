ALTER TABLE `users` ADD `emailVerified` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `pendingEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `users` ADD `verificationCode` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `verificationPurpose` enum('registration','existing_account','email_change');--> statement-breakpoint
ALTER TABLE `users` ADD `verificationExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `verificationSentAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `verificationAttempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_pending_email_unique` UNIQUE(`pendingEmail`);