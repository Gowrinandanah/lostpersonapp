// app/report-sighting.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  Image, FlatList, Animated, useColorScheme, Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { getCollection } from "../src/firebase/firestoreService";
import { auth } from "../src/firebase/firebaseConfig";
import { Colors, ColorScheme } from "../src/constants/colors";
import LocationPicker, { LocationResult } from "../src/components/LocationPicker.native";
import DateTimePicker, { formatDateTime } from "../src/components/DateTimePicker";
import {
  submitSightingReport,
  SubmitSightingResult,
} from "../src/features/sightings/reportSightingController";
import { getMatchText } from "../src/features/faceRecognition/faceMatcher";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MissingCase {
  id: string; name: string; age: number; gender: string;
  photoUrl?: string; lastSeenLocation: string;
}

// ── Face Match Result Modal ───────────────────────────────────────────────────

const FaceMatchModal = ({
  visible, result, onClose, theme,
}: {
  visible: boolean;
  result: SubmitSightingResult | null;
  onClose: () => void;
  theme: ColorScheme;
}) => {
  if (!result) return null;
  const score = result.faceMatchScore;
  const color = result.faceMatchColor;
  const label = getMatchText(result.faceMatchLabel);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.card, { backgroundColor: theme.card }]}>
          <Text style={[modalStyles.title, { color: theme.text }]}>Sighting Submitted ✅</Text>
          <Text style={[modalStyles.sub, { color: theme.textSecondary }]}>Face comparison result</Text>

          {result.faceMatchAttempted && !result.faceMatchError ? (
            <>
              <View style={[modalStyles.scoreCircle, { borderColor: color }]}>
                <Text style={[modalStyles.scoreNumber, { color }]}>{score.toFixed(0)}%</Text>
                <Text style={[modalStyles.scoreLabel, { color }]}>match</Text>
              </View>
              <View style={[modalStyles.badge, { backgroundColor: color + "22", borderColor: color }]}>
                <Text style={[modalStyles.badgeText, { color }]}>{label}</Text>
              </View>
              <Text style={[modalStyles.interpretation, { color: theme.textSecondary }]}>
                {result.isSamePerson
                  ? "⚠️ This person is likely the missing individual. Authorities have been notified."
                  : score >= 60
                  ? "🔍 Possible match detected. Authorities will review your sighting report."
                  : "ℹ️ Low facial similarity. Your sighting has still been recorded for review."}
              </Text>
            </>
          ) : (
            <View style={[modalStyles.noFaceBox, { backgroundColor: theme.surface }]}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>📷</Text>
              <Text style={[modalStyles.noFaceText, { color: theme.textSecondary }]}>
                {result.faceMatchError || "Face comparison was not run."}
              </Text>
              <Text style={[modalStyles.noFaceHint, { color: theme.textSecondary }]}>
                Your sighting has been recorded. Upload a clearer face photo next time for automatic comparison.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[modalStyles.doneBtn, { backgroundColor: theme.primary }]}
            onPress={onClose}
          >
            <Text style={modalStyles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const modalStyles = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 24 },
  card:           { width: "100%", borderRadius: 20, padding: 28, alignItems: "center" },
  title:          { fontSize: 20, fontWeight: "800", marginBottom: 4 },
  sub:            { fontSize: 13, marginBottom: 24 },
  scoreCircle:    { width: 120, height: 120, borderRadius: 60, borderWidth: 5, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  scoreNumber:    { fontSize: 36, fontWeight: "900" },
  scoreLabel:     { fontSize: 13, fontWeight: "600" },
  badge:          { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, marginBottom: 16 },
  badgeText:      { fontSize: 14, fontWeight: "700" },
  interpretation: { fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 24, paddingHorizontal: 8 },
  noFaceBox:      { width: "100%", borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 24 },
  noFaceText:     { fontSize: 13, textAlign: "center", fontWeight: "600", marginBottom: 8 },
  noFaceHint:     { fontSize: 12, textAlign: "center", lineHeight: 18 },
  doneBtn:        { width: "100%", height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  doneBtnText:    { color: "#fff", fontWeight: "800", fontSize: 16 },
});

// ── Case Card ─────────────────────────────────────────────────────────────────

const CaseCard = ({ item, selected, onSelect, theme }: {
  item: MissingCase; selected: boolean; onSelect: () => void; theme: ColorScheme;
}) => (
  <TouchableOpacity
    style={[caseCardStyles.card, { backgroundColor: theme.surface, borderColor: theme.border }, selected && { borderColor: theme.primary, backgroundColor: theme.card }]}
    onPress={onSelect} activeOpacity={0.85}
  >
    {item.photoUrl
      ? <Image source={{ uri: item.photoUrl }} style={caseCardStyles.photo} />
      : <View style={[caseCardStyles.photoPlaceholder, { backgroundColor: theme.border }]}><Text style={{ fontSize: 24 }}>👤</Text></View>
    }
    <View style={caseCardStyles.info}>
      <Text style={[caseCardStyles.name, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
      <Text style={[caseCardStyles.meta, { color: theme.textSecondary }]}>{item.age} yrs · {item.gender}</Text>
      <Text style={[caseCardStyles.location, { color: theme.textSecondary }]} numberOfLines={1}>📍 {item.lastSeenLocation}</Text>
    </View>
    <View style={[caseCardStyles.selectCircle, { borderColor: theme.border }, selected && { borderColor: theme.primary, backgroundColor: theme.primary }]}>
      {selected && <Text style={caseCardStyles.check}>✓</Text>}
    </View>
  </TouchableOpacity>
);

const caseCardStyles = StyleSheet.create({
  card:             { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1.5 },
  photo:            { width: 52, height: 52, borderRadius: 10 },
  photoPlaceholder: { width: 52, height: 52, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  info:             { flex: 1, marginLeft: 12 },
  name:             { fontSize: 15, fontWeight: "700" },
  meta:             { fontSize: 12, marginVertical: 2 },
  location:         { fontSize: 12 },
  selectCircle:     { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  check:            { color: "#fff", fontWeight: "800", fontSize: 14 },
});

// ── Confidence Selector ───────────────────────────────────────────────────────

const ConfidenceSelector = ({ value, onChange, theme }: {
  value: string; onChange: (v: string) => void; theme: ColorScheme;
}) => {
  const options = [
    { key: "low",    label: "Not Sure",    icon: "🤔", color: theme.warning },
    { key: "medium", label: "Fairly Sure", icon: "👍", color: theme.accent  },
    { key: "high",   label: "Very Sure",   icon: "✅", color: theme.success },
  ];
  return (
    <View style={confStyles.row}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.key}
          style={[confStyles.item, { borderColor: theme.border, backgroundColor: theme.surface }, value === o.key && { borderColor: o.color, backgroundColor: `${o.color}22` }]}
          onPress={() => onChange(o.key)}
        >
          <Text style={confStyles.icon}>{o.icon}</Text>
          <Text style={[confStyles.text, { color: theme.textSecondary }, value === o.key && { color: o.color }]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const confStyles = StyleSheet.create({
  row:  { flexDirection: "row", gap: 10 },
  item: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12, borderWidth: 1.5 },
  icon: { fontSize: 22, marginBottom: 4 },
  text: { fontSize: 12, fontWeight: "600" },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ReportSightingScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme: ColorScheme = isDark ? Colors.dark : Colors.light;

  const params = useLocalSearchParams<{ caseId?: string }>();

  const [cases, setCases]                   = useState<MissingCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(params.caseId || "");
  const [searchQuery, setSearchQuery]       = useState("");

  const [sightingLocation, setSightingLocation] = useState("");
  const [sightingCoords, setSightingCoords]     = useState<{ latitude: number; longitude: number } | null>(null);
  const [sightingDate, setSightingDate]         = useState<Date | null>(null); // ← now a Date object
  const [description, setDescription]           = useState("");
  const [confidence, setConfidence]             = useState<"low" | "medium" | "high">("medium");
  const [contactPhone, setContactPhone]         = useState("");
  const [imageUri, setImageUri]                 = useState<string | null>(null);

  const [loadingCases, setLoadingCases] = useState(true);
  const [submitting, setSubmitting]     = useState(false);
  const [errors, setErrors]             = useState<Record<string, string>>({});
  const [step, setStep]                 = useState<"select" | "details">(params.caseId ? "details" : "select");

  const [matchResult, setMatchResult]       = useState<SubmitSightingResult | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    loadCases();
  }, []);

  const loadCases = async () => {
    try {
      const data = await getCollection("missingPersons", []);
      setCases(data.filter((c: any) => c.status === "active") as MissingCase[]);
    } catch (e) { console.error(e); }
    finally { setLoadingCases(false); }
  };

  const filteredCases = cases.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.lastSeenLocation?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please allow access to your photo library in Settings.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        allowsMultipleSelection: false,
        selectionLimit: 1,
        quality: 0.8,
        base64: false,
      });
      if (!result.canceled && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch (e: any) {
      console.error("Image picker error:", e);
      Alert.alert("Error", "Could not open photo library. Please try again.");
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!selectedCaseId)          errs.case        = "Please select a case";
    if (!sightingLocation.trim()) errs.location    = "Location is required";
    if (!sightingDate)            errs.date        = "Please select the date and time";
    if (!description.trim())      errs.description = "Please describe what you saw";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const result = await submitSightingReport({
        caseId:           selectedCaseId,
        sightingLocation: sightingLocation.trim(),
        sightingDate:     sightingDate ? formatDateTime(sightingDate) : "",
        description:      description.trim(),
        confidence,
        contactPhone:     contactPhone.trim(),
        imageUri,
        coordinates:      sightingCoords,
      });
      setMatchResult(result);
      setShowMatchModal(true);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to submit sighting. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleModalClose = () => {
    setShowMatchModal(false);
    router.replace("/alerts");
  };

  const handleLocationConfirm = (result: LocationResult) => {
    setSightingLocation(result.address);
    if (result.lat !== 0 || result.lng !== 0) {
      setSightingCoords({ latitude: result.lat, longitude: result.lng });
    }
  };

  const selectedCase = cases.find((c) => c.id === selectedCaseId);

  const inputStyle = {
    backgroundColor: theme.card, borderWidth: 1.5, borderColor: theme.border,
    borderRadius: 12, color: theme.text, fontSize: 15,
    paddingHorizontal: 14, height: 52, marginBottom: 16,
  } as const;

  const textAreaStyle = {
    ...inputStyle, height: 110, paddingTop: 12,
    textAlignVertical: "top" as const,
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>

      <FaceMatchModal
        visible={showMatchModal}
        result={matchResult}
        onClose={handleModalClose}
        theme={theme}
      />

      <LinearGradient
        colors={isDark ? ["#0A100A", theme.background] : ["#F0FFF0", theme.background]}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: theme.textSecondary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Report a Sighting</Text>
        <Text style={[styles.headerSub, { color: theme.textSecondary }]}>Help locate a missing person</Text>
      </LinearGradient>

      <View style={[styles.tabs, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        {(["select", "details"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, step === t && { borderBottomColor: theme.primary }]}
            onPress={() => setStep(t)}
            disabled={t === "details" && !selectedCaseId}
          >
            <Text style={[styles.tabText, { color: theme.textSecondary }, step === t && { color: theme.primary }]}>
              {t === "select" ? "1. Select Case" : "2. Sighting Details"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>

        {/* ── Step 1: Select Case ── */}
        {step === "select" && (
          <View style={{ flex: 1 }}>
            <View style={[styles.searchWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by name or location…"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
            {errors.case && <Text style={[styles.errorText, { color: theme.error }]}>{errors.case}</Text>}
            {loadingCases ? (
              <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
            ) : (
              <FlatList
                data={filteredCases}
                keyExtractor={(i) => i.id}
                renderItem={({ item }) => (
                  <CaseCard
                    item={item}
                    selected={selectedCaseId === item.id}
                    onSelect={() => { setSelectedCaseId(item.id); setStep("details"); }}
                    theme={theme}
                  />
                )}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
                ListEmptyComponent={
                  <View style={styles.center}>
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No active cases found</Text>
                  </View>
                }
              />
            )}
          </View>
        )}

        {/* ── Step 2: Sighting Details ── */}
        {step === "details" && (
          <ScrollView
            contentContainerStyle={styles.detailsScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {selectedCase && (
              <View style={[styles.selectedBanner, { borderColor: theme.primary, backgroundColor: theme.card }]}>
                {selectedCase.photoUrl
                  ? <Image source={{ uri: selectedCase.photoUrl }} style={styles.bannerPhoto} />
                  : <View style={[styles.bannerPhoto, { backgroundColor: theme.border, alignItems: "center", justifyContent: "center" }]}>
                      <Text style={{ fontSize: 22 }}>👤</Text>
                    </View>
                }
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bannerLabel, { color: theme.textSecondary }]}>Reporting sighting for</Text>
                  <Text style={[styles.bannerName, { color: theme.text }]}>{selectedCase.name}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setStep("select")}
                  style={[styles.changeBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <Text style={[styles.changeBtnText, { color: theme.textSecondary }]}>Change</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Face comparison info banner */}
            <View style={[styles.faceInfoBanner, { backgroundColor: "#EAF3DE", borderColor: "#2ECC71" }]}>
              <Text style={styles.faceInfoIcon}>🔍</Text>
              <Text style={styles.faceInfoText}>
                Attach a photo of the person you saw for automatic face comparison with the missing person's photo.
              </Text>
            </View>

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              📍 WHERE DID YOU SEE THEM? <Text style={{ color: theme.primary }}>*</Text>
            </Text>

            <LocationPicker
              label="Pin Sighting Location"
              pinColor="orange"
              initialAddress={sightingLocation}
              onConfirm={handleLocationConfirm}
            />

            <TextInput
              style={[inputStyle, { marginTop: 8 }]}
              value={sightingLocation}
              onChangeText={(v) => { setSightingLocation(v); if (sightingCoords) setSightingCoords(null); }}
              placeholder="Or type location manually"
              placeholderTextColor={theme.textSecondary}
            />

            {sightingCoords && (
              <Text style={[styles.coordsNote, { color: theme.primary }]}>
                📌 Pinned: {sightingCoords.latitude.toFixed(5)}, {sightingCoords.longitude.toFixed(5)}
              </Text>
            )}
            {errors.location && <Text style={[styles.errorText, { color: theme.error }]}>{errors.location}</Text>}

            {/* ── Date & Time Picker ── */}
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              🕐 WHEN DID YOU SEE THEM? <Text style={{ color: theme.primary }}>*</Text>
            </Text>
            <DateTimePicker
              value={sightingDate}
              onChange={(date) => {
                setSightingDate(date);
                setErrors((e) => ({ ...e, date: "" }));
              }}
              placeholder="Tap to select date and time"
              primaryColor={theme.primary}
              borderColor={errors.date ? theme.error : theme.border}
              textColor={theme.text}
              backgroundColor={theme.card}
            />
            {errors.date && (
              <Text style={[styles.errorText, { color: theme.error, marginTop: 4 }]}>{errors.date}</Text>
            )}

            <View style={{ marginBottom: 16 }} />

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              📝 DESCRIBE WHAT YOU SAW <Text style={{ color: theme.primary }}>*</Text>
            </Text>
            <TextInput
              style={textAreaStyle}
              value={description}
              onChangeText={setDescription}
              placeholder="What were they doing? Were they alone? Any details that could help…"
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={4}
            />
            {errors.description && <Text style={[styles.errorText, { color: theme.error }]}>{errors.description}</Text>}

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>🎯 HOW CONFIDENT ARE YOU?</Text>
            <ConfidenceSelector
              value={confidence}
              onChange={(v) => setConfidence(v as "low" | "medium" | "high")}
              theme={theme}
            />

            <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 20 }]}>📞 YOUR PHONE (optional)</Text>
            <TextInput
              style={inputStyle}
              value={contactPhone}
              onChangeText={setContactPhone}
              placeholder="Authorities may contact you"
              placeholderTextColor={theme.textSecondary}
              keyboardType="phone-pad"
            />

            <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 4 }]}>
              📷 ATTACH PHOTO <Text style={{ color: theme.primary }}>*recommended for face match</Text>
            </Text>
            {imageUri ? (
              <View style={styles.imagePreviewWrap}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                <TouchableOpacity
                  onPress={() => setImageUri(null)}
                  style={[styles.removeBtn, { backgroundColor: theme.card, borderColor: theme.error }]}
                >
                  <Text style={[styles.removeBtnText, { color: theme.error }]}>✕ Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.addPhotoBtn, { borderColor: theme.border }]}
                onPress={pickImage}
              >
                <Text style={styles.addPhotoIcon}>📷</Text>
                <Text style={[styles.addPhotoBtnText, { color: theme.textSecondary }]}>
                  Attach Photo for Face Comparison
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.submitWrap}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[theme.success, "#228B22"]}
                style={styles.submitBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {submitting ? (
                  <View style={styles.submittingRow}>
                    <ActivityIndicator color="#fff" />
                    <Text style={[styles.submitText, { marginLeft: 10 }]}>Analysing face…</Text>
                  </View>
                ) : (
                  <Text style={styles.submitText}>👁 Submit Sighting Report</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1 },
  header:       { paddingTop: 54, paddingBottom: 16, paddingHorizontal: 20 },
  backBtn:      { marginBottom: 8 },
  backText:     { fontSize: 14 },
  headerTitle:  { fontSize: 22, fontWeight: "800" },
  headerSub:    { fontSize: 13, marginTop: 2 },

  tabs:    { flexDirection: "row", borderBottomWidth: 1 },
  tab:     { flex: 1, paddingVertical: 14, alignItems: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabText: { fontWeight: "600", fontSize: 13 },

  searchWrap:  { flexDirection: "row", alignItems: "center", borderRadius: 14, marginHorizontal: 20, marginVertical: 12, paddingHorizontal: 14, height: 48, borderWidth: 1 },
  searchIcon:  { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15 },

  center:    { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyText: { fontSize: 15 },

  detailsScroll:  { padding: 20, paddingBottom: 60 },
  selectedBanner: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 12, marginBottom: 16, borderWidth: 1, gap: 12 },
  bannerPhoto:    { width: 48, height: 48, borderRadius: 10 },
  bannerLabel:    { fontSize: 11 },
  bannerName:     { fontWeight: "700", fontSize: 15 },
  changeBtn:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  changeBtnText:  { fontSize: 12, fontWeight: "600" },

  faceInfoBanner: { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1, gap: 10 },
  faceInfoIcon:   { fontSize: 18 },
  faceInfoText:   { flex: 1, fontSize: 12, color: "#27AE60", lineHeight: 17 },

  fieldLabel:   { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  coordsNote:   { fontSize: 11, marginBottom: 8, fontStyle: "italic" },
  errorText:    { fontSize: 12, marginTop: -12, marginBottom: 12 },

  addPhotoBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 2, borderStyle: "dashed", borderRadius: 12, padding: 20, gap: 10, marginBottom: 20 },
  addPhotoIcon:     { fontSize: 24 },
  addPhotoBtnText:  { fontWeight: "600" },
  imagePreviewWrap: { alignItems: "center", marginBottom: 20 },
  imagePreview:     { width: 160, height: 120, borderRadius: 10, marginBottom: 8 },
  removeBtn:        { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  removeBtnText:    { fontWeight: "700", fontSize: 13 },

  submitWrap:    { borderRadius: 14, overflow: "hidden", marginTop: 8 },
  submitBtn:     { height: 58, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  submitText:    { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },
  submittingRow: { flexDirection: "row", alignItems: "center" },
});