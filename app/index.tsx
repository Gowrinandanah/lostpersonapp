import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { Timestamp } from "firebase/firestore";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { getMissingPersons } from "../src/firebase/firestoreService";
import { getOptimizedImageUrl } from "../src/services/cloudinaryService";
import { auth } from "../src/firebase/firebaseConfig";
import { timeAgo } from "../src/utils/dateFormatter";
import BottomNav from "../src/components/BottomNav";

const { width } = Dimensions.get("window");

const G = {
  primary:  "#2ECC71",
  dark:     "#27AE60",
  light:    "#EAFAF1",
  border:   "#D5F5E3",
  urgent:   "#E74C3C",
  orange:   "#E67E22",
  bg:       "#F4F7F4",
  white:    "#FFFFFF",
  text:     "#1A1A1A",
  sub:      "#666666",
  muted:    "#AAAAAA",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface MissingPerson {
  id: string;
  name: string;
  age: number;
  gender: string;
  lastSeenLocation: string;
  photoUrl?: string;
  publicId?: string;
  createdAt: Timestamp | null;
  isUrgentFlag?: boolean;
  isVulnerable?: boolean;
}

function toDate(v: Timestamp | string | number | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  const d = new Date(v as string | number);
  return isNaN(d.getTime()) ? null : d;
}

function isUrgent(p: MissingPerson): boolean {
  if (p.isUrgentFlag || p.isVulnerable) return true;
  if (p.age < 18 || p.age > 65) return true;
  const d = toDate(p.createdAt);
  return d ? Date.now() - d.getTime() < 48 * 3600 * 1000 : false;
}

// ── Recent Case Card ──────────────────────────────────────────────────────────

const CaseCard = ({ item }: { item: MissingPerson }) => {
  const imageUri = item.publicId
    ? getOptimizedImageUrl(item.publicId, 120, 120)
    : item.photoUrl ?? null;
  const urgent = isUrgent(item);

  return (
    <TouchableOpacity
      style={[cardS.card, urgent && cardS.cardUrgent]}
      onPress={() => router.push({ pathname: "/case-details", params: { id: item.id } })}
      activeOpacity={0.88}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={cardS.photo} />
      ) : (
        <View style={cardS.photoPlaceholder}>
          <Text style={{ fontSize: 28 }}>👤</Text>
        </View>
      )}
      <View style={cardS.info}>
        <View style={cardS.nameRow}>
          <Text style={cardS.name} numberOfLines={1}>{item.name}</Text>
          {urgent && <View style={cardS.urgentDot} />}
        </View>
        <Text style={cardS.meta}>{item.age} yrs · {item.gender}</Text>
        <Text style={cardS.location} numberOfLines={1}>📍 {item.lastSeenLocation || "Unknown"}</Text>
        <Text style={cardS.time}>{item.createdAt ? timeAgo(item.createdAt as any) : "Recently"}</Text>
      </View>
      <View style={[cardS.statusBadge, { backgroundColor: urgent ? "#FDECEA" : G.light, borderColor: urgent ? G.urgent : G.dark }]}>
        <Text style={[cardS.statusText, { color: urgent ? G.urgent : G.dark }]}>
          {urgent ? "URGENT" : "MISSING"}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const cardS = StyleSheet.create({
  card:           { flexDirection: "row", alignItems: "center", backgroundColor: G.white, borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#EEEEEE", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3 },
  cardUrgent:     { borderColor: "#FBBCB8", borderWidth: 1.5 },
  photo:          { width: 58, height: 68, borderRadius: 12 },
  photoPlaceholder:{ width: 58, height: 68, borderRadius: 12, backgroundColor: G.light, alignItems: "center", justifyContent: "center" },
  info:           { flex: 1, marginLeft: 12 },
  nameRow:        { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  name:           { fontSize: 14, fontWeight: "800", color: G.text, flex: 1 },
  urgentDot:      { width: 7, height: 7, borderRadius: 4, backgroundColor: G.urgent },
  meta:           { fontSize: 12, color: G.sub, marginBottom: 2 },
  location:       { fontSize: 11, color: G.muted, marginBottom: 3 },
  time:           { fontSize: 10, color: G.muted },
  statusBadge:    { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, alignSelf: "flex-start" },
  statusText:     { fontSize: 8, fontWeight: "800", letterSpacing: 0.8 },
});

// ── Emergency Row ─────────────────────────────────────────────────────────────

const EmergencyRow = ({ icon, title, number, color }: { icon: string; title: string; number: string; color: string }) => (
  <TouchableOpacity
    style={emerS.row}
    onPress={() => Linking.openURL(`tel:${number}`)}
    activeOpacity={0.85}
  >
    <View style={[emerS.iconWrap, { backgroundColor: color + "18" }]}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
    </View>
    <View style={{ flex: 1 }}>
      <Text style={emerS.title}>{title}</Text>
      <Text style={[emerS.number, { color }]}>{number}</Text>
    </View>
    <View style={[emerS.callBtn, { backgroundColor: color }]}>
      <Text style={emerS.callText}>Call</Text>
    </View>
  </TouchableOpacity>
);

const emerS = StyleSheet.create({
  row:     { flexDirection: "row", alignItems: "center", backgroundColor: G.white, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#EEEEEE", gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  iconWrap:{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  title:   { fontSize: 13, fontWeight: "600", color: G.text, marginBottom: 1 },
  number:  { fontSize: 17, fontWeight: "900" },
  callBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  callText:{ color: "#fff", fontWeight: "800", fontSize: 13 },
});

// ── Stat Card ─────────────────────────────────────────────────────────────────

const StatCard = ({ value, label, icon, color }: { value: string | number; label: string; icon: string; color: string }) => (
  <View style={[statS.card, { borderColor: color + "30" }]}>
    <View style={[statS.iconWrap, { backgroundColor: color + "15" }]}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
    </View>
    <Text style={[statS.value, { color }]}>{value}</Text>
    <Text style={statS.label}>{label}</Text>
  </View>
);

const statS = StyleSheet.create({
  card:    { flex: 1, backgroundColor: G.white, borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  iconWrap:{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  value:   { fontSize: 22, fontWeight: "900", marginBottom: 2 },
  label:   { fontSize: 10, fontWeight: "600", color: G.muted, textAlign: "center" },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [cases,   setCases]   = useState<MissingPerson[]>([]);
  const [loading, setLoading] = useState(true);

  const user = auth.currentUser;
  const firstName = user?.displayName?.split(" ")[0] || "Citizen";

  useEffect(() => {
    const unsub = getMissingPersons((data) => {
      setCases(data as MissingPerson[]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const recentCases  = cases.slice(0, 4);
  const urgentCount  = cases.filter(isUrgent).length;
  const todayCount   = cases.filter(c => {
    const d = toDate(c.createdAt);
    return d ? Date.now() - d.getTime() < 86_400_000 : false;
  }).length;

  const emergencyNumbers = [
    { icon: "🚔", title: "Police",                number: "100",  color: "#3498DB" },
    { icon: "🚑", title: "Ambulance",             number: "108",  color: "#E74C3C" },
    { icon: "👶", title: "Missing Child (NCPCR)", number: "1098", color: "#F39C12" },
    { icon: "📞", title: "Women Helpline",         number: "1091", color: "#9B59B6" },
  ];

  return (
    <SafeAreaView style={S.root}>
      <StatusBar barStyle="dark-content" backgroundColor={G.white} />

      {/* ── Header ── */}
      <View style={S.header}>
        <View>
          <Text style={S.appName}>RescuerConnect</Text>
          <Text style={S.greeting}>Hello, {firstName} 👋</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/profile")} style={S.avatarBtn}>
          {user?.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={S.avatarImg} />
          ) : (
            <View style={S.avatarFallback}>
              <Text style={S.avatarInitial}>
                {(user?.displayName ?? user?.email ?? "C")[0].toUpperCase()}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={S.scroll}
      >

        {/* ── Hero Banner ── */}
        <LinearGradient
          colors={["#2ECC71", "#1A9E52"]}
          style={S.heroBanner}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={S.heroTextWrap}>
            <Text style={S.heroTitle}>Help Bring{"\n"}Someone Home</Text>
            <Text style={S.heroSub}>
              {loading ? "Loading cases…" : `${cases.length} active case${cases.length !== 1 ? "s" : ""} need your attention`}
            </Text>
            <TouchableOpacity
              style={S.heroBtn}
              onPress={() => router.push("/report-missing")}
              activeOpacity={0.88}
            >
              <Text style={S.heroBtnText}>🚨 Report Missing Person</Text>
            </TouchableOpacity>
          </View>
          <Text style={S.heroEmoji}>🔍</Text>
        </LinearGradient>

        {/* ── Stats Row ── */}
        <View style={S.statsRow}>
          <StatCard
            value={loading ? "—" : cases.length}
            label="Active Cases"
            icon="📋"
            color={G.dark}
          />
          <View style={S.statGap} />
          <StatCard
            value={loading ? "—" : urgentCount}
            label="Urgent"
            icon="🔴"
            color={G.urgent}
          />
          <View style={S.statGap} />
          <StatCard
            value={loading ? "—" : todayCount}
            label="Today"
            icon="📅"
            color="#3498DB"
          />
        </View>

        {/* ── Statistics Page Teaser ── */}
        <TouchableOpacity
          style={S.statsTeaser}
          onPress={() => router.push("/statistics")}
          activeOpacity={0.88}
        >
          <View style={S.statsTeaserLeft}>
            <Text style={S.statsTeaserIcon}>📊</Text>
            <View>
              <Text style={S.statsTeaserTitle}>Live Statistics</Text>
              <Text style={S.statsTeaserSub}>Trends, charts & case insights</Text>
            </View>
          </View>
          <Text style={{ color: G.dark, fontSize: 18 }}>›</Text>
        </TouchableOpacity>

        {/* ── Recent Alerts ── */}
        <View style={S.sectionHeader}>
          <Text style={S.sectionTitle}>Recent Alerts</Text>
          <TouchableOpacity onPress={() => router.push("/alerts")}>
            <Text style={S.viewAll}>See All →</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={S.loadingWrap}>
            <ActivityIndicator color={G.primary} />
            <Text style={S.loadingText}>Loading cases…</Text>
          </View>
        ) : recentCases.length === 0 ? (
          <View style={S.emptyBox}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>✅</Text>
            <Text style={S.emptyTitle}>No active cases</Text>
            <Text style={S.emptySub}>Be the first to report a missing person</Text>
          </View>
        ) : (
          recentCases.map((item) => <CaseCard key={item.id} item={item} />)
        )}

        {/* ── How to Help ── */}
        <Text style={[S.sectionTitle, { marginTop: 8 }]}>How You Can Help</Text>
        <View style={S.helpCard}>
          {[
            { icon: "📢", text: "Share alerts on social media to spread awareness" },
            { icon: "👁",  text: "Report a sighting if you spot someone matching a case" },
            { icon: "🤝", text: "Volunteer with local search and rescue teams" },
            { icon: "💙", text: "Support families of missing persons emotionally" },
          ].map(({ icon, text }, i) => (
            <View key={i} style={S.helpRow}>
              <View style={S.helpIconWrap}>
                <Text style={{ fontSize: 16 }}>{icon}</Text>
              </View>
              <Text style={S.helpText}>{text}</Text>
            </View>
          ))}
        </View>

        {/* ── Emergency Numbers ── */}
        <Text style={[S.sectionTitle, { marginTop: 4 }]}>Emergency Numbers</Text>
        {emergencyNumbers.map((r, i) => <EmergencyRow key={i} {...r} />)}

      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root:   { flex: 1, backgroundColor: G.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: 110 },

  // Header
  header:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: G.white, borderBottomWidth: 1, borderBottomColor: "#EEEEEE" },
  appName:       { fontSize: 19, fontWeight: "900", color: G.dark, letterSpacing: -0.3 },
  greeting:      { fontSize: 12, color: G.muted, marginTop: 1 },
  avatarBtn:     { width: 40, height: 40, borderRadius: 20, overflow: "hidden" },
  avatarImg:     { width: 40, height: 40, borderRadius: 20 },
  avatarFallback:{ width: 40, height: 40, borderRadius: 20, backgroundColor: G.primary, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 16, fontWeight: "900", color: "#fff" },

  // Hero
  heroBanner:  { borderRadius: 20, padding: 22, marginTop: 16, marginBottom: 18, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  heroTextWrap:{ flex: 1 },
  heroTitle:   { fontSize: 22, fontWeight: "900", color: "#fff", lineHeight: 28, marginBottom: 6 },
  heroSub:     { fontSize: 13, color: "rgba(255,255,255,0.82)", marginBottom: 16, lineHeight: 18 },
  heroBtn:     { backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignSelf: "flex-start", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" },
  heroBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  heroEmoji:   { fontSize: 56, marginLeft: 8, opacity: 0.9 },

  // Stats
  statsRow: { flexDirection: "row", marginBottom: 14 },
  statGap:  { width: 10 },

  // Statistics teaser
  statsTeaser:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: G.white, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: G.border, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  statsTeaserLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  statsTeaserIcon: { fontSize: 28 },
  statsTeaserTitle:{ fontSize: 15, fontWeight: "800", color: G.text },
  statsTeaserSub:  { fontSize: 12, color: G.muted, marginTop: 1 },

  // Section headers
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle:  { fontSize: 16, fontWeight: "800", color: G.text, marginBottom: 12 },
  viewAll:       { fontSize: 13, fontWeight: "700", color: G.primary },

  // Loading / empty
  loadingWrap: { alignItems: "center", paddingVertical: 28, gap: 8 },
  loadingText: { fontSize: 13, color: G.muted },
  emptyBox:    { backgroundColor: G.white, borderRadius: 16, borderWidth: 1, borderColor: "#EEEEEE", padding: 28, alignItems: "center", marginBottom: 16 },
  emptyTitle:  { fontSize: 15, fontWeight: "800", color: G.text, marginBottom: 4 },
  emptySub:    { fontSize: 12, color: G.muted, textAlign: "center" },

  // How to help
  helpCard:    { backgroundColor: G.white, borderRadius: 16, borderWidth: 1, borderColor: "#EEEEEE", padding: 16, marginBottom: 20, gap: 14 },
  helpRow:     { flexDirection: "row", alignItems: "center", gap: 12 },
  helpIconWrap:{ width: 36, height: 36, borderRadius: 18, backgroundColor: G.light, alignItems: "center", justifyContent: "center" },
  helpText:    { flex: 1, fontSize: 13, lineHeight: 18, color: G.sub },
});