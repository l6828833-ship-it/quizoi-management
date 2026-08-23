import { z } from "zod";

import { COOKIE_NAME } from "../shared/const.js";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";

const difficultySchema = z.enum(["easy", "medium", "hard"]);
const statusSchema = z.enum(["draft", "published", "paused", "archived"]);
const questionSchema = z.object({
  prompt: z.string().trim().min(10).max(280),
  optionA: z.string().trim().min(1).max(300),
  optionB: z.string().trim().min(1).max(300),
  optionC: z.string().trim().min(1).max(300),
  optionD: z.string().trim().min(1).max(300),
  correctOptionIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(10).max(500),
  categoryId: z.number().int().positive(),
  difficulty: difficultySchema,
  status: statusSchema.default("draft"),
  sourceNote: z.string().trim().max(500).optional(),
}).superRefine((value, context) => {
  const options = [value.optionA, value.optionB, value.optionC, value.optionD].map((item) => item.trim().toLocaleLowerCase());
  if (new Set(options).size !== 4) context.addIssue({ code: "custom", message: "All four options must be different.", path: ["optionA"] });
});

const csvHeaders = ["prompt", "option_a", "option_b", "option_c", "option_d", "correct_option", "explanation", "category_slug", "difficulty", "source_note"];

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"') { value += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (character === "," && !quoted) { cells.push(value.trim()); value = ""; continue; }
    value += character;
  }
  cells.push(value.trim());
  return cells;
}

function parseCsv(csv: string) {
  const rows = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((row) => row.trim().length > 0).map(parseCsvLine);
  if (!rows.length) return { rows: [], errors: ["The CSV file is empty."] };
  const header = rows[0].map((cell) => cell.trim().toLocaleLowerCase());
  if (header.join(",") !== csvHeaders.join(",")) return { rows: [], errors: [`CSV header must be: ${csvHeaders.join(",")}`] };
  return { rows: rows.slice(1), errors: [] as string[] };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  quiz: router({
    categories: publicProcedure.query(() => db.listCategories(false)),
    published: publicProcedure.input(z.object({ categorySlug: z.string().optional(), limit: z.number().int().min(1).max(100).default(50) })).query(({ input }) => db.listPublishedQuestions(input)),
    admin: router({
      dashboard: adminProcedure.query(() => db.getContentStats()),
      categories: adminProcedure.query(() => db.listCategories(true)),
      saveCategory: adminProcedure.input(z.object({ id: z.number().int().positive().optional(), name: z.string().trim().min(2).max(80), slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(80), iconKey: z.string().trim().min(1).max(64), color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/), isActive: z.boolean() })).mutation(({ input }) => db.saveCategory(input)),
      list: adminProcedure.input(z.object({ status: statusSchema.optional(), limit: z.number().int().min(1).max(1000).default(200) })).query(({ input }) => db.listAdminQuestions(input)),
      create: adminProcedure.input(questionSchema).mutation(({ input, ctx }) => db.createQuestion(input, ctx.user.id)),
      update: adminProcedure.input(questionSchema.safeExtend({ id: z.number().int().positive() })).mutation(({ input }) => { const { id, ...question } = input; return db.updateQuestion(id, question); }),
      setStatus: adminProcedure.input(z.object({ id: z.number().int().positive(), status: statusSchema })).mutation(({ input }) => db.setQuestionStatus(input.id, input.status)),
      remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => db.removeQuestion(input.id)),
      importCsv: adminProcedure.input(z.object({ fileName: z.string().trim().min(1).max(255), csv: z.string().min(1).max(200000), publishAfterValidation: z.boolean().default(false) })).mutation(async ({ input, ctx }) => {
        const parsed = parseCsv(input.csv);
        if (parsed.errors.length) return { imported: 0, rejected: 0, errors: parsed.errors };
        const categories = await db.listCategories(true);
        const categoryIds = new Map(categories.map((category) => [category.slug, category.id]));
        const importId = await db.createImportAudit({ fileName: input.fileName, totalRows: parsed.rows.length, createdBy: ctx.user.id });
        const errors: string[] = [];
        let imported = 0;
        for (const [offset, row] of parsed.rows.entries()) {
          const [prompt, optionA, optionB, optionC, optionD, correctOption, explanation, categorySlug, difficulty, sourceNote] = row;
          const categoryId = categoryIds.get(categorySlug?.trim());
          const correctOptionIndex = ["A", "B", "C", "D"].indexOf((correctOption ?? "").trim().toUpperCase());
          const checked = questionSchema.safeParse({ prompt, optionA, optionB, optionC, optionD, correctOptionIndex, explanation, categoryId, difficulty, status: input.publishAfterValidation ? "published" : "draft", sourceNote });
          if (!checked.success) { errors.push(`Row ${offset + 2}: ${checked.error.issues[0]?.message ?? "Invalid question"}`); continue; }
          try { await db.importQuestion(checked.data, ctx.user.id, importId); imported += 1; }
          catch { errors.push(`Row ${offset + 2}: duplicate prompt or database validation failed.`); }
        }
        await db.completeImportAudit(importId, { importedRows: imported, rejectedRows: errors.length, errorSummary: errors.slice(0, 10).join(" | ") || null });
        return { imported, rejected: errors.length, errors: errors.slice(0, 20) };
      }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
