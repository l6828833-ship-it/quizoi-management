import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useColorScheme } from "@/hooks/use-color-scheme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { QUIZ_CATEGORIES } from "@/lib/quiz-data";
import { calculateAnswerPoints, getLevelProgress, getQuestionsForMode, getQuestionsFromPool, getTimerSeconds, getTodayKey, shuffle } from "@/lib/quiz-engine";
import { consumeHintToken, completeQuiz, loadPlayerSettings, loadPlayerStats } from "@/lib/quiz-store";
import { quizHaptics } from "@/lib/haptics";
import { trpc } from "@/lib/trpc";
import { loadPublishedSupabaseQuestions } from "@/lib/supabase";
import type { AnswerState, PlayerSettings, PlayerStats, QuizMode, QuizQuestion, QuizResponse } from "@/lib/quiz-types";

type Surface = "home" | "modes" | "category" | "quiz" | "result" | "review";
const emptyStats: PlayerStats = { totalQuizzes: 0, totalQuestions: 0, correctAnswers: 0, xp: 0, level: 1, currentStreak: 0, bestScore: 0, hintTokens: 3, lastActiveDate: null, lastDailyCompletion: null, categoryStats: {} };
const defaultSettings: PlayerSettings = { hapticsEnabled: true };

export default function HomeScreen() {
  const [surface, setSurface] = useState<Surface>("home");
  const [stats, setStats] = useState<PlayerStats>(emptyStats);
  const [settings, setSettings] = useState<PlayerSettings>(defaultSettings);
  const [mode, setMode] = useState<QuizMode>("quick");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answerState, setAnswerState] = useState<AnswerState>("idle");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [responses, setResponses] = useState<QuizResponse[]>([]);
  const [score, setScore] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(12);
  const [hiddenOptions, setHiddenOptions] = useState<number[]>([]);
  const [xpGained, setXpGained] = useState(0);
  const [supabaseQuestions, setSupabaseQuestions] = useState<QuizQuestion[]>([]);
  const publishedContent = trpc.quiz.published.useQuery({ limit: 100 }, { staleTime: 30_000, retry: 1 });
  const remoteQuestions = useMemo<QuizQuestion[]>(() => (publishedContent.data ?? []).map((question) => ({
    id: `remote-${question.id}`,
    prompt: question.prompt,
    options: [question.optionA, question.optionB, question.optionC, question.optionD],
    correctOptionIndex: question.correctOptionIndex,
    explanation: question.explanation,
    categoryId: question.categorySlug,
    categoryName: question.categoryName,
    difficulty: question.difficulty,
  })), [publishedContent.data]);

  useEffect(() => {
    let active = true;
    loadPublishedSupabaseQuestions().then((questions) => {
      if (active) setSupabaseQuestions(questions);
    }).catch(() => {
      if (active) setSupabaseQuestions([]);
    });
    return () => { active = false; };
  }, []);

  const refreshProfile = useCallback(() => {
    Promise.all([loadPlayerStats(), loadPlayerSettings()]).then(([savedStats, savedSettings]) => { setStats(savedStats); setSettings(savedSettings); }).catch(() => undefined);
  }, []);

  useFocusEffect(useCallback(() => { refreshProfile(); }, [refreshProfile]));

  const currentQuestion = questions[questionIndex];
  const timerSeconds = currentQuestion ? getTimerSeconds(currentQuestion.difficulty) : 12;
  const dailyDone = stats.lastDailyCompletion === getTodayKey();
  const accuracy = responses.length ? Math.round(responses.filter((response) => response.isCorrect).length / responses.length * 100) : 0;

  const chooseAnswer = useCallback((answerIndex: number | null) => {
    if (!currentQuestion || answerState !== "idle") return;
    const isCorrect = answerIndex === currentQuestion.correctOptionIndex;
    const earnedPoints = calculateAnswerPoints(isCorrect, secondsLeft, timerSeconds);
    const response: QuizResponse = { question: currentQuestion, selectedOptionIndex: answerIndex, isCorrect, earnedPoints, timeRemaining: secondsLeft };
    setResponses((current) => [...current, response]);
    setScore((current) => current + earnedPoints);
    setSelectedOption(answerIndex);
    setAnswerState(answerIndex === null ? "timeout" : isCorrect ? "correct" : "incorrect");
    if (isCorrect) quizHaptics.correct(settings.hapticsEnabled); else quizHaptics.incorrect(settings.hapticsEnabled);
  }, [answerState, currentQuestion, secondsLeft, settings.hapticsEnabled, timerSeconds]);

  useEffect(() => {
    if (surface !== "quiz" || answerState !== "idle") return;
    if (secondsLeft <= 0) { chooseAnswer(null); return; }
    const timer = setTimeout(() => setSecondsLeft((current) => Math.max(0, current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [answerState, chooseAnswer, questionIndex, secondsLeft, surface]);

  const beginQuiz = (nextMode: QuizMode, categoryId?: string) => {
    if (nextMode === "daily" && dailyDone) return;
    const sharedQuestions = supabaseQuestions.length ? supabaseQuestions : remoteQuestions;
    const remoteForMode = getQuestionsFromPool(sharedQuestions, nextMode, categoryId);
    const bundledForMode = getQuestionsForMode(nextMode, categoryId);
    const requiredCount = nextMode === "streak" ? 5 : 10;
    const remoteIds = new Set(remoteForMode.map((question) => question.id));
    const nextQuestions = remoteForMode.length >= requiredCount
      ? remoteForMode
      : [...remoteForMode, ...bundledForMode.filter((question) => !remoteIds.has(question.id)).slice(0, requiredCount - remoteForMode.length)];
    if (!nextQuestions.length) return;
    quizHaptics.tap(settings.hapticsEnabled);
    setMode(nextMode); setQuestions(nextQuestions); setQuestionIndex(0); setResponses([]); setScore(0); setAnswerState("idle"); setSelectedOption(null); setHiddenOptions([]); setSecondsLeft(getTimerSeconds(nextQuestions[0].difficulty)); setXpGained(0); setSurface("quiz");
  };

  const useHint = async () => {
    if (!currentQuestion || hiddenOptions.length || stats.hintTokens < 1 || answerState !== "idle") return;
    const removable = shuffle([0, 1, 2, 3].filter((index) => index !== currentQuestion.correctOptionIndex)).slice(0, 2);
    const nextStats = await consumeHintToken();
    setStats(nextStats); setHiddenOptions(removable); quizHaptics.tap(settings.hapticsEnabled);
  };

  const continueQuiz = async () => {
    quizHaptics.tap(settings.hapticsEnabled);
    if (questionIndex < questions.length - 1) {
      const nextQuestion = questions[questionIndex + 1];
      setQuestionIndex((current) => current + 1); setAnswerState("idle"); setSelectedOption(null); setHiddenOptions([]); setSecondsLeft(getTimerSeconds(nextQuestion.difficulty));
      return;
    }
    const outcome = await completeQuiz({ mode, score, responses, completedAt: new Date().toISOString() });
    setStats(outcome.stats); setXpGained(outcome.xpGained); setSurface("result");
  };

  const goHome = () => { setSurface("home"); refreshProfile(); };
  const currentCorrect = currentQuestion?.correctOptionIndex;

  if (surface === "modes") return <ModePicker onBack={() => setSurface("home")} onPick={(nextMode) => nextMode === "category" ? setSurface("category") : beginQuiz(nextMode)} dailyDone={dailyDone} />;
  if (surface === "category") return <CategoryPicker onBack={() => setSurface("modes")} onPick={(categoryId) => beginQuiz("category", categoryId)} />;
  if (surface === "quiz" && currentQuestion) return <QuizScreen question={currentQuestion} currentIndex={questionIndex} total={questions.length} score={score} secondsLeft={secondsLeft} timerSeconds={timerSeconds} selectedOption={selectedOption} answerState={answerState} correctOption={currentCorrect ?? 0} hiddenOptions={hiddenOptions} hintTokens={stats.hintTokens} onSelect={chooseAnswer} onHint={useHint} onContinue={continueQuiz} />;
  if (surface === "result") return <ResultScreen score={score} accuracy={accuracy} correct={responses.filter((response) => response.isCorrect).length} total={responses.length} xpGained={xpGained} mode={mode} onPlayAgain={() => beginQuiz(mode)} onReview={() => setSurface("review")} onHome={goHome} />;
  if (surface === "review") return <ReviewScreen responses={responses} onBack={() => setSurface("result")} />;

  return <HomeSurface stats={stats} levelProgress={getLevelProgress(stats.xp)} dailyDone={dailyDone} onPlay={() => beginQuiz("quick")} onBrowse={() => setSurface("modes")} onCategory={(categoryId) => beginQuiz("category", categoryId)} />;
}

function HomeSurface({ stats, levelProgress, dailyDone, onPlay, onBrowse, onCategory }: { stats: PlayerStats; levelProgress: number; dailyDone: boolean; onPlay: () => void; onBrowse: () => void; onCategory: (categoryId: string) => void }) {
  return <ScreenContainer className="px-5 pt-4" containerClassName="bg-background">
    <View style={styles.homeHeader}><View><Text style={styles.eyebrow}>HELLO, QUIZ MASTER</Text><Text style={styles.greeting}>Pick a game{`\n`}to play!</Text></View><View style={styles.coinPill}><MaterialIcons name="monetization-on" size={19} color="#9A5410" /><Text style={styles.coinText}>{stats.xp}</Text></View></View>
    <View style={styles.hero}><View style={styles.heroSpark}><Text style={styles.sparkText}>✦</Text></View><View style={styles.heroTop}><View><Text style={styles.heroLabel}>TODAY’S BRAIN BOOST</Text><Text style={styles.heroTitle}>Quick{`\n`}challenge</Text></View><QubiFace /></View><Text style={styles.heroText}>Ten curious questions. One bright new personal best.</Text><Pressable onPress={onPlay} accessibilityRole="button" accessibilityLabel="Start a Quick Play quiz" style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>Play a round</Text><MaterialIcons name="play-arrow" size={21} color="#FFFFFF" /></Pressable></View>
    <View style={styles.statsRow}><SmallStat icon="local-fire-department" value={`${stats.currentStreak} day`} label="Current streak" color="#F59E0B" /><SmallStat icon="emoji-events" value={String(stats.bestScore)} label="Best score" color="#0F9F9A" /><SmallStat icon="star" value={`L${stats.level}`} label={`${levelProgress}/500 XP`} color="#9333EA" /></View>
    <Pressable onPress={onBrowse} accessibilityRole="button" accessibilityLabel="Choose a quiz mode" style={({ pressed }) => [styles.dailyCard, pressed && styles.pressed]}><View style={styles.dailyIcon}><MaterialIcons name={dailyDone ? "check-circle" : "today"} size={25} color={dailyDone ? "#16A34A" : "#0F9F9A"} /></View><View style={styles.dailyCopy}><Text style={styles.dailyTitle}>{dailyDone ? "Daily Quiz complete" : "Choose your challenge"}</Text><Text style={styles.dailyText}>{dailyDone ? "Come back tomorrow for a new set." : "Daily, category, and streak modes are waiting."}</Text></View><MaterialIcons name="chevron-right" size={24} color="#64748B" /></Pressable>
    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Explore categories</Text><Pressable onPress={onBrowse} accessibilityRole="button"><Text style={styles.linkText}>See all</Text></Pressable></View>
    <View style={styles.categoryGrid}><CategoryTile category={QUIZ_CATEGORIES[0]} onPress={onCategory} /><CategoryTile category={QUIZ_CATEGORIES[1]} onPress={onCategory} /><CategoryTile category={QUIZ_CATEGORIES[2]} onPress={onCategory} /><CategoryTile category={QUIZ_CATEGORIES[3]} onPress={onCategory} /></View>
  </ScreenContainer>;
}

function SmallStat({ icon, value, label, color }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; value: string; label: string; color: string }) { return <View style={styles.smallStat}><View style={[styles.statIcon, { backgroundColor: `${color}25` }]}><MaterialIcons name={icon} size={18} color={color} /></View><Text style={styles.smallStatValue}>{value}</Text><Text style={styles.smallStatLabel}>{label}</Text></View>; }

function QubiFace() { return <View style={styles.qubi}><View style={styles.qubiEarLeft} /><View style={styles.qubiEarRight} /><Text style={styles.qubiMark}>?</Text><View style={styles.qubiEyes}><View style={styles.qubiEye}><View style={styles.qubiPupil} /></View><View style={styles.qubiEye}><View style={styles.qubiPupil} /></View></View><View style={styles.qubiSmile} /></View>; }

function CategoryTile({ category, onPress }: { category: typeof QUIZ_CATEGORIES[number]; onPress: (categoryId: string) => void }) { return <Pressable onPress={() => onPress(category.id)} accessibilityRole="button" accessibilityLabel={`Start ${category.name} category challenge`} style={({ pressed }) => [styles.categoryTile, pressed && styles.pressed]}><View style={[styles.categoryIcon, { backgroundColor: `${category.color}18` }]}><MaterialIcons name={category.icon as React.ComponentProps<typeof MaterialIcons>["name"]} size={22} color={category.color} /></View><Text style={styles.categoryName}>{category.name}</Text><MaterialIcons name="arrow-forward" size={17} color="#94A3B8" /></Pressable>; }

function ModePicker({ onBack, onPick, dailyDone }: { onBack: () => void; onPick: (mode: QuizMode) => void; dailyDone: boolean }) { return <ScreenContainer className="px-5 pt-4" containerClassName="bg-background"><BackButton onPress={onBack} /><Text style={styles.eyebrow}>PICK YOUR PACE</Text><Text style={styles.screenTitle}>How do you want to play?</Text><Text style={styles.screenSubtitle}>Choose a format that fits the moment.</Text><ModeCard icon="bolt" title="Quick Play" detail="10 mixed questions · about 3 min" accent="#312E81" onPress={() => onPick("quick")} /><ModeCard icon="category" title="Category Challenge" detail="Focus on a topic you love" accent="#0F9F9A" onPress={() => onPick("category")} /><ModeCard icon="today" title="Daily Quiz" detail={dailyDone ? "Completed today · new quiz tomorrow" : "10 fresh questions · one try today"} accent="#F59E0B" disabled={dailyDone} onPress={() => onPick("daily")} /><ModeCard icon="local-fire-department" title="Streak Mode" detail="5 questions · stay sharp" accent="#E11D48" onPress={() => onPick("streak")} /></ScreenContainer>; }

function ModeCard({ icon, title, detail, accent, onPress, disabled = false }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; title: string; detail: string; accent: string; onPress: () => void; disabled?: boolean }) { return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }} style={({ pressed }) => [styles.modeCard, disabled && styles.disabled, pressed && styles.pressed]}><View style={[styles.modeIcon, { backgroundColor: `${accent}18` }]}><MaterialIcons name={icon} size={24} color={accent} /></View><View style={styles.modeCopy}><Text style={styles.modeTitle}>{title}</Text><Text style={styles.modeDetail}>{detail}</Text></View><MaterialIcons name="chevron-right" size={25} color="#94A3B8" /></Pressable>; }

