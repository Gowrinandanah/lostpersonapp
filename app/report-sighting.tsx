import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  Image, FlatList, Animated, useColorScheme,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { addDocument, getCollection } from "../src/firebase/firestoreService";
import { uploadImageToCloudinary } from "../src/services/cloudinaryService";
import { auth } from "../src/firebase/firebaseConfig";
import { Colors, ColorScheme } from "../src/constants/colors";
import LocationPicker, { LocationResult } from "../src/components/LocationPicker.native";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MissingCase {
  id: string; name: string; age: number; gender: string;
  photoUrl?: string; lastSeenLocation: string;
}

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
  const [sightingDate, setSightingDate]         = useState("");
  const [description, setDescription]           = useState("");
  const [confidence, setConfidence]             = useState("medium");
  const [contactPhone, setContactPhone]         = useState("");
  const [imageUri, setImageUri]                 = useState<string | null>(null);

  const [loadingCases, setLoadingCases] = useState(true);
  const [submitting, setSubmitting]     = useState(false);
  const [errors, setErrors]             = useState<Record<string, string>>({});
  const [step, setStep] = useState<"select" | "details">(params.caseId ? "details" : "select");

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
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!selectedCaseId)          errs.case        = "Please select a case";
    if (!sightingLocation.trim()) errs.location    = "Location is required";
    if (!sightingDate.trim())     errs.date        = "Date/time is required";
    if (!description.trim())      errs.description = "Please describe what you saw";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    let photoUrl = "";
    try {
      if (imageUri) {
        const uploaded = await uploadImageToCloudinary(imageUri);
        photoUrl = uploaded.url;
      }
      await addDocument("sightings", {
        caseId:           selectedCaseId,
        sightingLocation: sightingLocation.trim(),
        sightingDate:     sightingDate.trim(),
        description:      description.trim(),
        confidence,
        contactPhone:     contactPhone.trim(),
        photoUrl,
        coordinates:  sightingCoords || null,
        sightingLat:  sightingCoords?.latitude  ?? null,
        sightingLng:  sightingCoords?.longitude ?? null,
        reportedBy:     auth.currentUser?.uid,
        reportedByName: auth.currentUser?.displayName || "Anonymous",
        verified: false,
      });
      Alert.alert("✅ Sighting Reported", "Thank you for your report. The authorities have been notified.",
        [{ text: "Back to Alerts", onPress: () => router.replace("/alerts") }]
      );
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to submit sighting. Please try again.");
    } finally { setSubmitting(false); }
  };

  // Fully typed — no implicit any
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

  const textAreaStyle = { ...inputStyle, height: 110, paddingTop: 12, textAlignVertical: "top" as const };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>

      <LinearGradient colors={isDark ? ["#0A100A", theme.background] : ["#F0FFF0", theme.background]} style={styles.header}>
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
              <TextInput style={[styles.searchInput, { color: theme.text }]} value={searchQuery} onChangeText={setSearchQuery} placeholder="Search by name or location…" placeholderTextColor={theme.textSecondary} />
            </View>
            {errors.case && <Text style={[styles.errorText, { color: theme.error }]}>{errors.case}</Text>}
            {loadingCases ? (
              <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
            ) : (
              <FlatList
                data={filteredCases}
                keyExtractor={(i) => i.id}
                renderItem={({ item }) => (
                  <CaseCard item={item} selected={selectedCaseId === item.id} onSelect={() => { setSelectedCaseId(item.id); setStep("details"); }} theme={theme} />
                )}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
                ListEmptyComponent={<View style={styles.center}><Text style={[styles.emptyText, { color: theme.textSecondary }]}>No active cases found</Text></View>}
              />
            )}
          </View>
        )}

        {/* ── Step 2: Sighting Details ── */}
        {step === "details" && (
          <ScrollView contentContainerStyle={styles.detailsScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {selectedCase && (
              <View style={[styles.selectedBanner, { borderColor: theme.primary, backgroundColor: theme.card }]}>
                {selectedCase.photoUrl
                  ? <Image source={{ uri: selectedCase.photoUrl }} style={styles.bannerPhoto} />
                  : <View style={[styles.bannerPhoto, { backgroundColor: theme.border, alignItems: "center", justifyContent: "center" }]}><Text style={{ fontSize: 22 }}>👤</Text></View>
                }
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bannerLabel, { color: theme.textSecondary }]}>Reporting sighting for</Text>
                  <Text style={[styles.bannerName, { color: theme.text }]}>{selectedCase.name}</Text>
                </View>
                <TouchableOpacity onPress={() => setStep("select")} style={[styles.changeBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.changeBtnText, { color: theme.textSecondary }]}>Change</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Sighting Location ── */}
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

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              🕐 WHEN? <Text style={{ color: theme.primary }}>*</Text>
            </Text>
            <TextInput style={inputStyle} value={sightingDate} onChangeText={setSightingDate} placeholder="e.g. Today at 2:30 PM" placeholderTextColor={theme.textSecondary} />
            {errors.date && <Text style={[styles.errorText, { color: theme.error }]}>{errors.date}</Text>}

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              📝 DESCRIBE WHAT YOU SAW <Text style={{ color: theme.primary }}>*</Text>
            </Text>
            <TextInput style={textAreaStyle} value={description} onChangeText={setDescription} placeholder="What were they doing? Were they alone? Any details that could help…" placeholderTextColor={theme.textSecondary} multiline numberOfLines={4} />
            {errors.description && <Text style={[styles.errorText, { color: theme.error }]}>{errors.description}</Text>}

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>🎯 HOW CONFIDENT ARE YOU?</Text>
            <ConfidenceSelector value={confidence} onChange={setConfidence} theme={theme} />

            <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 20 }]}>📞 YOUR PHONE (optional)</Text>
            <TextInput style={inputStyle} value={contactPhone} onChangeText={setContactPhone} placeholder="Authorities may contact you" placeholderTextColor={theme.textSecondary} keyboardType="phone-pad" />

            <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 4 }]}>📷 ATTACH PHOTO (optional)</Text>
            {imageUri ? (
              <View style={styles.imagePreviewWrap}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                <TouchableOpacity onPress={() => setImageUri(null)} style={[styles.removeBtn, { backgroundColor: theme.card, borderColor: theme.error }]}>
                  <Text style={[styles.removeBtnText, { color: theme.error }]}>✕ Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={[styles.addPhotoBtn, { borderColor: theme.border }]} onPress={pickImage}>
                <Text style={styles.addPhotoIcon}>📷</Text>
                <Text style={[styles.addPhotoBtnText, { color: theme.textSecondary }]}>Attach Photo Evidence</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.submitWrap} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
              <LinearGradient colors={[theme.success, "#228B22"]} style={styles.submitBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>👁 Submit Sighting Report</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header:      { paddingTop: 54, paddingBottom: 16, paddingHorizontal: 20 },
  backBtn:     { marginBottom: 8 },
  backText:    { fontSize: 14 },
  headerTitle: { fontSize: 22, fontWeight: "800" },
  headerSub:   { fontSize: 13, marginTop: 2 },

  tabs:    { flexDirection: "row", borderBottomWidth: 1 },
  tab:     { flex: 1, paddingVertical: 14, alignItems: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabText: { fontWeight: "600", fontSize: 13 },

  searchWrap:  { flexDirection: "row", alignItems: "center", borderRadius: 14, marginHorizontal: 20, marginVertical: 12, paddingHorizontal: 14, height: 48, borderWidth: 1 },
  searchIcon:  { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15 },

  center:    { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyText: { fontSize: 15 },

  detailsScroll:  { padding: 20, paddingBottom: 60 },
  selectedBanner: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 12, marginBottom: 20, borderWidth: 1, gap: 12 },
  bannerPhoto:    { width: 48, height: 48, borderRadius: 10 },
  bannerLabel:    { fontSize: 11 },
  bannerName:     { fontWeight: "700", fontSize: 15 },
  changeBtn:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  changeBtnText:  { fontSize: 12, fontWeight: "600" },

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

  submitWrap: { borderRadius: 14, overflow: "hidden", marginTop: 8 },
  submitBtn:  { height: 58, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },
});