// app/admin/user-detail.tsx

import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ActivityIndicator,
  ScrollView, TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import {
  collection, query, where, getDocs, orderBy,
} from "firebase/firestore";
import { db } from "../../src/firebase/firebaseConfig";
import { SafeAreaView } from "react-native-safe-area-context";

/* ✅ TYPES */
type MissingPerson = {
  id: string;
  name: string;
  age: number;
  gender: string;
  lastSeenLocation: string;
  status: string;
};

type Sighting = {
  id: string;
  caseId: string;
  sightingLocation: string;
  sightingDate: string;
  description: string;
};

export default function UserDetail() {
  const { uid } = useLocalSearchParams();

  const [cases, setCases] = useState<MissingPerson[]>([]);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"cases" | "sightings">("cases");

  useEffect(() => {
    if (!uid) return;

    const load = async () => {
      const caseSnap = await getDocs(
        query(
          collection(db, "missingPersons"),
          where("reportedBy", "==", uid),
          orderBy("createdAt", "desc")
        )
      );

      const userCases: MissingPerson[] = caseSnap.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<MissingPerson, "id">),
      }));

      setCases(userCases);

      let all: Sighting[] = [];

      for (const c of userCases) {
        const sightSnap = await getDocs(
          query(
            collection(db, "sightings"),
            where("caseId", "==", c.id)
          )
        );

        const s: Sighting[] = sightSnap.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as Omit<Sighting, "id">),
        }));

        all = [...all, ...s];
      }

      setSightings(all);
      setLoading(false);
    };

    load();
  }, [uid]);

  if (loading) {
    return (
      <View style={S.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={S.root}>

      {/* 🔝 HEADER */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={S.back}>‹ Back</Text>
        </TouchableOpacity>

        <Text style={S.title}>User Activity</Text>

        <View style={{ width: 60 }} />
      </View>

      {/* 🔁 TOGGLE */}
      <View style={S.tabs}>
        <TouchableOpacity
          style={[S.tab, tab === "cases" && S.activeTab]}
          onPress={() => setTab("cases")}
        >
          <Text style={tab === "cases" ? S.activeText : S.tabText}>
            Cases ({cases.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[S.tab, tab === "sightings" && S.activeTab]}
          onPress={() => setTab("sightings")}
        >
          <Text style={tab === "sightings" ? S.activeText : S.tabText}>
            Sightings ({sightings.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* 📄 CONTENT */}
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* 📋 CASES */}
        {tab === "cases" && (
          <>
            {cases.map(c => (
              <View key={c.id} style={S.card}>
                <Text style={S.name}>{c.name}</Text>

                <Text style={S.sub}>
                  {c.gender} • {c.age}
                </Text>

                <Text style={S.info}>
                  📍 {c.lastSeenLocation}
                </Text>

                <Text style={S.status}>
                  Status: {c.status}
                </Text>
              </View>
            ))}

            {cases.length === 0 && (
              <Text style={S.empty}>No cases found</Text>
            )}
          </>
        )}

        {/* 👁 SIGHTINGS */}
        {tab === "sightings" && (
          <>
            {sightings.map(s => (
              <View key={s.id} style={S.card}>
                <Text style={S.info}>
                  📍 {s.sightingLocation}
                </Text>

                <Text style={S.sub}>
                  🕐 {s.sightingDate}
                </Text>

                <Text style={S.desc}>
                  {s.description}
                </Text>
              </View>
            ))}

            {sightings.length === 0 && (
              <Text style={S.empty}>No sightings found</Text>
            )}
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

/* 🎨 STYLES */

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F3F4F6" },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#16A34A",
    padding: 16,
  },

  back: {
    color: "#fff",
    fontSize: 16,
  },

  title: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },

  tabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
  },

  tab: {
    flex: 1,
    padding: 12,
    alignItems: "center",
  },

  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: "#16A34A",
  },

  tabText: {
    color: "#6B7280",
    fontWeight: "600",
  },

  activeText: {
    color: "#16A34A",
    fontWeight: "800",
  },

  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },

  name: {
    fontWeight: "800",
    fontSize: 15,
  },

  sub: {
    color: "#6B7280",
    marginTop: 4,
  },

  info: {
    marginTop: 6,
  },

  status: {
    marginTop: 6,
    fontWeight: "600",
  },

  desc: {
    marginTop: 6,
    color: "#374151",
  },

  empty: {
    textAlign: "center",
    marginTop: 20,
    color: "#9CA3AF",
  },
});