function CategoryPicker({ onBack, onPick }: { onBack: () => void; onPick: (categoryId: string) => void }) { return <ScreenContainer className="px-5 pt-4" containerClassName="bg-background"><BackButton onPress={onBack} /><Text style={styles.eyebrow}>CATEGORY CHALLENGE</Text><Text style={styles.screenTitle}>Choose a subject</Text><Text style={styles.screenSubtitle}>A focused round from our local starter bank.</Text><FlatList data={QUIZ_CATEGORIES} keyExtractor={(item) => item.id} showsVerticalScrollIndicator={false} contentContainerStyle={styles.categoryList} renderItem={({ item }) => <CategoryTile category={item} onPress={onPick} />} /></ScreenContainer>; }

function QuizScreen({ question, currentIndex, total, score, secondsLeft, timerSeconds, selectedOption, answerState, correctOption, hiddenOptions, hintTokens, onSelect, onHint, onContinue }: { question: QuizQuestion; currentIndex: number; total: number; score: number; secondsLeft: number; timerSeconds: number; selectedOption: number | null; answerState: AnswerState; correctOption: number; hiddenOptions: number[]; hintTokens: number; onSelect: (index: number) => void; onHint: () => void; onContinue: () => void }) {
  const timerFraction = secondsLeft / timerSeconds;
  const answerMessage = answerState === "correct" ? "Correct — nicely done." : answerState === "incorrect" ? "Not quite. The answer is highlighted." : "Time is up. The answer is highlighted.";
  const isDark = useColorScheme() === "dark";

  return (
    <ScreenContainer className="px-5 pt-3" containerClassName="bg-background">
      <ScrollView contentContainerStyle={quizScrollStyles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.quizHeader}>
        <View>
          <Text style={[styles.quizCount, isDark && darkQuestionStyles.metaText]}>QUESTION {currentIndex + 1} OF {total}</Text>
          <View style={[styles.progressTrack, isDark && darkQuestionStyles.progressTrack]}><View style={[styles.progressFill, { width: `${(currentIndex + 1) / total * 100}%` }]} /></View>
        </View>
        <View style={styles.scorePill}><MaterialIcons name="stars" size={15} color="#B45309" /><Text style={styles.scoreText}>{score}</Text></View>
      </View>
      <View style={styles.timerRow}><View style={[styles.timerTrack, isDark && darkQuestionStyles.progressTrack]}><View style={[styles.timerFill, { width: `${timerFraction * 100}%`, backgroundColor: secondsLeft <= 4 ? "#E11D48" : "#0F9F9A" }]} /></View><Text accessibilityLabel={`${secondsLeft} seconds remaining`} style={[styles.timerText, isDark && darkQuestionStyles.metaText, secondsLeft <= 4 && { color: "#E11D48" }]}>{secondsLeft}s</Text></View>
      <View style={styles.questionMeta}><Text style={[styles.questionCategory, isDark && darkQuestionStyles.categoryText]}>{question.categoryName.toUpperCase()}</Text><Text style={[styles.difficulty, isDark && darkQuestionStyles.metaText]}>{question.difficulty}</Text></View>
      <View style={[explicitQuestionStyles.card, isDark && explicitQuestionStyles.cardDark]}>
        <Text style={[styles.questionText, explicitQuestionStyles.text, isDark && explicitQuestionStyles.textDark]}>{question.prompt || "Question unavailable"}</Text>
      </View>
      <View style={styles.answers}>{question.options.map((option, index) => <AnswerCard key={option} option={option} index={index} selected={selectedOption === index} correct={correctOption === index} locked={answerState !== "idle"} hidden={hiddenOptions.includes(index)} onPress={() => onSelect(index)} />)}</View>
      {answerState === "idle" ? <Pressable onPress={onHint} disabled={hintTokens < 1 || hiddenOptions.length > 0} accessibilityRole="button" accessibilityState={{ disabled: hintTokens < 1 || hiddenOptions.length > 0 }} style={({ pressed }) => [styles.hintButton, (hintTokens < 1 || hiddenOptions.length > 0) && styles.disabled, pressed && styles.pressed]}><MaterialIcons name="lightbulb" size={19} color="#B45309" /><Text style={styles.hintText}>{hiddenOptions.length ? "Hint used for this question" : `Use a hint · ${hintTokens} left`}</Text></Pressable> : <View style={[styles.feedbackBox, isDark && darkQuestionStyles.feedbackBox]}><View style={[styles.feedbackIcon, { backgroundColor: answerState === "correct" ? "#DCFCE7" : "#FFE4E6" }]}><MaterialIcons name={answerState === "correct" ? "check" : "info"} size={22} color={answerState === "correct" ? "#16A34A" : "#E11D48"} /></View><View style={styles.feedbackCopy}><Text style={[styles.feedbackTitle, isDark && darkQuestionStyles.promptText]}>{answerMessage}</Text><Text style={[styles.feedbackText, isDark && darkQuestionStyles.metaText]}>{question.explanation}</Text></View></View>}
      {answerState !== "idle" && <Pressable onPress={onContinue} accessibilityRole="button" style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}><Text style={styles.continueText}>{currentIndex === total - 1 ? "See results" : "Continue"}</Text><MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" /></Pressable>}
      </ScrollView>
    </ScreenContainer>
  );
}

