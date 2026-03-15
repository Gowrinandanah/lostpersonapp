import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  Image, Animated, Platform, StatusBar,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router, Stack } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../src/firebase/firebaseConfig";
import { uploadImageToCloudinary } from "../src/services/cloudinaryService";
import { validateAge } from "../src/utils/validators";
import { SafeAreaView } from "react-native-safe-area-context";
// Metro automatically picks:
//   LocationPicker.native.tsx  on Android/iOS
//   LocationPicker.web.tsx     on web
// Do NOT add .native here — that bypasses platform resolution
import LocationPicker from "../src/components/LocationPicker.native";
import type { LocationResult } from "../src/components/LocationPicker.native";

// ── Palette ───────────────────────────────────────────────────────────────────

const G = {
  primary:  "#2ECC71", dark:     "#27AE60", light:    "#EAFAF1",
  border:   "#D5F5E3", white:    "#FFFFFF", bg:       "#F7F8FA",
  text:     "#1A1A1A", sub:      "#666666", muted:    "#AAAAAA",
  inputBdr: "#E0E0E0", error:    "#E74C3C",
};

const STEPS = [
  { label: "Personal",    icon: "👤" },
  { label: "Description", icon: "📋" },
  { label: "Last Seen",   icon: "📍" },
  { label: "Photo",       icon: "📷" },
];

// ── Progress Bar ──────────────────────────────────────────────────────────────

const ProgressBar = ({ step }: { step: number }) => (
  <View style={progStyles.wrap}>
    {STEPS.map((s, i) => {
      const done   = i < step - 1;
      const active = i === step - 1;
      return (
        <React.Fragment key={i}>
          <View style={progStyles.item}>
            <View style={[progStyles.circle, done && progStyles.circleDone, active && progStyles.circleActive]}>
              <Text style={[progStyles.circleText, (done || active) && { color: "#fff" }]}>
                {done ? "✓" : String(i + 1)}
              </Text>
            </View>
            <Text style={[progStyles.label, active && progStyles.labelActive]}>{s.label}</Text>
          </View>
          {i < STEPS.length - 1 && <View style={[progStyles.line, done && progStyles.lineDone]} />}
        </React.Fragment>
      );
    })}
  </View>
);

const progStyles = StyleSheet.create({
  wrap:         { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, paddingVertical: 16, backgroundColor: G.white, borderBottomWidth: 1, borderBottomColor: "#EEEEEE" },
  item:         { alignItems: "center", width: 60 },
  circle:       { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: G.inputBdr, backgroundColor: G.white, alignItems: "center", justifyContent: "center", marginBottom: 5 },
  circleDone:   { borderColor: G.dark,    backgroundColor: G.dark },
  circleActive: { borderColor: G.primary, backgroundColor: G.primary },
  circleText:   { fontSize: 12, fontWeight: "800", color: G.muted },
  label:        { fontSize: 9, fontWeight: "600", color: G.muted, textAlign: "center" },
  labelActive:  { color: G.dark, fontWeight: "800" },
  line:         { flex: 1, height: 2, backgroundColor: G.inputBdr, marginTop: 15, marginHorizontal: 2 },
  lineDone:     { backgroundColor: G.dark },
});

// ── Section Header ────────────────────────────────────────────────────────────

const SectionHeader = ({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) => (
  <View style={secStyles.wrap}>
    <View style={secStyles.iconWrap}><Text style={{ fontSize: 24 }}>{icon}</Text></View>
    <View>
      <Text style={secStyles.title}>{title}</Text>
      <Text style={secStyles.subtitle}>{subtitle}</Text>
    </View>
  </View>
);

const secStyles = StyleSheet.create({
  wrap:     { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  iconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: G.light, alignItems: "center", justifyContent: "center" },
  title:    { fontSize: 17, fontWeight: "800", color: G.text },
  subtitle: { fontSize: 12, color: G.sub, marginTop: 1 },
});

// ── Field wrapper ─────────────────────────────────────────────────────────────

const Field = ({ label, required, hint, children, error }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode; error?: string;
}) => (
  <View style={fieldStyles.wrap}>
    <View style={fieldStyles.labelRow}>
      <Text style={fieldStyles.label}>{label}</Text>
      {required && <Text style={fieldStyles.required}>Required</Text>}
    </View>
    {hint && <Text style={fieldStyles.hint}>{hint}</Text>}
    {children}
    {error ? <Text style={fieldStyles.error}>⚠ {error}</Text> : null}
  </View>
);

