import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator, Alert,
  RefreshControl, useColorScheme, FlatList, Modal,
} from "react-native";
import { router, Stack, useFocusEffect } from "expo-router";
import {
  collection, query, where, getDocs, orderBy,
  doc, getDoc, addDoc, Timestamp, serverTimestamp,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../src/firebase/firebaseConfig";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, ColorScheme } from "../src/constants/colors";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MissingCase {
  id: string;
  name: string;
  age: number;
  gender: string;
  photoUrl?: string | null;
  lastSeenLocation: string;
  lastSeenDate: string;
  status: string;
  sightings: number;
  createdAt: Timestamp | null;
  isUrgentFlag?: boolean;
  isVulnerable?: boolean;
}

interface Sighting {
  id: string;
  caseId: string;
  sightingLocation: string;
  sightingDate: string;
  description: string;
  confidence: "low" | "medium" | "high";
  contactPhone?: string;
  photoUrl?: string | null;
  reportedByName: string;
  reportedBy: string;
  verified: boolean;
  createdAt: Timestamp | null;
  flagged?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ts: Timestamp | null): string {
  if (!ts) return "Unknown";
  const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts as any);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)   return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const CONFIDENCE_LABEL: Record<string, { label: string; color: string; icon: string }> = {
  low:    { label: "Not Sure",    color: "#F39C12", icon: "🤔" },
  medium: { label: "Fairly Sure", color: "#3498DB", icon: "👍" },
  high:   { label: "Very Sure",   color: "#27AE60", icon: "✅" },
};

// ── Sighting Card ─────────────────────────────────────────────────────────────