function AnswerCard({ option, index, selected, correct, locked, hidden, onPress }: { option: string; index: number; selected: boolean; correct: boolean; locked: boolean; hidden: boolean; onPress: () => void }) { const letter = ["A", "B", "C", "D"][index]; const stateStyle = locked && correct ? styles.answerCorrect : locked && selected ? styles.answerIncorrect : hidden ? styles.answerHidden : undefined; const labelStyle = locked && correct ? styles.answerLabelCorrect : locked && selected ? styles.answerLabelIncorrect : undefined; return <Pressable onPress={onPress} disabled={locked || hidden} accessibilityRole="button" accessibilityState={{ disabled: locked || hidden, selected }} style={({ pressed }) => [styles.answerCard, stateStyle, pressed && !locked && styles.pressed]}><View style={[styles.answerLetter, labelStyle]}><Text style={[styles.answerLetterText, locked && correct && styles.whiteText, locked && selected && !correct && styles.whiteText]}>{letter}</Text></View><Text style={[styles.answerText, hidden && styles.hiddenText, locked && (correct || selected) && styles.whiteText]}>{hidden ? "Eliminated" : option}</Text>{locked && correct && <MaterialIcons name="check-circle" size={21} color="#FFFFFF" />}{locked && selected && !correct && <MaterialIcons name="cancel" size={21} color="#FFFFFF" />}</Pressable>; }

