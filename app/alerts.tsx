import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  FlatList,
  Platform,
  Animated,
  useColorScheme,
  Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { addDocument, getCollection } from "../src/firebase/firestoreService";
import { uploadImageToCloudinary } from "../src/services/cloudinaryService";
import { auth } from "../src/firebase/firebaseConfig";
import { Colors, ColorScheme } from "../src/constants/colors";
import * as Location from "expo-location";
import BottomNav from "../src/components/BottomNav";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../src/firebase/firebaseConfig";
import { Stack } from "expo-router";

const G = {
  primary: "#2ECC71", dark: "#27AE60", light: "#EAFAF1",
  white: "#FFFFFF", bg: "#F7F8FA", text: "#1A1A1A",
  sub: "#666666", muted: "#AAAAAA", error: "#E74C3C",
  border: "#E0E0E0", urgent: "#E74C3C", orange: "#E67E22",
};

// ── Location Permission Banner ───────────────────────────────────────────────

function LocationBanner() {
  const [status, setStatus] = useState<"checking" | "granted" | "denied">("checking");

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      setStatus(status === "granted" ? "granted" : "denied");
    });
  }, []);

  const handleEnable = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") {
      setStatus("granted");
    } else {
      // Permission was denied permanently — open settings
      Alert.alert(
        "Location Permission",
        "To see missing persons near you, please enable location access in your phone settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  if (status !== "denied") return null;

  return (
    <TouchableOpacity style={bannerS.wrap} onPress={handleEnable} activeOpacity={0.85}>
      <View style={bannerS.iconWrap}>
        <Text style={{ fontSize: 18 }}>📍</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={bannerS.title}>Location disabled</Text>
        <Text style={bannerS.sub}>Enable to see alerts near you</Text>
      </View>
      <Text style={bannerS.action}>Enable →</Text>
    </TouchableOpacity>
  );
}

const bannerS = StyleSheet.create({
  wrap:    { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF8E1", borderBottomWidth: 1, borderBottomColor: "#FFE082", paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  iconWrap:{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFD54F", alignItems: "center", justifyContent: "center" },
  title:   { fontSize: 13, fontWeight: "700", color: "#5D4037" },
  sub:     { fontSize: 11, color: "#795548", marginTop: 1 },
  action:  { fontSize: 13, fontWeight: "700", color: "#F57F17" },
});

// ── Alert Card ───────────────────────────────────────────────────────────────

interface MissingPerson {
  id: string;
  name: string;
  age: number;
  gender: string;
  lastSeenLocation: string;
  lastSeenDate: string;
  photoUrl?: string;
  status: string;
  isUrgentFlag?: boolean;
  isVulnerable?: boolean;
  createdAt: any;
  sightings?: number;
}

function daysSince(createdAt: any): number {
  if (!createdAt) return 0;
  const d = createdAt?.toDate ? createdAt.toDate() : new Date(createdAt);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function isUrgent(p: MissingPerson): boolean {
  if (p.isUrgentFlag) return true;
  if (p.isVulnerable) return true;
  if (p.age < 18 || p.age > 65) return true;
  if (p.createdAt) {
    const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
    return Date.now() - d.getTime() < 48 * 3600 * 1000;
  }
  return false;
}

const AlertCard = ({ item, onPress }: { item: MissingPerson; onPress: () => void }) => {
  const urgent = isUrgent(item);
  const days   = daysSince(item.createdAt);

  return (
    <TouchableOpacity style={[cardS.card, urgent && cardS.cardUrgent]} onPress={onPress} activeOpacity={0.88}>
      {/* Photo */}
      <View style={cardS.photoWrap}>
        {item.photoUrl ? (
          <Image source={{ uri: item.photoUrl }} style={cardS.photo} />
        ) : (
          <View style={[cardS.photo, cardS.photoPlaceholder]}>
            <Text style={{ fontSize: 28 }}>👤</Text>
          </View>
        )}
        {urgent && <View style={cardS.urgentDot} />}
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <View style={cardS.nameRow}>
          <Text style={cardS.name} numberOfLines={1}>{item.name}</Text>
          {urgent && (
            <View style={cardS.urgentBadge}>
              <Text style={cardS.urgentBadgeText}>URGENT</Text>
            </View>
          )}
          {item.status === "found" && (
            <View style={cardS.foundBadge}>
              <Text style={cardS.foundBadgeText}>FOUND</Text>
            </View>
          )}
        </View>
        <Text style={cardS.meta}>{item.age} yrs · {item.gender}</Text>
        <Text style={cardS.location} numberOfLines={1}>📍 {item.lastSeenLocation}</Text>
        <View style={cardS.footer}>
          <Text style={cardS.days}>
            {days === 0 ? "Reported today" : `Missing ${days}d`}
          </Text>
          {(item.sightings ?? 0) > 0 && (
            <Text style={cardS.sightings}>👁 {item.sightings} sighting{item.sightings !== 1 ? "s" : ""}</Text>
          )}
        </View>
      </View>

      <Text style={{ color: G.muted, fontSize: 18, alignSelf: "center" }}>›</Text>
    </TouchableOpacity>
  );
};

const cardS = StyleSheet.create({
  card:             { flexDirection: "row", backgroundColor: G.white, borderRadius: 16, padding: 12, marginHorizontal: 16, marginBottom: 10, gap: 12, borderWidth: 1, borderColor: "#EEEEEE", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardUrgent:       { borderColor: "#FECACA", backgroundColor: "#FFF5F5" },
  photoWrap:        { position: "relative" },
  photo:            { width: 64, height: 64, borderRadius: 12 },
  photoPlaceholder: { backgroundColor: G.light, alignItems: "center", justifyContent: "center" },
  urgentDot:        { position: "absolute", top: -3, right: -3, width: 12, height: 12, borderRadius: 6, backgroundColor: G.urgent, borderWidth: 2, borderColor: G.white },
  nameRow:          { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  name:             { fontSize: 15, fontWeight: "800", color: G.text, flex: 1 },
  urgentBadge:      { backgroundColor: "#FDECEA", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: G.urgent },
  urgentBadgeText:  { fontSize: 8, fontWeight: "900", color: G.urgent, letterSpacing: 0.5 },
  foundBadge:       { backgroundColor: "#EAFAF1", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: G.dark },
  foundBadgeText:   { fontSize: 8, fontWeight: "900", color: G.dark },
  meta:             { fontSize: 12, color: G.sub, marginBottom: 2 },
  location:         { fontSize: 12, color: G.muted, marginBottom: 4 },
  footer:           { flexDirection: "row", gap: 10 },
  days:             { fontSize: 11, color: G.muted, fontWeight: "600" },
  sightings:        { fontSize: 11, color: G.dark, fontWeight: "600" },
});

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function AlertsScreen() {
  const [persons,   setPersons]   = useState<MissingPerson[]>([]);
  const [filtered,  setFiltered]  = useState<MissingPerson[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [filter,    setFilter]    = useState<"all" | "urgent" | "found">("all");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const params   = useLocalSearchParams<{ refresh?: string }>();

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    const q    = query(collection(db, "missingPersons"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MissingPerson[];
      setPersons(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Re-filter when search/filter/data changes
  useEffect(() => {
    let result = persons;
    if (filter === "urgent") result = result.filter(isUrgent);
    if (filter === "found")  result = result.filter((p) => p.status === "found");
    if (search.trim()) {
      const q = search.toLowerCase();
      result  = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.lastSeenLocation?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [search, filter, persons]);

  const urgentCount = persons.filter(isUrgent).length;
  const activeCount = persons.filter((p) => p.status === "active").length;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={S.root}>
        {/* ── Header ── */}
        <LinearGradient colors={["#27AE60", "#2ECC71"]} style={S.header}>
          <View style={S.headerTop}>
            <View>
              <Text style={S.headerTitle}>🚨 Lost Person Alert</Text>
              <Text style={S.headerSub}>{activeCount} active case{activeCount !== 1 ? "s" : ""}</Text>
            </View>
            <View style={S.headerActions}>
              <TouchableOpacity style={S.iconBtn} onPress={() => router.push("/map")}>
                <Text style={{ fontSize: 20 }}>🗺</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.iconBtn} onPress={() => router.push("/profile")}>
                <Text style={{ fontSize: 20 }}>👤</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search */}
          <View style={S.searchBox}>
            <Text style={{ fontSize: 14, marginRight: 6 }}>🔍</Text>
            <TextInput
              style={S.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search name or location..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        {/* ── Location banner (shown only if permission denied) ── */}
        <LocationBanner />

        {/* ── Filter chips ── */}
        <View style={S.chips}>
          {(["all", "urgent", "found"] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[S.chip, filter === f && S.chipActive, f === "urgent" && filter === f && S.chipUrgent]}
              onPress={() => setFilter(f)}
            >
              <Text style={[S.chipText, filter === f && S.chipTextActive]}>
                {f === "all"    ? `All (${persons.length})` :
                 f === "urgent" ? `🔴 Urgent (${urgentCount})` :
                                  `✅ Found`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── List ── */}
        {loading ? (
          <View style={S.center}>
            <ActivityIndicator color={G.primary} size="large" />
            <Text style={{ color: G.sub, marginTop: 8 }}>Loading cases…</Text>
          </View>
        ) : (
          <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
            <FlatList
              data={filtered}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ paddingTop: 12, paddingBottom: 120 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <AlertCard
                  item={item}
                  onPress={() => router.push({ pathname: "/case-details", params: { id: item.id } })}
                />
              )}
              ListEmptyComponent={
                <View style={S.center}>
                  <Text style={{ fontSize: 40, marginBottom: 10 }}>🔍</Text>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: G.text }}>
                    {search ? "No results found" : "No cases yet"}
                  </Text>
                  <Text style={{ fontSize: 13, color: G.sub, marginTop: 4 }}>
                    {search ? "Try a different search" : "Be the first to report a missing person"}
                  </Text>
                </View>
              }
            />
          </Animated.View>
        )}

        {/* ── FAB: Report Missing ── */}
        <TouchableOpacity
          style={S.fab}
          onPress={() => router.push("/report-missing")}
          activeOpacity={0.85}
        >
          <Text style={S.fabText}>+ Report Missing</Text>
        </TouchableOpacity>

        <BottomNav />
      </View>
    </>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bg },

  header:      { paddingTop: Platform.OS === "ios" ? 54 : 40, paddingBottom: 16, paddingHorizontal: 16 },
  headerTop:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#fff" },
  headerSub:   { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2 },
  headerActions:{ flexDirection: "row", gap: 8 },
  iconBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },

  searchBox:   { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 12, height: 42 },
  searchInput: { flex: 1, fontSize: 14, color: "#fff" },

  chips:        { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, gap: 8, backgroundColor: G.white, borderBottomWidth: 1, borderBottomColor: "#EEEEEE" },
  chip:         { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: "#DDDDDD", backgroundColor: G.white },
  chipActive:   { backgroundColor: G.light, borderColor: G.dark },
  chipUrgent:   { backgroundColor: "#FDECEA", borderColor: G.urgent },
  chipText:     { fontSize: 12, fontWeight: "600", color: G.sub },
  chipTextActive:{ color: G.dark },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },

  fab:     { position: "absolute", bottom: 80, alignSelf: "center", backgroundColor: G.dark, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 30, shadowColor: G.dark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  fabText: { color: "#fff", fontWeight: "900", fontSize: 15 },
});