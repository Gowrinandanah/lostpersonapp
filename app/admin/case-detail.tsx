// app/admin/case-detail.tsx

import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, TouchableOpacity, Alert, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../src/firebase/firebaseConfig";
import {
  verifyCase, rejectCase, resolveCase,
} from "../../src/firebase/firestoreService";

const G = {
  primary: "#16A34A",
  danger: "#DC2626",
  warning: "#F59E0B",
  bg: "#F3F4F6",
  white: "#FFFFFF",
  border: "#E5E7EB",
  text: "#16A34A",
  sub: "#6B7280",
};

export default function CaseDetail() {
  const { id } = useLocalSearchParams();

  const [caseData, setCaseData] = useState<any>(null);
  const [sightings, setSightings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const ref = doc(db, "missingPersons", id as string);
      const snap = await getDoc(ref);

      if (!snap.exists()) return;

      const data: any = { id: snap.id, ...snap.data() };
      setCaseData(data);

      // sightings
      const q = query(
        collection(db, "sightings"),
        where("caseId", "==", id)
      );

      const res = await getDocs(q);
      const list: any[] = [];
      res.forEach((d) => list.push({ id: d.id, ...d.data() }));

      setSightings(list);
    } catch (e) {
      console.log(e);
    }

    setLoading(false);
  };

  // ACTIONS
  const confirmAction = (title: string, action: () => Promise<void>) => {
    Alert.alert(title, "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          setActing(true);
          await action();
          setActing(false);
          router.back();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={S.center}>
        <ActivityIndicator size="large" color={G.primary} />
      </SafeAreaView>
    );
  }

  if (!caseData) {
    return (
      <SafeAreaView style={S.center}>
        <Text>Case not found</Text>
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
        <Text style={S.title}>Admin Case Review</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* IMAGE */}
        {caseData.photoUrl && (
          <Image source={{ uri: caseData.photoUrl }} style={S.image} />
        )}

        {/* TABLE */}
        <View style={S.table}>

          <Row label="Name" value={caseData.name} />
          <Row label="Age" value={caseData.age} />
          <Row label="Gender" value={caseData.gender} />
          <Row label="Height" value={caseData.height + " cm"} />
          <Row label="Complexion" value={caseData.complexion} />

          <Row label="Last Seen Location" value={caseData.lastSeenLocation} />
          <Row label="Last Seen Date" value={caseData.lastSeenDate} />

          <Row label="Clothing" value={caseData.clothingDescription} />
          <Row label="Description" value={caseData.description} />

          <Row label="Reported By" value={caseData.reportedByName} />
          <Row label="Contact Person" value={caseData.contactName} />
          <Row label="Phone" value={caseData.contactPhone} />

          <Row label="Status" value={caseData.status?.toUpperCase()} />

        </View>

        {/* SIGHTINGS TABLE */}
        <View style={{ marginTop: 20 }}>
          <Text style={S.section}>Sightings ({sightings.length})</Text>

          {sightings.length === 0 ? (
            <Text style={S.empty}>No sightings reported</Text>
          ) : (
            sightings.map((s) => (
              <View key={s.id} style={S.sightingRow}>
                <Text style={S.sightingText}>{s.location}</Text>
                {s.note && <Text style={S.sightingSub}>{s.note}</Text>}
              </View>
            ))
          )}
        </View>

        {/* ACTION BUTTONS */}
        {acting ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : (
          <View style={S.actions}>

            {!caseData.verified && (
              <>
                <Btn text="VERIFY" color={G.primary} onPress={() =>
                  confirmAction("Verify Case", () => verifyCase(id as string))
                } />

                <Btn text="REJECT" color={G.danger} onPress={() =>
                  confirmAction("Reject Case", () => rejectCase(id as string))
                } />
              </>
            )}

            {caseData.status === "active" && (
              <Btn text="MARK RESOLVED" color={G.warning} onPress={() =>
                confirmAction("Resolve Case", () => resolveCase(id as string))
              } />
            )}

          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- SMALL COMPONENTS ---------- */

const Row = ({ label, value }: any) => (
  <View style={S.row}>
    <Text style={S.label}>{label}</Text>
    <Text style={S.value}>{value || "-"}</Text>
  </View>
);

const Btn = ({ text, color, onPress }: any) => (
  <TouchableOpacity style={[S.btn, { backgroundColor: color }]} onPress={onPress}>
    <Text style={S.btnText}>{text}</Text>
  </TouchableOpacity>
);

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
  title: { color: "#fff", fontWeight: "800", fontSize: 16 },

  image: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    marginBottom: 16,
  },

  table: {
    backgroundColor: G.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: G.border,
    overflow: "hidden",
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: G.border,
  },

  label: {
    fontWeight: "700",
    color: G.text,
    width: "45%",
  },

  value: {
    color: G.sub,
    width: "55%",
    textAlign: "right",
  },

  section: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },

  empty: {
    color: G.sub,
    fontSize: 13,
  },

  sightingRow: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },

  sightingText: {
    fontWeight: "600",
  },

  sightingSub: {
    color: G.sub,
    fontSize: 12,
  },

  actions: {
    marginTop: 20,
    gap: 10,
  },

  btn: {
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },

  btnText: {
    color: "#fff",
    fontWeight: "800",
  },
});