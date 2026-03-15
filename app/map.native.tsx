import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  FlatList,
  Animated,
  Platform,
} from "react-native";
import MapView, { Marker, UrlTile, Callout } from "react-native-maps";
import * as Location from "expo-location";
import { router, Stack } from "expo-router";
import { Timestamp } from "firebase/firestore";
import { SafeAreaView } from "react-native-safe-area-context";
import { getMissingPersons } from "../src/firebase/firestoreService";
import BottomNav from "../src/components/BottomNav";

const G = {
  primary: "#2ECC71", dark: "#27AE60", light: "#EAFAF1", border: "#D5F5E3",
  white:   "#FFFFFF", bg:   "#F7F8FA", text:  "#1A1A1A", sub:   "#666666",
  muted:   "#AAAAAA", urgent: "#E74C3C", orange: "#E67E22",
};

const DEFAULT_REGION = {
  latitude:      10.8505,
  longitude:     76.2711,
  latitudeDelta:  5,
  longitudeDelta: 5,
};

interface MissingPerson {
  id: string; name: string; age: number; gender: string;
  lastSeenLocation: string; status: string; createdAt: Timestamp | null;
  coordinates?: { latitude: number; longitude: number } | null;
  lastSeenLat?: number | null; lastSeenLng?: number | null;
  isUrgentFlag?: boolean;
  isVulnerable?: boolean;
}

interface MapMarker {
  id: string; name: string; age: number; gender: string;
  lastSeenLocation: string; latitude: number; longitude: number;
  isUrgent: boolean; status: string;
}

function isUrgent(p: MissingPerson): boolean {
  if (p.isUrgentFlag) return true;
  if (p.isVulnerable) return true;
  if (p.age < 18 || p.age > 65) return true;
  if (p.createdAt) {
    const d = p.createdAt instanceof Timestamp ? p.createdAt.toDate() : null;
    return d ? Date.now() - d.getTime() < 48 * 3600 * 1000 : false;
  }
  return false;
}

// ── List row (shown in bottom panel) ─────────────────────────────────────────

const CaseRow = ({ item, onPress }: { item: MapMarker; onPress: () => void }) => (
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
      <Text style={rowS.location} numberOfLines={1}>📍 {item.lastSeenLocation}</Text>
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
  location:      { fontSize: 11, color: G.muted },
});

// ── Toggle: Map / List ────────────────────────────────────────────────────────

type ViewMode = "map" | "list";