const quizScrollStyles = StyleSheet.create({
  content: { paddingBottom: 120 },
});

function ResultScreen({ score, accuracy, correct, total, xpGained, mode, onPlayAgain, onReview, onHome }: { score: number; accuracy: number; correct: number; total: number; xpGained: number; mode: QuizMode; onPlayAgain: () => void; onReview: () => void; onHome: () => void }) { const headline = accuracy >= 80 ? "Excellent sprint!" : accuracy >= 50 ? "Strong effort!" : "Every round teaches you something."; return <ScreenContainer className="px-5 pt-5" containerClassName="bg-background"><View style={styles.resultTop}><View style={styles.resultTrophy}><MaterialIcons name="emoji-events" size={42} color="#B45309" /></View><Text style={styles.eyebrow}>ROUND COMPLETE</Text><Text style={styles.resultHeadline}>{headline}</Text><Text style={styles.resultSub}>{mode === "daily" ? "Your Daily Quiz is recorded for today." : "Your latest round is saved on this device."}</Text></View><View style={styles.scoreCard}><Text style={styles.scoreOverline}>YOUR SCORE</Text><Text style={styles.resultScore}>{score}</Text><View style={styles.resultLine} /><View style={styles.resultMetrics}><ResultMetric value={`${accuracy}%`} label="Accuracy" /><ResultMetric value={`${correct}/${total}`} label="Correct" /><ResultMetric value={`+${xpGained}`} label="XP gained" /></View></View><Pressable onPress={onPlayAgain} accessibilityRole="button" style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}><Text style={styles.continueText}>Play again</Text><MaterialIcons name="replay" size={20} color="#FFFFFF" /></Pressable><Pressable onPress={onReview} accessibilityRole="button" style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><Text style={styles.secondaryText}>Review answers</Text><MaterialIcons name="format-list-bulleted" size={20} color="#312E81" /></Pressable><Pressable onPress={onHome} accessibilityRole="button" style={({ pressed }) => [styles.tertiaryButton, pressed && styles.pressed]}><Text style={styles.tertiaryText}>Back to home</Text></Pressable></ScreenContainer>; }