const fieldStyles = StyleSheet.create({
  wrap:     { marginBottom: 20 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  label:    { fontSize: 13, fontWeight: "700", color: G.text },
  required: { fontSize: 10, fontWeight: "700", color: G.primary, backgroundColor: G.light, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  hint:     { fontSize: 11, color: G.sub, marginBottom: 6 },
  error:    { fontSize: 12, marginTop: 6, color: G.error, fontWeight: "600" },
});

// ── Selector Pills ────────────────────────────────────────────────────────────

const Selector = ({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) => (
  <View style={selStyles.wrap}>
    {options.map((opt) => (
      <TouchableOpacity key={opt} style={[selStyles.pill, value === opt && selStyles.pillActive]} onPress={() => onChange(opt)} activeOpacity={0.8}>
        <Text style={[selStyles.text, value === opt && selStyles.textActive]}>{opt}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

const selStyles = StyleSheet.create({
  wrap:       { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill:       { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 22, borderWidth: 1.5, borderColor: G.inputBdr, backgroundColor: G.white },
  pillActive: { borderColor: G.dark, backgroundColor: G.light },
  text:       { fontSize: 13, fontWeight: "600", color: G.sub },
  textActive: { color: G.dark, fontWeight: "700" },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ReportMissingScreen() {
  const [step, setStep]           = useState(1);
  const [loading, setLoading]     = useState(false);
  const [imageUri, setImageUri]   = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors]       = useState<Record<string, string>>({});

  const [name, setName]                               = useState("");
  const [age, setAge]                                 = useState("");
  const [gender, setGender]                           = useState("");
  const [height, setHeight]                           = useState("");
  const [complexion, setComplexion]                   = useState("");
  const [description, setDescription]                 = useState("");
  const [clothingDescription, setClothingDescription] = useState("");
  const [lastSeenLocation, setLastSeenLocation]       = useState("");
  const [lastSeenCoords, setLastSeenCoords]           = useState<{ latitude: number; longitude: number } | null>(null);
  const [lastSeenDate, setLastSeenDate]               = useState("");
  const [contactName, setContactName]                 = useState("");
  const [contactPhone, setContactPhone]               = useState("");
  const [isUrgentFlag, setIsUrgentFlag]               = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const input = { height: 50, backgroundColor: G.white, borderWidth: 1.5, borderColor: G.inputBdr, borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: G.text } as const;
  const textarea = { ...input, height: 110, paddingTop: 14, textAlignVertical: "top" as const };

  const animateTransition = (cb: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      cb();
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const validateStep = (): boolean => {
    const errs: Record<string, string> = {};
    if (step === 1) {
      if (!name.trim()) errs.name   = "Full name is required";
      if (!age.trim())  errs.age    = "Age is required";
      else { const e = validateAge(age); if (e) errs.age = e; }
      if (!gender)      errs.gender = "Please select a gender";
    }
    if (step === 3) {
      if (!lastSeenLocation.trim()) errs.lastSeenLocation = "Location is required";
      if (!lastSeenDate.trim())     errs.lastSeenDate     = "Date is required";
      if (!contactPhone.trim())     errs.contactPhone     = "Contact phone is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => { if (!validateStep()) return; animateTransition(() => setStep((s) => Math.min(s + 1, 4))); };
  const prevStep = () => { animateTransition(() => setStep((s) => Math.max(s - 1, 1))); };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission required", "Please allow access to your photo library."); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [3, 4], quality: 0.85 });
      if (!result.canceled) setImageUri(result.assets[0].uri);
    } catch { Alert.alert("Error", "Failed to pick image."); }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission required", "Please allow camera access."); return; }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [3, 4], quality: 0.85 });
      if (!result.canceled) setImageUri(result.assets[0].uri);
    } catch { Alert.alert("Error", "Failed to take photo."); }
  };

  const proceedWithSubmission = async (photoUrl: string) => {
    await addDoc(collection(db, "missingPersons"), {
      name: name.trim(), age: parseInt(age) || 0, gender,
      height: height.trim() || null, complexion: complexion || null,
      description: description.trim() || null,
      clothingDescription: clothingDescription.trim() || null,
      lastSeenLocation: lastSeenLocation.trim(), lastSeenDate: lastSeenDate.trim(),
      contactName: contactName.trim() || null, contactPhone: contactPhone.trim(),
      photoUrl: photoUrl || null, status: "active",
      coordinates:  lastSeenCoords || null,
      lastSeenLat:  lastSeenCoords?.latitude  ?? null,
      lastSeenLng:  lastSeenCoords?.longitude ?? null,
      reportedBy: auth.currentUser?.uid,
      reportedByName: auth.currentUser?.displayName || "Anonymous",
      isUrgentFlag: isUrgentFlag,
      isVulnerable: (parseInt(age) < 18 || parseInt(age) > 65),
      sightings: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    Alert.alert("✅ Report Submitted", "Your report has been published successfully.", [
      { text: "View Alerts", onPress: () => router.replace({ pathname: "/alerts", params: { refresh: Date.now().toString() } }) },
    ], { cancelable: false });
  };

  const handleSubmit = async () => {
    if (!auth.currentUser) {
      Alert.alert("Sign In Required", "Please sign in to submit a report.", [{ text: "Sign In", onPress: () => router.push("/(auth)/login") }]);
      return;
    }
    if (!validateStep()) return;
    setLoading(true);
    let photoUrl = "";
    try {
      if (imageUri) {
        setUploading(true);
        try {
          const up = await uploadImageToCloudinary(imageUri);
          photoUrl = up.url;
        } catch {
          Alert.alert("Upload Failed", "Continue without photo?", [
            { text: "Cancel", style: "cancel", onPress: () => { setLoading(false); setUploading(false); } },
            { text: "Continue", onPress: () => proceedWithSubmission("") },
          ]);
          return;
        } finally { setUploading(false); }
      }
      await proceedWithSubmission(photoUrl);
    } catch {
      Alert.alert("Error", "Failed to submit. Check your connection and try again.");
    } finally { setLoading(false); setUploading(false); }
  };

  // Fully typed — no implicit any
  const handleLocationConfirm = (result: LocationResult) => {
    setLastSeenLocation(result.address);
    if (result.lat !== 0 || result.lng !== 0) {
      setLastSeenCoords({ latitude: result.lat, longitude: result.lng });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor={G.dark} />
      <Stack.Screen options={{ title: "Report Missing Person", headerStyle: { backgroundColor: G.dark }, headerTintColor: "#fff", headerTitleStyle: { fontWeight: "700" }, headerBackTitle: "" }} />

      <ProgressBar step={step} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ── Step 1: Personal Info ── */}
          {step === 1 && (
            <View style={styles.card}>
              <SectionHeader icon="👤" title="Personal Information" subtitle="Basic details about the missing person" />
              <Field label="Full Name" required error={errors.name}>
                <TextInput style={input} value={name} onChangeText={setName} placeholder="Enter full name" placeholderTextColor={G.muted} autoCapitalize="words" />
              </Field>
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Field label="Age" required error={errors.age}>
                    <TextInput style={input} value={age} onChangeText={setAge} placeholder="e.g. 25" placeholderTextColor={G.muted} keyboardType="numeric" />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Height (cm)" hint="Optional">
                    <TextInput style={input} value={height} onChangeText={setHeight} placeholder="e.g. 165" placeholderTextColor={G.muted} keyboardType="numeric" />
                  </Field>
                </View>
              </View>
              <Field label="Gender" required error={errors.gender}>
                <Selector options={["Male", "Female", "Other", "Unknown"]} value={gender} onChange={setGender} />
              </Field>
              <Field label="Complexion" hint="Optional — helps with identification">
                <Selector options={["Fair", "Medium", "Dark", "Unknown"]} value={complexion} onChange={setComplexion} />
              </Field>
            </View>
          )}

          {/* ── Step 2: Description ── */}
          {step === 2 && (
            <View style={styles.card}>
              <SectionHeader icon="📋" title="Physical Description" subtitle="Identifying features and clothing" />
              <Field label="Physical Description" hint="Hair, eyes, birthmarks, tattoos, scars, etc.">
                <TextInput style={textarea} value={description} onChangeText={setDescription} placeholder="e.g. Short black hair, brown eyes, small scar on left cheek..." placeholderTextColor={G.muted} multiline numberOfLines={4} />
              </Field>
              <Field label="Clothing Description" hint="What were they wearing when last seen?">
                <TextInput style={textarea} value={clothingDescription} onChangeText={setClothingDescription} placeholder="e.g. Blue jeans, white t-shirt, black sneakers..." placeholderTextColor={G.muted} multiline numberOfLines={4} />
              </Field>
            </View>
          )}

          {/* ── Step 3: Last Seen & Contact ── */}
          {step === 3 && (
            <View style={styles.card}>
              <SectionHeader icon="📍" title="Last Known Location" subtitle="Where and when were they last seen?" />

              <Field label="Last Seen Location" required error={errors.lastSeenLocation} hint="Pin on map or type manually below">
                <LocationPicker
                  label="Pin Last Seen Location"
                  pinColor="red"
                  initialAddress={lastSeenLocation}
                  onConfirm={handleLocationConfirm}
                />
                <TextInput
                  style={[input, { marginTop: 8 }]}
                  value={lastSeenLocation}
                  onChangeText={(v) => { setLastSeenLocation(v); if (lastSeenCoords) setLastSeenCoords(null); }}
                  placeholder="Or type address / area manually"
                  placeholderTextColor={G.muted}
                />
                {lastSeenCoords && (
                  <Text style={styles.coordsNote}>
                    📌 Pinned: {lastSeenCoords.latitude.toFixed(5)}, {lastSeenCoords.longitude.toFixed(5)}
                  </Text>
                )}
              </Field>

              <Field label="Date & Time Last Seen" required error={errors.lastSeenDate} hint="Be as specific as possible">
                <TextInput style={input} value={lastSeenDate} onChangeText={setLastSeenDate} placeholder="e.g. 15 Jan 2025, 3:00 PM" placeholderTextColor={G.muted} />
              </Field>

              <View style={styles.sectionBreak}>
                <View style={styles.sectionBreakLine} />
                <Text style={styles.sectionBreakLabel}>📞 Contact Information</Text>
                <View style={styles.sectionBreakLine} />
              </View>

              <Field label="Contact Person Name" hint="Family member or person reporting">
                <TextInput style={input} value={contactName} onChangeText={setContactName} placeholder="e.g. Rajan Kumar (Brother)" placeholderTextColor={G.muted} autoCapitalize="words" />
              </Field>
              <Field label="Contact Phone Number" required error={errors.contactPhone}>
                <TextInput style={input} value={contactPhone} onChangeText={setContactPhone} placeholder="+91 XXXXX XXXXX" placeholderTextColor={G.muted} keyboardType="phone-pad" />
              </Field>

              {/* ── Urgent flag ── */}
              <View style={styles.urgentToggleWrap}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.urgentToggleLabel}>🚨 Mark as Urgent</Text>
                  <Text style={styles.urgentToggleSub}>
                    {parseInt(age) < 18
                      ? "Auto-flagged: missing child"
                      : parseInt(age) > 65
                      ? "Auto-flagged: missing elderly person"
                      : "Tick if this case needs immediate attention"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.urgentToggleBtn, isUrgentFlag && styles.urgentToggleBtnActive]}
                  onPress={() => setIsUrgentFlag((v) => !v)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.urgentToggleThumb, isUrgentFlag && styles.urgentToggleThumbActive]} />
                </TouchableOpacity>
              </View>

              {(isUrgentFlag || parseInt(age) < 18 || parseInt(age) > 65) && (
                <View style={styles.urgentNote}>
                  <Text style={styles.urgentNoteText}>
                    ⚠️  This case will be highlighted as urgent to all users
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Step 4: Photo ── */}
          {step === 4 && (
            <View style={styles.card}>
              <SectionHeader icon="📷" title="Upload a Photo" subtitle="A recent photo increases identification chances" />

              {imageUri ? (
                <View style={styles.previewWrap}>
                  <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
                  <View style={styles.previewActions}>
                    <TouchableOpacity style={styles.changePhotoBtn} onPress={pickImage}>
                      <Text style={styles.changePhotoBtnText}>🔄  Change Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.removePhotoBtn} onPress={() => setImageUri(null)}>
                      <Text style={styles.removePhotoBtnText}>✕  Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.pickerBox}>
                  <Text style={{ fontSize: 52, marginBottom: 10 }}>🖼️</Text>
                  <Text style={styles.pickerTitle}>Add a Photo</Text>
                  <Text style={styles.pickerSub}>Choose from gallery or take a new photo</Text>
                  <View style={styles.pickerBtns}>
                    <TouchableOpacity style={styles.pickerBtn} onPress={pickImage} activeOpacity={0.85}>
                      <Text style={styles.pickerBtnText}>🖼  Gallery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.pickerBtn, styles.pickerBtnOutline]} onPress={takePhoto} activeOpacity={0.85}>
                      <Text style={[styles.pickerBtnText, { color: G.dark }]}>📸  Camera</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.summary}>
                <Text style={styles.summaryHeader}>📋 Review Before Submitting</Text>
                <View style={styles.summaryDivider} />
                {[
                  { key: "Name",         val: name             || "—" },
                  { key: "Age / Gender", val: age ? `${age} yrs · ${gender}` : "—" },
                  { key: "Height",       val: height ? `${height} cm` : "Not provided" },
                  { key: "Last Seen",    val: lastSeenLocation || "—" },
                  { key: "Date",         val: lastSeenDate     || "—" },
                  { key: "Contact",      val: contactPhone     || "—" },
                  { key: "Coordinates",  val: lastSeenCoords ? `${lastSeenCoords.latitude.toFixed(4)}, ${lastSeenCoords.longitude.toFixed(4)}` : "Not pinned" },
                ].map(({ key, val }) => (
                  <View key={key} style={styles.summaryRow}>
                    <Text style={styles.summaryKey}>{key}</Text>
                    <Text style={styles.summaryVal} numberOfLines={1}>{val}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

        </Animated.View>
      </ScrollView>

      {/* ── Bottom Nav ── */}
      <View style={styles.navBar}>
        {step > 1
          ? <TouchableOpacity style={styles.backBtn} onPress={prevStep} activeOpacity={0.8}><Text style={styles.backBtnText}>← Back</Text></TouchableOpacity>
          : <View style={styles.backBtnPlaceholder} />
        }
        <View style={styles.stepIndicator}>
          <Text style={styles.stepIndicatorText}>{step} / {STEPS.length}</Text>
        </View>
        {step < 4 ? (
          <TouchableOpacity style={styles.nextBtn} onPress={nextStep} activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>Continue →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.nextBtn, styles.submitBtn]} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
            {loading ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.nextBtnText}>{uploading ? "Uploading…" : "Submitting…"}</Text>
              </View>
            ) : (
              <Text style={styles.nextBtnText}>🚨 Submit Report</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: G.bg },
  scroll: { padding: 16, paddingBottom: 24 },
  card:   { backgroundColor: G.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: "#EEEEEE", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  row2:   { flexDirection: "row", gap: 12 },

  coordsNote:        { fontSize: 11, color: G.dark, marginTop: 6, fontStyle: "italic" },
  // Urgent toggle
  urgentToggleWrap:       { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF8F8", borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: "#FADADD", marginBottom: 10, gap: 12 },
  urgentToggleLabel:      { fontSize: 14, fontWeight: "700", color: "#C0392B" },
  urgentToggleSub:        { fontSize: 11, color: "#E74C3C", marginTop: 2 },
  urgentToggleBtn:        { width: 50, height: 28, borderRadius: 14, backgroundColor: "#DDDDDD", justifyContent: "center", paddingHorizontal: 3 },
  urgentToggleBtnActive:  { backgroundColor: "#E74C3C" },
  urgentToggleThumb:      { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  urgentToggleThumbActive:{ transform: [{ translateX: 22 }] },
  urgentNote:             { backgroundColor: "#FDECEA", borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: "#E74C3C" },
  urgentNoteText:         { fontSize: 12, color: "#C0392B", fontWeight: "600" },

  sectionBreak:      { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 20 },
  sectionBreakLine:  { flex: 1, height: 1, backgroundColor: "#EEEEEE" },
  sectionBreakLabel: { fontSize: 13, fontWeight: "700", color: G.sub },

  pickerBox:          { borderWidth: 2, borderStyle: "dashed", borderColor: G.border, borderRadius: 14, padding: 32, alignItems: "center", marginBottom: 20, backgroundColor: G.light },
  pickerTitle:        { fontSize: 16, fontWeight: "700", color: G.text, marginBottom: 4 },
  pickerSub:          { fontSize: 12, color: G.sub, marginBottom: 20, textAlign: "center" },
  pickerBtns:         { flexDirection: "row", gap: 12 },
  pickerBtn:          { paddingHorizontal: 22, paddingVertical: 11, borderRadius: 10, backgroundColor: G.primary },
  pickerBtnOutline:   { backgroundColor: G.white, borderWidth: 1.5, borderColor: G.dark },
  pickerBtnText:      { fontWeight: "700", fontSize: 14, color: "#fff" },

  previewWrap:        { alignItems: "center", marginBottom: 20 },
  preview:            { width: 200, height: 260, borderRadius: 14, marginBottom: 14, borderWidth: 2, borderColor: G.border },
  previewActions:     { flexDirection: "row", gap: 10 },
  changePhotoBtn:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: G.primary },
  changePhotoBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  removePhotoBtn:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: G.error },
  removePhotoBtnText: { color: G.error, fontWeight: "700", fontSize: 13 },

  summary:        { backgroundColor: G.light, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: G.border },
  summaryHeader:  { fontSize: 14, fontWeight: "800", color: G.text, marginBottom: 10 },
  summaryDivider: { height: 1, backgroundColor: G.border, marginBottom: 12 },
  summaryRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  summaryKey:     { fontSize: 12, color: G.sub, fontWeight: "600", width: 100 },
  summaryVal:     { fontSize: 13, fontWeight: "700", color: G.text, flex: 1, textAlign: "right" },

  navBar:             { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, paddingBottom: Platform.OS === "ios" ? 28 : 16, backgroundColor: G.white, borderTopWidth: 1, borderTopColor: "#EEEEEE", gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 8 },
  backBtn:            { width: 100, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#DDDDDD", backgroundColor: G.white },
  backBtnPlaceholder: { width: 100 },
  backBtnText:        { fontSize: 15, fontWeight: "700", color: G.text },
  stepIndicator:      { flex: 1, alignItems: "center" },
  stepIndicatorText:  { fontSize: 13, fontWeight: "700", color: G.sub },
  nextBtn:            { width: 150, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: G.primary, shadowColor: G.dark, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 4 },
  submitBtn:          { width: 150, backgroundColor: G.dark },
  nextBtnText:        { color: "#fff", fontWeight: "800", fontSize: 15 },
});