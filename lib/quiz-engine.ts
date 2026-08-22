import { STARTER_QUESTIONS } from "@/lib/quiz-data";
import type { Difficulty, QuizMode, QuizQuestion } from "@/lib/quiz-types";

export const getTodayKey = (date = new Date()) => date.toISOString().slice(0, 10);

export const getTimerSeconds = (difficulty: Difficulty) => {
  if (difficulty === "easy") return 12;
  if (difficulty === "medium") return 15;
  return 18;
};

export const calculateAnswerPoints = (isCorrect: boolean, secondsRemaining: number, totalSeconds: number) => {
  if (!isCorrect) return 0;
  const bonus = Math.round(Math.max(0, secondsRemaining) / totalSeconds * 50);
  return 100 + bonus;
};

export const shuffle = <T,>(items: T[], seed?: number): T[] => {
  const result = [...items];
  let state = seed ?? Math.floor(Math.random() * 2 ** 31);
  const random = () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state / 2 ** 31;
  };

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

const dailySeed = (dailyKey: string) => [...dailyKey].reduce((sum, character) => sum + character.charCodeAt(0), 0);

export const getQuestionsFromPool = (pool: QuizQuestion[], mode: QuizMode, categoryId?: string, today = getTodayKey()): QuizQuestion[] => {
  const requestedCount = mode === "streak" ? 5 : 10;
  const eligible = categoryId ? pool.filter((question) => question.categoryId === categoryId) : pool;

  if (mode === "daily") return shuffle(eligible, dailySeed(today)).slice(0, requestedCount);
  return shuffle(eligible).slice(0, Math.min(requestedCount, eligible.length));
};

export const getQuestionsForMode = (mode: QuizMode, categoryId?: string, today = getTodayKey()): QuizQuestion[] =>
  getQuestionsFromPool(STARTER_QUESTIONS, mode, categoryId, today);

export const getLevelFromXp = (xp: number) => Math.max(1, Math.floor(xp / 500) + 1);

export const getLevelProgress = (xp: number) => xp % 500;
