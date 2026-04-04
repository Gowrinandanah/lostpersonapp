// app/admin/dashboard.tsx

import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { auth } from "../../src/firebase/firebaseConfig";
import { getAllCasesForAdmin  } from "../../src/firebase/firestoreService";
import { DocumentData } from "firebase/firestore";

const G = {
  primary: "#2ECC71",
  dark: "#27AE60",
  light: "#EAFAF1",
  border: "#E5E7EB",
  white: "#FFFFFF",
  bg: "#F4F6F8",
  text: "#111827",
  sub: "#6B7280",
  muted: "#9CA3AF",
  urgent: "#E74C3C",
  orange: "#F39C12",
};

export default function AdminDashboard() {
  const [cases, setCases] = useState<DocumentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = getAllCasesForAdmin ((data) => {
      setCases(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={S.root}>
        <View style={S.center}>
          <ActivityIndicator size="large" color={G.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // 📊 Stats
  const total    = cases.length;
  const active   = cases.filter((c) => c.status === "active").length;
  const pending  = cases.filter((c) => c.verified === false && c.status !== "rejected").length;
  const resolved = cases.filter((c) => c.status === "resolved").length;

  const StatCard = ({ label, value, color }: any) => (
    <View style={[S.statCard, { borderTopColor: color }]}>
      <Text style={[S.statValue, { color }]}>{value}</Text>
      <Text style={S.statLabel}>{label}</Text>
    </View>
  );

  const NavCard = ({ icon, title, subtitle, onPress, badge }: any) => (
    <TouchableOpacity style={S.navCard} onPress={onPress} activeOpacity={0.85}>
      <View style={S.iconWrap}>
        <Text style={S.icon}>{icon}</Text>
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

      <Text style={S.arrow}>›</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={S.root}>
      
      {/* HEADER */}
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

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* OVERVIEW */}
        <Text style={S.sectionTitle}>OVERVIEW</Text>
        <View style={S.statsGrid}>
          <StatCard label="Total Cases" value={total} color={G.dark} />
          <StatCard label="Active" value={active} color={G.primary} />
          <StatCard label="Pending" value={pending} color={G.orange} />
          <StatCard label="Resolved" value={resolved} color={G.sub} />
        </View>

        {/* ACTIONS */}
        <Text style={S.sectionTitle}>ACTIONS</Text>
        <View style={S.navList}>

          <NavCard
            icon="📋"
            title="Verify Cases"
            subtitle="Review and approve or reject cases"
            badge={pending}
            onPress={() => router.push("/admin/verify-case")}
          />

          <NavCard
            icon="👥"
            title="Manage Users"
            subtitle="View users and their activity"
            onPress={() => router.push("/admin/users")}
          />

          <NavCard
            icon="✅"
            title="Approved Cases"
            subtitle="View verified cases & sightings"
            onPress={() => router.push("/admin/approved-cases")}
          />

        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: G.bg,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  /* HEADER */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: G.dark,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: G.white,
  },

  headerSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },

  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* SECTION */
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: G.sub,
    letterSpacing: 1.2,
    paddingHorizontal: 16,
    marginTop: 22,
    marginBottom: 12,
  },

  /* STATS */
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 12,
  },

  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: G.white,
    borderRadius: 14,
    padding: 16,
    borderTopWidth: 4,
    elevation: 3,
  },

  statValue: {
    fontSize: 30,
    fontWeight: "900",
  },

  statLabel: {
    fontSize: 12,
    color: G.sub,
    marginTop: 4,
    fontWeight: "600",
  },

  /* NAV */
  navList: {
    paddingHorizontal: 16,
    gap: 12,
  },

  navCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: G.white,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    elevation: 3,
  },

  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: G.light,
    alignItems: "center",
    justifyContent: "center",
  },

  icon: {
    fontSize: 24,
  },

  navTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: G.text,
  },

  navSub: {
    fontSize: 12,
    color: G.sub,
    marginTop: 2,
  },

  arrow: {
    fontSize: 20,
    color: G.muted,
  },

  badge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: G.urgent,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },

  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
  },
});