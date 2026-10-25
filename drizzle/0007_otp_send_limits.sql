ALTER TABLE `users` ADD `verificationSendWindowAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `verificationSendCount` int DEFAULT 0 NOT NULL;