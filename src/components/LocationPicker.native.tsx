// src/components/LocationPicker.native.tsx
//
// Full-screen map modal for picking a location.
// 100% Google-free — uses @maplibre/maplibre-react-native + Nominatim.
//
// Features:
//   • Search bar (Nominatim) with live dropdown results
//   • Tap anywhere on the map to drop a pin
//   • Bounding-box highlight after a search result is selected
//   • GPS button (expo-location) to jump to current position
//   • Reverse-geocode the pin via Nominatim and show the resolved address
//   • Confirm → calls onConfirm({ address, lat, lng })

import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Modal, Alert, Platform,
  TextInput, FlatList, Keyboard,
} from "react-native";
import {
  MapView,
  Camera,
  CameraRef,
  PointAnnotation,
  UserLocation,
} from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";

// ── Exported types ────────────────────────────────────────────────────────────

export interface LocationResult {
  address: string;
  lat: number;
  lng: number;
}

export interface LocationPickerProps {
  label?: string;
  pinColor?: string;
  initialAddress?: string;
  onConfirm: (result: LocationResult) => void;
}

interface SearchResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string];
}

// ── Palette ───────────────────────────────────────────────────────────────────

const G = {
  primary: "#2ECC71", dark: "#27AE60", light: "#EAFAF1",
  border:  "#D5F5E3", white: "#FFFFFF", text: "#1A1A1A",
  sub:     "#666666", muted: "#AAAAAA",
  urgent:  "#E74C3C", orange: "#E67E22",
};

// ── Default map centre (Kerala) ───────────────────────────────────────────────

const DEFAULT_CENTER: [number, number] = [76.2711, 10.8505]; // [lng, lat] GeoJSON order
const DEFAULT_ZOOM = 8;

// ── CartoDB Voyager style — no API key ────────────────────────────────────────

