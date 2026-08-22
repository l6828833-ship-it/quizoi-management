import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { getLevelProgress } from "@/lib/quiz-engine";
import { loadPlayerStats, subscribeToPlayerChanges } from "@/lib/quiz-store";
import type { PlayerStats } from "@/lib/quiz-types";

const empty: PlayerStats = { totalQuizzes: 0, totalQuestions: 0, correctAnswers: 0, xp: 0, level: 1, currentStreak: 0, bestScore: 0, hintTokens: 3, lastActiveDate: null, lastDailyCompletion: null, categoryStats: {} };

export default function ProgressScreen() {
  const [stats, setStats] = useState<PlayerStats>(empty);
  const refresh = useCallback(() => { loadPlayerStats().then(setStats).catch(() => setStats(empty)); }, []);

  useFocusEffect(useCallback(() => {
    refresh();
    return subscribeToPlayerChanges(refresh);
  }, [refresh]));

  const accuracy = stats.totalQuestions ? Math.round(stats.correctAnswers / stats.totalQuestions * 100) : 0;
  const levelProgress = getLevelProgress(stats.xp);

  return (
    <ScreenContainer className="px-5 pt-4" containerClassName="bg-background">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>YOUR PRIZE SHELF</Text>
        <Text style={styles.title}>Growing every{`\n`}round.</Text>
        <Text style={styles.subtitle}>Tiny wins make a brilliant streak.</Text>
      </View>

      <View style={styles.levelCard}>
        <View style={styles.levelBadge}><Text style={styles.levelNumber}>{stats.level}</Text></View>
        <View style={styles.levelDetails}>
          <Text style={styles.levelLabel}>Level {stats.level}</Text>
          <Text style={styles.levelCaption}>{stats.xp} XP collected</Text>
          <View style={styles.track}><View style={[styles.fill, { width: `${levelProgress / 5}%` }]} /></View>
          <Text style={styles.levelCaption}>{500 - levelProgress} XP to the next level</Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <Metric icon="quiz" label="Quizzes" value={String(stats.totalQuizzes)} color="#8B5CF6" />
        <Metric icon="check-circle" label="Accuracy" value={`${accuracy}%`} color="#14B8A6" />
        <Metric icon="local-fire-department" label="Streak" value={`${stats.currentStreak}d`} color="#F59E0B" />
        <Metric icon="emoji-events" label="Best score" value={String(stats.bestScore)} color="#F45A9D" />
      </View>

      <View style={styles.note}>
        <MaterialIcons name="offline-bolt" size={24} color="#0F9F9A" />
        <View style={styles.noteCopy}>
          <Text style={styles.noteTitle}>Your progress stays with you</Text>
          <Text style={styles.noteText}>Quizio stores your scores and preferences on this device.</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

function Metric({ icon, label, value, color }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; label: string; value: string; color: string }) {
  return <View style={[styles.metric, { borderColor: `${color}32` }]}><View style={[styles.metricIcon, { backgroundColor: `${color}1F` }]}><MaterialIcons name={icon} size={20} color={color} /></View><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  header: { marginBottom: 20 }, eyebrow: { color: "#8B5CF6", fontWeight: "900", letterSpacing: 1.2, fontSize: 10 }, title: { color: "#171411", fontSize: 34, lineHeight: 38, fontWeight: "900", marginTop: 4 }, subtitle: { color: "#8A7D70", fontSize: 14, lineHeight: 21, marginTop: 5, fontWeight: "600" },
  levelCard: { backgroundColor: "#FFB638", borderRadius: 28, padding: 20, flexDirection: "row", alignItems: "center", shadowColor: "#D98400", shadowOpacity: 0.18, shadowRadius: 15, elevation: 4 }, levelBadge: { width: 60, height: 60, borderRadius: 24, backgroundColor: "#FFEF5A", borderWidth: 3, borderColor: "#171411", alignItems: "center", justifyContent: "center", marginRight: 15 }, levelNumber: { color: "#171411", fontSize: 27, fontWeight: "900" }, levelDetails: { flex: 1 }, levelLabel: { color: "#171411", fontWeight: "900", fontSize: 19 }, levelCaption: { color: "#70420B", fontSize: 12, marginTop: 3, fontWeight: "700" }, track: { height: 8, borderRadius: 99, backgroundColor: "#E89410", marginTop: 11, overflow: "hidden" }, fill: { height: "100%", borderRadius: 99, backgroundColor: "#14B8A6" },
  metrics: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 18 }, metric: { width: "47.5%", backgroundColor: "#FFFFFF", borderRadius: 22, padding: 15, marginBottom: 12, borderWidth: 1 }, metricIcon: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 14 }, metricValue: { fontWeight: "900", fontSize: 24, color: "#171411" }, metricLabel: { color: "#8A7D70", fontSize: 11, marginTop: 2, fontWeight: "700" },
  note: { backgroundColor: "#DDF7F2", borderRadius: 21, padding: 16, flexDirection: "row", alignItems: "center", marginTop: 5, borderWidth: 1, borderColor: "#9CE2D8" }, noteCopy: { flex: 1, marginLeft: 12 }, noteTitle: { color: "#125B54", fontSize: 14, fontWeight: "900" }, noteText: { color: "#317D75", fontSize: 12, lineHeight: 17, marginTop: 2, fontWeight: "600" },
});
