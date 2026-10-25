CREATE TABLE `direct_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`senderId` int NOT NULL,
	`recipientId` int NOT NULL,
	`body` varchar(3000) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `direct_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `friend_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fromUserId` int NOT NULL,
	`toUserId` int NOT NULL,
	`status` enum('pending','accepted','declined') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `friend_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `friend_requests_pair_unique` UNIQUE(`fromUserId`,`toUserId`)
);
--> statement-breakpoint
CREATE TABLE `friendships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userLowId` int NOT NULL,
	`userHighId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `friendships_id` PRIMARY KEY(`id`),
	CONSTRAINT `friendships_pair_unique` UNIQUE(`userLowId`,`userHighId`)
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `dueTime` varchar(5) DEFAULT '17:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `bio` varchar(180);--> statement-breakpoint
ALTER TABLE `users` ADD `profileColor` varchar(16) DEFAULT 'sage';--> statement-breakpoint
ALTER TABLE `direct_messages` ADD CONSTRAINT `direct_messages_senderId_users_id_fk` FOREIGN KEY (`senderId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `direct_messages` ADD CONSTRAINT `direct_messages_recipientId_users_id_fk` FOREIGN KEY (`recipientId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `friend_requests` ADD CONSTRAINT `friend_requests_fromUserId_users_id_fk` FOREIGN KEY (`fromUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `friend_requests` ADD CONSTRAINT `friend_requests_toUserId_users_id_fk` FOREIGN KEY (`toUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `friendships` ADD CONSTRAINT `friendships_userLowId_users_id_fk` FOREIGN KEY (`userLowId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `friendships` ADD CONSTRAINT `friendships_userHighId_users_id_fk` FOREIGN KEY (`userHighId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `direct_messages_conversation_idx` ON `direct_messages` (`senderId`,`recipientId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `friend_requests_inbox_idx` ON `friend_requests` (`toUserId`,`status`);--> statement-breakpoint
CREATE INDEX `friendships_low_idx` ON `friendships` (`userLowId`);--> statement-breakpoint
CREATE INDEX `friendships_high_idx` ON `friendships` (`userHighId`);