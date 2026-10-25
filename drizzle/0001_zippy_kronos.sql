CREATE TABLE `notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` date NOT NULL,
	`title` varchar(240) NOT NULL,
	`body` text,
	`category` enum('study','planning','reflection') NOT NULL DEFAULT 'study',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(240) NOT NULL,
	`details` text,
	`dueDate` date,
	`assignee` varchar(160),
	`studyContext` varchar(180),
	`status` enum('todo','in_progress','done') NOT NULL DEFAULT 'todo',
	`priority` enum('low','normal','high') NOT NULL DEFAULT 'normal',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`userId` int NOT NULL,
	`spotifyLink` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_preferences_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `username` varchar(24);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` text;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`);--> statement-breakpoint
ALTER TABLE `notes` ADD CONSTRAINT `notes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD CONSTRAINT `user_preferences_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `notes_user_date_idx` ON `notes` (`userId`,`date`);--> statement-breakpoint
CREATE INDEX `tasks_user_due_idx` ON `tasks` (`userId`,`dueDate`);--> statement-breakpoint
CREATE INDEX `tasks_user_status_idx` ON `tasks` (`userId`,`status`);