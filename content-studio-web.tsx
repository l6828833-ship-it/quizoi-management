import { useState } from "react";
import { Alert, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { startOAuthLogin } from "@/constants/oauth";
import { trpc } from "@/lib/trpc";

type StudioMode = "library" | "editor" | "import";
type Status = "draft" | "published" | "paused" | "archived";

type QuestionEditor = {
  prompt: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOptionIndex: number;
  explanation: string;
  categoryId: number;
  difficulty: "easy" | "medium" | "hard";
  status: Status;
  sourceNote: string;
};

const emptyEditor: QuestionEditor = {
  prompt: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctOptionIndex: 0,
  explanation: "",
  categoryId: 0,
  difficulty: "medium" as const,
  status: "draft" as Status,
  sourceNote: "",
};

export default function AdminScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<StudioMode>("library");
  const [editor, setEditor] = useState<QuestionEditor>(emptyEditor);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [csv, setCsv] = useState("");
  const [csvName, setCsvName] = useState("questions.csv");
  const [csvResult, setCsvResult] = useState<string | null>(null);

  const me = trpc.auth.me.useQuery();
  const isAdmin = me.data?.role === "admin";
  const dashboard = trpc.quiz.admin.dashboard.useQuery(undefined, { enabled: isAdmin });
  const categories = trpc.quiz.admin.categories.useQuery(undefined, { enabled: isAdmin });
  const questions = trpc.quiz.admin.list.useQuery({ limit: 200 }, { enabled: isAdmin });
  const createQuestion = trpc.quiz.admin.create.useMutation();
  const updateQuestion = trpc.quiz.admin.update.useMutation();
  const setQuestionStatus = trpc.quiz.admin.setStatus.useMutation();
  const removeQuestion = trpc.quiz.admin.remove.useMutation();
  const importCsv = trpc.quiz.admin.importCsv.useMutation();

  const isBusy = createQuestion.isPending || updateQuestion.isPending || importCsv.isPending;

  const refreshContent = async () => {
    await Promise.all([
      utils.quiz.admin.dashboard.invalidate(),
      utils.quiz.admin.categories.invalidate(),
      utils.quiz.admin.list.invalidate(),
    ]);
  };

  const openNewQuestion = () => {
    setEditingId(null);
    setEditor({ ...emptyEditor, categoryId: categories.data?.[0]?.id ?? 0 });
    setMode("editor");
  };

  const editQuestion = (question: NonNullable<typeof questions.data>[number]) => {
    setEditingId(question.id);
    setEditor({
      prompt: question.prompt,
      optionA: question.optionA,
      optionB: question.optionB,
      optionC: question.optionC,
      optionD: question.optionD,
      correctOptionIndex: question.correctOptionIndex,
      explanation: question.explanation,
      categoryId: question.categoryId,
      difficulty: question.difficulty,
      status: question.status,
      sourceNote: question.sourceNote ?? "",
    });
    setMode("editor");
  };

  const saveQuestion = async () => {
    if (!editor.categoryId) {
      Alert.alert("Choose a category", "Select the category that this question belongs to.");
      return;
    }
    try {
      if (editingId) await updateQuestion.mutateAsync({ ...editor, id: editingId });
      else await createQuestion.mutateAsync(editor);
      await refreshContent();
      setMode("library");
      setEditingId(null);
      setEditor(emptyEditor);
    } catch (error) {
      Alert.alert("Question not saved", error instanceof Error ? error.message : "Check the question fields and try again.");
    }
  };

  const chooseCsv = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/comma-separated-values", "application/vnd.ms-excel", "text/plain"], copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      const text = Platform.OS === "web" && asset.file ? await asset.file.text() : await new File(asset.uri).text();
      if (text.length > 200000) { Alert.alert("File is too large", "Use a CSV smaller than 200 KB for a single import."); return; }
      setCsv(text);
      setCsvName(asset.name || "questions.csv");
      setCsvResult(null);
    } catch (error) {
      Alert.alert("Could not read CSV", error instanceof Error ? error.message : "Choose a valid UTF-8 CSV file.");
    }
  };

  const submitImport = async (publishAfterValidation: boolean) => {
    if (!csv.trim()) { Alert.alert("Choose a CSV file", "Select a quiz CSV file or paste the content before importing."); return; }
    try {
      const result = await importCsv.mutateAsync({ fileName: csvName, csv, publishAfterValidation });
      setCsvResult(`${result.imported} imported · ${result.rejected} rejected${result.errors.length ? `\n${result.errors.join("\n")}` : ""}`);
      await refreshContent();
      if (result.rejected === 0) { setCsv(""); setCsvName("questions.csv"); }
    } catch (error) {
      Alert.alert("Import failed", error instanceof Error ? error.message : "The CSV could not be imported.");
    }
  };

  const changeStatus = async (id: number, status: Status) => {
    try { await setQuestionStatus.mutateAsync({ id, status }); await refreshContent(); }
    catch (error) { Alert.alert("Status not updated", error instanceof Error ? error.message : "Try again."); }
  };

  const confirmRemove = (id: number) => Alert.alert("Delete this question?", "This permanently removes the question from the content platform and player delivery.", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: () => removeQuestion.mutateAsync({ id }).then(refreshContent).catch(() => Alert.alert("Delete failed", "Try again.")) },
  ]);

  if (me.isLoading) return <ScreenContainer className="items-center justify-center" containerClassName="bg-background"><Text style={styles.loadingText}>Checking Content Studio access…</Text></ScreenContainer>;

  if (!me.data) {
    return <ScreenContainer className="px-5 pt-5" containerClassName="bg-background"><Back onPress={() => router.back()} /><View style={styles.gateIcon}><MaterialIcons name="admin-panel-settings" size={38} color="#312E81" /></View><Text style={styles.eyebrow}>QUIZIO CONTENT STUDIO</Text><Text style={styles.title}>Manage quizzes remotely</Text><Text style={styles.subtitle}>Sign in with the project-owner account to create, upload, publish, pause, and remove database-backed questions.</Text><Pressable onPress={() => startOAuthLogin()} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}><Text style={styles.primaryText}>Sign in to Content Studio</Text><MaterialIcons name="login" size={20} color="#FFFFFF" /></Pressable><Text style={styles.helpText}>Only administrator accounts can change quiz content. Player access is never required.</Text></ScreenContainer>;
  }

  if (!isAdmin) {
    return <ScreenContainer className="px-5 pt-5" containerClassName="bg-background"><Back onPress={() => router.back()} /><View style={styles.gateIcon}><MaterialIcons name="lock" size={38} color="#E11D48" /></View><Text style={styles.eyebrow}>ACCESS RESTRICTED</Text><Text style={styles.title}>Administrator account required</Text><Text style={styles.subtitle}>This signed-in account can play Quizio, but it cannot manage the remote question database. Sign in with the project-owner account to use Content Studio.</Text></ScreenContainer>;
  }

  if (mode === "editor") return <ScreenContainer className="px-5 pt-4" containerClassName="bg-background"><Back onPress={() => setMode("library")} /><Text style={styles.eyebrow}>QUESTION EDITOR</Text><Text style={styles.title}>{editingId ? "Edit question" : "New question"}</Text><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.editorScroll}><Input label="Question prompt" value={editor.prompt} onChangeText={(prompt) => setEditor((current) => ({ ...current, prompt }))} placeholder="What do you want players to answer?" multiline /><Text style={styles.fieldLabel}>ANSWER OPTIONS</Text>{(["optionA", "optionB", "optionC", "optionD"] as const).map((key, index) => <Pressable key={key} onPress={() => setEditor((current) => ({ ...current, correctOptionIndex: index }))} style={[styles.optionRow, editor.correctOptionIndex === index && styles.optionSelected]}><Text style={[styles.optionBadge, editor.correctOptionIndex === index && styles.optionBadgeSelected]}>{["A", "B", "C", "D"][index]}</Text><TextInput value={editor[key]} onChangeText={(value) => setEditor((current) => ({ ...current, [key]: value }))} placeholder={`Option ${["A", "B", "C", "D"][index]}`} placeholderTextColor="#94A3B8" style={styles.optionInput} /><MaterialIcons name={editor.correctOptionIndex === index ? "radio-button-checked" : "radio-button-unchecked"} size={22} color={editor.correctOptionIndex === index ? "#16A34A" : "#94A3B8"} /></Pressable>)}<Input label="Explanation" value={editor.explanation} onChangeText={(explanation) => setEditor((current) => ({ ...current, explanation }))} placeholder="Explain why the correct answer is right." multiline /><Text style={styles.fieldLabel}>CATEGORY</Text><View style={styles.chips}>{categories.data?.filter((category) => category.isActive).map((category) => <Pressable key={category.id} onPress={() => setEditor((current) => ({ ...current, categoryId: category.id }))} style={[styles.chip, editor.categoryId === category.id && styles.chipActive]}><Text style={[styles.chipText, editor.categoryId === category.id && styles.chipTextActive]}>{category.name}</Text></Pressable>)}</View><Text style={styles.fieldLabel}>DIFFICULTY</Text><View style={styles.chips}>{(["easy", "medium", "hard"] as const).map((difficulty) => <Pressable key={difficulty} onPress={() => setEditor((current) => ({ ...current, difficulty }))} style={[styles.chip, editor.difficulty === difficulty && styles.chipActive]}><Text style={[styles.chipText, editor.difficulty === difficulty && styles.chipTextActive]}>{difficulty}</Text></Pressable>)}</View><Text style={styles.fieldLabel}>PUBLICATION</Text><View style={styles.chips}>{(["draft", "published", "paused"] as const).map((status) => <Pressable key={status} onPress={() => setEditor((current) => ({ ...current, status }))} style={[styles.chip, editor.status === status && styles.chipActive]}><Text style={[styles.chipText, editor.status === status && styles.chipTextActive]}>{status}</Text></Pressable>)}</View><Input label="Source note (optional)" value={editor.sourceNote} onChangeText={(sourceNote) => setEditor((current) => ({ ...current, sourceNote }))} placeholder="Internal reference or source" /><Pressable onPress={saveQuestion} disabled={isBusy} style={({ pressed }) => [styles.primary, isBusy && styles.dimmed, pressed && styles.pressed]}><Text style={styles.primaryText}>{isBusy ? "Saving…" : editingId ? "Update question" : "Save question"}</Text><MaterialIcons name="save" size={20} color="#FFFFFF" /></Pressable></ScrollView></ScreenContainer>;

  if (mode === "import") return <ScreenContainer className="px-5 pt-4" containerClassName="bg-background"><Back onPress={() => setMode("library")} /><Text style={styles.eyebrow}>CSV IMPORT</Text><Text style={styles.title}>Upload questions</Text><Text style={styles.subtitle}>Select a UTF-8 CSV file. Imported questions are validated before they reach players.</Text><View style={styles.csvCard}><Text style={styles.csvLabel}>Required header</Text><Text style={styles.csvCode}>prompt,option_a,option_b,option_c,option_d,correct_option,explanation,category_slug,difficulty,source_note</Text></View><Pressable onPress={chooseCsv} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}><MaterialIcons name="upload-file" size={21} color="#312E81" /><Text style={styles.secondaryText}>{csv ? `Selected: ${csvName}` : "Select CSV file"}</Text></Pressable><Text style={styles.orText}>or paste CSV content</Text><TextInput value={csv} onChangeText={setCsv} multiline placeholder="Paste CSV rows here" placeholderTextColor="#94A3B8" style={styles.csvInput} textAlignVertical="top" /><Pressable onPress={() => submitImport(false)} disabled={isBusy} style={({ pressed }) => [styles.primary, isBusy && styles.dimmed, pressed && styles.pressed]}><Text style={styles.primaryText}>{isBusy ? "Validating…" : "Import as drafts"}</Text><MaterialIcons name="playlist-add" size={20} color="#FFFFFF" /></Pressable><Pressable onPress={() => submitImport(true)} disabled={isBusy} style={({ pressed }) => [styles.publishButton, isBusy && styles.dimmed, pressed && styles.pressed]}><Text style={styles.publishText}>Validate and publish</Text><MaterialIcons name="publish" size={20} color="#15803D" /></Pressable>{csvResult && <View style={styles.resultBox}><Text style={styles.resultTitle}>Import result</Text><Text style={styles.resultText}>{csvResult}</Text></View>}</ScreenContainer>;

  return <ScreenContainer className="pt-4" containerClassName="bg-background"><View style={styles.libraryHeader}><Back onPress={() => router.back()} /><Text style={styles.eyebrow}>QUIZIO CONTENT STUDIO</Text><Text style={styles.title}>Question library</Text><Text style={styles.subtitle}>Create and publish quiz content without changing app code.</Text><View style={styles.metrics}><Metric label="Published" value={dashboard.data?.published ?? 0} color="#16A34A" /><Metric label="Drafts" value={dashboard.data?.drafts ?? 0} color="#F59E0B" /><Metric label="Paused" value={dashboard.data?.paused ?? 0} color="#64748B" /></View><View style={styles.actionRow}><Pressable onPress={openNewQuestion} style={({ pressed }) => [styles.primaryHalf, pressed && styles.pressed]}><MaterialIcons name="add-circle" size={20} color="#FFFFFF" /><Text style={styles.primaryText}>New question</Text></Pressable><Pressable onPress={() => setMode("import")} style={({ pressed }) => [styles.secondaryHalf, pressed && styles.pressed]}><MaterialIcons name="upload-file" size={20} color="#312E81" /><Text style={styles.secondaryText}>Import CSV</Text></Pressable></View><Text style={styles.listHeading}>RECENT QUESTIONS</Text></View><FlatList data={questions.data ?? []} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.emptyText}>No remote questions yet. Create one or import a CSV batch.</Text>} renderItem={({ item }) => <View style={styles.questionCard}><View style={styles.questionTop}><View style={[styles.statusDot, { backgroundColor: statusColor(item.status) }]} /><Text style={styles.questionCategory}>{item.categoryName} · {item.difficulty}</Text><Text style={[styles.statusText, { color: statusColor(item.status) }]}>{item.status}</Text></View><Text style={styles.questionPrompt} numberOfLines={2}>{item.prompt}</Text><View style={styles.cardActions}><Pressable onPress={() => editQuestion(item)} style={styles.smallAction}><MaterialIcons name="edit" size={18} color="#312E81" /><Text style={styles.smallActionText}>Edit</Text></Pressable>{item.status !== "published" && <Pressable onPress={() => changeStatus(item.id, "published")} style={styles.smallAction}><MaterialIcons name="publish" size={18} color="#15803D" /><Text style={[styles.smallActionText, { color: "#15803D" }]}>Publish</Text></Pressable>}{item.status === "published" && <Pressable onPress={() => changeStatus(item.id, "paused")} style={styles.smallAction}><MaterialIcons name="pause-circle-filled" size={18} color="#B45309" /><Text style={[styles.smallActionText, { color: "#B45309" }]}>Pause</Text></Pressable>}<Pressable onPress={() => confirmRemove(item.id)} style={styles.smallAction}><MaterialIcons name="delete-outline" size={18} color="#BE123C" /></Pressable></View></View>} /></ScreenContainer>;
}