function ResultMetric({ value, label }: { value: string; label: string }) { return <View style={styles.resultMetric}><Text style={styles.resultMetricValue}>{value}</Text><Text style={styles.resultMetricLabel}>{label}</Text></View>; }

function ReviewScreen({ responses, onBack }: { responses: QuizResponse[]; onBack: () => void }) { return <ScreenContainer className="pt-4" containerClassName="bg-background"><View style={styles.reviewHeader}><BackButton onPress={onBack} /><Text style={styles.eyebrow}>LEARN FROM THE ROUND</Text><Text style={styles.screenTitle}>Review answers</Text><Text style={styles.screenSubtitle}>See what you knew and pick up something new.</Text></View><FlatList data={responses} keyExtractor={(item) => item.question.id} contentContainerStyle={styles.reviewList} renderItem={({ item, index }) => <View style={styles.reviewCard}><View style={styles.reviewTop}><Text style={styles.reviewNumber}>{index + 1}</Text><View style={[styles.reviewStatus, { backgroundColor: item.isCorrect ? "#DCFCE7" : "#FFE4E6" }]}><MaterialIcons name={item.isCorrect ? "check" : "close"} size={16} color={item.isCorrect ? "#16A34A" : "#E11D48"} /><Text style={[styles.reviewStatusText, { color: item.isCorrect ? "#15803D" : "#BE123C" }]}>{item.isCorrect ? `+${item.earnedPoints}` : "Missed"}</Text></View></View><Text style={styles.reviewPrompt}>{item.question.prompt}</Text><Text style={styles.reviewChoiceLabel}>YOUR ANSWER</Text><Text style={styles.reviewChoice}>{item.selectedOptionIndex === null ? "No answer" : item.question.options[item.selectedOptionIndex]}</Text><Text style={styles.reviewChoiceLabel}>CORRECT ANSWER</Text><Text style={styles.reviewCorrect}>{item.question.options[item.question.correctOptionIndex]}</Text><Text style={styles.reviewExplanation}>{item.question.explanation}</Text></View>} /></ScreenContainer>; }

