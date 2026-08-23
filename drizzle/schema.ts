import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const quizCategories = mysqlTable("quiz_categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  iconKey: varchar("iconKey", { length: 64 }).notNull().default("quiz"),
  color: varchar("color", { length: 12 }).notNull().default("#312E81"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const quizImports = mysqlTable("quiz_imports", {
  id: int("id").autoincrement().primaryKey(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  totalRows: int("totalRows").notNull().default(0),
  importedRows: int("importedRows").notNull().default(0),
  rejectedRows: int("rejectedRows").notNull().default(0),
  errorSummary: text("errorSummary"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const quizQuestions = mysqlTable("quiz_questions", {
  id: int("id").autoincrement().primaryKey(),
  prompt: varchar("prompt", { length: 500 }).notNull(),
  normalizedPrompt: varchar("normalizedPrompt", { length: 500 }).notNull().unique(),
  optionA: varchar("optionA", { length: 300 }).notNull(),
  optionB: varchar("optionB", { length: 300 }).notNull(),
  optionC: varchar("optionC", { length: 300 }).notNull(),
  optionD: varchar("optionD", { length: 300 }).notNull(),
  correctOptionIndex: int("correctOptionIndex").notNull(),
  explanation: varchar("explanation", { length: 1000 }).notNull(),
  categoryId: int("categoryId").notNull(),
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).notNull().default("medium"),
  status: mysqlEnum("status", ["draft", "published", "paused", "archived"]).notNull().default("draft"),
  sourceNote: varchar("sourceNote", { length: 500 }),
  importId: int("importId"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  publishedAt: timestamp("publishedAt"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type QuizCategory = typeof quizCategories.$inferSelect;
export type InsertQuizCategory = typeof quizCategories.$inferInsert;
export type QuizQuestionRecord = typeof quizQuestions.$inferSelect;
export type InsertQuizQuestion = typeof quizQuestions.$inferInsert;
