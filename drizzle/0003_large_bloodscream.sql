CREATE TABLE `study_materials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`fileName` varchar(255) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`fileSize` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`deletedAt` timestamp,
	CONSTRAINT `study_materials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `study_materials` ADD CONSTRAINT `study_materials_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `study_materials_user_created_idx` ON `study_materials` (`userId`,`createdAt`);
--> statement-breakpoint
INSERT INTO `study_materials` (`userId`, `title`, `description`, `fileName`, `storageKey`, `fileSize`, `createdAt`)
SELECT `userId`, LEFT(`title`, 200), `body`, `pdfFileName`, `pdfStorageKey`, `pdfFileSize`, `createdAt`
FROM `notes`
WHERE `pdfStorageKey` IS NOT NULL AND `pdfFileName` IS NOT NULL AND `pdfFileSize` IS NOT NULL;
