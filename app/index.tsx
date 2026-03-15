import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { Timestamp } from "firebase/firestore";
import { SafeAreaView } from "react-native-safe-area-context";
import { getMissingPersons } from "../src/firebase/firestoreService";
import { getOptimizedImageUrl } from "../src/services/cloudinaryService";
import { auth } from "../src/firebase/firebaseConfig";
import { timeAgo } from "../src/utils/dateFormatter";
import BottomNav from "../src/components/BottomNav";

const { width } = Dimensions.get("window");

const G = {
  primary: "#2ECC71",
  dark:    "#27AE60",
  light:   "#EAFAF1",
  border:  "#D5F5E3",
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
}

function toDate(v: Timestamp | string | number | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  const d = new Date(v as string | number);
  return isNaN(d.getTime()) ? null : d;
}

// ── Recent Alert Row ──────────────────────────────────────────────────────────

const AlertRow = ({ item }: { item: MissingPerson }) => {
  const imageUri = item.publicId
    ? getOptimizedImageUrl(item.publicId, 80, 80)
    : item.photoUrl ?? null;
  const createdDate = toDate(item.createdAt);

  return (
    <TouchableOpacity
      style={rowStyles.card}
      onPress={() => router.push({ pathname: "/case-details", params: { id: item.id } })}
      activeOpacity={0.85}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={rowStyles.photo} />
      ) : (
        <View style={rowStyles.photoPlaceholder}>
          <Text style={{ fontSize: 24 }}>👤</Text>
        </View>
      )}
      <View style={rowStyles.info}>
        <Text style={rowStyles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={rowStyles.meta}>{item.age} yrs · {item.gender}</Text>
        <Text style={rowStyles.location} numberOfLines={1}>
          📍 {item.lastSeenLocation || "Unknown location"}
        </Text>
      </View>
      <View style={rowStyles.right}>
        <View style={rowStyles.badge}>
          <Text style={rowStyles.badgeText}>MISSING</Text>
        </View>
        <Text style={rowStyles.time}>
          {createdDate ? timeAgo(item.createdAt as any) : "Recently"}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const rowStyles = StyleSheet.create({
  card:             { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#EEEEEE", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  photo:            { width: 54, height: 54, borderRadius: 10 },
  photoPlaceholder: { width: 54, height: 54, borderRadius: 10, backgroundColor: G.light, alignItems: "center", justifyContent: "center" },
  info:             { flex: 1, marginLeft: 10 },
  name:             { fontSize: 14, fontWeight: "700", color: "#1A1A1A", marginBottom: 2 },
  meta:             { fontSize: 12, color: "#666", marginBottom: 2 },
  location:         { fontSize: 11, color: "#888" },
  right:            { alignItems: "flex-end", gap: 6 },
  badge:            { backgroundColor: "#FDECEA", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: "#E74C3C" },
  badgeText:        { fontSize: 8, fontWeight: "800", color: "#E74C3C", letterSpacing: 0.8 },
  time:             { fontSize: 10, color: "#999" },
});

// ── Action Tile ───────────────────────────────────────────────────────────────

const ActionTile = ({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) => (
  <TouchableOpacity style={tileStyles.tile} onPress={onPress} activeOpacity={0.8}>
    <View style={tileStyles.iconWrap}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
    </View>
    <Text style={tileStyles.label}>{label}</Text>
  </TouchableOpacity>
);

const tileStyles = StyleSheet.create({
  tile:    { width: (width - 64) / 3, paddingVertical: 16, paddingHorizontal: 6, borderRadius: 14, borderWidth: 1, borderColor: G.border, backgroundColor: "#fff", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  iconWrap:{ width: 44, height: 44, borderRadius: 22, backgroundColor: G.light, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  label:   { fontSize: 11, fontWeight: "600", textAlign: "center", color: "#1A1A1A" },
});

// ── Emergency Row ─────────────────────────────────────────────────────────────

const EmergencyRow = ({ icon, title, number, color }: { icon: string; title: string; number: string; color: string }) => (
  <View style={emerStyles.row}>
    <View style={[emerStyles.iconWrap, { backgroundColor: color + "18" }]}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
    </View>
    <View style={{ flex: 1 }}>
      <Text style={emerStyles.title}>{title}</Text>
      <Text style={[emerStyles.number, { color }]}>{number}</Text>
    </View>
    <TouchableOpacity
      style={[emerStyles.callBtn, { backgroundColor: color }]}
      onPress={() => Linking.openURL(`tel:${number}`)}
    >
      <Text style={emerStyles.callText}>Call</Text>
    </TouchableOpacity>
  </View>
);

const emerStyles = StyleSheet.create({
  row:     { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#EEEEEE", gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  iconWrap:{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  title:   { fontSize: 13, fontWeight: "600", color: "#333" },
  number:  { fontSize: 18, fontWeight: "800" },
  callBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  callText:{ color: "#fff", fontWeight: "700", fontSize: 13 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [cases, setCases]     = useState<MissingPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");

  const user = auth.currentUser;

  // Live Firestore subscription
  useEffect(() => {
    const unsub = getMissingPersons((data) => {
      setCases(data as MissingPerson[]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const recentCases = cases.slice(0, 3);

  const emergencyResources = [
    { icon: "🚔", title: "Police",                number: "100",  color: "#3498DB" },
    { icon: "🚑", title: "Ambulance",             number: "108",  color: "#E74C3C" },
    { icon: "👶", title: "Missing Child (NCPCR)", number: "1098", color: "#F39C12" },
    { icon: "📞", title: "Women Helpline",         number: "1091", color: "#9B59B6" },
  ];

  const helpTips = [
    "Share alerts on social media to spread awareness",
    "Contact authorities if you spot someone matching a report",
    "Volunteer with local search and rescue teams",
    "Donate to organizations supporting missing person searches",
  ];

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>RescuerConnect</Text>
          <Text style={styles.greeting}>
            Hello, {user?.displayName?.split(" ")[0] || "Citizen"} 👋
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/profile")} style={styles.avatar}>
          <Text style={{ fontSize: 18 }}>👤</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Search ── */}
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => router.push("/alerts")}
          activeOpacity={0.8}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Search by name, location or ID...</Text>
        </TouchableOpacity>

        {/* ── Stats strip ── */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{loading ? "—" : cases.length}</Text>
            <Text style={styles.statLabel}>Active Cases</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {loading ? "—" : cases.filter(c => {
                const d = toDate(c.createdAt);
                return d ? Date.now() - d.getTime() < 86_400_000 : false;
              }).length}
            </Text>
            <Text style={styles.statLabel}>Reported Today</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>24/7</Text>
            <Text style={styles.statLabel}>Monitoring</Text>
          </View>
        </View>

        {/* ── Getting Started ── */}
        <Text style={styles.sectionTitle}>Getting Started</Text>
        <View style={styles.tilesRow}>
          <ActionTile icon="👤" label="My Profile"     onPress={() => router.push("/profile")} />
          <ActionTile icon="🔔" label="View Alerts"    onPress={() => router.push("/alerts")}  />
          <ActionTile icon="🔎" label="Search Cases"   onPress={() => router.push("/alerts")}  />
        </View>

        {/* ── Report CTA ── */}
        <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push("/report-missing")} activeOpacity={0.88}>
          <Text style={styles.ctaIcon}>🚨</Text>
          <Text style={styles.ctaText}>Report a Missing Person</Text>
        </TouchableOpacity>

        {/* ── Active Alerts ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Alerts Near You</Text>
          <TouchableOpacity onPress={() => router.push("/alerts")}>
            <Text style={styles.viewAll}>See All</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={G.primary} />
            <Text style={styles.loadingText}>Loading cases...</Text>
          </View>
        ) : recentCases.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={{ fontSize: 28, marginBottom: 6 }}>✅</Text>
            <Text style={styles.emptyTitle}>No active cases right now</Text>
            <Text style={styles.emptySub}>Be the first to report if you know someone missing</Text>
          </View>
        ) : (
          recentCases.map((item) => <AlertRow key={item.id} item={item} />)
        )}

        {/* ── How You Can Help ── */}
        <Text style={[styles.sectionTitle, { marginTop: 6 }]}>How You Can Help</Text>
        <View style={styles.helpCard}>
          {helpTips.map((tip, i) => (
            <View key={i} style={styles.helpRow}>
              <View style={styles.helpDot} />
              <Text style={styles.helpText}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* ── Emergency Resources ── */}
        <Text style={[styles.sectionTitle, { marginTop: 6 }]}>Emergency Resources</Text>
        {emergencyResources.map((r, i) => <EmergencyRow key={i} {...r} />)}

      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: "#F7F8FA" },
  scroll: { paddingHorizontal: 16, paddingBottom: 100 },

  header:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#EEEEEE" },
  appName:   { fontSize: 18, fontWeight: "800", color: G.dark },
  greeting:  { fontSize: 12, color: "#888", marginTop: 1 },
  avatar:    { width: 38, height: 38, borderRadius: 19, backgroundColor: G.light, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: G.border },

  searchBar:         { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", marginTop: 14, marginBottom: 14, borderRadius: 12, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: "#EEEEEE" },
  searchIcon:        { fontSize: 15, marginRight: 8 },
  searchPlaceholder: { fontSize: 14, color: "#AAA" },

  statsRow:    { flexDirection: "row", backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#EEEEEE", marginBottom: 20, overflow: "hidden" },
  statItem:    { flex: 1, alignItems: "center", paddingVertical: 14 },
  statValue:   { fontSize: 20, fontWeight: "800", color: G.dark },
  statLabel:   { fontSize: 10, color: "#888", fontWeight: "600", marginTop: 2 },
  statDivider: { width: 1, backgroundColor: "#EEEEEE", marginVertical: 10 },

  sectionTitle:  { fontSize: 16, fontWeight: "700", color: "#1A1A1A", marginBottom: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  viewAll:       { fontSize: 13, fontWeight: "600", color: G.primary },

  tilesRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },

  ctaBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: G.primary, borderRadius: 14, paddingVertical: 16, marginBottom: 24, gap: 10, shadowColor: G.dark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  ctaIcon: { fontSize: 20 },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  centered:    { alignItems: "center", paddingVertical: 24, gap: 8 },
  loadingText: { fontSize: 13, color: "#999" },
  emptyBox:    { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#EEEEEE", padding: 24, alignItems: "center", marginBottom: 16 },
  emptyTitle:  { fontSize: 15, fontWeight: "700", color: "#1A1A1A", marginBottom: 4 },
  emptySub:    { fontSize: 12, color: "#999", textAlign: "center" },

  helpCard: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#EEEEEE", padding: 16, marginBottom: 20, gap: 12 },
  helpRow:  { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  helpDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: G.primary, marginTop: 5 },
  helpText: { flex: 1, fontSize: 13, lineHeight: 19, color: "#555" },
});