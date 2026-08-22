import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { loadPlayerSettings, resetLocalPlayerData, savePlayerSettings, subscribeToPlayerChanges } from "@/lib/quiz-store";
import type { PlayerSettings } from "@/lib/quiz-types";

const defaultSettings: PlayerSettings = { hapticsEnabled: true };

export default function SettingsScreen() {
  const [settings, setSettings] = useState<PlayerSettings>(defaultSettings);
  const refresh = useCallback(() => { loadPlayerSettings().then(setSettings).catch(() => setSettings(defaultSettings)); }, []);
  useFocusEffect(useCallback(() => { refresh(); return subscribeToPlayerChanges(refresh); }, [refresh]));

  const setHaptics = (hapticsEnabled: boolean) => { const next = { ...settings, hapticsEnabled }; setSettings(next); savePlayerSettings(next); };
  const confirmReset = () => Alert.alert("Reset local progress?", "This removes this device's scores, streak, XP, and settings. It cannot be undone.", [ { text: "Cancel", style: "cancel" }, { text: "Reset", style: "destructive", onPress: () => resetLocalPlayerData().then(refresh) } ]);

  return (
    <ScreenContainer className="px-5 pt-4" containerClassName="bg-background">
      <Text style={styles.eyebrow}>YOUR GAME SPACE</Text>
      <Text style={styles.title}>Make it{`\n`}yours.</Text>
      <Text style={styles.subtitle}>A few tiny choices for a happier game.</Text>

      <Text style={styles.section}>PLAY EXPERIENCE</Text>
      <View style={styles.card}>
        <View style={styles.rowIcon}><MaterialIcons name="vibration" size={22} color="#312E81" /></View>
        <View style={styles.rowCopy}><Text style={styles.rowTitle}>Haptic feedback</Text><Text style={styles.rowText}>Feel taps and answer results.</Text></View>
        <Switch value={settings.hapticsEnabled} onValueChange={setHaptics} trackColor={{ false: "#CBD5E1", true: "#0F9F9A" }} thumbColor="#FFFFFF" accessibilityLabel="Enable haptic feedback" />
      </View>

      <Text style={styles.section}>YOUR DATA</Text>
      <View style={styles.infoCard}>
        <MaterialIcons name="phone-android" size={24} color="#0F9F9A" />
        <View style={styles.rowCopy}><Text style={styles.rowTitle}>Local-first progress</Text><Text style={styles.rowText}>Your game data is stored on this device. No account is required.</Text></View>
      </View>
      <Pressable onPress={confirmReset} accessibilityRole="button" accessibilityLabel="Reset all local progress" style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}>
        <MaterialIcons name="restart-alt" size={20} color="#BE123C" /><Text style={styles.resetText}>Reset local progress</Text>
      </Pressable>
      <Text style={styles.version}>Quizio · Version 1.0</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: "#8B5CF6", fontWeight: "900", letterSpacing: 1.2, fontSize: 10 }, title: { color: "#171411", fontSize: 34, lineHeight: 38, fontWeight: "900", marginTop: 4 }, subtitle: { color: "#8A7D70", fontSize: 14, lineHeight: 21, marginTop: 5, fontWeight: "600" }, section: { color: "#8A7D70", fontSize: 10, fontWeight: "900", letterSpacing: 1.1, marginTop: 28, marginBottom: 9 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 22, padding: 15, borderWidth: 1, borderColor: "#F0E9DD", flexDirection: "row", alignItems: "center" }, rowIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: "#F1EAFE", alignItems: "center", justifyContent: "center", marginRight: 12 }, rowCopy: { flex: 1 }, rowTitle: { color: "#171411", fontSize: 15, fontWeight: "900" }, rowText: { color: "#8A7D70", fontSize: 12, lineHeight: 17, marginTop: 2, fontWeight: "600" },
  infoCard: { backgroundColor: "#DDF7F2", borderRadius: 22, padding: 16, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#9CE2D8" }, resetButton: { marginTop: 14, minHeight: 52, borderWidth: 1, borderColor: "#FFC1CE", borderRadius: 18, backgroundColor: "#FFF0F4", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }, pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] }, resetText: { color: "#C83962", fontSize: 14, fontWeight: "900" }, version: { color: "#A89C90", fontSize: 12, textAlign: "center", marginTop: 27, fontWeight: "700" },
});
