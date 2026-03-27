import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { auth } from "../../src/firebase/firebaseConfig";
import { getAllMissingPersons } from "../../src/firebase/firestoreService";
import { DocumentData } from "firebase/firestore";

const ADMIN_EMAILS = ["admin@gmail.com"]; // ← replace with your actual email

const G = {
  primary: "#2ECC71", dark: "#27AE60", light: "#EAFAF1", border: "#D5F5E3",
  white: "#FFFFFF", bg: "#F7F8FA", text: "#1A1A1A", sub: "#666666",
  muted: "#AAAAAA", urgent: "#E74C3C", orange: "#E67E22",
};

export default function AdminDashboard() {
  const [isAdmin,  setIsAdmin]  = useState(false);
  const [checking, setChecking] = useState(true);
  const [cases,    setCases]    = useState<DocumentData[]>([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { router.replace("/(auth)/login"); return; }
    if (!ADMIN_EMAILS.includes(user.email ?? "")) {
      Alert.alert("Access Denied", "You are not an admin.");
      router.replace("/alerts");
      return;
    }
    setIsAdmin(true);
    setChecking(false);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = getAllMissingPersons((data) => setCases(data));
    return () => unsub();
  }, [isAdmin]);

  if (checking) {
    return (
      <SafeAreaView style={S.root}>
        <View style={S.center}>
          <ActivityIndicator size="large" color={G.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const total    = cases.length;
  const active   = cases.filter((c) => c.status === "active").length;
  const pending  = cases.filter((c) => !c.verified && c.status !== "rejected" && c.status !== "resolved").length;
  const resolved = cases.filter((c) => c.status === "resolved").length;

  const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <View style={[S.statCard, { borderLeftColor: color }]}>
      <Text style={[S.statValue, { color }]}>{value}</Text>
      <Text style={S.statLabel}>{label}</Text>
    </View>
  );

  const NavCard = ({ icon, title, subtitle, onPress, badge }: {
    icon: string; title: string; subtitle: string; onPress: () => void; badge?: number;
  }) => (
    <TouchableOpacity style={S.navCard} onPress={onPress} activeOpacity={0.85}>
      <View style={S.navIconWrap}>
        <Text style={{ fontSize: 26 }}>{icon}</Text>
        {!!badge && (
          <View style={S.badge}>
            <Text style={S.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={S.navTitle}>{title}</Text>
        <Text style={S.navSub}>{subtitle}</Text>
      </View>
      <Text style={{ color: G.muted, fontSize: 20 }}>›</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={S.root}>
      <View style={S.header}>
        <View>
          <Text style={S.headerTitle}>Admin Dashboard</Text>
          <Text style={S.headerSub}>Lost Person Alert</Text>
        </View>
        <TouchableOpacity
          style={S.logoutBtn}
          onPress={() => auth.signOut().then(() => router.replace("/(auth)/login"))}
        >
          <Text style={{ fontSize: 18 }}>🚪</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={S.sectionTitle}>OVERVIEW</Text>
        <View style={S.statsGrid}>
          <StatCard label="Total Cases" value={total}    color={G.dark} />
          <StatCard label="Active"      value={active}   color={G.primary} />
          <StatCard label="Pending"     value={pending}  color={G.orange} />
          <StatCard label="Resolved"    value={resolved} color={G.sub} />
        </View>

        <Text style={S.sectionTitle}>MANAGE</Text>
        <View style={S.navList}>
          <NavCard
            icon="📋"
            title="Verify Cases"
            subtitle="Review and approve submitted reports"
            badge={pending}
            onPress={() => router.push("/admin/verify-case")}
          />
          <NavCard
            icon="👥"
            title="Manage Users"
            subtitle="View, ban or promote users"
            onPress={() => router.push("/admin/users")}
          />
        </View>

        <Text style={S.sectionTitle}>RECENT CASES</Text>
        {cases.slice(0, 5).map((c) => (
          <View key={c.id} style={S.caseRow}>
            <View style={[S.statusDot, {
              backgroundColor:
                c.status === "active"   ? G.primary :
                c.status === "resolved" ? G.sub :
                c.status === "rejected" ? G.urgent : G.orange,
            }]} />
            <View style={{ flex: 1 }}>
              <Text style={S.caseName}>{c.name || "Unknown"}</Text>
              <Text style={S.caseMeta}>
                {c.status?.toUpperCase()} · {c.verified ? "✓ Verified" : "⏳ Unverified"}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root:        { flex: 1, backgroundColor: G.bg },
  center:      { flex: 1, alignItems: "center", justifyContent: "center" },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: G.dark, paddingHorizontal: 20, paddingVertical: 18 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: G.white },
  headerSub:   { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  logoutBtn:   { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },

  sectionTitle: { fontSize: 11, fontWeight: "800", color: G.sub, letterSpacing: 1.2, paddingHorizontal: 16, marginTop: 22, marginBottom: 10 },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 10 },
  statCard:  { flex: 1, minWidth: "44%", backgroundColor: G.white, borderRadius: 12, padding: 14, borderLeftWidth: 4, elevation: 2 },
  statValue: { fontSize: 28, fontWeight: "900", marginBottom: 4 },
  statLabel: { fontSize: 12, color: G.sub, fontWeight: "600" },

  navList:     { paddingHorizontal: 16, gap: 10 },
  navCard:     { flexDirection: "row", alignItems: "center", backgroundColor: G.white, borderRadius: 14, padding: 16, gap: 14, elevation: 2, borderWidth: 1, borderColor: "#F0F0F0" },
  navIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: G.light, alignItems: "center", justifyContent: "center" },
  badge:       { position: "absolute", top: -4, right: -4, backgroundColor: G.urgent, borderRadius: 10, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText:   { color: G.white, fontSize: 10, fontWeight: "800" },
  navTitle:    { fontSize: 15, fontWeight: "700", color: G.text, marginBottom: 3 },
  navSub:      { fontSize: 12, color: G.sub },

  caseRow:   { flexDirection: "row", alignItems: "center", backgroundColor: G.white, marginHorizontal: 16, marginBottom: 8, borderRadius: 10, padding: 12, gap: 12, elevation: 1, borderWidth: 1, borderColor: "#F0F0F0" },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  caseName:  { fontSize: 14, fontWeight: "700", color: G.text },
  caseMeta:  { fontSize: 11, color: G.sub, marginTop: 2 },
});