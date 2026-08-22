export type Difficulty = "easy" | "medium" | "hard";
export type QuizMode = "quick" | "daily" | "streak" | "category";
export type AnswerState = "idle" | "correct" | "incorrect" | "timeout";

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: [string, string, string, string];
  correctOptionIndex: number;
  explanation: string;
  categoryId: string;
  categoryName: string;
  difficulty: Difficulty;
}

export interface QuizResponse {
  question: QuizQuestion;
  selectedOptionIndex: number | null;
  isCorrect: boolean;
  earnedPoints: number;
  timeRemaining: number;
}

export interface QuizSessionSummary {
  mode: QuizMode;
  categoryId?: string;
  score: number;
  responses: QuizResponse[];
  completedAt: string;
}

export interface CategoryStat {
  attempted: number;
  correct: number;
}

export interface PlayerStats {
  totalQuizzes: number;
  totalQuestions: number;
  correctAnswers: number;
  xp: number;
  level: number;
  currentStreak: number;
  bestScore: number;
  hintTokens: number;
  lastActiveDate: string | null;
  lastDailyCompletion: string | null;
  categoryStats: Record<string, CategoryStat>;
}

export interface PlayerSettings {
  hapticsEnabled: boolean;
}
