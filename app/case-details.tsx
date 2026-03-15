import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator, Share,
  useColorScheme, Linking, Platform, Alert,
} from "react-native";
import { router, useLocalSearchParams, Stack } from "expo-router";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "../src/firebase/firebaseConfig";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, ColorScheme } from "../src/constants/colors";
import { cacheDirectory, getInfoAsync, downloadAsync } from "expo-file-system/legacy";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MissingPerson {
  id: string;
  name: string;
  age: number;
  gender: string;
  height?: string | null;
  complexion?: string | null;
  description?: string | null;
  clothingDescription?: string | null;
  lastSeenLocation: string;
  lastSeenDate: string;
  contactName?: string | null;
  contactPhone: string;
  photoUrl?: string | null;
  status: string;
  sightings: number;
  reportedByName?: string;
  createdAt: Timestamp | null;
  lastSeenLat?: number | null;
  lastSeenLng?: number | null;
  isUrgentFlag?: boolean;  // reporter manually marked urgent
  isVulnerable?: boolean;  // auto-set: child <18 or elderly >65
}

// ── Urgency logic ─────────────────────────────────────────────────────────────
// A case is urgent if ANY of:
//   1. Reporter explicitly flagged it as urgent
//   2. Person is a child (<18) or elderly (>65) — always vulnerable
//   3. Report is less than 48 hours old (fresh disappearance)

function checkUrgent(p: MissingPerson): boolean {
  if (p.isUrgentFlag)  return true;
  if (p.isVulnerable)  return true;
  if (p.age < 18 || p.age > 65) return true;
  if (p.createdAt) {
    const d = p.createdAt instanceof Timestamp ? p.createdAt.toDate() : new Date(p.createdAt as any);
    return Date.now() - d.getTime() < 48 * 3600 * 1000;
  }
  return false;
}

function urgentReason(p: MissingPerson): string {
  if (p.isUrgentFlag)     return "Marked urgent by reporter";
  if (p.age < 18)         return "Missing child";
  if (p.age > 65)         return "Missing elderly person";
  if (p.isVulnerable)     return "Vulnerable person";
  return "Recently reported";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts: Timestamp | null): string {
  if (!ts) return "Unknown";
  const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts as any);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function daysSince(ts: Timestamp | null): number {
  if (!ts) return 0;
  const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts as any);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Detail Row ────────────────────────────────────────────────────────────────

const DetailRow = ({ icon, label, value, theme }: {
  icon: string; label: string; value: string; theme: ColorScheme;
}) => (
  <View style={[rowS.row, { borderBottomColor: theme.border }]}>
    <Text style={rowS.icon}>{icon}</Text>
    <View style={{ flex: 1 }}>
      <Text style={[rowS.label, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[rowS.value, { color: theme.text }]}>{value || "Not provided"}</Text>
    </View>
  </View>
);

const rowS = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "flex-start", paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  icon:  { fontSize: 20, width: 28, marginTop: 1 },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5, marginBottom: 2 },
  value: { fontSize: 15, fontWeight: "500", lineHeight: 20 },
});

// ── Section Card ──────────────────────────────────────────────────────────────

