import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

const supportsHaptics = (enabled: boolean) => enabled && Platform.OS !== "web";

export const quizHaptics = {
  tap: (enabled: boolean) => {
    if (supportsHaptics(enabled)) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  correct: (enabled: boolean) => {
    if (supportsHaptics(enabled)) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  incorrect: (enabled: boolean) => {
    if (supportsHaptics(enabled)) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },
};
