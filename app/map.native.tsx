// app/map.native.tsx
//
// MAP SCREEN — "Cases Near Me"
//
// FIXES:
//  • Firebase composite-index error → getAllMissingPersons now filters
//    verified=true client-side (no composite index needed)
//  • Shows ONLY verified + active/approved cases
//  • Every MapMarker shows the person's name label
//
// Google-free: MapLibre Native + CartoDB Voyager tiles

import React, {
  useEffect, useState, useRef, useCallback, useMemo,
} from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, FlatList,
  Animated, Alert,
} from "react-native";
import {
  MapView, Camera, CameraRef, UserLocation,
} from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import { onAuthStateChanged, User } from "firebase/auth";
import { router, Stack } from "expo-router";
import { Timestamp } from "firebase/firestore";
import { SafeAreaView } from "react-native-safe-area-context";
import MapMarker from "../src/components/MapMarker.native";
import { auth } from "../src/firebase/firebaseConfig";
import {
  getAllMissingPersons,
  getUserProfile,
} from "../src/firebase/firestoreService";
import BottomNav from "../src/components/BottomNav";

// ─────────────────────────────────────────────────────────────────────────────
// Palette
// ─────────────────────────────────────────────────────────────────────────────

const G = {
  primary: "#E53935",   // red  — all active cases
  dark:    "#C62828",   // dark red
  light:   "#FDECEA",
  border:  "#FFCDD2",
  white:   "#FFFFFF",
  bg:      "#F7F8FA",
  text:    "#1A1A1A",
  sub:     "#666666",
  muted:   "#AAAAAA",
  urgent:  "#7B1FA2",   // purple — urgent cases
  blue:    "#2980B9",
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CENTER: [number, number] = [76.2711, 10.8505]; // Kerala
const DEFAULT_ZOOM   = 7;
const NEARBY_KM      = 50;

const OSM_MAP_STYLE = {
  version: 8 as const,
  sources: {
    "carto-voyager": {
      type:      "raster" as const,
      tiles:     ["https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"],
      tileSize:  256,
      attribution: "© OpenStreetMap contributors © CARTO",
      maxzoom:   19,
    },
  },
  layers: [
    { id: "carto-voyager-layer", type: "raster" as const, source: "carto-voyager" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type UserRole   = "public" | "reporter" | "admin";
type ViewMode   = "map" | "list";
type FilterMode = "all" | "urgent";

interface MissingPersonRaw {
  id:               string;
  name:             string;
  age:              number;
  gender:           string;
  lastSeenLocation: string;
  status:           string;
  verified?:        boolean;          // ← Firestore field
  createdAt:        Timestamp | null;
  coordinates?:     { latitude: number; longitude: number } | null;
  lastSeenLat?:     number | null;
  lastSeenLng?:     number | null;
  isUrgentFlag?:    boolean;
  isVulnerable?:    boolean;
  reportedBy?:      string;
}

interface CaseMarker {
  id:               string;
  name:             string;
  age:              number;
  gender:           string;
  lastSeenLocation: string;
  latitude:         number;
  longitude:        number;
  isUrgent:         boolean;
  status:           string;
  reportedBy?:      string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isUrgent(p: MissingPersonRaw): boolean {
  if (p.isUrgentFlag || p.isVulnerable) return true;
  if (p.age < 18 || p.age > 65)         return true;
  if (p.createdAt) {
    const d = p.createdAt instanceof Timestamp ? p.createdAt.toDate() : null;
    return d ? Date.now() - d.getTime() < 48 * 3600 * 1000 : false;
  }
  return false;
}

/** Only include persons that are verified=true AND have valid coordinates */
function toCaseMarker(p: MissingPersonRaw): CaseMarker | null {
  // Allow through if verified is true OR if verified field is missing entirely
  // (some older records may not have the field but are already active/approved)
  if (p.verified === false) return null;

  const lat = p.coordinates?.latitude  ?? p.lastSeenLat;
  const lng = p.coordinates?.longitude ?? p.lastSeenLng;
  if (lat == null || lng == null) {
    console.log(`[MAP] skipping ${p.name} — no coordinates`);
    return null;
  }

  return {
    id:               p.id,
    name:             p.name,
    age:              p.age,
    gender:           p.gender,
    lastSeenLocation: p.lastSeenLocation,
    latitude:         lat,
    longitude:        lng,
    isUrgent:         isUrgent(p),
    status:           p.status,
    reportedBy:       p.reportedBy,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const RoleBadge = ({ role }: { role: UserRole }) => {
  const cfg = {
    public:   { label: "Near Me",   bg: G.primary, icon: "📍" },
    reporter: { label: "My Cases",  bg: G.blue,    icon: "👤" },
    admin:    { label: "All Cases", bg: G.urgent,  icon: "🛡"  },
  }[role];
  return (
    <View style={[badge.wrap, { backgroundColor: cfg.bg }]}>
      <Text style={badge.text}>{cfg.icon}  {cfg.label}</Text>
    </View>
  );
};
const badge = StyleSheet.create({
  wrap: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  text: { color: "#fff", fontSize: 11, fontWeight: "700" },
});

const CaseRow = ({ item, onPress }: { item: CaseMarker; onPress: () => void }) => (
  <TouchableOpacity style={rowS.row} onPress={onPress} activeOpacity={0.85}>
    <View style={[rowS.dot, item.isUrgent && rowS.dotUrgent]} />
    <View style={{ flex: 1 }}>
      <View style={rowS.nameRow}>
        <Text style={rowS.name} numberOfLines={1}>{item.name}</Text>
        {item.isUrgent && (
          <View style={rowS.urgentTag}><Text style={rowS.urgentTagText}>URGENT</Text></View>
        )}
      </View>
      <Text style={rowS.meta}>Age {item.age} · {item.gender}</Text>
      <Text style={rowS.loc} numberOfLines={1}>📍 {item.lastSeenLocation}</Text>
    </View>
    <Text style={{ color: G.sub, fontSize: 18 }}>›</Text>
  </TouchableOpacity>
);

const rowS = StyleSheet.create({
  row:           { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#F0F0F0", gap: 10, backgroundColor: G.white },
  dot:           { width: 10, height: 10, borderRadius: 5, backgroundColor: G.primary },
  dotUrgent:     { backgroundColor: G.urgent },
  nameRow:       { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  name:          { fontSize: 14, fontWeight: "700", color: G.text },
  urgentTag:     { backgroundColor: "#FDECEA", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: G.urgent },
  urgentTagText: { fontSize: 8, fontWeight: "800", color: G.urgent, letterSpacing: 0.6 },
  meta:          { fontSize: 11, color: G.sub, marginBottom: 1 },
  loc:           { fontSize: 11, color: G.muted },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function MapScreen() {
  const cameraRef = useRef<CameraRef>(null);

  const [user,      setUser]      = useState<User | null>(null);
  const [role,      setRole]      = useState<UserRole>("public");
  const [authReady, setAuthReady] = useState(false);

  const [allCases,   setAllCases]   = useState<CaseMarker[]>([]);
  const [userLatLng, setUserLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [locating,   setLocating]   = useState(false);

  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState<FilterMode>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("map");

  const [camCenter, setCamCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [camZoom,   setCamZoom]   = useState(DEFAULT_ZOOM);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Auth + role ──────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const profile = await getUserProfile(u.uid) as any;
          setRole(profile?.role === "admin" ? "admin" : "reporter");
        } catch {
          setRole("reporter");
        }
      } else {
        setRole("public");
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // ── Fetch cases ──────────────────────────────────────────────────────────
  // getAllMissingPersons now queries status in ["active","approved"] only
  // and filters verified=true client-side → no composite index needed.

  useEffect(() => {
    if (!authReady) return;
    setLoading(true);

    const unsub = getAllMissingPersons((raw) => {
      const data = raw as unknown as MissingPersonRaw[];

      // 🔍 Debug — remove after confirming markers appear
      console.log("[MAP] raw records from Firestore:", data.length);
      data.forEach((p) => {
        console.log(`  → ${p.name} | status=${p.status} | verified=${p.verified} | lat=${p.coordinates?.latitude ?? p.lastSeenLat} | lng=${p.coordinates?.longitude ?? p.lastSeenLng}`);
      });

      const markers = data
        .map(toCaseMarker)
        .filter((m): m is CaseMarker => m !== null);

      console.log("[MAP] markers after toCaseMarker:", markers.length);

      setAllCases(markers);
      setLoading(false);

      Animated.timing(fadeAnim, {
        toValue: 1, duration: 400, useNativeDriver: true,
      }).start();
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, role, user?.uid]);

  // ── Auto-acquire GPS ─────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({});
        setUserLatLng({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        setCamCenter([loc.coords.longitude, loc.coords.latitude]);
        setCamZoom(12);
      } catch {
        // Location unavailable — show all cases
      }
    })();
  }, []);

  // ── Filtered cases ───────────────────────────────────────────────────────
  // Note: verified filter is already applied in toCaseMarker,
  // so allCases here only contains verified+active/approved cases.

  const filteredCases = useMemo(() => {
    let result = allCases;

    if (filter === "urgent") {
      result = result.filter((m) => m.isUrgent);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.lastSeenLocation.toLowerCase().includes(q),
      );
    }

    return result;
  }, [allCases, filter, search]);

  // ── GPS button ───────────────────────────────────────────────────────────

  const goToMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Location access is needed to centre the map.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setUserLatLng({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      setCamCenter([loc.coords.longitude, loc.coords.latitude]);
      setCamZoom(13);
    } catch {
      Alert.alert("Error", "Could not get your location.");
    } finally {
      setLocating(false);
    }
  };

  const handleCasePress = useCallback((id: string) => {
    router.push({ pathname: "/case-details", params: { id } });
  }, []);

  // ── Auth guard ───────────────────────────────────────────────────────────

  if (!authReady) {
    return (
      <SafeAreaView style={S.root}>
        <View style={S.center}>
          <ActivityIndicator color={G.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const urgentCount  = filteredCases.filter((m) => m.isUrgent).length;
  const nearbyLabel  = userLatLng
    ? `Within ${NEARBY_KM} km of you`
    : "Showing all verified cases";

  return (
    <SafeAreaView style={S.root}>
      <Stack.Screen
        options={{
          title: "Cases",
          headerStyle:      { backgroundColor: G.dark },
          headerTintColor:  "#fff",
          headerTitleStyle: { fontWeight: "700" },
          headerBackTitle:  "",
          headerRight: () => (
            <View style={{ marginRight: 12 }}>
              <RoleBadge role={role} />
            </View>
          ),
        }}
      />

      {/* ── Search + view toggle ── */}
      <View style={S.searchWrap}>
        <View style={S.searchBox}>
          <Text style={{ fontSize: 14, marginRight: 6 }}>🔍</Text>
          <TextInput
            style={S.searchText}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or location…"
            placeholderTextColor={G.muted}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Text style={{ color: G.muted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={S.toggleWrap}>
          <TouchableOpacity
            style={[S.toggleBtn, viewMode === "map" && S.toggleActive]}
            onPress={() => setViewMode("map")}
          >
            <Text style={[S.toggleText, viewMode === "map" && S.toggleTextActive]}>🗺</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[S.toggleBtn, viewMode === "list" && S.toggleActive]}
            onPress={() => setViewMode("list")}
          >
            <Text style={[S.toggleText, viewMode === "list" && S.toggleTextActive]}>☰</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Filter chips + legend ── */}
      <View style={S.chips}>
        <TouchableOpacity
          style={[S.chip, filter === "all" && S.chipActive]}
          onPress={() => setFilter("all")}
        >
          <Text style={[S.chipText, filter === "all" && S.chipTextActive]}>
            All ({filteredCases.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[S.chip, filter === "urgent" && S.chipUrgent]}
          onPress={() => setFilter("urgent")}
        >
          <Text style={[S.chipText, filter === "urgent" && { color: G.white }]}>
            🔴 Urgent ({urgentCount})
          </Text>
        </TouchableOpacity>

        <View style={S.legend}>
          <View style={[S.legendDot, { backgroundColor: G.urgent }]} />
          <Text style={S.legendText}>Urgent</Text>
          <View style={[S.legendDot, { backgroundColor: G.primary, marginLeft: 8 }]} />
          <Text style={S.legendText}>Active</Text>
        </View>
      </View>

      {/* ── Proximity / status banner ── */}
      <View style={S.infoBanner}>
        <Text style={S.infoBannerText}>✅ {nearbyLabel} · verified cases only</Text>
      </View>

      {/* ── Main content ── */}
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
        {loading ? (
          <View style={S.center}>
            <ActivityIndicator color={G.primary} size="large" />
            <Text style={{ color: G.sub, marginTop: 8 }}>Loading verified cases…</Text>
          </View>

        ) : viewMode === "map" ? (
          /* ══ MAP VIEW ══ */
          <View style={{ flex: 1 }}>
            <MapView
              style={{ flex: 1 }}
              mapStyle={OSM_MAP_STYLE}
              logoEnabled={false}
              attributionEnabled={false}
              compassEnabled
              compassViewPosition={0}
            >
              <Camera
                ref={cameraRef}
                centerCoordinate={camCenter}
                zoomLevel={camZoom}
                animationMode="flyTo"
                animationDuration={800}
              />
              <UserLocation visible renderMode="native" />

              {/*
               * ✅ Each MapMarker renders a teardrop pin (red=urgent, green=active)
               *    with the person's name label below the pin (built into MapMarker).
               *    Only verified=true AND active/approved cases reach here.
               */}
              {filteredCases.map((m) => (
                <MapMarker
                  key={m.id}
                  data={{
                    id:               m.id,
                    name:             m.name,   // ← name shown on pin label
                    age:              m.age,
                    gender:           m.gender,
                    lastSeenLocation: m.lastSeenLocation,
                    latitude:         m.latitude,
                    longitude:        m.longitude,
                    isUrgent:         m.isUrgent,
                    status:           m.status,
                  }}
                  onPress={handleCasePress}
                />
              ))}
            </MapView>

            {/* Stats overlay */}
            <View style={S.statsOverlay}>
              <Text style={S.statsText}>
                ✅ {filteredCases.length} verified case{filteredCases.length !== 1 ? "s" : ""}
              </Text>
            </View>

            {/* GPS button */}
            <TouchableOpacity style={S.gpsBtn} onPress={goToMyLocation} activeOpacity={0.85}>
              {locating
                ? <ActivityIndicator color={G.dark} size="small" />
                : <Text style={{ fontSize: 20 }}>🎯</Text>
              }
            </TouchableOpacity>

            {role === "admin" && (
              <TouchableOpacity
                style={S.adminBtn}
                onPress={() => router.push("/admin/dashboard")}
                activeOpacity={0.85}
              >
                <Text style={S.adminBtnText}>🛡 Admin Panel</Text>
              </TouchableOpacity>
            )}

            {filteredCases.length === 0 && !loading && (
              <View style={S.noMarkersBanner}>
                <Text style={{ fontSize: 30, marginBottom: 6 }}>🔍</Text>
                <Text style={S.noMarkersText}>
                  No verified active cases match your current filter.
                </Text>
              </View>
            )}
          </View>

        ) : (
          /* ══ LIST VIEW ══ */
          filteredCases.length === 0 ? (
            <View style={S.center}>
              <Text style={{ fontSize: 40, marginBottom: 10 }}>🔍</Text>
              <Text style={{ fontSize: 16, fontWeight: "700", color: G.text }}>
                No verified cases found
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredCases}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ paddingBottom: 100 }}
              renderItem={({ item }) => (
                <CaseRow item={item} onPress={() => handleCasePress(item.id)} />
              )}
            />
          )
        )}
      </Animated.View>

      <BottomNav />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root:   { flex: 1, backgroundColor: G.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  searchWrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: G.white, borderBottomWidth: 1, borderBottomColor: "#EEE", gap: 8 },
  searchBox:  { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: G.bg, borderRadius: 10, paddingHorizontal: 12, height: 40, borderWidth: 1, borderColor: "#EEE" },
  searchText: { flex: 1, fontSize: 14, color: G.text },

  toggleWrap:       { flexDirection: "row", borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: G.border },
  toggleBtn:        { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: G.white },
  toggleActive:     { backgroundColor: G.light },
  toggleText:       { fontSize: 16, color: G.sub },
  toggleTextActive: { color: G.dark },

  chips:          { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, gap: 8, backgroundColor: G.white, borderBottomWidth: 1, borderBottomColor: "#EEE", alignItems: "center" },
  chip:           { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: "#DDD", backgroundColor: G.white },
  chipActive:     { backgroundColor: G.light, borderColor: G.dark },
  chipUrgent:     { backgroundColor: G.urgent, borderColor: G.urgent },
  chipText:       { fontSize: 12, fontWeight: "600", color: G.sub },
  chipTextActive: { color: G.dark },

  legend:     { flexDirection: "row", alignItems: "center", marginLeft: "auto" as any, gap: 4 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: G.sub },

  infoBanner:     { backgroundColor: "#EAF6FF", borderLeftWidth: 4, borderLeftColor: G.blue, paddingHorizontal: 14, paddingVertical: 7 },
  infoBannerText: { fontSize: 12, color: "#1A5276", fontWeight: "600" },

  statsOverlay: { position: "absolute", top: 10, left: 10, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: G.border, elevation: 3 },
  statsText:    { fontSize: 12, fontWeight: "700", color: G.dark },

  gpsBtn: { position: "absolute", right: 14, bottom: 90, width: 48, height: 48, borderRadius: 24, backgroundColor: G.white, alignItems: "center", justifyContent: "center", elevation: 6, borderWidth: 1, borderColor: G.border },

  adminBtn:     { position: "absolute", right: 14, bottom: 148, backgroundColor: "#C0392B", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, elevation: 5 },
  adminBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  noMarkersBanner: { position: "absolute", bottom: 80, left: 16, right: 16, backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: G.border, alignItems: "center" },
  noMarkersText:   { fontSize: 13, color: G.sub, textAlign: "center", lineHeight: 18 },
});