import { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import type { Session } from "@supabase/supabase-js";

import { ScreenContainer } from "@/components/screen-container";
import { getSupabaseClient, quizioOwnerEmail } from "@/lib/supabase";

type StudioMode = "library" | "editor" | "import";
type Status = "draft" | "published" | "paused" | "archived";
type Category = { id: number; name: string; slug: string; is_active: boolean; sort_order: number };
type Question = {
  id: number;
  category_id: number;
  prompt: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option_index: number;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  status: Status;
  source_note: string | null;
  quiz_categories: { name: string } | null;
};
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
  prompt: "", optionA: "", optionB: "", optionC: "", optionD: "", correctOptionIndex: 0,
  explanation: "", categoryId: 0, difficulty: "medium", status: "draft", sourceNote: "",
};

const asMessage = (error: unknown) => error instanceof Error ? error.message : "Please try again.";

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') { field += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === "," && !quoted) { row.push(field.trim()); field = ""; continue; }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; field = ""; continue;
    }
    field += char;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export default function ContentStudioWeb() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [email, setEmail] = useState(quizioOwnerEmail);
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authBusy, setAuthBusy] = useState(false);
  const [mode, setMode] = useState<StudioMode>("library");
  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [editor, setEditor] = useState<QuestionEditor>(emptyEditor);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [csv, setCsv] = useState("");
  const [csvName, setCsvName] = useState("questions.csv");
  const [csvResult, setCsvResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadContent = async () => {
    if (!supabase || !isAdmin) return;
    setLoadingContent(true);
    const [{ data: categoryData, error: categoryError }, { data: questionData, error: questionError }] = await Promise.all([
      supabase.from("quiz_categories").select("id,name,slug,is_active,sort_order").order("sort_order"),
      supabase.from("quiz_questions").select("*,quiz_categories(name)").order("updated_at", { ascending: false }).limit(200),
    ]);
    setLoadingContent(false);
    if (categoryError || questionError) {
      Alert.alert("Could not load content", asMessage(categoryError ?? questionError));
      return;
    }
    setCategories((categoryData ?? []) as Category[]);
    setQuestions((questionData ?? []) as Question[]);
  };

  const checkOwnerAccess = async (activeSession: Session | null) => {
    if (!supabase || !activeSession?.user.email) { setIsAdmin(false); setCheckingAccess(false); return; }
    setCheckingAccess(true);
    const { data, error } = await supabase.from("quizio_admins").select("email").eq("email", activeSession.user.email.toLowerCase()).maybeSingle();
    setCheckingAccess(false);
    if (error) { setAuthError(asMessage(error)); setIsAdmin(false); return; }
    setIsAdmin(Boolean(data));
  };

  useEffect(() => {
    if (!supabase) { setCheckingAccess(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); void checkOwnerAccess(data.session); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void checkOwnerAccess(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => { if (isAdmin) void loadContent(); }, [isAdmin]);

  const submitAuth = async () => {
    if (!supabase) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) { setAuthError("Enter your owner email and password."); return; }
    if (quizioOwnerEmail && normalizedEmail !== quizioOwnerEmail) { setAuthError("Only the configured Quizio owner email may access this panel."); return; }
    setAuthBusy(true); setAuthError(null);
    const response = authMode === "signup"
      ? await supabase.auth.signUp({ email: normalizedEmail, password })
      : await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    setAuthBusy(false);
    if (response.error) { setAuthError(response.error.message); return; }
    if (authMode === "signup" && !response.data.session) setAuthError("Account created. Check your email to confirm the account, then sign in.");
  };

  const signOut = async () => { if (supabase) await supabase.auth.signOut(); setMode("library"); setPassword(""); };
  const refreshContent = async () => { await loadContent(); };
  const openNewQuestion = () => { setEditingId(null); setEditor({ ...emptyEditor, categoryId: categories.find((item) => item.is_active)?.id ?? 0 }); setMode("editor"); };
  const editQuestion = (question: Question) => {
    setEditingId(question.id);
    setEditor({ prompt: question.prompt, optionA: question.option_a, optionB: question.option_b, optionC: question.option_c, optionD: question.option_d, correctOptionIndex: question.correct_option_index, explanation: question.explanation, categoryId: question.category_id, difficulty: question.difficulty, status: question.status, sourceNote: question.source_note ?? "" });
    setMode("editor");
  };
  const questionPayload = () => ({
    prompt: editor.prompt.trim(), option_a: editor.optionA.trim(), option_b: editor.optionB.trim(), option_c: editor.optionC.trim(), option_d: editor.optionD.trim(),
    correct_option_index: editor.correctOptionIndex, explanation: editor.explanation.trim(), category_id: editor.categoryId, difficulty: editor.difficulty, status: editor.status, source_note: editor.sourceNote.trim() || null,
  });
  const saveQuestion = async () => {
    if (!supabase || !editor.categoryId) { Alert.alert("Choose a category", "Select the category for this question."); return; }
    setSaving(true);
    const payload = questionPayload();
    const response = editingId ? await supabase.from("quiz_questions").update(payload).eq("id", editingId) : await supabase.from("quiz_questions").insert(payload);
    setSaving(false);
    if (response.error) { Alert.alert("Question not saved", response.error.message); return; }
    setMode("library"); setEditingId(null); setEditor(emptyEditor); await refreshContent();
  };
  const changeStatus = async (id: number, status: Status) => {
    if (!supabase) return;
    const { error } = await supabase.from("quiz_questions").update({ status }).eq("id", id);
    if (error) Alert.alert("Status not updated", error.message); else await refreshContent();
  };
  const removeQuestion = (id: number) => Alert.alert("Delete this question?", "This permanently removes the question from the content studio.", [
    { text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => { if (supabase) supabase.from("quiz_questions").delete().eq("id", id).then(({ error }) => error ? Alert.alert("Delete failed", error.message) : refreshContent()); } },
  ]);
  const chooseCsv = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/comma-separated-values", "application/vnd.ms-excel", "text/plain"], copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      const text = Platform.OS === "web" && asset.file ? await asset.file.text() : await new File(asset.uri).text();
      if (text.length > 200000) { Alert.alert("File is too large", "Use a CSV smaller than 200 KB."); return; }
      setCsv(text); setCsvName(asset.name || "questions.csv"); setCsvResult(null);
    } catch (error) { Alert.alert("Could not read CSV", asMessage(error)); }
  };
  const importCsv = async (publish: boolean) => {
    if (!supabase || !csv.trim()) { Alert.alert("Choose a CSV file", "Select or paste a quiz CSV file first."); return; }
    const rows = parseCsvRows(csv);
    const headers = rows.shift()?.map((header) => header.toLowerCase());
    const required = ["prompt", "option_a", "option_b", "option_c", "option_d", "correct_option", "explanation", "category_slug", "difficulty", "source_note"];
    if (!headers || required.some((field) => !headers.includes(field))) { Alert.alert("Invalid CSV", `Use this header: ${required.join(",")}`); return; }
    const index = Object.fromEntries(headers.map((header, position) => [header, position]));
    const bySlug = new Map(categories.map((category) => [category.slug, category.id]));
    const payload: Array<Record<string, unknown>> = []; let rejected = 0;
    for (const row of rows) {
      const get = (field: string) => row[index[field]]?.trim() ?? "";
      const option = get("correct_option").toUpperCase();
      const categoryId = bySlug.get(get("category_slug").toLowerCase());
      const difficulty = get("difficulty").toLowerCase();
      if (!categoryId || !["A", "B", "C", "D"].includes(option) || !["easy", "medium", "hard"].includes(difficulty) || required.slice(0, 7).some((field) => !get(field))) { rejected += 1; continue; }
      payload.push({ prompt: get("prompt"), option_a: get("option_a"), option_b: get("option_b"), option_c: get("option_c"), option_d: get("option_d"), correct_option_index: ["A", "B", "C", "D"].indexOf(option), explanation: get("explanation"), category_id: categoryId, difficulty, status: publish ? "published" : "draft", source_note: get("source_note") || null });
    }
    if (!payload.length) { setCsvResult(`0 imported · ${rejected} rejected`); return; }
    setSaving(true); const { error } = await supabase.from("quiz_questions").insert(payload); setSaving(false);
    if (error) { Alert.alert("Import failed", error.message); return; }
    setCsvResult(`${payload.length} imported · ${rejected} rejected`); if (!rejected) setCsv(""); await refreshContent();
  };

  if (!supabase) return <ConfigurationGate />;
  if (checkingAccess) return <ScreenContainer className="items-center justify-center" containerClassName="bg-background"><Text style={styles.loadingText}>Checking secure Content Studio access…</Text></ScreenContainer>;
  if (!session) return <AuthGate email={email} password={password} mode={authMode} busy={authBusy} error={authError} onEmail={setEmail} onPassword={setPassword} onMode={setAuthMode} onSubmit={submitAuth} />;
  if (!isAdmin) return <ScreenContainer className="px-5 pt-5" containerClassName="bg-background"><Back onPress={() => router.back()} /><View style={styles.gateIcon}><MaterialIcons name="lock" size={38} color="#E11D48" /></View><Text style={styles.eyebrow}>ACCESS RESTRICTED</Text><Text style={styles.title}>Administrator account required</Text><Text style={styles.subtitle}>This account is signed in but is not the owner approved for Quizio Content Studio.</Text><Pressable onPress={signOut} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}><Text style={styles.secondaryText}>Sign out</Text></Pressable></ScreenContainer>;
  if (mode === "editor") return <EditorScreen editor={editor} categories={categories} saving={saving} editing={Boolean(editingId)} onBack={() => setMode("library")} onChange={setEditor} onSave={saveQuestion} />;
  if (mode === "import") return <ImportScreen csv={csv} csvName={csvName} result={csvResult} saving={saving} onBack={() => setMode("library")} onChoose={chooseCsv} onCsv={setCsv} onImport={importCsv} />;
  const published = questions.filter((question) => question.status === "published").length;
  const drafts = questions.filter((question) => question.status === "draft").length;
  const paused = questions.filter((question) => question.status === "paused").length;
  return <ScreenContainer className="pt-4" containerClassName="bg-background"><View style={styles.libraryHeader}><View style={styles.libraryTop}><View><Text style={styles.eyebrow}>QUIZIO CONTENT STUDIO</Text><Text style={styles.title}>Question library</Text></View><Pressable onPress={signOut} style={styles.logout}><MaterialIcons name="logout" size={18} color="#312E81" /></Pressable></View><Text style={styles.subtitle}>Create, upload, publish, pause, and remove quizzes privately.</Text><View style={styles.metrics}><Metric label="Published" value={published} color="#16A34A" /><Metric label="Drafts" value={drafts} color="#F59E0B" /><Metric label="Paused" value={paused} color="#64748B" /></View><View style={styles.actionRow}><Pressable onPress={openNewQuestion} style={({ pressed }) => [styles.primaryHalf, pressed && styles.pressed]}><MaterialIcons name="add-circle" size={20} color="#FFFFFF" /><Text style={styles.primaryText}>New question</Text></Pressable><Pressable onPress={() => setMode("import")} style={({ pressed }) => [styles.secondaryHalf, pressed && styles.pressed]}><MaterialIcons name="upload-file" size={20} color="#312E81" /><Text style={styles.secondaryText}>Import CSV</Text></Pressable></View><Text style={styles.listHeading}>{loadingContent ? "LOADING QUESTIONS…" : "RECENT QUESTIONS"}</Text></View><FlatList data={questions} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.emptyText}>No quiz questions yet. Create one or import a CSV batch.</Text>} renderItem={({ item }) => <View style={styles.questionCard}><View style={styles.questionTop}><View style={[styles.statusDot, { backgroundColor: statusColor(item.status) }]} /><Text style={styles.questionCategory}>{item.quiz_categories?.name ?? "Uncategorized"} · {item.difficulty}</Text><Text style={[styles.statusText, { color: statusColor(item.status) }]}>{item.status}</Text></View><Text style={styles.questionPrompt} numberOfLines={2}>{item.prompt}</Text><View style={styles.cardActions}><Pressable onPress={() => editQuestion(item)} style={styles.smallAction}><MaterialIcons name="edit" size={18} color="#312E81" /><Text style={styles.smallActionText}>Edit</Text></Pressable>{item.status !== "published" && <Pressable onPress={() => changeStatus(item.id, "published")} style={styles.smallAction}><MaterialIcons name="publish" size={18} color="#15803D" /><Text style={[styles.smallActionText, { color: "#15803D" }]}>Publish</Text></Pressable>}{item.status === "published" && <Pressable onPress={() => changeStatus(item.id, "paused")} style={styles.smallAction}><MaterialIcons name="pause-circle-filled" size={18} color="#B45309" /><Text style={[styles.smallActionText, { color: "#B45309" }]}>Pause</Text></Pressable>}<Pressable onPress={() => removeQuestion(item.id)} style={styles.smallAction}><MaterialIcons name="delete-outline" size={18} color="#BE123C" /></Pressable></View></View>} /></ScreenContainer>;
}

