CREATE TABLE `account_completion_limits` (
	`ipHash` varchar(64) NOT NULL,
	`windowAt` timestamp NOT NULL,
	`attempts` int NOT NULL DEFAULT 1,
	CONSTRAINT `account_completion_limits_ipHash` PRIMARY KEY(`ipHash`)
);
--> statement-breakpoint
CREATE INDEX `account_completion_limits_window_idx` ON `account_completion_limits` (`windowAt`);