function BackButton({ onPress }: { onPress: () => void }) { return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Go back" style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={21} color="#312E81" /></Pressable>; }

const explicitQuestionStyles = StyleSheet.create({
  card: { backgroundColor: "#EEF2FF", borderColor: "#C7D2FE", borderRadius: 20, borderWidth: 1, marginTop: 10, marginBottom: 23, minHeight: 86, paddingHorizontal: 16, paddingVertical: 14, justifyContent: "center" },
  cardDark: { backgroundColor: "#1E1B4B", borderColor: "#4F46E5" },
  text: { color: "#111827" },
  textDark: { color: "#FFFFFF" },
});

const darkQuestionStyles = StyleSheet.create({
  metaText: { color: "#CBD5E1" },
  categoryText: { color: "#A5B4FC" },
  promptText: { color: "#F8FAFC" },
  progressTrack: { backgroundColor: "#334155" },
  feedbackBox: { backgroundColor: "#1E293B" },
});

const baseStyles = StyleSheet.create({
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] }, disabled: { opacity: 0.48 }, eyebrow: { color: "#0F9F9A", fontWeight: "800", letterSpacing: 1.1, fontSize: 11 }, homeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }, greeting: { color: "#111827", fontSize: 30, lineHeight: 37, fontWeight: "800", marginTop: 3 }, xpPill: { backgroundColor: "#FEF3C7", borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 4 }, xpText: { color: "#92400E", fontWeight: "800", fontSize: 12 },
  hero: { backgroundColor: "#312E81", borderRadius: 26, padding: 20, shadowColor: "#312E81", shadowOpacity: 0.18, shadowRadius: 18, elevation: 4 }, heroTop: { flexDirection: "row", justifyContent: "space-between" }, heroLabel: { color: "#99F6E4", letterSpacing: 1.1, fontWeight: "800", fontSize: 11 }, heroTitle: { color: "#FFFFFF", fontWeight: "800", fontSize: 25, lineHeight: 31, marginTop: 6 }, heroIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: "#FCD34D", alignItems: "center", justifyContent: "center" }, heroText: { color: "#C7D2FE", fontSize: 13, lineHeight: 19, marginTop: 14, maxWidth: "88%" }, primaryButton: { minHeight: 50, backgroundColor: "#2DD4BF", borderRadius: 15, marginTop: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }, primaryButtonText: { color: "#312E81", fontSize: 15, fontWeight: "900" },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 }, smallStat: { width: "31.5%", backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderWidth: 1, borderRadius: 16, paddingVertical: 11, paddingHorizontal: 9 }, smallStatValue: { fontSize: 15, color: "#111827", fontWeight: "800", marginTop: 7 }, smallStatLabel: { color: "#64748B", fontSize: 10, lineHeight: 13, marginTop: 2 },
  dailyCard: { backgroundColor: "#F0FDFA", borderRadius: 20, padding: 15, flexDirection: "row", alignItems: "center", marginTop: 15 }, dailyIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", marginRight: 12 }, dailyCopy: { flex: 1 }, dailyTitle: { color: "#134E4A", fontSize: 14, fontWeight: "800" }, dailyText: { color: "#0F766E", fontSize: 12, lineHeight: 17, marginTop: 2 }, sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 21, marginBottom: 10 }, sectionTitle: { color: "#111827", fontWeight: "800", fontSize: 17 }, linkText: { color: "#312E81", fontWeight: "800", fontSize: 13 }, categoryGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 }, categoryTile: { width: "48.5%", minHeight: 100, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 18, padding: 13 }, categoryIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" }, categoryName: { color: "#111827", fontSize: 13, fontWeight: "800", marginTop: 10, marginBottom: 5 },
  backButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center", marginBottom: 18 }, screenTitle: { color: "#111827", fontSize: 29, lineHeight: 36, fontWeight: "800", marginTop: 4 }, screenSubtitle: { color: "#64748B", fontSize: 14, lineHeight: 20, marginTop: 5, marginBottom: 20 }, modeCard: { minHeight: 82, backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0", padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 11 }, modeIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center", marginRight: 13 }, modeCopy: { flex: 1 }, modeTitle: { color: "#111827", fontWeight: "800", fontSize: 16 }, modeDetail: { color: "#64748B", fontSize: 12, lineHeight: 17, marginTop: 2 }, categoryList: { paddingBottom: 30, gap: 10 },
  quizHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, quizCount: { color: "#64748B", fontSize: 11, letterSpacing: 0.9, fontWeight: "800" }, progressTrack: { backgroundColor: "#E2E8F0", width: 190, maxWidth: "100%", height: 6, borderRadius: 99, overflow: "hidden", marginTop: 7 }, progressFill: { height: "100%", backgroundColor: "#312E81", borderRadius: 99 }, scorePill: { backgroundColor: "#FEF3C7", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 4 }, scoreText: { color: "#92400E", fontSize: 12, fontWeight: "800" }, timerRow: { flexDirection: "row", alignItems: "center", marginTop: 20, gap: 10 }, timerTrack: { flex: 1, height: 7, borderRadius: 99, backgroundColor: "#E2E8F0", overflow: "hidden" }, timerFill: { height: "100%", borderRadius: 99 }, timerText: { width: 29, color: "#0F766E", fontSize: 13, fontWeight: "900" }, questionMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 28 }, questionCategory: { color: "#312E81", letterSpacing: 0.8, fontSize: 10, fontWeight: "900" }, difficulty: { color: "#64748B", textTransform: "capitalize", fontSize: 11, fontWeight: "700" }, questionText: { color: "#111827", fontWeight: "800", fontSize: 24, lineHeight: 31, marginTop: 8, marginBottom: 23 }, answers: { gap: 10 }, answerCard: { minHeight: 58, backgroundColor: "#FFFFFF", borderRadius: 17, borderWidth: 1.25, borderColor: "#E2E8F0", padding: 11, alignItems: "center", flexDirection: "row" }, answerLetter: { width: 32, height: 32, borderRadius: 11, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginRight: 11 }, answerLetterText: { color: "#475569", fontWeight: "900", fontSize: 12 }, answerText: { color: "#1E293B", fontSize: 14, lineHeight: 19, fontWeight: "700", flex: 1 }, answerCorrect: { backgroundColor: "#16A34A", borderColor: "#16A34A" }, answerIncorrect: { backgroundColor: "#E11D48", borderColor: "#E11D48" }, answerHidden: { backgroundColor: "#F8FAFC", borderColor: "#E2E8F0", opacity: 0.6 }, answerLabelCorrect: { backgroundColor: "#15803D" }, answerLabelIncorrect: { backgroundColor: "#BE123C" }, whiteText: { color: "#FFFFFF" }, hiddenText: { color: "#94A3B8", textDecorationLine: "line-through" }, hintButton: { minHeight: 48, marginTop: 15, borderRadius: 15, backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 }, hintText: { color: "#B45309", fontWeight: "800", fontSize: 13 }, feedbackBox: { marginTop: 14, borderRadius: 17, padding: 14, backgroundColor: "#F8FAFC", flexDirection: "row" }, feedbackIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 10 }, feedbackCopy: { flex: 1 }, feedbackTitle: { color: "#111827", fontSize: 14, fontWeight: "900" }, feedbackText: { color: "#475569", fontSize: 12, lineHeight: 17, marginTop: 3 }, continueButton: { backgroundColor: "#312E81", minHeight: 53, borderRadius: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 14 }, continueText: { color: "#FFFFFF", fontWeight: "900", fontSize: 15 },
  resultTop: { alignItems: "center", marginTop: 4 }, resultTrophy: { width: 80, height: 80, borderRadius: 28, backgroundColor: "#FEF3C7", alignItems: "center", justifyContent: "center", marginBottom: 17 }, resultHeadline: { color: "#111827", fontSize: 27, lineHeight: 34, fontWeight: "800", textAlign: "center", marginTop: 5 }, resultSub: { color: "#64748B", fontSize: 13, lineHeight: 19, marginTop: 4, textAlign: "center" }, scoreCard: { backgroundColor: "#FFFFFF", borderRadius: 24, borderWidth: 1, borderColor: "#E2E8F0", marginTop: 22, padding: 20, alignItems: "center" }, scoreOverline: { color: "#64748B", fontWeight: "800", fontSize: 10, letterSpacing: 1.1 }, resultScore: { color: "#312E81", fontSize: 51, lineHeight: 60, fontWeight: "900", marginTop: 4 }, resultLine: { height: 1, backgroundColor: "#E2E8F0", width: "100%", marginVertical: 14 }, resultMetrics: { flexDirection: "row", width: "100%", justifyContent: "space-between" }, resultMetric: { alignItems: "center", flex: 1 }, resultMetricValue: { color: "#111827", fontWeight: "900", fontSize: 17 }, resultMetricLabel: { color: "#64748B", fontSize: 10, marginTop: 3 }, secondaryButton: { minHeight: 52, marginTop: 11, borderRadius: 16, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }, secondaryText: { color: "#312E81", fontWeight: "900", fontSize: 14 }, tertiaryButton: { minHeight: 43, alignItems: "center", justifyContent: "center" }, tertiaryText: { color: "#64748B", fontWeight: "800", fontSize: 13 },
  reviewHeader: { paddingHorizontal: 20 }, reviewList: { paddingHorizontal: 20, paddingBottom: 30, gap: 12 }, reviewCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 20, padding: 16 }, reviewTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, reviewNumber: { color: "#312E81", fontWeight: "900", fontSize: 14 }, reviewStatus: { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 3 }, reviewStatusText: { fontSize: 11, fontWeight: "900" }, reviewPrompt: { color: "#111827", fontSize: 15, fontWeight: "800", lineHeight: 21, marginTop: 10 }, reviewChoiceLabel: { color: "#94A3B8", fontWeight: "900", fontSize: 9, letterSpacing: 0.8, marginTop: 12 }, reviewChoice: { color: "#64748B", fontSize: 13, marginTop: 3 }, reviewCorrect: { color: "#15803D", fontSize: 13, fontWeight: "800", marginTop: 3 }, reviewExplanation: { color: "#475569", fontSize: 12, lineHeight: 17, borderTopWidth: 1, borderTopColor: "#F1F5F9", marginTop: 12, paddingTop: 11 },
});

