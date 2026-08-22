import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import WebContentStudio from "@/components/content-studio-web";

export default function AdminRoute() {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const root = document.documentElement;
    const previousBackground = root.style.getPropertyValue("--color-background");
    const previousForeground = root.style.getPropertyValue("--color-foreground");
    root.style.setProperty("--color-background", "#F8FAFC");
    root.style.setProperty("--color-foreground", "#111827");
    return () => {
      root.style.setProperty("--color-background", previousBackground);
      root.style.setProperty("--color-foreground", previousForeground);
    };
  }, []);

  if (Platform.OS === "web") return <WebContentStudio />;
  return <NativeAdminPlaceholder />;
}

function NativeAdminPlaceholder() {
  const router = useRouter();

  return (
    <ScreenContainer className="px-5 pt-5" containerClassName="bg-background">
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <MaterialIcons name="arrow-back" size={21} color="#312E81" />
      </Pressable>
      <View style={styles.icon}><MaterialIcons name="public" size={38} color="#312E81" /></View>
      <Text style={styles.eyebrow}>QUIZIO ADMINISTRATION</Text>
      <Text style={styles.title}>Manage content in a browser</Text>
      <Text style={styles.text}>For a Play Store-safe player experience, quiz creation and CSV upload are available only through the private browser dashboard. Open your published Quizio website and visit the secure <Text style={styles.url}>/admin</Text> page with the Supabase owner account.</Text>
      <View style={styles.note}><MaterialIcons name="verified-user" size={22} color="#0F766E" /><Text style={styles.noteText}>The Android app can only play quizzes and download published questions.</Text></View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  back: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" }, pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] }, icon: { width: 76, height: 76, borderRadius: 26, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center", marginTop: 32, marginBottom: 21 }, eyebrow: { color: "#0F9F9A", fontWeight: "900", fontSize: 11, letterSpacing: 1.1 }, title: { color: "#111827", fontSize: 29, lineHeight: 36, fontWeight: "900", marginTop: 5 }, text: { color: "#64748B", fontSize: 15, lineHeight: 23, marginTop: 10 }, url: { color: "#312E81", fontWeight: "900" }, note: { backgroundColor: "#ECFEFF", borderRadius: 18, padding: 15, flexDirection: "row", gap: 11, alignItems: "center", marginTop: 24 }, noteText: { flex: 1, color: "#0F766E", fontSize: 13, lineHeight: 19, fontWeight: "700" },
});
