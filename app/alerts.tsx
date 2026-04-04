// app/alerts.tsx

import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, TouchableOpacity, Image, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import BottomNav from "../src/components/BottomNav";
import { useAlerts } from "../src/hooks/useAlerts";

const G = {
  primary: "#16A34A",
  bg:      "#F3F4F6",
  white:   "#FFFFFF",
  border:  "#E5E7EB",
  sub:     "#6B7280",
  urgent:  "#E74C3C",
};

export default function AlertsScreen() {
  const { alerts, loading, error } = useAlerts();
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? alerts.filter((c) => {
        const s = search.toLowerCase();
        return (
          c.name?.toLowerCase().includes(s) ||
          c.lastSeenLocation?.toLowerCase().includes(s)
        );
      })
    : alerts;

  if (loading) {
    return (
      <SafeAreaView style={S.center}>
        <ActivityIndicator size="large" color={G.primary} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={S.center}>
        <Text style={S.errorText}>{error}</Text>
        <Text style={S.errorSub}>Check your Firestore composite indexes.</Text>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={S.root}>

        {/* HEADER */}
        <View style={S.header}>
          <View style={S.headerTopRow}>
            <Text style={S.title}>🚨 Active Alerts</Text>
            <View style={S.countBadge}>
              <Text style={S.countText}>{filtered.length}</Text>
            </View>
          </View>
          <TextInput
            style={S.search}
            placeholder="Search by name or location..."
            placeholderTextColor="rgba(255,255,255,0.65)"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {filtered.length === 0 ? (
          <View style={S.center}>
            <Text style={{ fontSize: 40 }}>✅</Text>
            <Text style={S.emptyTitle}>
              {search ? "No results found" : "No active alerts"}
            </Text>
            <Text style={S.emptySub}>
              {search
                ? "Try a different search term"
                : "Verified missing person cases will appear here"}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[S.card, item.isUrgentFlag && S.cardUrgent]}
                onPress={() =>
                  router.push({ pathname: "/case-details", params: { id: item.id } })
                }
                activeOpacity={0.85}
              >
                {/* IMAGE */}
                {item.photoUrl ? (
                  <Image source={{ uri: item.photoUrl }} style={S.image} />
                ) : (
                  <View style={[S.image, S.imagePlaceholder]}>
                    <Text style={{ fontSize: 28 }}>👤</Text>
                  </View>
                )}

                {/* INFO */}
                <View style={{ flex: 1, padding: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={S.name}>{item.name}</Text>
                    {item.isUrgentFlag && (
                      <View style={S.urgentBadge}>
                        <Text style={S.urgentText}>🔥 URGENT</Text>
                      </View>
                    )}
                    {item.isVulnerable && (
                      <View style={S.vulnerableBadge}>
                        <Text style={S.vulnerableText}>⚠️ VULNERABLE</Text>
                      </View>
                    )}
                  </View>

                  <Text style={S.meta}>{item.age} yrs • {item.gender}</Text>
                  <Text style={S.meta} numberOfLines={1}>
                    📍 {item.lastSeenLocation}
                  </Text>

                  {/* Distance info if coordinates exist */}
                  {item.lastSeenLat != null && item.lastSeenLng != null && (
                    <Text style={S.metaCoords}>
                      🗺 {item.lastSeenLat.toFixed(4)}, {item.lastSeenLng.toFixed(4)}
                    </Text>
                  )}

                  <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                    <View style={S.badge}>
                      <Text style={S.badgeText}>ACTIVE</Text>
                    </View>
                    <View style={S.verifiedBadge}>
                      <Text style={S.verifiedText}>✓ VERIFIED</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        <BottomNav />
      </SafeAreaView>
    </>
  );
}

const S = StyleSheet.create({
  root:   { flex: 1, backgroundColor: G.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },

  header: {
    backgroundColor: "#16A34A",
    padding: 16,
    paddingBottom: 20,
  },
  headerTopRow: {
    flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10,
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "900" },
  countBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 2,
  },
  countText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  search: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 10, padding: 10,
    color: "#fff", fontSize: 13,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
  },

  card: {
    flexDirection: "row", backgroundColor: G.white,
    borderRadius: 12, overflow: "hidden",
    borderWidth: 1, borderColor: G.border,
    elevation: 2, shadowColor: "#000",
    shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  cardUrgent: { borderColor: "#FBBCB8", borderWidth: 1.5 },

  image: { width: 90, height: 110 },
  imagePlaceholder: {
    backgroundColor: "#EAFAF1", alignItems: "center", justifyContent: "center",
  },

  name: { fontSize: 15, fontWeight: "800", color: "#1A1A1A" },
  meta: { fontSize: 12, color: G.sub, marginTop: 2 },
  metaCoords: { fontSize: 10, color: "#9CA3AF", marginTop: 2, fontFamily: "monospace" },

  badge: {
    alignSelf: "flex-start", backgroundColor: "#DCFCE7",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  badgeText: { color: "#166534", fontSize: 10, fontWeight: "800" },

  verifiedBadge: {
    alignSelf: "flex-start", backgroundColor: "#EFF6FF",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  verifiedText: { color: "#1D4ED8", fontSize: 10, fontWeight: "800" },

  urgentBadge: {
    backgroundColor: G.urgent, paddingHorizontal: 6,
    paddingVertical: 2, borderRadius: 5,
  },
  urgentText: { color: G.white, fontSize: 9, fontWeight: "900" },

  vulnerableBadge: {
    backgroundColor: "#FEF3C7", paddingHorizontal: 6,
    paddingVertical: 2, borderRadius: 5,
  },
  vulnerableText: { color: "#92400E", fontSize: 9, fontWeight: "900" },

  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#1A1A1A", marginTop: 10 },
  emptySub:   { fontSize: 13, color: G.sub, marginTop: 4, textAlign: "center" },
  errorText:  { fontSize: 15, fontWeight: "700", color: G.urgent, marginBottom: 6 },
  errorSub:   { fontSize: 13, color: G.sub },
});