const gameStyles = StyleSheet.create({
  pressed: { opacity: 0.82, transform: [{ scale: 0.975 }] }, eyebrow: { color: "#8B5CF6", fontWeight: "900", letterSpacing: 1.2, fontSize: 10 }, homeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }, greeting: { color: "#171411", fontSize: 34, lineHeight: 38, fontWeight: "900", marginTop: 5 }, coinPill: { backgroundColor: "#FFF1C8", borderRadius: 99, paddingHorizontal: 11, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "#F6C75A" }, coinText: { color: "#7A4110", fontWeight: "900", fontSize: 13 },
  hero: { backgroundColor: "#FFB638", borderRadius: 30, padding: 20, overflow: "hidden", shadowColor: "#E18A00", shadowOpacity: 0.2, shadowRadius: 14, elevation: 5 }, heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }, heroLabel: { color: "#6B3A09", letterSpacing: 1.05, fontWeight: "900", fontSize: 10 }, heroTitle: { color: "#171411", fontWeight: "900", fontSize: 31, lineHeight: 33, marginTop: 5 }, heroText: { color: "#6B3A09", fontSize: 13, lineHeight: 19, marginTop: 11, maxWidth: "75%", fontWeight: "700" }, heroSpark: { position: "absolute", top: 10, left: 12, opacity: 0.7 }, sparkText: { color: "#FFFFFF", fontSize: 21, fontWeight: "900" }, primaryButton: { minHeight: 52, backgroundColor: "#171411", borderRadius: 18, marginTop: 17, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }, primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  qubi: { width: 88, height: 88, borderRadius: 34, backgroundColor: "#FFEF5A", borderWidth: 4, borderColor: "#171411", alignItems: "center", justifyContent: "center", transform: [{ rotate: "-5deg" }] }, qubiMark: { color: "#F45A9D", fontSize: 22, fontWeight: "900", position: "absolute", top: -6, right: 7 }, qubiEyes: { flexDirection: "row", gap: 10, marginTop: 9 }, qubiEye: { width: 20, height: 25, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: "#171411", alignItems: "center", justifyContent: "center" }, qubiPupil: { width: 9, height: 12, borderRadius: 7, backgroundColor: "#171411" }, qubiSmile: { width: 24, height: 11, borderBottomWidth: 3, borderColor: "#171411", borderRadius: 20, marginTop: 3 }, qubiEarLeft: { position: "absolute", width: 17, height: 20, backgroundColor: "#A78BFA", left: -9, top: 19, borderRadius: 9, borderWidth: 3, borderColor: "#171411" }, qubiEarRight: { position: "absolute", width: 17, height: 20, backgroundColor: "#F45A9D", right: -9, top: 19, borderRadius: 9, borderWidth: 3, borderColor: "#171411" },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 15 }, smallStat: { width: "31.5%", backgroundColor: "#FFFFFF", borderColor: "#F0E9DD", borderWidth: 1, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 9 }, statIcon: { width: 28, height: 28, borderRadius: 11, alignItems: "center", justifyContent: "center" }, smallStatValue: { fontSize: 14, color: "#171411", fontWeight: "900", marginTop: 6 }, smallStatLabel: { color: "#8A7D70", fontSize: 9, lineHeight: 12, marginTop: 2, fontWeight: "700" },
  dailyCard: { backgroundColor: "#DDF7F2", borderRadius: 22, padding: 15, flexDirection: "row", alignItems: "center", marginTop: 16, borderWidth: 1, borderColor: "#9CE2D8" }, dailyIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", marginRight: 12 }, dailyTitle: { color: "#125B54", fontSize: 15, fontWeight: "900" }, dailyText: { color: "#317D75", fontSize: 12, lineHeight: 17, marginTop: 2, fontWeight: "600" }, sectionTitle: { color: "#171411", fontWeight: "900", fontSize: 19 }, linkText: { color: "#8B5CF6", fontWeight: "900", fontSize: 13 }, categoryTile: { width: "48.5%", minHeight: 108, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#F0E9DD", borderRadius: 22, padding: 14 }, categoryIcon: { width: 38, height: 38, borderRadius: 15, alignItems: "center", justifyContent: "center" }, categoryName: { color: "#171411", fontSize: 13, fontWeight: "900", marginTop: 10, marginBottom: 5 },
  backButton: { width: 44, height: 44, borderRadius: 17, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#F0E9DD", alignItems: "center", justifyContent: "center", marginBottom: 17 }, screenTitle: { color: "#171411", fontSize: 31, lineHeight: 37, fontWeight: "900", marginTop: 4 }, screenSubtitle: { color: "#8A7D70", fontSize: 14, lineHeight: 20, marginTop: 5, marginBottom: 20, fontWeight: "600" }, modeCard: { minHeight: 86, backgroundColor: "#FFFFFF", borderRadius: 24, borderWidth: 1, borderColor: "#F0E9DD", padding: 15, flexDirection: "row", alignItems: "center", marginBottom: 11 }, modeIcon: { width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center", marginRight: 13 }, modeTitle: { color: "#171411", fontWeight: "900", fontSize: 16 }, modeDetail: { color: "#8A7D70", fontSize: 12, lineHeight: 17, marginTop: 2, fontWeight: "600" },
  quizCount: { color: "#8A7D70", fontSize: 10, letterSpacing: 1, fontWeight: "900" }, progressTrack: { backgroundColor: "#F2ECE2", width: 190, maxWidth: "100%", height: 8, borderRadius: 99, overflow: "hidden", marginTop: 7 }, progressFill: { height: "100%", backgroundColor: "#F45A9D", borderRadius: 99 }, scorePill: { backgroundColor: "#FFF1C8", borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: "#F6C75A" }, timerTrack: { flex: 1, height: 8, borderRadius: 99, backgroundColor: "#F2ECE2", overflow: "hidden" }, questionCategory: { color: "#8B5CF6", letterSpacing: 0.9, fontSize: 10, fontWeight: "900" }, difficulty: { color: "#8A7D70", textTransform: "capitalize", fontSize: 11, fontWeight: "800" }, questionText: { color: "#171411", fontWeight: "900", fontSize: 24, lineHeight: 30, marginTop: 0, marginBottom: 0 }, answerCard: { minHeight: 61, backgroundColor: "#FFFFFF", borderRadius: 19, borderWidth: 1.25, borderColor: "#F0E9DD", padding: 12, alignItems: "center", flexDirection: "row" }, answerLetter: { width: 34, height: 34, borderRadius: 13, backgroundColor: "#FFF3DD", alignItems: "center", justifyContent: "center", marginRight: 11 }, answerLetterText: { color: "#7A4110", fontWeight: "900", fontSize: 13 }, answerText: { color: "#171411", fontSize: 14, lineHeight: 19, fontWeight: "800", flex: 1 }, answerCorrect: { backgroundColor: "#20B86A", borderColor: "#20B86A" }, answerIncorrect: { backgroundColor: "#F45A6C", borderColor: "#F45A6C" }, hintButton: { minHeight: 49, marginTop: 15, borderRadius: 18, backgroundColor: "#FFF3DD", borderWidth: 1, borderColor: "#FFE0A5", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 }, hintText: { color: "#A46100", fontWeight: "900", fontSize: 13 }, feedbackBox: { marginTop: 14, borderRadius: 19, padding: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#F0E9DD", flexDirection: "row" }, continueButton: { backgroundColor: "#171411", minHeight: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 14 },
  resultTrophy: { width: 84, height: 84, borderRadius: 30, backgroundColor: "#FFEF5A", alignItems: "center", justifyContent: "center", marginBottom: 15, borderWidth: 3, borderColor: "#171411" }, resultHeadline: { color: "#171411", fontSize: 29, lineHeight: 35, fontWeight: "900", textAlign: "center", marginTop: 5 }, resultSub: { color: "#8A7D70", fontSize: 13, lineHeight: 19, marginTop: 4, textAlign: "center", fontWeight: "600" }, scoreCard: { backgroundColor: "#A78BFA", borderRadius: 28, borderWidth: 2, borderColor: "#8B5CF6", marginTop: 22, padding: 20, alignItems: "center" }, scoreOverline: { color: "#F4EFFF", fontWeight: "900", fontSize: 10, letterSpacing: 1.2 }, resultScore: { color: "#171411", fontSize: 54, lineHeight: 61, fontWeight: "900", marginTop: 4 }, resultLine: { height: 1, backgroundColor: "#8B5CF6", width: "100%", marginVertical: 14 }, resultMetricValue: { color: "#171411", fontWeight: "900", fontSize: 17 }, resultMetricLabel: { color: "#F4EFFF", fontSize: 10, marginTop: 3, fontWeight: "800" }, secondaryButton: { minHeight: 52, marginTop: 11, borderRadius: 18, backgroundColor: "#FFF3DD", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }, secondaryText: { color: "#7A4110", fontWeight: "900", fontSize: 14 }, tertiaryText: { color: "#8A7D70", fontWeight: "900", fontSize: 13 },
  reviewCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#F0E9DD", borderRadius: 22, padding: 16 }, reviewNumber: { color: "#8B5CF6", fontWeight: "900", fontSize: 15 }, reviewPrompt: { color: "#171411", fontSize: 15, fontWeight: "900", lineHeight: 21, marginTop: 10 }, reviewExplanation: { color: "#62574C", fontSize: 12, lineHeight: 17, borderTopWidth: 1, borderTopColor: "#F5EFE6", marginTop: 12, paddingTop: 11 },
});

const styles = { ...baseStyles, ...gameStyles };
