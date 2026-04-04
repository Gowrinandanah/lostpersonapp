import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { DocumentData } from "firebase/firestore";
import {
  getAllCasesForAdmin, rejectCase, resolveCase,
} from "../../src/firebase/firestoreService";
import { GeofencingService } from "../../src/services/geofencingService";
import { verifyAndNotify } from "../../src/features/alerts/alertsController";

const G = {
  primary: "#2ECC71",
  dark: "#27AE60",
  light: "#ECFDF5",
  border: "#E5E7EB",
  white: "#FFFFFF",
  bg: "#F4F6F8",
  text: "#111827",
  sub: "#6B7280",
  muted: "#9CA3AF",
  urgent: "#E74C3C",
  orange: "#F39C12",
};

type FilterType = "pending" | "active" | "resolved" | "rejected";

export default function VerifyCase() {
  const [cases, setCases] = useState<DocumentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("pending");
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    const unsub = getAllCasesForAdmin((data) => {
      setCases(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = cases.filter((c) => {
    if (filter === "pending") {
      return c.verified !== true && c.status !== "resolved" && c.status !== "rejected";
    }
    if (filter === "active") {
      return c.verified === true && c.status !== "resolved";
    }
    if (filter === "resolved") {
      return c.status === "resolved";
    }
    if (filter === "rejected") {
      return c.status === "rejected";
    }
    return true;
  });

  const handleVerify = async (id: string, name: string, caseData: any) => {
    Alert.alert("Verify Case", `Approve "${name}" and send geofence alerts?`, [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Verify", 
        onPress: async () => { 
          setActing(id); 
          try {
            // This will trigger geofence setup and notifications
            await verifyAndNotify({
              id,
              name: caseData.name,
              age: caseData.age,
              gender: caseData.gender,
              lastSeenLocation: caseData.lastSeenLocation,
              lastSeenLat: caseData.lastSeenLat,
              lastSeenLng: caseData.lastSeenLng,
              isUrgentFlag: caseData.isUrgentFlag,
              isVulnerable: caseData.isVulnerable,
            });
            
            Alert.alert("Success", "Case verified and geofence alerts sent to nearby users!");
          } catch (error) {
            console.error("Verification error:", error);
            Alert.alert("Error", "Failed to verify case. Please try again.");
          }
          setActing(null); 
        } 
      },
    ]);
  };

  const handleReject = (id: string, name: string) =>
    Alert.alert("Reject Case", `Reject "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Reject", style: "destructive", onPress: async () => { setActing(id); await rejectCase(id); setActing(null); } },
    ]);

  const handleResolve = (id: string, name: string) =>
    Alert.alert("Mark Resolved", `Mark "${name}" as found? This will deactivate geofence.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Resolve", onPress: async () => { 
        setActing(id); 
        await resolveCase(id);
        await GeofencingService.deactivateGeofence(id);
        setActing(null); 
      }},
    ]);

  const FilterChip = ({ label, value }: any) => (
    <TouchableOpacity
      style={[S.chip, filter === value && S.chipActive]}
      onPress={() => setFilter(value)}
    >
      <Text style={[S.chipText, filter === value && S.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={S.root}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={S.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle}>Verify Cases</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={S.chips}>
        <FilterChip label="Pending" value="pending" />
        <FilterChip label="Active" value="active" />
        <FilterChip label="Resolved" value="resolved" />
        <FilterChip label="Rejected" value="rejected" />
      </View>

      {loading ? (
        <View style={S.center}>
          <ActivityIndicator size="large" color={G.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={S.center}>
          <Text style={S.empty}>No cases here</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={S.card}
              activeOpacity={0.9}
              onPress={() =>
                router.push({
                  pathname: "/admin/case-detail",
                  params: { id: item.id },
                })
              }
            >
              <View style={S.row}>
                <View style={{ flex: 1 }}>
                  <Text style={S.name}>{item.name}</Text>
                  <Text style={S.meta}>
                    {item.age} yrs · {item.gender}
                  </Text>
                  <Text style={S.location}>{item.lastSeenLocation}</Text>
                </View>
                <View style={S.badge}>
                  <Text style={S.badgeText}>
                    {item.status?.toUpperCase()}
                  </Text>
                </View>
              </View>

              {item.reportedBy && (
                <Text style={S.reported}>
                  Reported by: {item.reportedBy}
                </Text>
              )}

              {item.description && (
                <Text numberOfLines={2} style={S.desc}>
                  {item.description}
                </Text>
              )}

              {acting === item.id ? (
                <ActivityIndicator style={{ marginTop: 10 }} />
              ) : (
                <View style={S.actions}>
                  {filter === "pending" && (
                    <>
                      <TouchableOpacity
                        style={[S.btn, { backgroundColor: G.primary }]}
                        onPress={() => handleVerify(item.id, item.name, item)}
                      >
                        <Text style={S.btnText}>Verify & Alert</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[S.btn, { backgroundColor: G.urgent }]}
                        onPress={() => handleReject(item.id, item.name)}
                      >
                        <Text style={S.btnText}>Reject</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {filter === "active" && (
                    <TouchableOpacity
                      style={[S.btn, { backgroundColor: G.orange }]}
                      onPress={() => handleResolve(item.id, item.name)}
                    >
                      <Text style={S.btnText}>Mark Resolved</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: G.dark,
    padding: 16,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  back: { color: "#fff", fontSize: 16 },
  chips: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    backgroundColor: "#fff",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  chipActive: {
    backgroundColor: G.light,
    borderColor: G.primary,
  },
  chipText: { fontSize: 12, color: G.sub },
  chipTextActive: { color: G.primary },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    elevation: 3,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  name: { fontSize: 16, fontWeight: "800", color: G.text },
  meta: { fontSize: 12, color: G.sub },
  location: { fontSize: 12, color: G.muted, marginTop: 2 },
  badge: {
    backgroundColor: G.light,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { fontSize: 10, fontWeight: "700", color: G.primary },
  reported: { fontSize: 11, color: G.sub, marginTop: 6 },
  desc: { fontSize: 13, color: G.sub, marginTop: 6 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
  empty: { fontSize: 16, color: G.sub },
});