const OSM_MAP_STYLE = {
  version: 8 as const,
  sources: {
    "carto-voyager": {
      type: "raster" as const,
      tiles: ["https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id:     "carto-voyager-layer",
      type:   "raster" as const,
      source: "carto-voyager",
    },
  ],
};

// ── Nominatim helpers ─────────────────────────────────────────────────────────

async function searchPlaces(query: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
      { headers: { "Accept-Language": "en", "User-Agent": "LostPersonAlert/1.0" } }
    );
    return await res.json();
  } catch {
    return [];
  }
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "en", "User-Agent": "LostPersonAlert/1.0" } }
    );
    const json = await res.json();
    if (json?.display_name) {
      return json.display_name.split(",").slice(0, 3).map((s: string) => s.trim()).join(", ");
    }
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LocationPicker({
  label = "Pin Location on Map",
  pinColor = "red",
  onConfirm,
  initialAddress = "",
}: LocationPickerProps) {
  const cameraRef   = useRef<CameraRef>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [visible,       setVisible]       = useState(false);
  const [marker,        setMarker]        = useState<{ lat: number; lng: number } | null>(null);
  const [resolved,      setResolved]      = useState("");
  const [resolving,     setResolving]     = useState(false);
  const [locating,      setLocating]      = useState(false);
  const [confirmed,     setConfirmed]     = useState(initialAddress);

  // Camera state
  const [camCenter, setCamCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [camZoom,   setCamZoom]   = useState(DEFAULT_ZOOM);

  // Search state
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching,     setSearching]     = useState(false);
  const [showResults,   setShowResults]   = useState(false);

  // On modal open: request location + reset search
  useEffect(() => {
    if (!visible) return;
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({});
          setCamCenter([loc.coords.longitude, loc.coords.latitude]);
          setCamZoom(13);
        }
      } catch (_) {}
    })();
  }, [visible]);

  // ── Search ────────────────────────────────────────────────────────────────

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setShowResults(false);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 3) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchPlaces(text);
      setSearchResults(results);
      setShowResults(results.length > 0);
      setSearching(false);
    }, 500);
  };

  const handleSubmitSearch = async () => {
    if (searchQuery.trim().length < 3) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearching(true);
    setShowResults(false);
    const results = await searchPlaces(searchQuery);
    setSearching(false);
    if (!results.length) {
      Alert.alert("Not found", "No results found. Try a different search.");
      return;
    }
    handleSelectResult(results[0]);
  };

  const handleSelectResult = (result: SearchResult) => {
    Keyboard.dismiss();
    setShowResults(false);
    setSearchQuery(result.display_name.split(",").slice(0, 2).join(", "));

    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    let zoom = 13;
    if (result.boundingbox?.length === 4) {
      const minLat = parseFloat(result.boundingbox[0]);
      const maxLat = parseFloat(result.boundingbox[1]);
      const minLng = parseFloat(result.boundingbox[2]);
      const maxLng = parseFloat(result.boundingbox[3]);
      const latSpan = maxLat - minLat;
      const lngSpan = maxLng - minLng;
      // rough zoom from bounding-box span
      zoom = Math.max(5, Math.min(15, 13 - Math.log2(Math.max(latSpan, lngSpan) * 10)));
    }

    setCamCenter([lng, lat]);
    setCamZoom(zoom);
  };

  // ── Pin placement + reverse geocode ──────────────────────────────────────

  const placePin = async (lat: number, lng: number) => {
    setMarker({ lat, lng });
    setResolving(true);
    const addr = await reverseGeocode(lat, lng);
    setResolved(addr);
    setResolving(false);
  };

  // ── GPS ──────────────────────────────────────────────────────────────────

  const goToGPS = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Location access is required.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      setCamCenter([longitude, latitude]);
      setCamZoom(15);
      await placePin(latitude, longitude);
    } catch {
      Alert.alert("Error", "Could not get current location.");
    } finally {
      setLocating(false);
    }
  };

  // ── Confirm ───────────────────────────────────────────────────────────────

  const handleConfirm = () => {
    if (!marker) {
      Alert.alert("No location", "Tap the map to drop a pin first.");
      return;
    }
    const addr = resolved || `${marker.lat.toFixed(5)}, ${marker.lng.toFixed(5)}`;
    setConfirmed(addr);
    onConfirm({ address: addr, lat: marker.lat, lng: marker.lng });
    setVisible(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Trigger button ── */}
      <TouchableOpacity style={S.trigger} onPress={() => setVisible(true)} activeOpacity={0.85}>
        <Text style={S.triggerIcon}>📍</Text>
        <View style={{ flex: 1 }}>
          <Text style={[S.triggerText, !confirmed && S.triggerPlaceholder]}>
            {confirmed || "Tap to pin location on map"}
          </Text>
          {!!confirmed && <Text style={S.triggerHint}>Tap to change</Text>}
        </View>
        <Text style={{ fontSize: 18, color: G.muted }}>›</Text>
      </TouchableOpacity>

      {/* ── Full-screen map modal ── */}
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setVisible(false)}
      >
        <View style={{ flex: 1 }}>

          {/* Header */}
          <View style={S.modalHeader}>
            <TouchableOpacity onPress={() => setVisible(false)} style={S.closeBtn}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
            <Text style={S.modalTitle}>{label}</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Search bar */}
          <View style={S.searchWrap}>
            <View style={S.searchBox}>
              <Text style={S.searchIcon}>🔍</Text>
              <TextInput
                style={S.searchInput}
                value={searchQuery}
                onChangeText={handleSearchChange}
                placeholder="Search a place, road or area…"
                placeholderTextColor={G.muted}
                returnKeyType="search"
                onSubmitEditing={handleSubmitSearch}
              />
              {searching && (
                <ActivityIndicator size="small" color={G.dark} style={{ marginRight: 8 }} />
              )}
              {searchQuery.length > 0 && !searching && (
                <TouchableOpacity
                  onPress={() => { setSearchQuery(""); setSearchResults([]); setShowResults(false); }}
                  style={{ paddingHorizontal: 10 }}
                >
                  <Text style={{ fontSize: 15, color: G.muted }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Results dropdown */}
            {showResults && (
              <View style={S.dropdown}>
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.place_id}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      style={[
                        S.dropdownItem,
                        index < searchResults.length - 1 && S.dropdownDivider,
                      ]}
                      onPress={() => handleSelectResult(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={S.dropdownIcon}>📍</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={S.dropdownMain} numberOfLines={1}>
                          {item.display_name.split(",")[0]}
                        </Text>
                        <Text style={S.dropdownSub} numberOfLines={1}>
                          {item.display_name.split(",").slice(1, 3).join(", ")}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}
          </View>

          {/* Instruction bar */}
          <View style={S.instruction}>
            <Text style={S.instructionText}>📌 Tap anywhere on the map to drop a pin</Text>
          </View>

          {/* ── MapLibre map ── */}
          <MapView
            style={{ flex: 1 }}
            mapStyle={OSM_MAP_STYLE}
            logoEnabled={false}
            attributionEnabled={false}
            onPress={(feature) => {
              // MapLibre onPress passes a GeoJSON Feature
              Keyboard.dismiss();
              setShowResults(false);
              const [lng, lat] = (feature as any).geometry.coordinates as [number, number];
              placePin(lat, lng);
            }}
          >
            {/* Controlled camera */}
            <Camera
              ref={cameraRef}
              centerCoordinate={camCenter}
              zoomLevel={camZoom}
              animationMode="flyTo"
              animationDuration={700}
            />

            {/* User location */}
            <UserLocation visible renderMode="native" />

            {/* Dropped pin */}
            {marker && (
              <PointAnnotation
                id="selected-pin"
                coordinate={[marker.lng, marker.lat]}
                title="Selected Location"
              >
                {/* Simple coloured circle pin */}
                <View style={[S.pin, { backgroundColor: pinColor === "red" ? G.urgent : G.orange }]} />
              </PointAnnotation>
            )}
          </MapView>

          {/* GPS floating button */}
          <TouchableOpacity style={S.gpsBtn} onPress={goToGPS} activeOpacity={0.85}>
            {locating
              ? <ActivityIndicator color={G.dark} size="small" />
              : <Text style={{ fontSize: 22 }}>🎯</Text>
            }
          </TouchableOpacity>

          {/* Bottom sheet */}
          <View style={S.sheet}>
            {marker ? (
              <>
                <Text style={S.sheetLabel}>SELECTED LOCATION</Text>
                {resolving ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <ActivityIndicator color={G.primary} size="small" />
                    <Text style={{ color: G.sub }}>Resolving address…</Text>
                  </View>
                ) : (
                  <Text style={S.sheetAddr} numberOfLines={2}>📍 {resolved}</Text>
                )}
                <TouchableOpacity
                  style={[S.confirmBtn, resolving && { opacity: 0.5 }]}
                  onPress={handleConfirm}
                  disabled={resolving}
                  activeOpacity={0.85}
                >
                  <Text style={S.confirmBtnText}>✓  Confirm Location</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={{ alignItems: "center", paddingVertical: 10 }}>
                <Text style={{ fontSize: 32, marginBottom: 6 }}>🗺️</Text>
                <Text style={{ fontSize: 14, color: G.sub, textAlign: "center" }}>
                  Search above or tap the map to mark the location
                </Text>
              </View>
            )}
          </View>

        </View>
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  trigger:            { flexDirection: "row", alignItems: "center", backgroundColor: G.white, borderWidth: 1.5, borderColor: "#E0E0E0", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  triggerIcon:        { fontSize: 20 },
  triggerText:        { fontSize: 15, color: G.text, fontWeight: "500" },
  triggerPlaceholder: { color: G.muted },
  triggerHint:        { fontSize: 11, color: G.sub, marginTop: 2 },

  modalHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: G.dark, paddingTop: Platform.OS === "ios" ? 54 : 16, paddingBottom: 14, paddingHorizontal: 16 },
  closeBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  modalTitle:   { fontSize: 16, fontWeight: "700", color: "#fff", flex: 1, textAlign: "center" },

  searchWrap:  { backgroundColor: G.white, paddingHorizontal: 12, paddingVertical: 8, zIndex: 10, elevation: 10 },
  searchBox:   { flexDirection: "row", alignItems: "center", backgroundColor: "#F5F5F5", borderRadius: 10, borderWidth: 1, borderColor: "#E8E8E8", paddingLeft: 10, height: 44 },
  searchIcon:  { fontSize: 16, marginRight: 6 },
  searchInput: { flex: 1, fontSize: 14, color: G.text, paddingVertical: 0 },

  dropdown:        { position: "absolute", top: 52, left: 0, right: 0, backgroundColor: G.white, borderRadius: 12, borderWidth: 1, borderColor: "#E0E0E0", maxHeight: 220, zIndex: 20, elevation: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 },
  dropdownItem:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  dropdownDivider: { borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  dropdownIcon:    { fontSize: 16 },
  dropdownMain:    { fontSize: 14, fontWeight: "600", color: G.text },
  dropdownSub:     { fontSize: 12, color: G.sub, marginTop: 2 },

  instruction:     { backgroundColor: G.light, paddingVertical: 7, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: G.border },
  instructionText: { fontSize: 12, color: G.dark, fontWeight: "600", textAlign: "center" },

  // Simple circular pin rendered as a PointAnnotation child
  pin: { width: 20, height: 20, borderRadius: 10, borderWidth: 2.5, borderColor: "#fff" },

  gpsBtn:  { position: "absolute", right: 14, bottom: 210, width: 48, height: 48, borderRadius: 24, backgroundColor: G.white, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 6, borderWidth: 1, borderColor: G.border },

  sheet:          { backgroundColor: G.white, paddingHorizontal: 20, paddingTop: 16, paddingBottom: Platform.OS === "ios" ? 40 : 20, borderTopWidth: 1, borderTopColor: "#EEEEEE", minHeight: 150 },
  sheetLabel:     { fontSize: 10, fontWeight: "800", color: G.sub, letterSpacing: 1, marginBottom: 6 },
  sheetAddr:      { fontSize: 15, fontWeight: "600", color: G.text, marginBottom: 14, lineHeight: 21 },
  confirmBtn:     { backgroundColor: G.primary, borderRadius: 12, height: 50, alignItems: "center", justifyContent: "center", shadowColor: G.dark, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  confirmBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});