const SightingCard = ({
  item, theme, onReport,
}: {
  item: Sighting; theme: ColorScheme; onReport: (s: Sighting) => void;
}) => {
  const conf = CONFIDENCE_LABEL[item.confidence] ?? CONFIDENCE_LABEL.medium;
  return (
    <View style={[sightS.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* Header row */}
      <View style={sightS.header}>
        <View style={[sightS.avatarCircle, { backgroundColor: theme.border }]}>
          <Text style={{ fontSize: 18 }}>👤</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[sightS.reporter, { color: theme.text }]}>
            {item.reportedByName || "Anonymous"}
          </Text>
          <Text style={[sightS.time, { color: theme.textSecondary }]}>
            {timeAgo(item.createdAt)}
          </Text>
        </View>
        {/* Confidence badge */}
        <View style={[sightS.confBadge, { backgroundColor: `${conf.color}22`, borderColor: conf.color }]}>
          <Text style={{ fontSize: 12 }}>{conf.icon}</Text>
          <Text style={[sightS.confText, { color: conf.color }]}>{conf.label}</Text>
        </View>
      </View>

      {/* Location + date */}
      <View style={sightS.metaRow}>
        <Text style={[sightS.metaItem, { color: theme.textSecondary }]}>
          📍 {item.sightingLocation}
        </Text>
        <Text style={[sightS.metaItem, { color: theme.textSecondary }]}>
          🕐 {item.sightingDate}
        </Text>
      </View>

      {/* Description */}
      <Text style={[sightS.desc, { color: theme.text }]}>{item.description}</Text>

      {/* Photo if any */}
      {item.photoUrl ? (
        <Image source={{ uri: item.photoUrl }} style={sightS.photo} resizeMode="cover" />
      ) : null}

      {/* Footer */}
      <View style={sightS.footer}>
        {item.verified && (
          <View style={sightS.verifiedBadge}>
            <Text style={sightS.verifiedText}>✓ Verified</Text>
          </View>
        )}
        {item.flagged && (
          <View style={sightS.flaggedBadge}>
            <Text style={sightS.flaggedText}>⚑ Reported</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        {/* Report malicious sighting button */}
        {!item.flagged && (
          <TouchableOpacity
            style={[sightS.reportBtn, { borderColor: theme.error ?? "#E74C3C" }]}
            onPress={() => onReport(item)}
            activeOpacity={0.8}
          >
            <Text style={[sightS.reportBtnText, { color: theme.error ?? "#E74C3C" }]}>
              ⚑ Report
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const sightS = StyleSheet.create({
  card:        { borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1 },
  header:      { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  avatarCircle:{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  reporter:    { fontSize: 13, fontWeight: "700" },
  time:        { fontSize: 11, marginTop: 1 },
  confBadge:   { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  confText:    { fontSize: 11, fontWeight: "700" },
  metaRow:     { gap: 4, marginBottom: 8 },
  metaItem:    { fontSize: 12 },
  desc:        { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  photo:       { width: "100%", height: 140, borderRadius: 10, marginBottom: 10 },
  footer:      { flexDirection: "row", alignItems: "center", gap: 8 },
  verifiedBadge:{ backgroundColor: "#EAFAF1", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#27AE60" },
  verifiedText: { fontSize: 11, fontWeight: "700", color: "#27AE60" },
  flaggedBadge: { backgroundColor: "#FFF3CD", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#F39C12" },
  flaggedText:  { fontSize: 11, fontWeight: "700", color: "#F39C12" },
  reportBtn:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5 },
  reportBtnText:{ fontSize: 12, fontWeight: "700" },
});

// ── Case Card ─────────────────────────────────────────────────────────────────

const CaseCard = ({
  item, theme, onPress,
}: {
  item: MissingCase; theme: ColorScheme; onPress: () => void;
}) => {
  const days    = item.createdAt
    ? Math.floor((Date.now() - (item.createdAt instanceof Timestamp ? item.createdAt.toDate() : new Date(item.createdAt as any)).getTime()) / 86400000)
    : 0;
  const urgent  = item.isUrgentFlag || item.isVulnerable || item.age < 18 || item.age > 65;
  const resolved= item.status === "found" || item.status === "resolved";

  return (
    <TouchableOpacity
      style={[caseS.card, { backgroundColor: theme.card, borderColor: urgent && !resolved ? "#E74C3C" : theme.border }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {item.photoUrl ? (
        <Image source={{ uri: item.photoUrl }} style={caseS.photo} />
      ) : (
        <View style={[caseS.photoPlaceholder, { backgroundColor: theme.border }]}>
          <Text style={{ fontSize: 28 }}>👤</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={caseS.nameRow}>
          <Text style={[caseS.name, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
          {urgent && !resolved && (
            <View style={caseS.urgentDot} />
          )}
        </View>
        <Text style={[caseS.meta, { color: theme.textSecondary }]}>
          {item.age} yrs · {item.gender}
        </Text>
        <Text style={[caseS.location, { color: theme.textSecondary }]} numberOfLines={1}>
          📍 {item.lastSeenLocation}
        </Text>
        <View style={caseS.statsRow}>
          <View style={[caseS.statusPill, { backgroundColor: resolved ? "#EAFAF1" : "#FFF3CD" }]}>
            <Text style={[caseS.statusText, { color: resolved ? "#27AE60" : "#856404" }]}>
              {resolved ? "✅ Found" : `⏳ ${days}d missing`}
            </Text>
          </View>
          {item.sightings > 0 && (
            <View style={caseS.sightingsPill}>
              <Text style={caseS.sightingsText}>👁 {item.sightings}</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={{ color: theme.textSecondary, fontSize: 20 }}>›</Text>
    </TouchableOpacity>
  );
};

const caseS = StyleSheet.create({
  card:           { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1.5, gap: 12 },
  photo:          { width: 60, height: 72, borderRadius: 10 },
  photoPlaceholder:{ width: 60, height: 72, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  nameRow:        { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  name:           { fontSize: 15, fontWeight: "700", flex: 1 },
  urgentDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E74C3C" },
  meta:           { fontSize: 12, marginBottom: 2 },
  location:       { fontSize: 12, marginBottom: 6 },
  statsRow:       { flexDirection: "row", gap: 6 },
  statusPill:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText:     { fontSize: 11, fontWeight: "700" },
  sightingsPill:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: "#EBF5FB" },
  sightingsText:  { fontSize: 11, fontWeight: "700", color: "#2980B9" },
});

// ── Report Malicious Sighting Modal ───────────────────────────────────────────

const REPORT_REASONS = [
  "This location is completely wrong",
  "Description doesn't match at all",
  "This appears to be spam",
  "Reporter is spreading false information",
  "This sighting is fabricated",
  "Other malicious intent",
];

const ReportModal = ({
  visible, sighting, theme, onClose, onSubmit,
}: {
  visible: boolean;
  sighting: Sighting | null;
  theme: ColorScheme;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) => {
  const [selected, setSelected] = useState("");
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={modalS.overlay}>
        <View style={[modalS.sheet, { backgroundColor: theme.card }]}>
          <Text style={[modalS.title, { color: theme.text }]}>Report Misleading Sighting</Text>
          <Text style={[modalS.sub, { color: theme.textSecondary }]}>
            Select the reason this sighting report is false or malicious:
          </Text>
          {REPORT_REASONS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[modalS.reasonRow, { borderColor: selected === r ? "#E74C3C" : theme.border }, selected === r && { backgroundColor: "#FDECEA" }]}
              onPress={() => setSelected(r)}
              activeOpacity={0.8}
            >
              <View style={[modalS.radio, { borderColor: selected === r ? "#E74C3C" : theme.border }]}>
                {selected === r && <View style={modalS.radioFill} />}
              </View>
              <Text style={[modalS.reasonText, { color: theme.text }]}>{r}</Text>
            </TouchableOpacity>
          ))}
          <View style={modalS.btnRow}>
            <TouchableOpacity style={[modalS.cancelBtn, { borderColor: theme.border }]} onPress={onClose}>
              <Text style={[modalS.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalS.submitBtn, !selected && { opacity: 0.4 }]}
              onPress={() => { if (selected) { onSubmit(selected); setSelected(""); } }}
              disabled={!selected}
            >
              <Text style={modalS.submitText}>Submit Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const modalS = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:      { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  title:      { fontSize: 18, fontWeight: "800", marginBottom: 6 },
  sub:        { fontSize: 13, marginBottom: 16, lineHeight: 18 },
  reasonRow:  { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, borderWidth: 1.5, marginBottom: 8 },
  radio:      { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioFill:  { width: 10, height: 10, borderRadius: 5, backgroundColor: "#E74C3C" },
  reasonText: { fontSize: 14, flex: 1 },
  btnRow:     { flexDirection: "row", gap: 12, marginTop: 8 },
  cancelBtn:  { flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  cancelText: { fontWeight: "700" },
  submitBtn:  { flex: 1, height: 48, borderRadius: 12, backgroundColor: "#E74C3C", alignItems: "center", justifyContent: "center" },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});

// ── My Case Detail Modal ──────────────────────────────────────────────────────

const MyCaseDetailModal = ({
  visible, caseItem, theme, onClose,
}: {
  visible: boolean;
  caseItem: MissingCase | null;
  theme: ColorScheme;
  onClose: () => void;
}) => {
  const [sightings,       setSightings]       = useState<Sighting[]>([]);
  const [loadingSightings, setLoadingSightings] = useState(false);
  const [reportTarget,    setReportTarget]    = useState<Sighting | null>(null);
  const [reportModal,     setReportModal]     = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    if (!caseItem) return;
    setLoadingSightings(true);
    (async () => {
      try {
        const q    = query(collection(db, "sightings"), where("caseId", "==", caseItem.id), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        setSightings(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sighting)));
      } catch (e) { console.error(e); }
      finally { setLoadingSightings(false); }
    })();
  }, [caseItem?.id]);

  const handleReportSighting = async (reason: string) => {
    if (!reportTarget || !caseItem) return;
    setSubmittingReport(true);
    try {
      await addDoc(collection(db, "sightingReports"), {
        sightingId:      reportTarget.id,
        caseId:          caseItem.id,
        reportedBy:      auth.currentUser?.uid,
        reportedByName:  auth.currentUser?.displayName || "Anonymous",
        accusedUserId:   reportTarget.reportedBy,
        accusedUserName: reportTarget.reportedByName,
        reason,
        createdAt: serverTimestamp(),
        status: "pending",
      });
      // Mark sighting as flagged locally
      setSightings((prev) =>
        prev.map((s) => s.id === reportTarget.id ? { ...s, flagged: true } : s)
      );
      setReportModal(false);
      setReportTarget(null);
      Alert.alert(
        "Report Submitted",
        "Thank you. This sighting has been flagged for admin review. The reporter may face consequences if found guilty of spreading false information.",
        [{ text: "OK" }]
      );
    } catch (e) {
      Alert.alert("Error", "Failed to submit report. Try again.");
    } finally {
      setSubmittingReport(false);
    }
  };

  const resolved = caseItem?.status === "found" || caseItem?.status === "resolved";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[detailS.root, { backgroundColor: theme.background }]}>

        {/* Header */}
        <View style={[detailS.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={detailS.closeBtn}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: theme.textSecondary }}>✕</Text>
          </TouchableOpacity>
          <Text style={[detailS.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {caseItem?.name ?? "Case Details"}
          </Text>
          <TouchableOpacity
            onPress={() => { onClose(); router.push({ pathname: "/case-details", params: { id: caseItem?.id } }); }}
            style={detailS.viewFullBtn}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: theme.primary }}>Full View</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

          {/* Case summary banner */}
          {caseItem && (
            <View style={[detailS.banner, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {caseItem.photoUrl ? (
                <Image source={{ uri: caseItem.photoUrl }} style={detailS.bannerPhoto} />
              ) : (
                <View style={[detailS.bannerPhotoPlaceholder, { backgroundColor: theme.border }]}>
                  <Text style={{ fontSize: 28 }}>👤</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[detailS.bannerName, { color: theme.text }]}>{caseItem.name}</Text>
                <Text style={[detailS.bannerMeta, { color: theme.textSecondary }]}>
                  {caseItem.age} yrs · {caseItem.gender}
                </Text>
                <Text style={[detailS.bannerLocation, { color: theme.textSecondary }]} numberOfLines={1}>
                  📍 {caseItem.lastSeenLocation}
                </Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                  <View style={[detailS.statusPill, { backgroundColor: resolved ? "#EAFAF1" : "#FFF3CD" }]}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: resolved ? "#27AE60" : "#856404" }}>
                      {resolved ? "✅ Found" : "⏳ Active"}
                    </Text>
                  </View>
                  <View style={[detailS.statusPill, { backgroundColor: "#EBF5FB" }]}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#2980B9" }}>
                      👁 {caseItem.sightings} sighting{caseItem.sightings !== 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Sightings section */}
          <View style={detailS.sectionHeader}>
            <Text style={[detailS.sectionTitle, { color: theme.text }]}>👁 Sighting Reports</Text>
            {sightings.length > 0 && (
              <Text style={[detailS.sectionCount, { color: theme.textSecondary }]}>
                {sightings.length} total
              </Text>
            )}
          </View>

          {loadingSightings ? (
            <View style={{ alignItems: "center", padding: 32 }}>
              <ActivityIndicator color={theme.primary} />
              <Text style={{ color: theme.textSecondary, marginTop: 8 }}>Loading sightings…</Text>
            </View>
          ) : sightings.length === 0 ? (
            <View style={[detailS.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>🔍</Text>
              <Text style={[detailS.emptyTitle, { color: theme.text }]}>No sightings yet</Text>
              <Text style={[detailS.emptySub, { color: theme.textSecondary }]}>
                Sighting reports from the public will appear here
              </Text>
            </View>
          ) : (
            sightings.map((s) => (
              <SightingCard
                key={s.id}
                item={s}
                theme={theme}
                onReport={(sighting) => {
                  setReportTarget(sighting);
                  setReportModal(true);
                }}
              />
            ))
          )}
        </ScrollView>

        {/* Report Modal */}
        <ReportModal
          visible={reportModal}
          sighting={reportTarget}
          theme={theme}
          onClose={() => { setReportModal(false); setReportTarget(null); }}
          onSubmit={handleReportSighting}
        />
      </View>
    </Modal>
  );
};

const detailS = StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  closeBtn:     { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle:  { flex: 1, fontSize: 16, fontWeight: "800", textAlign: "center", marginHorizontal: 8 },
  viewFullBtn:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  banner:       { flexDirection: "row", borderRadius: 14, padding: 12, marginBottom: 20, borderWidth: 1, gap: 12 },
  bannerPhoto:  { width: 64, height: 78, borderRadius: 10 },
  bannerPhotoPlaceholder: { width: 64, height: 78, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  bannerName:   { fontSize: 16, fontWeight: "800", marginBottom: 2 },
  bannerMeta:   { fontSize: 12, marginBottom: 2 },
  bannerLocation:{ fontSize: 12 },
  statusPill:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  sectionHeader:{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  sectionCount: { fontSize: 13 },
  emptyCard:    { borderRadius: 14, padding: 32, alignItems: "center", borderWidth: 1 },
  emptyTitle:   { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  emptySub:     { fontSize: 13, textAlign: "center", lineHeight: 18 },
});

// ── Main Profile Screen ───────────────────────────────────────────────────────

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme: ColorScheme = isDark ? Colors.dark : Colors.light;

  const user = auth.currentUser;

  const [cases,       setCases]       = useState<MissingCase[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [selectedCase,setSelectedCase]= useState<MissingCase | null>(null);
  const [caseModal,   setCaseModal]   = useState(false);

  const loadCases = useCallback(async () => {
    if (!user) return;
    try {
      const q    = query(
        collection(db, "missingPersons"),
        where("reportedBy", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setCases(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MissingCase)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user?.uid]);

  useFocusEffect(useCallback(() => { setLoading(true); loadCases(); }, [loadCases]));

  const handleRefresh = () => { setRefreshing(true); loadCases(); };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out", style: "destructive",
        onPress: async () => {
          await signOut(auth);
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const activeCases   = cases.filter((c) => c.status === "active");
  const resolvedCases = cases.filter((c) => c.status === "found" || c.status === "resolved");
  const totalSightings= cases.reduce((sum, c) => sum + (c.sightings || 0), 0);

  if (!user) {
    return (
      <SafeAreaView style={[S.root, { backgroundColor: theme.background }]}>
        <View style={S.center}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🔒</Text>
          <Text style={[S.emptyTitle, { color: theme.text }]}>Not signed in</Text>
          <TouchableOpacity style={[S.signInBtn, { backgroundColor: theme.primary }]} onPress={() => router.push("/(auth)/login")}>
            <Text style={{ color: "#fff", fontWeight: "800" }}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[S.root, { backgroundColor: theme.background }]} edges={["top", "left", "right"]}>
      <Stack.Screen options={{
        title: "My Profile",
        headerStyle: { backgroundColor: theme.card },
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: "800" },
        headerRight: () => (
          <TouchableOpacity onPress={handleSignOut} style={{ marginRight: 8, padding: 6 }}>
            <Text style={{ fontSize: 20 }}>🚪</Text>
          </TouchableOpacity>
        ),
      }} />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── Profile Hero ── */}
        <LinearGradient
          colors={isDark ? ["#0A1A0A", theme.background] : ["#2ECC71", "#27AE60"]}
          style={S.heroGradient}
        >
          <View style={S.avatarWrap}>
            {user.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={S.avatar} />
            ) : (
              <View style={[S.avatarPlaceholder]}>
                <Text style={S.avatarInitial}>
                  {(user.displayName ?? user.email ?? "?")[0].toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <Text style={S.heroName}>{user.displayName || "Anonymous User"}</Text>
          <Text style={S.heroEmail}>{user.email}</Text>
          <Text style={S.heroJoined}>
            Member since {user.metadata.creationTime
              ? new Date(user.metadata.creationTime).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
              : "Unknown"}
          </Text>
        </LinearGradient>

        {/* ── Stats Row ── */}
        <View style={[S.statsRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {[
            { label: "Total\nReported",  value: cases.length,     icon: "📋" },
            { label: "Active\nCases",    value: activeCases.length,   icon: "🔍" },
            { label: "Found /\nResolved",value: resolvedCases.length, icon: "✅" },
            { label: "Sightings\nReceived", value: totalSightings,    icon: "👁" },
          ].map(({ label, value, icon }) => (
            <View key={label} style={S.statItem}>
              <Text style={S.statIcon}>{icon}</Text>
              <Text style={[S.statValue, { color: theme.text }]}>{value}</Text>
              <Text style={[S.statLabel, { color: theme.textSecondary }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* ── Account Info Card ── */}
        <View style={[S.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[S.cardTitle, { color: theme.textSecondary }]}>👤  ACCOUNT DETAILS</Text>
          {[
            { icon: "📛", label: "Display Name", value: user.displayName || "Not set" },
            { icon: "📧", label: "Email",         value: user.email || "Not set" },
            { icon: "🔐", label: "Provider",      value: user.providerData[0]?.providerId === "google.com" ? "Google" : "Email / Password" },
            { icon: "✅", label: "Email Verified", value: user.emailVerified ? "Verified" : "Not verified" },
          ].map(({ icon, label, value }) => (
            <View key={label} style={[S.infoRow, { borderBottomColor: theme.border }]}>
              <Text style={S.infoIcon}>{icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[S.infoLabel, { color: theme.textSecondary }]}>{label}</Text>
                <Text style={[S.infoValue, { color: theme.text }]}>{value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── My Cases ── */}
        <View style={S.section}>
          <View style={S.sectionHeader}>
            <Text style={[S.sectionTitle, { color: theme.text }]}>📋 My Reported Cases</Text>
            <TouchableOpacity onPress={() => router.push("/report-missing")} style={[S.addBtn, { backgroundColor: theme.primary }]}>
              <Text style={S.addBtnText}>+ New</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ alignItems: "center", padding: 32 }}>
              <ActivityIndicator color={theme.primary} />
              <Text style={{ color: theme.textSecondary, marginTop: 8 }}>Loading your cases…</Text>
            </View>
          ) : cases.length === 0 ? (
            <View style={[S.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>📭</Text>
              <Text style={[S.emptyTitle, { color: theme.text }]}>No cases yet</Text>
              <Text style={[S.emptySub, { color: theme.textSecondary }]}>
                Cases you report will appear here
              </Text>
              <TouchableOpacity
                style={[S.reportFirstBtn, { backgroundColor: theme.primary }]}
                onPress={() => router.push("/report-missing")}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Report a Missing Person</Text>
              </TouchableOpacity>
            </View>
          ) : (
            cases.map((c) => (
              <CaseCard
                key={c.id}
                item={c}
                theme={theme}
                onPress={() => {
                  setSelectedCase(c);
                  setCaseModal(true);
                }}
              />
            ))
          )}
        </View>

        {/* ── Sign Out Button ── */}
        <TouchableOpacity style={[S.signOutBtn, { borderColor: "#E74C3C" }]} onPress={handleSignOut} activeOpacity={0.85}>
          <Text style={S.signOutText}>🚪 Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── My Case Detail Modal ── */}
      <MyCaseDetailModal
        visible={caseModal}
        caseItem={selectedCase}
        theme={theme}
        onClose={() => { setCaseModal(false); setSelectedCase(null); }}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },

  heroGradient:      { paddingTop: 32, paddingBottom: 28, alignItems: "center", paddingHorizontal: 20 },
  avatarWrap:        { marginBottom: 12 },
  avatar:            { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: "rgba(255,255,255,0.6)" },
  avatarPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "rgba(255,255,255,0.5)" },
  avatarInitial:     { fontSize: 36, fontWeight: "900", color: "#fff" },
  heroName:          { fontSize: 22, fontWeight: "900", color: "#fff", marginBottom: 4 },
  heroEmail:         { fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 4 },
  heroJoined:        { fontSize: 11, color: "rgba(255,255,255,0.6)" },

  statsRow:   { flexDirection: "row", marginHorizontal: 16, marginTop: -1, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  statItem:   { flex: 1, alignItems: "center", paddingVertical: 14, paddingHorizontal: 4 },
  statIcon:   { fontSize: 18, marginBottom: 4 },
  statValue:  { fontSize: 18, fontWeight: "900" },
  statLabel:  { fontSize: 9, fontWeight: "600", textAlign: "center", marginTop: 2, lineHeight: 13 },

  card:      { margin: 16, borderRadius: 14, padding: 16, borderWidth: 1 },
  cardTitle: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginBottom: 8 },

  infoRow:   { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, gap: 12 },
  infoIcon:  { fontSize: 18, width: 26 },
  infoLabel: { fontSize: 11, fontWeight: "600", marginBottom: 1 },
  infoValue: { fontSize: 14, fontWeight: "500" },

  section:       { paddingHorizontal: 16, marginTop: 4 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle:  { fontSize: 16, fontWeight: "800" },
  addBtn:        { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 },
  addBtnText:    { color: "#fff", fontWeight: "800", fontSize: 13 },

  emptyCard:       { borderRadius: 14, padding: 28, alignItems: "center", borderWidth: 1, marginBottom: 16 },
  emptyTitle:      { fontSize: 16, fontWeight: "800", marginBottom: 6 },
  emptySub:        { fontSize: 13, textAlign: "center", lineHeight: 18, marginBottom: 16 },
  reportFirstBtn:  { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },

  signOutBtn:  { marginHorizontal: 16, marginTop: 8, height: 50, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  signOutText: { color: "#E74C3C", fontWeight: "700", fontSize: 15 },
  signInBtn:   { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
});