function ConfigurationGate() { return <ScreenContainer className="px-5 pt-5" containerClassName="bg-background"><View style={styles.gateIcon}><MaterialIcons name="settings" size={38} color="#312E81" /></View><Text style={styles.eyebrow}>SETUP REQUIRED</Text><Text style={styles.title}>Connect Supabase</Text><Text style={styles.subtitle}>Add EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and EXPO_PUBLIC_QUIZIO_OWNER_EMAIL to the Fly build arguments, then redeploy.</Text></ScreenContainer>; }
function AuthGate({ email, password, mode, busy, error, onEmail, onPassword, onMode, onSubmit }: { email: string; password: string; mode: "signin" | "signup"; busy: boolean; error: string | null; onEmail: (value: string) => void; onPassword: (value: string) => void; onMode: (value: "signin" | "signup") => void; onSubmit: () => void }) { return <ScreenContainer className="px-5 pt-5" containerClassName="bg-background"><View style={styles.gateIcon}><MaterialIcons name="admin-panel-settings" size={38} color="#312E81" /></View><Text style={styles.eyebrow}>QUIZIO CONTENT STUDIO</Text><Text style={styles.title}>{mode === "signin" ? "Owner sign in" : "Create owner account"}</Text><Text style={styles.subtitle}>Use the private owner email and password secured by Supabase Auth.</Text><Text style={styles.fieldLabel}>OWNER EMAIL</Text><TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={onEmail} placeholder="owner@example.com" placeholderTextColor="#94A3B8" style={styles.input} /><Text style={styles.fieldLabel}>PASSWORD</Text><TextInput autoComplete={mode === "signin" ? "current-password" : "new-password"} secureTextEntry value={password} onChangeText={onPassword} placeholder="Your private password" placeholderTextColor="#94A3B8" style={styles.input} /><Pressable onPress={onSubmit} disabled={busy} style={({ pressed }) => [styles.primary, busy && styles.dimmed, pressed && styles.pressed]}><Text style={styles.primaryText}>{busy ? "Please wait…" : mode === "signin" ? "Sign in to Content Studio" : "Create owner account"}</Text><MaterialIcons name="login" size={20} color="#FFFFFF" /></Pressable>{error && <Text style={styles.authError}>{error}</Text>}<Pressable onPress={() => onMode(mode === "signin" ? "signup" : "signin")} style={({ pressed }) => [styles.authSwitch, pressed && styles.pressed]}><Text style={styles.authSwitchText}>{mode === "signin" ? "First time? Create the owner account" : "Already created it? Sign in"}</Text></Pressable></ScreenContainer>; }
function EditorScreen({ editor, categories, saving, editing, onBack, onChange, onSave }: { editor: QuestionEditor; categories: Category[]; saving: boolean; editing: boolean; onBack: () => void; onChange: (value: QuestionEditor) => void; onSave: () => void }) { return <ScreenContainer className="px-5 pt-4" containerClassName="bg-background"><Back onPress={onBack} /><Text style={styles.eyebrow}>QUESTION EDITOR</Text><Text style={styles.title}>{editing ? "Edit question" : "New question"}</Text><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.editorScroll}><Input label="Question prompt" value={editor.prompt} onChangeText={(prompt) => onChange({ ...editor, prompt })} placeholder="What do you want players to answer?" multiline /><Text style={styles.fieldLabel}>ANSWER OPTIONS</Text>{(["optionA", "optionB", "optionC", "optionD"] as const).map((key, index) => <Pressable key={key} onPress={() => onChange({ ...editor, correctOptionIndex: index })} style={[styles.optionRow, editor.correctOptionIndex === index && styles.optionSelected]}><Text style={[styles.optionBadge, editor.correctOptionIndex === index && styles.optionBadgeSelected]}>{["A", "B", "C", "D"][index]}</Text><TextInput value={editor[key]} onChangeText={(value) => onChange({ ...editor, [key]: value })} placeholder={`Option ${["A", "B", "C", "D"][index]}`} placeholderTextColor="#94A3B8" style={styles.optionInput} /><MaterialIcons name={editor.correctOptionIndex === index ? "radio-button-checked" : "radio-button-unchecked"} size={22} color={editor.correctOptionIndex === index ? "#16A34A" : "#94A3B8"} /></Pressable>)}<Input label="Explanation" value={editor.explanation} onChangeText={(explanation) => onChange({ ...editor, explanation })} placeholder="Explain why the correct answer is right." multiline /><Text style={styles.fieldLabel}>CATEGORY</Text><View style={styles.chips}>{categories.filter((category) => category.is_active).map((category) => <Pressable key={category.id} onPress={() => onChange({ ...editor, categoryId: category.id })} style={[styles.chip, editor.categoryId === category.id && styles.chipActive]}><Text style={[styles.chipText, editor.categoryId === category.id && styles.chipTextActive]}>{category.name}</Text></Pressable>)}</View><Text style={styles.fieldLabel}>DIFFICULTY</Text><View style={styles.chips}>{(["easy", "medium", "hard"] as const).map((difficulty) => <Pressable key={difficulty} onPress={() => onChange({ ...editor, difficulty })} style={[styles.chip, editor.difficulty === difficulty && styles.chipActive]}><Text style={[styles.chipText, editor.difficulty === difficulty && styles.chipTextActive]}>{difficulty}</Text></Pressable>)}</View><Text style={styles.fieldLabel}>PUBLICATION</Text><View style={styles.chips}>{(["draft", "published", "paused"] as const).map((status) => <Pressable key={status} onPress={() => onChange({ ...editor, status })} style={[styles.chip, editor.status === status && styles.chipActive]}><Text style={[styles.chipText, editor.status === status && styles.chipTextActive]}>{status}</Text></Pressable>)}</View><Input label="Source note (optional)" value={editor.sourceNote} onChangeText={(sourceNote) => onChange({ ...editor, sourceNote })} placeholder="Internal reference" /><Pressable onPress={onSave} disabled={saving} style={({ pressed }) => [styles.primary, saving && styles.dimmed, pressed && styles.pressed]}><Text style={styles.primaryText}>{saving ? "Saving…" : editing ? "Update question" : "Save question"}</Text><MaterialIcons name="save" size={20} color="#FFFFFF" /></Pressable></ScrollView></ScreenContainer>; }
function ImportScreen({ csv, csvName, result, saving, onBack, onChoose, onCsv, onImport }: { csv: string; csvName: string; result: string | null; saving: boolean; onBack: () => void; onChoose: () => void; onCsv: (value: string) => void; onImport: (publish: boolean) => void }) { return <ScreenContainer className="px-5 pt-4" containerClassName="bg-background"><Back onPress={onBack} /><Text style={styles.eyebrow}>CSV IMPORT</Text><Text style={styles.title}>Upload questions</Text><Text style={styles.subtitle}>CSV rows are validated before being added to Supabase.</Text><View style={styles.csvCard}><Text style={styles.csvLabel}>Required header</Text><Text style={styles.csvCode}>prompt,option_a,option_b,option_c,option_d,correct_option,explanation,category_slug,difficulty,source_note</Text></View><Pressable onPress={onChoose} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}><MaterialIcons name="upload-file" size={21} color="#312E81" /><Text style={styles.secondaryText}>{csv ? `Selected: ${csvName}` : "Select CSV file"}</Text></Pressable><Text style={styles.orText}>or paste CSV content</Text><TextInput value={csv} onChangeText={onCsv} multiline placeholder="Paste CSV rows here" placeholderTextColor="#94A3B8" style={styles.csvInput} textAlignVertical="top" /><Pressable onPress={() => onImport(false)} disabled={saving} style={({ pressed }) => [styles.primary, saving && styles.dimmed, pressed && styles.pressed]}><Text style={styles.primaryText}>{saving ? "Validating…" : "Import as drafts"}</Text><MaterialIcons name="playlist-add" size={20} color="#FFFFFF" /></Pressable><Pressable onPress={() => onImport(true)} disabled={saving} style={({ pressed }) => [styles.publishButton, saving && styles.dimmed, pressed && styles.pressed]}><Text style={styles.publishText}>Validate and publish</Text><MaterialIcons name="publish" size={20} color="#15803D" /></Pressable>{result && <View style={styles.resultBox}><Text style={styles.resultTitle}>Import result</Text><Text style={styles.resultText}>{result}</Text></View>}</ScreenContainer>; }
function Back({ onPress }: { onPress: () => void }) { return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Go back" style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={21} color="#312E81" /></Pressable>; }
function Input({ label, value, onChangeText, placeholder, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#94A3B8" multiline={multiline} style={[styles.input, multiline && styles.multiline]} textAlignVertical={multiline ? "top" : "center"} /></View>; }
function Metric({ label, value, color }: { label: string; value: number; color: string }) { return <View style={styles.metric}><Text style={[styles.metricValue, { color }]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
const statusColor = (status: Status) => ({ draft: "#B45309", published: "#16A34A", paused: "#64748B", archived: "#BE123C" }[status]);

const styles = StyleSheet.create({
  loadingText: { color: "#64748B", fontSize: 15 }, eyebrow: { color: "#0F9F9A", fontWeight: "900", fontSize: 11, letterSpacing: 1.1 }, title: { color: "#111827", fontSize: 30, lineHeight: 37, fontWeight: "900", marginTop: 4 }, subtitle: { color: "#64748B", fontSize: 14, lineHeight: 20, marginTop: 5 }, gateIcon: { width: 76, height: 76, backgroundColor: "#EEF2FF", borderRadius: 25, alignItems: "center", justifyContent: "center", marginTop: 32, marginBottom: 21 }, authError: { color: "#B91C1C", fontSize: 13, lineHeight: 19, marginTop: 12 }, authSwitch: { alignSelf: "center", marginTop: 18, padding: 8 }, authSwitchText: { color: "#312E81", fontSize: 13, fontWeight: "800" }, back: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center", marginBottom: 17 }, pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] }, dimmed: { opacity: 0.55 }, primary: { minHeight: 53, backgroundColor: "#312E81", borderRadius: 16, marginTop: 24, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, primaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" }, secondary: { minHeight: 53, borderWidth: 1, borderColor: "#C7D2FE", backgroundColor: "#EEF2FF", borderRadius: 16, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20 }, secondaryText: { color: "#312E81", fontSize: 14, fontWeight: "900" }, field: { marginTop: 18 }, fieldLabel: { color: "#475569", fontSize: 11, fontWeight: "900", letterSpacing: 0.7, marginBottom: 7 }, input: { backgroundColor: "#FFFFFF", borderColor: "#CBD5E1", borderWidth: 1, borderRadius: 14, minHeight: 50, paddingHorizontal: 13, color: "#111827", fontSize: 14 }, multiline: { minHeight: 92, paddingTop: 12, lineHeight: 20 }, libraryHeader: { paddingHorizontal: 20 }, libraryTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, logout: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" }, metrics: { flexDirection: "row", gap: 10, marginTop: 20 }, metric: { flex: 1, backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderWidth: 1, borderRadius: 16, padding: 12 }, metricValue: { fontSize: 23, fontWeight: "900" }, metricLabel: { color: "#64748B", fontSize: 10, marginTop: 3 }, actionRow: { flexDirection: "row", gap: 10, marginTop: 17 }, primaryHalf: { flex: 1, minHeight: 50, backgroundColor: "#312E81", borderRadius: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }, secondaryHalf: { flex: 1, minHeight: 50, backgroundColor: "#EEF2FF", borderRadius: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }, listHeading: { color: "#64748B", fontSize: 10, fontWeight: "900", letterSpacing: 1, marginTop: 24, marginBottom: 9 }, list: { paddingHorizontal: 20, paddingBottom: 30, gap: 10 }, emptyText: { color: "#64748B", fontSize: 14, textAlign: "center", marginTop: 32 }, questionCard: { backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderWidth: 1, borderRadius: 18, padding: 14 }, questionTop: { flexDirection: "row", alignItems: "center", gap: 6 }, statusDot: { height: 8, width: 8, borderRadius: 4 }, questionCategory: { color: "#64748B", fontSize: 11, fontWeight: "800", flex: 1 }, statusText: { textTransform: "capitalize", fontSize: 11, fontWeight: "900" }, questionPrompt: { color: "#111827", fontSize: 15, lineHeight: 20, fontWeight: "800", marginTop: 9 }, cardActions: { flexDirection: "row", gap: 8, marginTop: 12 }, smallAction: { minHeight: 34, paddingHorizontal: 9, borderRadius: 10, backgroundColor: "#F8FAFC", flexDirection: "row", gap: 4, alignItems: "center", justifyContent: "center" }, smallActionText: { color: "#312E81", fontSize: 11, fontWeight: "900" }, editorScroll: { paddingBottom: 32 }, optionRow: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#CBD5E1", minHeight: 53, borderRadius: 14, paddingHorizontal: 10, marginBottom: 8, flexDirection: "row", alignItems: "center" }, optionSelected: { borderColor: "#16A34A", backgroundColor: "#F0FDF4" }, optionBadge: { width: 28, height: 28, borderRadius: 9, backgroundColor: "#E2E8F0", textAlign: "center", paddingTop: 6, color: "#475569", fontWeight: "900", fontSize: 12 }, optionBadgeSelected: { backgroundColor: "#16A34A", color: "#FFFFFF" }, optionInput: { flex: 1, color: "#111827", marginHorizontal: 9, fontSize: 14, fontWeight: "700" }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 }, chip: { minHeight: 35, borderRadius: 12, paddingHorizontal: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F5F9" }, chipActive: { backgroundColor: "#312E81" }, chipText: { color: "#475569", fontWeight: "800", fontSize: 12, textTransform: "capitalize" }, chipTextActive: { color: "#FFFFFF" }, csvCard: { backgroundColor: "#F8FAFC", borderRadius: 16, borderColor: "#E2E8F0", borderWidth: 1, padding: 14, marginTop: 20 }, csvLabel: { color: "#475569", fontSize: 11, fontWeight: "900", marginBottom: 6 }, csvCode: { color: "#312E81", fontSize: 11, lineHeight: 16, fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) }, orText: { color: "#64748B", fontSize: 12, fontWeight: "800", textAlign: "center", marginVertical: 15 }, csvInput: { backgroundColor: "#FFFFFF", borderColor: "#CBD5E1", borderWidth: 1, borderRadius: 15, minHeight: 170, padding: 12, color: "#111827", fontSize: 12, lineHeight: 17 }, publishButton: { minHeight: 50, backgroundColor: "#DCFCE7", borderRadius: 15, marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, publishText: { color: "#15803D", fontSize: 14, fontWeight: "900" }, resultBox: { backgroundColor: "#EEF2FF", borderRadius: 16, padding: 14, marginTop: 14 }, resultTitle: { color: "#312E81", fontSize: 13, fontWeight: "900" }, resultText: { color: "#475569", fontSize: 12, lineHeight: 18, marginTop: 5 },
});