const SectionCard = ({ title, children, theme }: {
  title: string; children: React.ReactNode; theme: ColorScheme;
}) => (
  <View style={[sS.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
    <Text style={[sS.title, { color: theme.textSecondary }]}>{title}</Text>
    {children}
  </View>
);

const sS = StyleSheet.create({
  card:  { borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  title: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginBottom: 4 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function CaseDetailsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme: ColorScheme = isDark ? Colors.dark : Colors.light;

  const { id } = useLocalSearchParams<{ id: string }>();

  const [person,   setPerson]   = useState<MissingPerson | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [sharing,  setSharing]  = useState(false);

  useEffect(() => {
    if (!id) { setError("No case ID provided."); setLoading(false); return; }
    (async () => {
      try {
        const snap = await getDoc(doc(db, "missingPersons", id));
        if (!snap.exists()) { setError("Case not found."); return; }
        setPerson({ id: snap.id, ...snap.data() } as MissingPerson);
      } catch (e) {
        console.error(e);
        setError("Failed to load case. Check your connection.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // ── Share — text + photo ─────────────────────────────────────────────────────
  // Strategy:
  //   Android — Share.share() accepts both message + url, so the native sheet
  //             shows the text AND the image together in most apps (WhatsApp etc.)
  //   iOS     — Share.share() url works for images stored locally; we download
  //             the photo first then pass the local file URI as url alongside message.
  //             Most iOS apps will pick up both.
  const handleShare = async () => {
    if (!person) return;
    setSharing(true);

    const alertText =
      `🚨 MISSING PERSON ALERT

` +
      `Name: ${person.name}
` +
      `Age: ${person.age} · ${person.gender}
` +
      (person.height     ? `Height: ${person.height} cm
`       : "") +
      (person.complexion ? `Complexion: ${person.complexion}
`   : "") +
      `
Last Seen: ${person.lastSeenLocation}
` +
      `Date / Time: ${person.lastSeenDate}
` +
      `
Contact: ${person.contactName ? person.contactName + " — " : ""}${person.contactPhone}
` +
      `
If you have any information please call the contact above immediately.`;

    try {
      let imageUri: string | undefined;

      // Download photo to local cache so we can pass a file:// URI
      if (person.photoUrl) {
        try {
          const ext      = person.photoUrl.split("?")[0].split(".").pop() || "jpg";
          const localUri = (cacheDirectory ?? "") + `missing_${person.id}.${ext}`;
          const info     = await getInfoAsync(localUri);
          if (!info.exists) {
            await downloadAsync(person.photoUrl, localUri);
          }
          imageUri = localUri;
        } catch (_) {
          // Photo download failed — continue without it
        }
      }

      // React Native's Share API:
      //   message — shown as text in all apps
      //   url     — on iOS this attaches the file; on Android some apps use it
      await Share.share(
        {
          title:   `🚨 Missing Person: ${person.name}`,
          message: alertText,
          ...(imageUri ? { url: imageUri } : {}),
        },
        {
          dialogTitle: `Share Alert: ${person.name}`,
          subject:     `Missing Person Alert — ${person.name}`,
        }
      );
    } catch (e: any) {
      // Share.share throws if user cancels on some platforms — ignore that
      if (!String(e?.message).includes("cancel")) {
        Alert.alert("Share failed", "Could not open the share sheet.");
      }
    } finally {
      setSharing(false);
    }
  };

  const handleCall = () => {
    if (!person?.contactPhone) return;
    Linking.openURL(`tel:${person.contactPhone}`);
  };

  const handleReportSighting = () => {
    router.push({ pathname: "/report-sighting", params: { caseId: id } });
  };

  // ── Loading / Error ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={[S.root, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: "Case Details", headerStyle: { backgroundColor: theme.card }, headerTintColor: theme.text }} />
        <View style={S.center}>
          <ActivityIndicator color={theme.primary} size="large" />
          <Text style={{ color: theme.textSecondary, marginTop: 12 }}>Loading case…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !person) {
    return (
      <SafeAreaView style={[S.root, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: "Case Details" }} />
        <View style={S.center}>
          <Text style={{ fontSize: 48 }}>😔</Text>
          <Text style={[S.errorTitle, { color: theme.text }]}>Case Not Found</Text>
          <Text style={[S.errorSub, { color: theme.textSecondary }]}>{error}</Text>
          <TouchableOpacity style={[S.backBtnSmall, { backgroundColor: theme.primary }]} onPress={() => router.back()}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>← Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const urgent   = checkUrgent(person);
  const reason   = urgent ? urgentReason(person) : "";
  const days     = daysSince(person.createdAt);
  const reported = formatDate(person.createdAt);
  const resolved = person.status === "found" || person.status === "resolved";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[S.root, { backgroundColor: theme.background }]} edges={["top", "left", "right"]}>
      <Stack.Screen options={{
        title: "",
        headerStyle:       { backgroundColor: "transparent" },
        headerTintColor:   "#fff",
        headerTransparent: true,
        headerBackTitle:   "",
        headerRight: () => (
          <TouchableOpacity onPress={handleShare} style={{ marginRight: 4, padding: 6 }} disabled={sharing}>
            {sharing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ fontSize: 20 }}>🔗</Text>
            }
          </TouchableOpacity>
        ),
      }} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── Hero ── */}
        <View style={S.heroWrap}>
          <LinearGradient
            colors={
              urgent   ? ["#E74C3C", "#C0392B"] :
              resolved ? ["#27AE60", "#1E8449"] :
              isDark   ? ["#1A2E1A", "#0D1F0D"] : ["#2ECC71", "#27AE60"]
            }
            style={S.heroBg}
          />
          {person.photoUrl ? (
            <Image source={{ uri: person.photoUrl }} style={S.heroPhoto} resizeMode="cover" />
          ) : (
            <View style={[S.heroPhotoPlaceholder, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
              <Text style={{ fontSize: 64 }}>👤</Text>
            </View>
          )}

          <View style={S.badges}>
            {urgent && !resolved && (
              <View style={S.badgeUrgent}>
                <Text style={S.badgeText}>🔴 URGENT — {reason}</Text>
              </View>
            )}
            {resolved && (
              <View style={S.badgeFound}>
                <Text style={S.badgeText}>✅ FOUND</Text>
              </View>
            )}
            <View style={S.badgeDays}>
              <Text style={S.badgeText}>
                {days === 0 ? "Reported today" : `Missing ${days}d`}
              </Text>
            </View>
          </View>

          <Text style={S.heroName}>{person.name}</Text>
          <Text style={S.heroMeta}>
            {person.age} years · {person.gender}
            {person.height ? `  ·  ${person.height} cm` : ""}
          </Text>
          <Text style={S.heroReported}>Reported on {reported}</Text>
        </View>

        {/* ── Sightings counter ── */}
        {person.sightings > 0 && (
          <View style={[S.sightingsBanner, { backgroundColor: "#FFF3CD", borderColor: "#FFC107" }]}>
            <Text style={{ fontSize: 18 }}>👁</Text>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#856404" }}>
              {person.sightings} sighting{person.sightings !== 1 ? "s" : ""} reported
            </Text>
          </View>
        )}

        {/* ── Urgent reason banner ── */}
        {urgent && !resolved && (
          <View style={[S.urgentBanner, { backgroundColor: "#FDECEA", borderColor: "#E74C3C" }]}>
            <Text style={{ fontSize: 18 }}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={S.urgentBannerTitle}>This is an urgent case</Text>
              <Text style={S.urgentBannerSub}>{reason} — please share widely</Text>
            </View>
          </View>
        )}

        <View style={S.content}>

          {/* ── Last Seen ── */}
          <SectionCard title="📍  LAST KNOWN LOCATION" theme={theme}>
            <DetailRow icon="📍" label="Location"    value={person.lastSeenLocation} theme={theme} />
            <DetailRow icon="🕐" label="Date & Time" value={person.lastSeenDate}     theme={theme} />
          </SectionCard>

          {/* ── Physical Description ── */}
          <SectionCard title="👤  PHYSICAL DESCRIPTION" theme={theme}>
            <DetailRow icon="🧑" label="Age / Gender" value={`${person.age} years · ${person.gender}`} theme={theme} />
            {!!person.height     && <DetailRow icon="📏" label="Height"     value={`${person.height} cm`} theme={theme} />}
            {!!person.complexion && <DetailRow icon="🎨" label="Complexion" value={person.complexion!}    theme={theme} />}
            {!!person.description && (
              <View style={[rowS.row, { borderBottomColor: theme.border }]}>
                <Text style={rowS.icon}>📝</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[rowS.label, { color: theme.textSecondary }]}>Physical Features</Text>
                  <Text style={[rowS.value, { color: theme.text }]}>{person.description}</Text>
                </View>
              </View>
            )}
            {!!person.clothingDescription && (
              <View style={[rowS.row, { borderBottomWidth: 0 }]}>
                <Text style={rowS.icon}>👕</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[rowS.label, { color: theme.textSecondary }]}>Last Seen Wearing</Text>
                  <Text style={[rowS.value, { color: theme.text }]}>{person.clothingDescription}</Text>
                </View>
              </View>
            )}
          </SectionCard>

          {/* ── Contact ── */}
          <SectionCard title="📞  CONTACT INFORMATION" theme={theme}>
            {!!person.contactName && (
              <DetailRow icon="🧑" label="Contact Person" value={person.contactName!} theme={theme} />
            )}
            <View style={[rowS.row, { borderBottomWidth: 0 }]}>
              <Text style={rowS.icon}>📱</Text>
              <View style={{ flex: 1 }}>
                <Text style={[rowS.label, { color: theme.textSecondary }]}>Phone Number</Text>
                <TouchableOpacity onPress={handleCall} activeOpacity={0.7}>
                  <Text style={[rowS.value, { color: theme.primary, textDecorationLine: "underline" }]}>
                    {person.contactPhone}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </SectionCard>

          {/* ── Case info ── */}
          <SectionCard title="🗂  CASE INFORMATION" theme={theme}>
            <DetailRow icon="👤" label="Reported By" value={person.reportedByName || "Anonymous"} theme={theme} />
            <DetailRow icon="📅" label="Report Date" value={reported}                             theme={theme} />
            <View style={[rowS.row, { borderBottomWidth: 0 }]}>
              <Text style={rowS.icon}>🔖</Text>
              <View style={{ flex: 1 }}>
                <Text style={[rowS.label, { color: theme.textSecondary }]}>Status</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <View style={[S.statusDot, { backgroundColor: resolved ? "#27AE60" : urgent ? "#E74C3C" : "#F39C12" }]} />
                  <Text style={[rowS.value, { color: theme.text }]}>
                    {resolved ? "Found / Resolved" : urgent ? "Active — Urgent" : "Active"}
                  </Text>
                </View>
              </View>
            </View>
          </SectionCard>

        </View>
      </ScrollView>

      {/* ── Bottom Action Bar ── */}
      {!resolved && (
        <View style={[S.actionBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <TouchableOpacity style={[S.callBtn, { borderColor: theme.primary }]} onPress={handleCall} activeOpacity={0.85}>
            <Text style={{ fontSize: 20 }}>📞</Text>
            <Text style={[S.callBtnText, { color: theme.primary }]}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity style={S.sightingBtn} onPress={handleReportSighting} activeOpacity={0.85}>
            <LinearGradient colors={["#2ECC71", "#27AE60"]} style={S.sightingBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={S.sightingBtnIcon}>👁</Text>
              <Text style={S.sightingBtnText}>I&apos;ve Seen Them!</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={[S.callBtn, { borderColor: theme.border }]} onPress={handleShare} disabled={sharing} activeOpacity={0.85}>
            {sharing
              ? <ActivityIndicator color={theme.primary} size="small" />
              : <Text style={{ fontSize: 20 }}>🔗</Text>
            }
            <Text style={[S.callBtnText, { color: theme.textSecondary }]}>Share</Text>
          </TouchableOpacity>
        </View>
      )}

      {resolved && (
        <View style={[S.actionBar, { backgroundColor: "#EAFAF1", borderTopColor: "#D5F5E3" }]}>
          <View style={{ alignItems: "center", flex: 1 }}>
            <Text style={{ fontSize: 28 }}>✅</Text>
            <Text style={{ fontWeight: "700", color: "#27AE60", marginTop: 4 }}>This person has been found</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root:    { flex: 1 },
  center:  { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  content: { padding: 16 },

  heroWrap:            { minHeight: 340, alignItems: "center", justifyContent: "flex-end", paddingBottom: 24, paddingHorizontal: 20 },
  heroBg:              { ...StyleSheet.absoluteFillObject },
  heroPhoto:           { width: 130, height: 160, borderRadius: 16, borderWidth: 3, borderColor: "rgba(255,255,255,0.6)", marginBottom: 14, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  heroPhotoPlaceholder:{ width: 130, height: 160, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  heroName:            { fontSize: 26, fontWeight: "900", color: "#fff", textAlign: "center", textShadowColor: "rgba(0,0,0,0.25)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  heroMeta:            { fontSize: 15, color: "rgba(255,255,255,0.85)", marginTop: 4, textAlign: "center" },
  heroReported:        { fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 4 },

  badges:      { flexDirection: "row", gap: 8, marginBottom: 10, flexWrap: "wrap", justifyContent: "center" },
  badgeUrgent: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)" },
  badgeFound:  { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)" },
  badgeDays:   { backgroundColor: "rgba(0,0,0,0.2)",        borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText:   { fontSize: 11, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },

  urgentBanner:      { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 10, marginBottom: 2, borderRadius: 12, padding: 14, borderWidth: 1 },
  urgentBannerTitle: { fontSize: 14, fontWeight: "800", color: "#C0392B" },
  urgentBannerSub:   { fontSize: 12, color: "#E74C3C", marginTop: 2 },

  sightingsBanner: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 8, marginBottom: 2, borderRadius: 12, padding: 12, borderWidth: 1 },

  statusDot: { width: 8, height: 8, borderRadius: 4 },

  errorTitle:   { fontSize: 20, fontWeight: "800", marginTop: 12 },
  errorSub:     { fontSize: 14, marginTop: 6, textAlign: "center", marginBottom: 24 },
  backBtnSmall: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },

  actionBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
    borderTopWidth: 1, gap: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 10,
  },
  callBtn:             { width: 64, alignItems: "center", gap: 3, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5 },
  callBtnText:         { fontSize: 11, fontWeight: "700" },
  sightingBtn:         { flex: 1, borderRadius: 14, overflow: "hidden", height: 54 },
  sightingBtnGradient: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  sightingBtnIcon:     { fontSize: 20 },
  sightingBtnText:     { fontSize: 16, fontWeight: "900", color: "#fff", letterSpacing: 0.3 },
});