function Back({ onPress }: { onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={21} color="#312E81" /></Pressable>; }
function Input({ label, value, onChangeText, placeholder, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#94A3B8" multiline={multiline} style={[styles.input, multiline && styles.multiline]} textAlignVertical={multiline ? "top" : "center"} /></View>; }
function Metric({ label, value, color }: { label: string; value: number; color: string }) { return <View style={styles.metric}><Text style={[styles.metricValue, { color }]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
const statusColor = (status: Status) => ({ draft: "#B45309", published: "#15803D", paused: "#64748B", archived: "#BE123C" }[status]);

const styles = StyleSheet.create({
  loadingText: { color: "#64748B", fontSize: 15 }, eyebrow: { color: "#0F9F9A", fontWeight: "900", fontSize: 11, letterSpacing: 1.1 }, title: { color: "#111827", fontSize: 30, lineHeight: 37, fontWeight: "900", marginTop: 4 }, subtitle: { color: "#64748B", fontSize: 14, lineHeight: 20, marginTop: 5 }, gateIcon: { width: 76, height: 76, backgroundColor: "#EEF2FF", borderRadius: 25, alignItems: "center", justifyContent: "center", marginTop: 32, marginBottom: 21 }, helpText: { color: "#64748B", fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 16 },
  back: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center", marginBottom: 17 }, pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] }, dimmed: { opacity: 0.55 }, primary: { minHeight: 53, backgroundColor: "#312E81", borderRadius: 16, marginTop: 24, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, primaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" }, secondary: { minHeight: 53, borderWidth: 1, borderColor: "#C7D2FE", backgroundColor: "#EEF2FF", borderRadius: 16, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20 }, secondaryText: { color: "#312E81", fontSize: 14, fontWeight: "900" },
  libraryHeader: { paddingHorizontal: 20 }, metrics: { flexDirection: "row", gap: 10, marginTop: 20 }, metric: { flex: 1, backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderWidth: 1, borderRadius: 16, padding: 12 }, metricValue: { fontSize: 23, fontWeight: "900" }, metricLabel: { color: "#64748B", fontSize: 10, marginTop: 3 }, actionRow: { flexDirection: "row", gap: 10, marginTop: 17 }, primaryHalf: { flex: 1, minHeight: 50, backgroundColor: "#312E81", borderRadius: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }, secondaryHalf: { flex: 1, minHeight: 50, backgroundColor: "#EEF2FF", borderRadius: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }, listHeading: { color: "#64748B", fontSize: 10, fontWeight: "900", letterSpacing: 1, marginTop: 24, marginBottom: 9 }, list: { paddingHorizontal: 20, paddingBottom: 30, gap: 10 }, emptyText: { color: "#64748B", fontSize: 14, textAlign: "center", marginTop: 32 },
  questionCard: { backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderWidth: 1, borderRadius: 18, padding: 14 }, questionTop: { flexDirection: "row", alignItems: "center", gap: 6 }, statusDot: { height: 8, width: 8, borderRadius: 4 }, questionCategory: { color: "#64748B", fontSize: 11, fontWeight: "800", flex: 1 }, statusText: { textTransform: "capitalize", fontSize: 11, fontWeight: "900" }, questionPrompt: { color: "#111827", fontSize: 15, lineHeight: 20, fontWeight: "800", marginTop: 9 }, cardActions: { flexDirection: "row", gap: 8, marginTop: 12 }, smallAction: { minHeight: 34, paddingHorizontal: 9, borderRadius: 10, backgroundColor: "#F8FAFC", flexDirection: "row", gap: 4, alignItems: "center", justifyContent: "center" }, smallActionText: { color: "#312E81", fontSize: 11, fontWeight: "900" },
  editorScroll: { paddingBottom: 32 }, field: { marginTop: 18 }, fieldLabel: { color: "#475569", fontSize: 11, fontWeight: "900", letterSpacing: 0.7, marginBottom: 7 }, input: { backgroundColor: "#FFFFFF", borderColor: "#CBD5E1", borderWidth: 1, borderRadius: 14, minHeight: 50, paddingHorizontal: 13, color: "#111827", fontSize: 14 }, multiline: { minHeight: 92, paddingTop: 12, lineHeight: 20 }, optionRow: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#CBD5E1", minHeight: 53, borderRadius: 14, paddingHorizontal: 10, marginBottom: 8, flexDirection: "row", alignItems: "center" }, optionSelected: { borderColor: "#16A34A", backgroundColor: "#F0FDF4" }, optionBadge: { width: 28, height: 28, borderRadius: 9, backgroundColor: "#E2E8F0", alignItems: "center", justifyContent: "center", color: "#475569", fontWeight: "900", fontSize: 12 }, optionBadgeSelected: { backgroundColor: "#16A34A", color: "#FFFFFF" }, optionInput: { flex: 1, color: "#111827", marginHorizontal: 9, fontSize: 14, fontWeight: "700" }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 }, chip: { minHeight: 35, borderRadius: 12, paddingHorizontal: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F5F9" }, chipActive: { backgroundColor: "#312E81" }, chipText: { color: "#475569", fontWeight: "800", fontSize: 12, textTransform: "capitalize" }, chipTextActive: { color: "#FFFFFF" },
  csvCard: { backgroundColor: "#F8FAFC", borderRadius: 16, borderColor: "#E2E8F0", borderWidth: 1, padding: 14, marginTop: 20 }, csvLabel: { color: "#475569", fontSize: 11, fontWeight: "900", marginBottom: 6 }, csvCode: { color: "#312E81", fontSize: 11, lineHeight: 16, fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) }, orText: { color: "#64748B", fontSize: 12, fontWeight: "800", textAlign: "center", marginVertical: 15 }, csvInput: { backgroundColor: "#FFFFFF", borderColor: "#CBD5E1", borderWidth: 1, borderRadius: 15, minHeight: 170, padding: 12, color: "#111827", fontSize: 12, lineHeight: 17 }, publishButton: { minHeight: 50, backgroundColor: "#DCFCE7", borderRadius: 15, marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, publishText: { color: "#15803D", fontSize: 14, fontWeight: "900" }, resultBox: { backgroundColor: "#EEF2FF", borderRadius: 16, padding: 14, marginTop: 14 }, resultTitle: { color: "#312E81", fontSize: 13, fontWeight: "900" }, resultText: { color: "#475569", fontSize: 12, lineHeight: 18, marginTop: 5 },
});
