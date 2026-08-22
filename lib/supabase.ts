import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { QuizQuestion } from "@/lib/quiz-types";

let client: SupabaseClient | null | undefined;

/**
 * Returns the browser-safe Supabase client when the public Fly build values
 * are present. The publishable key is safe in the client because database
 * access is protected by Supabase Auth and Row Level Security policies.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    client = null;
    return client;
  }

  client = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  return client;
}

export const quizioOwnerEmail = process.env.EXPO_PUBLIC_QUIZIO_OWNER_EMAIL?.toLowerCase() ?? "";

type PublishedQuestionRow = {
  id: number;
  prompt: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option_index: number;
  explanation: string;
  difficulty: QuizQuestion["difficulty"];
  quiz_categories: Array<{ name: string; slug: string }> | null;
};

/** Reads only published questions through Supabase Row Level Security. */
export async function loadPublishedSupabaseQuestions(): Promise<QuizQuestion[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("quiz_questions")
    .select("id,prompt,option_a,option_b,option_c,option_d,correct_option_index,explanation,difficulty,quiz_categories(name,slug)")
    .eq("status", "published")
    .order("id", { ascending: false })
    .limit(100);

  if (error) throw error;
  return ((data ?? []) as PublishedQuestionRow[]).map((question) => {
    const category = question.quiz_categories?.[0];
    return {
      id: `supabase-${question.id}`,
      prompt: question.prompt,
      options: [question.option_a, question.option_b, question.option_c, question.option_d],
      correctOptionIndex: question.correct_option_index,
      explanation: question.explanation,
      categoryId: category?.slug ?? "general",
      categoryName: category?.name ?? "General knowledge",
      difficulty: question.difficulty,
    };
  });
}
