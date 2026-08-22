import { describe, expect, it } from "vitest";

import { calculateAnswerPoints, getQuestionsForMode, getTimerSeconds, getTodayKey, shuffle } from "@/lib/quiz-engine";

describe("QuizSprint game engine", () => {
  it("awards a base score and proportionate speed bonus for correct answers", () => {
    expect(calculateAnswerPoints(true, 15, 15)).toBe(150);
    expect(calculateAnswerPoints(true, 0, 15)).toBe(100);
    expect(calculateAnswerPoints(false, 15, 15)).toBe(0);
  });

  it("uses the configured question timer by difficulty", () => {
    expect(getTimerSeconds("easy")).toBe(12);
    expect(getTimerSeconds("medium")).toBe(15);
    expect(getTimerSeconds("hard")).toBe(18);
  });

  it("creates a deterministic daily quiz without duplicate questions", () => {
    const date = "2026-08-22";
    const firstRun = getQuestionsForMode("daily", undefined, date);
    const secondRun = getQuestionsForMode("daily", undefined, date);
    expect(firstRun.map((question) => question.id)).toEqual(secondRun.map((question) => question.id));
    expect(new Set(firstRun.map((question) => question.id)).size).toBe(firstRun.length);
  });

  it("limits category rounds to available questions and preserves their category", () => {
    const geography = getQuestionsForMode("category", "geography");
    expect(geography.length).toBeGreaterThan(0);
    expect(geography.every((question) => question.categoryId === "geography")).toBe(true);
  });

  it("shuffles a list without losing elements", () => {
    expect(shuffle([1, 2, 3, 4], 42).sort()).toEqual([1, 2, 3, 4]);
    expect(getTodayKey(new Date("2026-08-22T12:00:00.000Z"))).toBe("2026-08-22");
  });
});
