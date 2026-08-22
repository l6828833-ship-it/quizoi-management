import AsyncStorage from "@react-native-async-storage/async-storage";

import { getLevelFromXp, getTodayKey } from "@/lib/quiz-engine";
import type { PlayerSettings, PlayerStats, QuizSessionSummary } from "@/lib/quiz-types";

const STATS_KEY = "quizsprint.stats.v1";
const SETTINGS_KEY = "quizsprint.settings.v1";
const listeners = new Set<() => void>();

const defaultStats: PlayerStats = {
  totalQuizzes: 0,
  totalQuestions: 0,
  correctAnswers: 0,
  xp: 0,
  level: 1,
  currentStreak: 0,
  bestScore: 0,
  hintTokens: 3,
  lastActiveDate: null,
  lastDailyCompletion: null,
  categoryStats: {},
};

const defaultSettings: PlayerSettings = { hapticsEnabled: true };
const notify = () => listeners.forEach((listener) => listener());

export const subscribeToPlayerChanges = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const loadPlayerStats = async (): Promise<PlayerStats> => {
  const raw = await AsyncStorage.getItem(STATS_KEY);
  if (!raw) return defaultStats;
  return { ...defaultStats, ...JSON.parse(raw) };
};

export const loadPlayerSettings = async (): Promise<PlayerSettings> => {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return defaultSettings;
  return { ...defaultSettings, ...JSON.parse(raw) };
};

export const savePlayerSettings = async (settings: PlayerSettings) => {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  notify();
  return settings;
};

export const consumeHintToken = async () => {
  const stats = await loadPlayerStats();
  if (stats.hintTokens < 1) return stats;
  const next = { ...stats, hintTokens: stats.hintTokens - 1 };
  await AsyncStorage.setItem(STATS_KEY, JSON.stringify(next));
  notify();
  return next;
};

export const completeQuiz = async (summary: QuizSessionSummary) => {
  const previous = await loadPlayerStats();
  const correctAnswers = summary.responses.filter((response) => response.isCorrect).length;
  const accuracy = summary.responses.length ? correctAnswers / summary.responses.length : 0;
  const xpGained = 25 + correctAnswers * 20 + (accuracy >= 0.8 ? 50 : 0);
  const today = getTodayKey(new Date(summary.completedAt));
  const isNewDay = previous.lastActiveDate !== today;
  const yesterday = new Date(`${today}T00:00:00.000Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayKey = getTodayKey(yesterday);
  const nextStreak = !isNewDay
    ? previous.currentStreak
    : previous.lastActiveDate === yesterdayKey
      ? previous.currentStreak + 1
      : 1;
  const categoryStats = { ...previous.categoryStats };

  for (const response of summary.responses) {
    const current = categoryStats[response.question.categoryId] ?? { attempted: 0, correct: 0 };
    categoryStats[response.question.categoryId] = {
      attempted: current.attempted + 1,
      correct: current.correct + (response.isCorrect ? 1 : 0),
    };
  }

  const xp = previous.xp + xpGained;
  const next: PlayerStats = {
    ...previous,
    totalQuizzes: previous.totalQuizzes + 1,
    totalQuestions: previous.totalQuestions + summary.responses.length,
    correctAnswers: previous.correctAnswers + correctAnswers,
    xp,
    level: getLevelFromXp(xp),
    currentStreak: nextStreak,
    bestScore: Math.max(previous.bestScore, summary.score),
    lastActiveDate: today,
    lastDailyCompletion: summary.mode === "daily" ? today : previous.lastDailyCompletion,
    categoryStats,
  };

  await AsyncStorage.setItem(STATS_KEY, JSON.stringify(next));
  notify();
  return { stats: next, xpGained };
};

export const resetLocalPlayerData = async () => {
  await AsyncStorage.multiRemove([STATS_KEY, SETTINGS_KEY]);
  notify();
};
