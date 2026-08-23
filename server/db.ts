import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

import {
  InsertUser,
  quizCategories,
  quizImports,
  quizQuestions,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const database = await getDb();
  if (!database) return;
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };

  (["name", "email", "loginMethod"] as const).forEach((field) => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await database.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const database = await getDb();
  if (!database) return undefined;
  const result = await database.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

const STARTER_CATEGORIES = [
  { name: "Geography", slug: "geography", iconKey: "public", color: "#2563EB" },
  { name: "Science", slug: "science", iconKey: "science", color: "#0F9F9A" },
  { name: "History", slug: "history", iconKey: "account-balance", color: "#9333EA" },
  { name: "Nature", slug: "nature", iconKey: "eco", color: "#16A34A" },
  { name: "Arts & Literature", slug: "arts", iconKey: "palette", color: "#DB2777" },
  { name: "Technology", slug: "technology", iconKey: "memory", color: "#EA580C" },
  { name: "Sports", slug: "sports", iconKey: "sports-basketball", color: "#CA8A04" },
  { name: "Food & Culture", slug: "food", iconKey: "restaurant", color: "#E11D48" },
] as const;

export async function ensureStarterCategories() {
  const database = await getDb();
  if (!database) return [];
  for (const category of STARTER_CATEGORIES) {
    await database.insert(quizCategories).values(category).onDuplicateKeyUpdate({
      set: { name: category.name, iconKey: category.iconKey, color: category.color },
    });
  }
  return database.select().from(quizCategories).orderBy(asc(quizCategories.name));
}

export async function listCategories(includeInactive = false) {
  await ensureStarterCategories();
  const database = await getDb();
  if (!database) return [];
  return database
    .select()
    .from(quizCategories)
    .where(includeInactive ? undefined : eq(quizCategories.isActive, true))
    .orderBy(asc(quizCategories.name));
}

export async function saveCategory(input: { id?: number; name: string; slug: string; iconKey: string; color: string; isActive: boolean }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  if (input.id) {
    await database.update(quizCategories).set({ ...input }).where(eq(quizCategories.id, input.id));
    return input.id;
  }
  const result = await database.insert(quizCategories).values(input);
  return Number(result[0].insertId);
}

type QuestionPayload = {
  prompt: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOptionIndex: number;
  explanation: string;
  categoryId: number;
  difficulty: "easy" | "medium" | "hard";
  status: "draft" | "published" | "paused" | "archived";
  sourceNote?: string | null;
};

export const normalizePrompt = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");

const questionValues = (input: QuestionPayload) => ({
  ...input,
  prompt: input.prompt.trim(),
  optionA: input.optionA.trim(),
  optionB: input.optionB.trim(),
  optionC: input.optionC.trim(),
  optionD: input.optionD.trim(),
  explanation: input.explanation.trim(),
  sourceNote: input.sourceNote?.trim() || null,
  normalizedPrompt: normalizePrompt(input.prompt),
  publishedAt: input.status === "published" ? new Date() : null,
});

const insertQuestionValues = (input: QuestionPayload, createdBy: number, importId?: number) => ({
  ...questionValues(input),
  createdBy,
  importId: importId ?? null,
});

export async function listPublishedQuestions(input: { categorySlug?: string; limit: number }) {
  const database = await getDb();
  if (!database) return [];
  const filters = [eq(quizQuestions.status, "published"), eq(quizCategories.isActive, true)];
  if (input.categorySlug) filters.push(eq(quizCategories.slug, input.categorySlug));
  return database
    .select({
      id: quizQuestions.id,
      prompt: quizQuestions.prompt,
      optionA: quizQuestions.optionA,
      optionB: quizQuestions.optionB,
      optionC: quizQuestions.optionC,
      optionD: quizQuestions.optionD,
      correctOptionIndex: quizQuestions.correctOptionIndex,
      explanation: quizQuestions.explanation,
      difficulty: quizQuestions.difficulty,
      categorySlug: quizCategories.slug,
      categoryName: quizCategories.name,
    })
    .from(quizQuestions)
    .innerJoin(quizCategories, eq(quizQuestions.categoryId, quizCategories.id))
    .where(and(...filters))
    .orderBy(desc(quizQuestions.publishedAt), desc(quizQuestions.id))
    .limit(input.limit);
}

export async function listAdminQuestions(input: { status?: "draft" | "published" | "paused" | "archived"; limit: number }) {
  const database = await getDb();
  if (!database) return [];
  return database
    .select({
      id: quizQuestions.id,
      prompt: quizQuestions.prompt,
      optionA: quizQuestions.optionA,
      optionB: quizQuestions.optionB,
      optionC: quizQuestions.optionC,
      optionD: quizQuestions.optionD,
      correctOptionIndex: quizQuestions.correctOptionIndex,
      explanation: quizQuestions.explanation,
      difficulty: quizQuestions.difficulty,
      status: quizQuestions.status,
      sourceNote: quizQuestions.sourceNote,
      categoryId: quizCategories.id,
      categoryName: quizCategories.name,
      categorySlug: quizCategories.slug,
      updatedAt: quizQuestions.updatedAt,
    })
    .from(quizQuestions)
    .innerJoin(quizCategories, eq(quizQuestions.categoryId, quizCategories.id))
    .where(input.status ? eq(quizQuestions.status, input.status) : undefined)
    .orderBy(desc(quizQuestions.updatedAt))
    .limit(input.limit);
}

export async function getContentStats() {
  const rows = await listAdminQuestions({ limit: 1000 });
  return {
    total: rows.length,
    published: rows.filter((item) => item.status === "published").length,
    drafts: rows.filter((item) => item.status === "draft").length,
    paused: rows.filter((item) => item.status === "paused").length,
  };
}

export async function createQuestion(input: QuestionPayload, createdBy: number) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const result = await database.insert(quizQuestions).values(insertQuestionValues(input, createdBy));
  return Number(result[0].insertId);
}

export async function updateQuestion(id: number, input: QuestionPayload) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  await database.update(quizQuestions).set(questionValues(input)).where(eq(quizQuestions.id, id));
}

export async function setQuestionStatus(id: number, status: QuestionPayload["status"]) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  await database
    .update(quizQuestions)
    .set({ status, publishedAt: status === "published" ? new Date() : null })
    .where(eq(quizQuestions.id, id));
}

export async function removeQuestion(id: number) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  await database.delete(quizQuestions).where(eq(quizQuestions.id, id));
}

export async function createImportAudit(input: { fileName: string; totalRows: number; createdBy: number }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const result = await database.insert(quizImports).values(input);
  return Number(result[0].insertId);
}

export async function completeImportAudit(id: number, input: { importedRows: number; rejectedRows: number; errorSummary: string | null }) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  await database.update(quizImports).set(input).where(eq(quizImports.id, id));
}

export async function importQuestion(input: QuestionPayload, createdBy: number, importId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  const result = await database.insert(quizQuestions).values(insertQuestionValues(input, createdBy, importId));
  return Number(result[0].insertId);
}
