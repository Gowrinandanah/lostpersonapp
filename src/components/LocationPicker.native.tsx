import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Modal, Alert, Platform,
  TextInput, FlatList, Keyboard,
} from "react-native";
import MapView, {
  Marker, UrlTile, Polygon, MapPressEvent, PROVIDER_DEFAULT,
} from "react-native-maps";
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
};

const DEFAULT_REGION = {
  latitude: 10.8505, longitude: 76.2711,
  latitudeDelta: 0.05, longitudeDelta: 0.05,
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
  const mapRef      = useRef<any>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [visible,       setVisible]       = useState(false);
  const [marker,        setMarker]        = useState<{ latitude: number; longitude: number } | null>(null);
  const [resolved,      setResolved]      = useState("");
  const [resolving,     setResolving]     = useState(false);
  const [locating,      setLocating]      = useState(false);
  const [region,        setRegion]        = useState(DEFAULT_REGION);
  const [confirmed,     setConfirmed]     = useState(initialAddress);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching,     setSearching]     = useState(false);
  const [showResults,   setShowResults]   = useState(false);
  const [highlight,     setHighlight]     = useState<{
    minLat: number; maxLat: number; minLng: number; maxLng: number;
  } | null>(null);

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
          setRegion({
            latitude: loc.coords.latitude, longitude: loc.coords.longitude,
            latitudeDelta: 0.05, longitudeDelta: 0.05,
          });
        }
      } catch (_) {}
    })();
  }, [visible]);

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
    if (results.length === 0) {
      Alert.alert("Not found", "No results found. Try a different search.");
      return;
    }
    setSearchResults(results);
    handleSelectResult(results[0]);
  };

  const handleSelectResult = (result: SearchResult) => {
    Keyboard.dismiss();
    setShowResults(false);
    setSearchQuery(result.display_name.split(",").slice(0, 2).join(", "));

    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    let newRegion = {
      latitude: lat, longitude: lng,
      latitudeDelta: 0.01, longitudeDelta: 0.01,
    };

    if (result.boundingbox && result.boundingbox.length === 4) {
      const minLat = parseFloat(result.boundingbox[0]);
      const maxLat = parseFloat(result.boundingbox[1]);
      const minLng = parseFloat(result.boundingbox[2]);
      const maxLng = parseFloat(result.boundingbox[3]);

      const latDelta = Math.max((maxLat - minLat) * 1.4, 0.005);
      const lngDelta = Math.max((maxLng - minLng) * 1.4, 0.005);

      setHighlight({ minLat, maxLat, minLng, maxLng });

      newRegion = {
        latitude:      (minLat + maxLat) / 2,
        longitude:     (minLng + maxLng) / 2,
        latitudeDelta:  latDelta,
        longitudeDelta: lngDelta,
      };
    } else {
      setHighlight(null);
    }

    setRegion(newRegion);
    setTimeout(() => {
      mapRef.current?.animateToRegion(newRegion, 800);
    }, 100);
  };

  const placePin = async (lat: number, lng: number) => {
    setHighlight(null);
    setMarker({ latitude: lat, longitude: lng });
    setResolving(true);
    const addr = await reverseGeocode(lat, lng);
    setResolved(addr);
    setResolving(false);
  };

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
      const r = { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      setRegion(r);
      setTimeout(() => mapRef.current?.animateToRegion(r, 700), 100);
      await placePin(latitude, longitude);
    } catch {
      Alert.alert("Error", "Could not get current location.");
    } finally {
      setLocating(false);
    }
  };

  const handleConfirm = () => {
    if (!marker) {
      Alert.alert("No location", "Tap the map to drop a pin first.");
      return;
    }
    const addr = resolved || `${marker.latitude.toFixed(5)}, ${marker.longitude.toFixed(5)}`;
    setConfirmed(addr);
    onConfirm({ address: addr, lat: marker.latitude, lng: marker.longitude });
    setVisible(false);
  };

  return (
    <>
      {/* Trigger button */}
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

      {/* Full-screen map modal */}
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

          {/* Map — PROVIDER_DEFAULT + UrlTile FIRST child = tiles always render */}
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            provider={PROVIDER_DEFAULT}
            mapType="none"
            region={region}
            onRegionChangeComplete={setRegion}
            showsUserLocation
            showsMyLocationButton={false}
            onPress={(e: MapPressEvent) => {
              Keyboard.dismiss();
              setShowResults(false);
              placePin(
                e.nativeEvent.coordinate.latitude,
                e.nativeEvent.coordinate.longitude
              );
            }}
          >
            {/* UrlTile MUST be first child for tiles to render */}
            <UrlTile
              urlTemplate="https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
              maximumZ={19}
              flipY={false}
              zIndex={-1}
            />

            {/* Bounding box highlight after search */}
            {highlight && (
              <Polygon
                coordinates={[
                  { latitude: highlight.minLat, longitude: highlight.minLng },
                  { latitude: highlight.maxLat, longitude: highlight.minLng },
                  { latitude: highlight.maxLat, longitude: highlight.maxLng },
                  { latitude: highlight.minLat, longitude: highlight.maxLng },
                ]}
                strokeColor="#2ECC71"
                strokeWidth={3}
                fillColor="rgba(46,204,113,0.12)"
              />
            )}

            {marker && (
              <Marker
                coordinate={marker}
                pinColor={pinColor}
                title="Selected Location"
              />
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

  gpsBtn:  { position: "absolute", right: 14, bottom: 210, width: 48, height: 48, borderRadius: 24, backgroundColor: G.white, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 6, borderWidth: 1, borderColor: G.border },

  sheet:          { backgroundColor: G.white, paddingHorizontal: 20, paddingTop: 16, paddingBottom: Platform.OS === "ios" ? 40 : 20, borderTopWidth: 1, borderTopColor: "#EEEEEE", minHeight: 150 },
  sheetLabel:     { fontSize: 10, fontWeight: "800", color: G.sub, letterSpacing: 1, marginBottom: 6 },
  sheetAddr:      { fontSize: 15, fontWeight: "600", color: G.text, marginBottom: 14, lineHeight: 21 },
  confirmBtn:     { backgroundColor: G.primary, borderRadius: 12, height: 50, alignItems: "center", justifyContent: "center", shadowColor: G.dark, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  confirmBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});