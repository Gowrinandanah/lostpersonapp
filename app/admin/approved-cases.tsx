// app/admin/approved-cases.tsx

import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, TouchableOpacity, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { DocumentData } from "firebase/firestore";
import { getAllCasesForAdmin } from "../../src/firebase/firestoreService";

const G = {
  primary: "#16A34A",
  bg: "#F3F4F6",
  white: "#FFFFFF",
  border: "#E5E7EB",
  text: "#16A34A",
  sub: "#6B7280",
};

export default function ApprovedCases() {
  const [cases, setCases] = useState<DocumentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = getAllCasesForAdmin((data) => {
      // ✅ Only APPROVED cases
      const approved = data.filter(
        (c: any) => c.verified === true && c.status === "active"
      );

      setCases(approved);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const openCase = (id: string) => {
    router.push({
      pathname: "/admin/case-detail",
      params: { id },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={S.center}>
        <ActivityIndicator size="large" color={G.primary} />
      </SafeAreaView>
    );
  }

  if (cases.length === 0) {
    return (
      <SafeAreaView style={S.center}>
        <Text style={{ fontSize: 40 }}>✅</Text>
        <Text style={{ fontWeight: "700", marginTop: 10 }}>
          No approved cases
        </Text>
        <Text style={{ color: G.sub, marginTop: 4 }}>
          Verified cases will appear here
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.root}>
      {/* HEADER */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={S.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={S.title}>Approved Cases</Text>
        <View style={{ width: 60 }} />
      </View>

      <FlatList
        data={cases}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={S.card} onPress={() => openCase(item.id)}>

            {/* IMAGE */}
            {item.photoUrl && (
              <Image source={{ uri: item.photoUrl }} style={S.image} />
            )}

            {/* INFO */}
            <View style={{ flex: 1 }}>
              <Text style={S.name}>{item.name}</Text>

              <Text style={S.meta}>
                {item.age} yrs • {item.gender}
              </Text>

              <Text style={S.meta} numberOfLines={1}>
                {item.lastSeenLocation}
              </Text>

              <View style={S.badge}>
                <Text style={S.badgeText}>ACTIVE</Text>
              </View>
            </View>

          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

/* ---------- STYLES ---------- */

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#16A34A",
    padding: 16,
  },

  back: { color: "#fff", fontSize: 16 },
  title: { color: "#fff", fontSize: 16, fontWeight: "800" },

  card: {
    flexDirection: "row",
    backgroundColor: G.white,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: G.border,
  },

  image: {
    width: 90,
    height: 90,
  },

  name: {
    fontSize: 15,
    fontWeight: "800",
    color: G.text,
  },

  meta: {
    fontSize: 12,
    color: G.sub,
    marginTop: 2,
  },

  badge: {
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  badgeText: {
    color: "#166534",
    fontSize: 10,
    fontWeight: "800",
  },
});