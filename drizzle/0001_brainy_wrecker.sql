CREATE TABLE `quiz_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`slug` varchar(80) NOT NULL,
	`iconKey` varchar(64) NOT NULL DEFAULT 'quiz',
	`color` varchar(12) NOT NULL DEFAULT '#312E81',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quiz_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `quiz_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `quiz_imports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`totalRows` int NOT NULL DEFAULT 0,
	`importedRows` int NOT NULL DEFAULT 0,
	`rejectedRows` int NOT NULL DEFAULT 0,
	`errorSummary` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quiz_imports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`prompt` varchar(500) NOT NULL,
	`normalizedPrompt` varchar(500) NOT NULL,
	`optionA` varchar(300) NOT NULL,
	`optionB` varchar(300) NOT NULL,
	`optionC` varchar(300) NOT NULL,
	`optionD` varchar(300) NOT NULL,
	`correctOptionIndex` int NOT NULL,
	`explanation` varchar(1000) NOT NULL,
	`categoryId` int NOT NULL,
	`difficulty` enum('easy','medium','hard') NOT NULL DEFAULT 'medium',
	`status` enum('draft','published','paused','archived') NOT NULL DEFAULT 'draft',
	`sourceNote` varchar(500),
	`importId` int,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`publishedAt` timestamp,
	CONSTRAINT `quiz_questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `quiz_questions_normalizedPrompt_unique` UNIQUE(`normalizedPrompt`)
);