export default function MapScreen() {
  const mapRef = useRef<any>(null);

  const [markers,  setMarkers]  = useState<MapMarker[]>([]);
  const [filtered, setFiltered] = useState<MapMarker[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState<"all" | "urgent">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [locating, setLocating] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    const unsub = getMissingPersons((data) => {
      const persons = data as MissingPerson[];
      const mapped: MapMarker[] = persons
        .filter((p) => {
          // Accept coordinates from either field shape
          const lat = p.coordinates?.latitude  ?? p.lastSeenLat;
          const lng = p.coordinates?.longitude ?? p.lastSeenLng;
          return lat != null && lng != null;
        })
        .map((p) => ({
          id:               p.id,
          name:             p.name,
          age:              p.age,
          gender:           p.gender,
          lastSeenLocation: p.lastSeenLocation,
          latitude:         p.coordinates?.latitude  ?? p.lastSeenLat!,
          longitude:        p.coordinates?.longitude ?? p.lastSeenLng!,
          isUrgent:         isUrgent(p),
          status:           p.status,
        }));
      setMarkers(mapped);
      setFiltered(mapped);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    let result = markers;
    if (filter === "urgent") result = result.filter((m) => m.isUrgent);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.lastSeenLocation.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [search, filter, markers]);

  const goToMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({});
      mapRef.current?.animateToRegion({
        latitude:      loc.coords.latitude,
        longitude:     loc.coords.longitude,
        latitudeDelta:  0.05,
        longitudeDelta: 0.05,
      }, 800);
    } catch (_) {}
    finally { setLocating(false); }
  };

  const urgentCount = markers.filter((m) => m.isUrgent).length;

  return (
    <SafeAreaView style={S.root}>
      <Stack.Screen options={{
        title: "Active Cases Map",
        headerStyle: { backgroundColor: G.dark },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
        headerBackTitle: "",
      }} />

      {/* ── Search bar ── */}
      <View style={S.searchWrap}>
        <View style={S.searchBox}>
          <Text style={{ fontSize: 14, marginRight: 6 }}>🔍</Text>
          <TextInput
            style={S.searchText}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or location..."
            placeholderTextColor={G.muted}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Text style={{ color: G.muted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        {/* Map / List toggle */}
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

      {/* ── Filter chips ── */}
      <View style={S.chips}>
        <TouchableOpacity
          style={[S.chip, filter === "all" && S.chipActive]}
          onPress={() => setFilter("all")}
        >
          <Text style={[S.chipText, filter === "all" && S.chipTextActive]}>
            All ({markers.length})
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

        {/* Legend */}
        <View style={S.legend}>
          <View style={[S.legendDot, { backgroundColor: G.urgent }]} />
          <Text style={S.legendText}>Missing</Text>
          <View style={[S.legendDot, { backgroundColor: G.orange, marginLeft: 8 }]} />
          <Text style={S.legendText}>Sighting</Text>
        </View>
      </View>

      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>

        {loading ? (
          <View style={S.center}>
            <ActivityIndicator color={G.primary} size="large" />
            <Text style={{ color: G.sub, marginTop: 8 }}>Loading cases…</Text>
          </View>
        ) : viewMode === "map" ? (

          /* ── MAP VIEW ── */
          <View style={{ flex: 1 }}>
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              initialRegion={DEFAULT_REGION}
              mapType="none"
              showsUserLocation
              showsMyLocationButton={false}
            >
              {/* CartoDB Voyager — free, no API key, no app blocking */}
              <UrlTile
                urlTemplate="https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
                maximumZ={19}
                flipY={false}
              />

              {/* 🔴 Missing persons — last seen pins */}
              {filtered.map((m) => (
                <Marker
                  key={`missing-${m.id}`}
                  coordinate={{ latitude: m.latitude, longitude: m.longitude }}
                  pinColor={m.isUrgent ? G.urgent : G.dark}
                >
                  <Callout onPress={() => router.push({ pathname: "/case-details", params: { id: m.id } })}>
                    <View style={S.callout}>
                      <Text style={S.calloutName}>{m.name}</Text>
                      <Text style={S.calloutMeta}>Age {m.age} · {m.gender}</Text>
                      <Text style={S.calloutLocation} numberOfLines={2}>
                        📍 {m.lastSeenLocation}
                      </Text>
                      {m.isUrgent && (
                        <View style={S.calloutUrgent}>
                          <Text style={S.calloutUrgentText}>⚠ URGENT — Missing &lt;48hrs</Text>
                        </View>
                      )}
                      <Text style={S.calloutTap}>Tap to view details →</Text>
                    </View>
                  </Callout>
                </Marker>
              ))}
            </MapView>

            {/* Stats overlay */}
            <View style={S.statsOverlay}>
              <Text style={S.statsText}>
                📍 {filtered.length} case{filtered.length !== 1 ? "s" : ""} on map
              </Text>
            </View>

            {/* GPS button */}
            <TouchableOpacity style={S.gpsBtn} onPress={goToMyLocation} activeOpacity={0.85}>
              {locating
                ? <ActivityIndicator color={G.dark} size="small" />
                : <Text style={{ fontSize: 20 }}>🎯</Text>
              }
            </TouchableOpacity>

            {/* No pins note */}
            {filtered.length === 0 && (
              <View style={S.noMarkersBanner}>
                <Text style={S.noMarkersText}>
                  No cases match your filter. Pinned reports will appear here.
                </Text>
              </View>
            )}
          </View>

        ) : (

          /* ── LIST VIEW ── */
          filtered.length === 0 ? (
            <View style={S.center}>
              <Text style={{ fontSize: 40, marginBottom: 10 }}>🔍</Text>
              <Text style={{ fontSize: 16, fontWeight: "700", color: G.text }}>No cases found</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ paddingBottom: 100 }}
              renderItem={({ item }) => (
                <CaseRow
                  item={item}
                  onPress={() =>
                    router.push({ pathname: "/case-details", params: { id: item.id } })
                  }
                />
              )}
            />
          )
        )}
      </Animated.View>

      <BottomNav />
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bg },

  searchWrap: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: G.white,
    borderBottomWidth: 1, borderBottomColor: "#EEEEEE",
    gap: 8,
  },
  searchBox:  { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: G.bg, borderRadius: 10, paddingHorizontal: 12, height: 40, borderWidth: 1, borderColor: "#EEEEEE" },
  searchText: { flex: 1, fontSize: 14, color: G.text },

  toggleWrap:      { flexDirection: "row", borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: G.border },
  toggleBtn:       { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: G.white },
  toggleActive:    { backgroundColor: G.light },
  toggleText:      { fontSize: 16, color: G.sub },
  toggleTextActive:{ color: G.dark },

  chips:     { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, gap: 8, backgroundColor: G.white, borderBottomWidth: 1, borderBottomColor: "#EEEEEE", alignItems: "center" },
  chip:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: "#DDDDDD", backgroundColor: G.white },
  chipActive:{ backgroundColor: G.light, borderColor: G.dark },
  chipUrgent:{ backgroundColor: G.urgent, borderColor: G.urgent },
  chipText:  { fontSize: 12, fontWeight: "600", color: G.sub },
  chipTextActive: { color: G.dark },

  legend:    { flexDirection: "row", alignItems: "center", marginLeft: "auto" as any, gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText:{ fontSize: 10, color: G.sub },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Map overlays
  statsOverlay: {
    position: "absolute", top: 10, left: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: G.border,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  statsText: { fontSize: 12, fontWeight: "700", color: G.dark },

  gpsBtn: {
    position: "absolute", right: 14, bottom: 90,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: G.white,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6,
    elevation: 6, borderWidth: 1, borderColor: G.border,
  },

  noMarkersBanner: {
    position: "absolute", bottom: 80, left: 16, right: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: G.border,
    alignItems: "center",
  },
  noMarkersText: { fontSize: 13, color: G.sub, textAlign: "center" },

  // Callout
  callout:          { width: 200, padding: 4 },
  calloutName:      { fontSize: 14, fontWeight: "800", color: G.text, marginBottom: 2 },
  calloutMeta:      { fontSize: 12, color: G.sub, marginBottom: 2 },
  calloutLocation:  { fontSize: 11, color: G.muted, marginBottom: 4 },
  calloutUrgent:    { backgroundColor: "#FDECEA", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4 },
  calloutUrgentText:{ fontSize: 10, fontWeight: "800", color: G.urgent },
  calloutTap:       { fontSize: 11, color: G.primary, fontWeight: "700", textAlign: "right" },
});