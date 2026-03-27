import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { DocumentData } from "firebase/firestore";
import {
  getAllMissingPersons, verifyCase, rejectCase, resolveCase,
} from "../../src/firebase/firestoreService";
import { auth } from "../../src/firebase/firebaseConfig";

const ADMIN_EMAILS = ["your@email.com"]; // ← replace with your actual email

const G = {
  primary: "#2ECC71", dark: "#27AE60", light: "#EAFAF1", border: "#D5F5E3",
  white: "#FFFFFF", bg: "#F7F8FA", text: "#1A1A1A", sub: "#666666",
  muted: "#AAAAAA", urgent: "#E74C3C", orange: "#E67E22",
};

type FilterType = "pending" | "active" | "resolved" | "rejected";

export default function VerifyCase() {
  const [cases,   setCases]   = useState<DocumentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<FilterType>("pending");
  const [acting,  setActing]  = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.replace("/(auth)/login");
        return;
      }

      const email = (user.email ?? "").toLowerCase();
      const isAdmin = ADMIN_EMAILS.includes(email);

      console.log("VERIFY PAGE EMAIL:", email);
      console.log("IS ADMIN:", isAdmin);

      if (!isAdmin) {
        Alert.alert("Access Denied", "You are not an admin.");
        router.replace("/alerts");
        return;
      }

      // ✅ Only load data AFTER admin confirmed
      const unsub = getAllMissingPersons((data) => {
        setCases(data);
        setLoading(false);
      });

      setChecking(false);

      return () => unsub();
    });

    return unsubscribe;
  }, []);

  const filtered = cases.filter((c) => {
    if (filter === "pending")  return !c.verified && c.status !== "rejected" && c.status !== "resolved";
    if (filter === "active")   return c.status === "active" && c.verified;
    if (filter === "resolved") return c.status === "resolved";
    if (filter === "rejected") return c.status === "rejected";
    return true;
  });

  const handleVerify = (id: string, name: string) => {
    Alert.alert("Verify Case", `Approve "${name}" as active?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Verify", onPress: async () => { setActing(id); await verifyCase(id); setActing(null); } },
    ]);
  };

  const handleReject = (id: string, name: string) => {
    Alert.alert("Reject Case", `Reject "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Reject", style: "destructive", onPress: async () => { setActing(id); await rejectCase(id); setActing(null); } },
    ]);
  };

  const handleResolve = (id: string, name: string) => {
    Alert.alert("Mark Resolved", `Mark "${name}" as found?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Resolve", onPress: async () => { setActing(id); await resolveCase(id); setActing(null); } },
    ]);
  };

  const pendingCount  = cases.filter((c) => !c.verified && c.status !== "rejected" && c.status !== "resolved").length;
  const activeCount   = cases.filter((c) => c.status === "active" && c.verified).length;
  const resolvedCount = cases.filter((c) => c.status === "resolved").length;
  const rejectedCount = cases.filter((c) => c.status === "rejected").length;

  const FilterChip = ({ label, value, count }: { label: string; value: FilterType; count: number }) => (
    <TouchableOpacity
      style={[S.chip, filter === value && S.chipActive]}
      onPress={() => setFilter(value)}
    >
      <Text style={[S.chipText, filter === value && S.chipTextActive]}>
        {label} ({count})
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={S.root}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
          <Text style={{ color: G.white, fontSize: 16, fontWeight: "700" }}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle}>Verify Cases</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={S.chips}>
        <FilterChip label="Pending"  value="pending"  count={pendingCount} />
        <FilterChip label="Active"   value="active"   count={activeCount} />
        <FilterChip label="Resolved" value="resolved" count={resolvedCount} />
        <FilterChip label="Rejected" value="rejected" count={rejectedCount} />
      </View>

      {loading ? (
        <View style={S.center}><ActivityIndicator size="large" color={G.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={S.center}>
          <Text style={{ fontSize: 40, marginBottom: 10 }}>✅</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: G.text }}>Nothing here</Text>
          <Text style={{ fontSize: 13, color: G.sub, marginTop: 4 }}>No cases in this category</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <View style={S.card}>
              <View style={S.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={S.cardName}>{item.name || "Unknown"}</Text>
                  <Text style={S.cardMeta}>Age {item.age} · {item.gender} · {item.lastSeenLocation}</Text>
                </View>
                <View style={[S.statusBadge, {
                  backgroundColor:
                    item.status === "active"   ? G.light :
                    item.status === "resolved" ? "#EEF" :
                    item.status === "rejected" ? "#FDECEA" : "#FFF3E0",
                }]}>
                  <Text style={[S.statusText, {
                    color:
                      item.status === "active"   ? G.dark :
                      item.status === "resolved" ? "#5B5BD6" :
                      item.status === "rejected" ? G.urgent : G.orange,
                  }]}>
                    {item.verified ? "✓ " : ""}{item.status?.toUpperCase()}
                  </Text>
                </View>
              </View>

              {item.description ? (
                <Text style={S.cardDesc} numberOfLines={2}>{item.description}</Text>
              ) : null}

              {acting === item.id ? (
                <ActivityIndicator color={G.primary} style={{ marginTop: 10 }} />
              ) : (
                <View style={S.actions}>
                  {filter === "pending" && (<>
                    <TouchableOpacity style={[S.actionBtn, { backgroundColor: G.primary }]} onPress={() => handleVerify(item.id, item.name)}>
                      <Text style={S.actionBtnText}>✓ Verify</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[S.actionBtn, { backgroundColor: G.urgent }]} onPress={() => handleReject(item.id, item.name)}>
                      <Text style={S.actionBtnText}>✕ Reject</Text>
                    </TouchableOpacity>
                  </>)}
                  {filter === "active" && (
                    <TouchableOpacity style={[S.actionBtn, { backgroundColor: G.sub }]} onPress={() => handleResolve(item.id, item.name)}>
                      <Text style={S.actionBtnText}>✓ Mark Resolved</Text>
                    </TouchableOpacity>
                  )}
                  {(filter === "resolved" || filter === "rejected") && (
                    <TouchableOpacity style={[S.actionBtn, { backgroundColor: G.orange }]} onPress={() => handleVerify(item.id, item.name)}>
                      <Text style={S.actionBtnText}>↺ Re-activate</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root:        { flex: 1, backgroundColor: G.bg },
  center:      { flex: 1, alignItems: "center", justifyContent: "center" },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: G.dark, paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:     { paddingHorizontal: 4, paddingVertical: 4 },
  headerTitle: { fontSize: 17, fontWeight: "800", color: G.white },

  chips:         { flexDirection: "row", padding: 12, gap: 8, backgroundColor: G.white, borderBottomWidth: 1, borderBottomColor: "#EEEEEE" },
  chip:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: "#DDDDDD", backgroundColor: G.white },
  chipActive:    { backgroundColor: G.light, borderColor: G.dark },
  chipText:      { fontSize: 11, fontWeight: "600", color: G.sub },
  chipTextActive:{ color: G.dark },

  card:       { backgroundColor: G.white, borderRadius: 14, padding: 14, elevation: 2, borderWidth: 1, borderColor: "#F0F0F0" },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 6 },
  cardName:   { fontSize: 15, fontWeight: "800", color: G.text, marginBottom: 3 },
  cardMeta:   { fontSize: 12, color: G.sub },
  cardDesc:   { fontSize: 13, color: G.sub, marginBottom: 8, lineHeight: 18 },

  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText:  { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },

  actions:      { flexDirection: "row", gap: 8, marginTop: 10 },
  actionBtn:    { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center" },
  actionBtnText:{ color: G.white, fontSize: 13, fontWeight: "700" },
});